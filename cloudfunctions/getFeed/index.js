const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 20

function withThumb(url, size) {
  if (!url) return ''
  const qIdx = url.indexOf('?')
  if (qIdx >= 0) {
    return url.slice(0, qIdx) + `?imageMogr2/thumbnail/${size}x` + '&' + url.slice(qIdx + 1)
  }
  return url + `?imageMogr2/thumbnail/${size}x`
}

async function resolveFileUrls(fileIds, size) {
  const map = {}
  const ids = fileIds.filter(id => id && id.indexOf('cloud://') === 0)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const res = await cloud.getTempFileURL({ fileList: chunk })
      ;(res.fileList || []).forEach(item => {
        if (item.tempFileURL) map[item.fileID] = withThumb(item.tempFileURL, size)
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
  const page = Math.max(0, Number(event.page) || 0)
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const my = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .count()
    if (my.total === 0) {
      return { code: 3, message: '你不是该群成员' }
    }

    const res = await db.collection('checkins')
      .where({ groupId })
      .orderBy('createTime', 'desc')
      .skip(page * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get()
    const rows = res.data || []

    const openids = rows.map(c => c.openid)
    const userMap = {}
    if (openids.length) {
      const userRes = await db.collection('users').where({ openid: _.in(openids) }).get()
      userRes.data.forEach(u => {
        if (u.openid) userMap[u.openid] = u
      })
    }

    const avatarMap = await resolveFileUrls(
      openids.map(id => (userMap[id] && userMap[id].avatarUrl) || '').filter(Boolean),
      200
    )
    const imageMap = await resolveFileUrls(
      rows.map(c => c.imageFileId || '').filter(Boolean),
      320
    )

    const list = rows.map(c => {
      const u = userMap[c.openid] || {}
      const comments = sortComments(c.comments)
      return {
        _id: c._id,
        openid: c.openid,
        nickName: u.nickName || '微信用户',
        avatarUrl: avatarMap[u.avatarUrl] || u.avatarUrl || '',
        checkDate: c.checkDate,
        createTime: c.createTime,
        sportType: c.sportType,
        duration: c.duration,
        calories: c.calories,
        count: c.count,
        remark: c.remark || '',
        imageUrl: imageMap[c.imageFileId] || '',
        likeCount: c.likeCount || 0,
        isLiked: (c.likeOpenids || []).indexOf(OPENID) >= 0,
        commentCount: (c.comments || []).length,
        comments
      }
    })

    return {
      code: 0,
      message: 'ok',
      data: {
        list,
        hasMore: rows.length === PAGE_SIZE,
        page
      }
    }
  } catch (err) {
    console.error('[getFeed]', err)
    return { code: 500, message: '获取动态失败，请重试' }
  }
}
