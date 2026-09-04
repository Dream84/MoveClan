const cloud = require('wx-server-sdk')
const cache = require('cache')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const cacheStore = new cache(60 * 1000)

const SORT_FIELDS = { count: 'count', calories: 'totalCalories', duration: 'totalDuration' }

async function buildResponse(list, OPENID, period, sortBy) {
  const top = list.slice(0, 50)
  const withAvatars = await resolveAvatarUrls(top)
  withAvatars.forEach((item, idx) => {
    item.rank = idx + 1
  })
  const fullIndex = list.findIndex(t => t.openid === OPENID)
  const myRank = fullIndex >= 0 ? fullIndex + 1 : 0
  const myData = fullIndex >= 0 ? { ...list[fullIndex], rank: myRank } : null
  return {
    list: withAvatars,
    myRank,
    myData,
    period,
    sortBy
  }
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  const s = now.toISOString().slice(0, 10)
  const parts = s.split('-')
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const lastDay = new Date(Number(parts[0]), Number(parts[1]), 0).getDate()
  const lwMonday = new Date(monday)
  lwMonday.setDate(monday.getDate() - 7)
  const lwSunday = new Date(sunday)
  lwSunday.setDate(sunday.getDate() - 7)
  const lmStart = new Date(Number(parts[0]), Number(parts[1]) - 2, 1)
  const lmEnd = new Date(Number(parts[0]), Number(parts[1]) - 1, 0)
  return {
    today: s,
    weekStart: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
    weekEnd: `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`,
    lastWeekStart: `${lwMonday.getFullYear()}-${pad(lwMonday.getMonth() + 1)}-${pad(lwMonday.getDate())}`,
    lastWeekEnd: `${lwSunday.getFullYear()}-${pad(lwSunday.getMonth() + 1)}-${pad(lwSunday.getDate())}`,
    monthStart: `${parts[0]}-${parts[1]}-01`,
    monthEnd: `${parts[0]}-${parts[1]}-${pad(lastDay)}`,
    lastMonthStart: `${lmStart.getFullYear()}-${pad(lmStart.getMonth() + 1)}-01`,
    lastMonthEnd: `${lmEnd.getFullYear()}-${pad(lmEnd.getMonth() + 1)}-${pad(lmEnd.getDate())}`
  }
}

async function fetchAll(where) {
  const all = []
  let offset = 0
  while (true) {
    const page = await db.collection('checkins')
      .where(where)
      .field({ openid: true, checkDate: true, duration: true, calories: true, count: true })
      .skip(offset)
      .limit(100)
      .get()
    all.push.apply(all, page.data)
    if (page.data.length < 100) break
    offset += 100
  }
  return all
}

function withThumb(url) {
  if (!url || url.indexOf('http') !== 0) return url || ''
  const qIdx = url.indexOf('?')
  if (qIdx >= 0) {
    return url.slice(0, qIdx) + '?imageMogr2/thumbnail/200x' + '&' + url.slice(qIdx + 1)
  }
  return url + '?imageMogr2/thumbnail/200x'
}

async function resolveAvatarUrls(rows) {
  const fileIds = rows.map(r => r.avatarUrl).filter(id => id && id.indexOf('cloud://') === 0)
  const urlMap = {}
  for (let i = 0; i < fileIds.length; i += 50) {
    const chunk = fileIds.slice(i, i + 50)
    try {
      const res = await cloud.getTempFileURL({ fileList: chunk })
      ;(res.fileList || []).forEach(item => {
        if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
      })
    } catch (err) {
      console.error('[getTempFileURL]', err)
    }
  }
  return rows.map(r => ({
    ...r,
    avatarUrl: withThumb(urlMap[r.avatarUrl] || '')
  }))
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  const period = ['week', 'lastWeek', 'month', 'lastMonth', 'total'].indexOf(event.period) >= 0 ? event.period : 'week'
  const sortBy = ['count', 'calories', 'duration'].indexOf(event.sortBy) >= 0 ? event.sortBy : 'count'
  const sortField = SORT_FIELDS[sortBy]
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

    const cacheKey = `rank:${groupId}:${period}:${sortBy}`
    const cachedList = cacheStore.get(cacheKey)
    if (cachedList && event.refresh !== true) {
      return { code: 0, message: 'ok', data: await buildResponse(cachedList, OPENID, period, sortBy) }
    }

    const memberRes = await db.collection('group_members').where({ groupId }).limit(1000).get()
    const members = memberRes.data
    const openidSet = new Set(members.map(m => m.openid))
    const userMap = {}
    members.forEach(m => {
      userMap[m.openid] = { nickName: m.nickName, avatarUrl: m.avatarUrl }
    })

    const openids = members.map(m => m.openid)
    if (openids.length) {
      const userRes = await db.collection('users').where({ openid: _.in(openids) }).get()
      userRes.data.forEach(u => {
        if (u.openid) {
          userMap[u.openid] = { nickName: u.nickName || '用户', avatarUrl: u.avatarUrl || '' }
        }
      })
    }

    let rows
    if (period === 'total') {
      rows = await fetchAll({ groupId })
    } else {
      const RANGE_MAP = {
        week: ['weekStart', 'weekEnd'],
        lastWeek: ['lastWeekStart', 'lastWeekEnd'],
        month: ['monthStart', 'monthEnd'],
        lastMonth: ['lastMonthStart', 'lastMonthEnd']
      }
      const range = todayCN()
      const start = range[RANGE_MAP[period][0]]
      const end = range[RANGE_MAP[period][1]]
      rows = await fetchAll({
        groupId,
        checkDate: _.gte(start).and(_.lte(end))
      })
    }

    const agg = {}
    rows.forEach(c => {
      if (!openidSet.has(c.openid)) return
      if (!agg[c.openid]) {
        agg[c.openid] = { openid: c.openid, count: 0, totalCalories: 0, totalDuration: 0 }
      }
      agg[c.openid].count += c.count
      agg[c.openid].totalCalories += c.calories
      agg[c.openid].totalDuration += c.duration
    })

    const list = Object.keys(agg).map(openid => ({
      openid,
      nickName: (userMap[openid] && userMap[openid].nickName) || '用户',
      avatarUrl: (userMap[openid] && userMap[openid].avatarUrl) || '',
      count: agg[openid].count,
      totalCalories: Math.round(agg[openid].totalCalories),
      totalDuration: agg[openid].totalDuration
    }))

    // 排序：主指标优先；相同时按固定优先级破平：次数 > 卡路里 > 运动时长
    const TIE_PRIORITY = ['count', 'totalCalories', 'totalDuration']
    const order = [sortField].concat(TIE_PRIORITY.filter(f => f !== sortField))
    list.sort((a, b) => {
      for (let i = 0; i < order.length; i++) {
        const diff = b[order[i]] - a[order[i]]
        if (diff !== 0) return diff
      }
      return a.openid.localeCompare(b.openid)
    })

    cacheStore.put(cacheKey, list)
    return { code: 0, message: 'ok', data: await buildResponse(list, OPENID, period, sortBy) }
  } catch (err) {
    console.error('[getGroupRanking]', err)
    return { code: 500, message: '获取排行失败，请重试' }
  }
}
