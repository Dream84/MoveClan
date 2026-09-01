const cloud = require('wx-server-sdk')
const cache = require('cache')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const cacheStore = new cache(15 * 1000)
const userCache = new Map()
const USER_CACHE_TTL = 60 * 1000

function withThumb(url, size) {
  if (!url || !(size > 0) || url.indexOf('http') !== 0) return url || ''
  const qIdx = url.indexOf('?')
  if (qIdx >= 0) {
    return url.slice(0, qIdx) + `?imageMogr2/thumbnail/${size}x` + '&' + url.slice(qIdx + 1)
  }
  return url + `?imageMogr2/thumbnail/${size}x`
}

async function loadUsers(openids) {
  const map = {}
  const miss = []
  openids.forEach(o => {
    if (!o) return
    const hit = userCache.get(o)
    if (hit && Date.now() - hit.ts < USER_CACHE_TTL) {
      map[o] = hit.user
    } else {
      miss.push(o)
    }
  })
  if (miss.length) {
    const res = await db.collection('users').where({ openid: _.in(miss) }).limit(1000).get()
    res.data.forEach(u => {
      if (u.openid) {
        map[u.openid] = u
        userCache.set(u.openid, { user: u, ts: Date.now() })
      }
    })
  }
  return map
}

async function resolveAll(fileIds) {
  const ids = Array.from(new Set(fileIds.filter(id => id && id.indexOf('cloud://') === 0)))
  const map = {}
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const res = await cloud.getTempFileURL({ fileList: chunk })
      ;(res.fileList || []).forEach(item => {
        if (item.tempFileURL) map[item.fileID] = item.tempFileURL
      })
    } catch (err) {
      console.error('[getTempFileURL]', err)
    }
  }
  return map
}

function sortComments(comments) {
  const list = (comments || []).slice()
  list.sort((a, b) => {
    const ta = a.createTime ? new Date(a.createTime).getTime() : 0
    const tb = b.createTime ? new Date(b.createTime).getTime() : 0
    return tb - ta
  })
  return list
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  const skip = Math.max(0, Number(event.skip) || 0)
  const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 5))
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }

  const cacheKey = `feed:${groupId}:${OPENID}:${skip}:${pageSize}`
  if (event.refresh !== true) {
    const hit = cacheStore.get(cacheKey)
    if (hit) {
      return { code: 0, message: 'ok', data: hit }
    }
  }

  try {
    const my = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .count()
    if (my.total === 0) {
      return { code: 3, message: '你不是该群成员' }
    }

    const ownerRes = await db.collection('groups').where({ _id: groupId }).get()
    const ownerOpenid = (ownerRes.data[0] && ownerRes.data[0].ownerOpenid) || ''

    const res = await db.collection('checkins')
      .where({ groupId })
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    const rows = res.data || []

    const authorOpenids = rows.map(c => c.openid)
    const userMap = await loadUsers(authorOpenids)

    // 点赞者（每条约前 9 位）
    const likerMap = {}
    const likerOpenids = []
    rows.forEach(c => {
      const ids = (c.likeOpenids || []).slice(0, 9)
      likerMap[c._id] = ids
      ids.forEach(o => {
        if (likerOpenids.indexOf(o) < 0) likerOpenids.push(o)
      })
    })
    const likerUserMap = await loadUsers(likerOpenids)

    // 合并换取临时链接：作者头像 + 打卡图 + 点赞者头像，一次批量
    const authorAvatarIds = authorOpenids.map(id => (userMap[id] && userMap[id].avatarUrl) || '').filter(Boolean)
    const imageIds = rows.map(c => c.imageFileId || '').filter(Boolean)
    const likerAvatarIds = likerOpenids.map(o => (likerUserMap[o] && likerUserMap[o].avatarUrl) || '').filter(Boolean)
    const authorSet = new Set(authorAvatarIds)
    const imageSet = new Set(imageIds)
    const likerSet = new Set(likerAvatarIds)

    const rawMap = await resolveAll(authorAvatarIds.concat(imageIds, likerAvatarIds))
    const avatarMap = {}
    const imageFullMap = {}
    const imageMap = {}
    const likerAvatarMap = {}
    Object.keys(rawMap).forEach(fid => {
      const raw = rawMap[fid]
      if (authorSet.has(fid)) avatarMap[fid] = withThumb(raw, 200)
      if (imageSet.has(fid)) {
        imageFullMap[fid] = raw
        imageMap[fid] = withThumb(raw, 320)
      }
      if (likerSet.has(fid)) likerAvatarMap[fid] = withThumb(raw, 60)
    })

    const list = rows.map(c => {
      const u = userMap[c.openid] || {}
      const comments = sortComments(c.comments).map(cm => ({
        ...cm,
        canDelete: cm.openid === OPENID || ownerOpenid === OPENID || c.openid === OPENID
      }))
      const likers = (likerMap[c._id] || []).map(o => {
        const lu = likerUserMap[o] || {}
        return {
          openid: o,
          nickName: lu.nickName || '用户',
          avatarUrl: likerAvatarMap[lu.avatarUrl] || ''
        }
      })
      return {
        _id: c._id,
        openid: c.openid,
        nickName: u.nickName || '用户',
        avatarUrl: avatarMap[u.avatarUrl] || '',
        checkDate: c.checkDate,
        createTime: c.createTime,
        sportType: c.sportType,
        duration: c.duration,
        calories: c.calories,
        count: c.count,
        remark: c.remark || '',
        imageUrl: imageMap[c.imageFileId] || '',
        imageFullUrl: imageFullMap[c.imageFileId] || imageMap[c.imageFileId] || '',
        likeCount: c.likeCount || 0,
        isLiked: (c.likeOpenids || []).indexOf(OPENID) >= 0,
        likers,
        commentCount: (c.comments || []).length,
        comments
      }
    })

    const data = {
      list,
      hasMore: rows.length === pageSize,
      skip
    }
    cacheStore.put(cacheKey, data)

    return { code: 0, message: 'ok', data }
  } catch (err) {
    console.error('[getFeed]', err)
    return { code: 500, message: '获取动态失败，请重试' }
  }
}
