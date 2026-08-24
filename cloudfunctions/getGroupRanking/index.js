const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
  return {
    today: s,
    weekStart: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
    weekEnd: `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`,
    monthStart: `${parts[0]}-${parts[1]}-01`,
    monthEnd: `${parts[0]}-${parts[1]}-${pad(lastDay)}`
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  const period = event.period === 'month' ? 'month' : 'week'
  const sortBy = ['count', 'calories', 'duration'].indexOf(event.sortBy) >= 0 ? event.sortBy : 'count'
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
          userMap[u.openid] = { nickName: u.nickName || '微信用户', avatarUrl: u.avatarUrl || '' }
        }
      })
    }

    const range = todayCN()
    const start = period === 'week' ? range.weekStart : range.monthStart
    const end = period === 'week' ? range.weekEnd : range.monthEnd

    const rows = await fetchAll({
      groupId,
      checkDate: _.gte(start).and(_.lte(end))
    })

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
      nickName: (userMap[openid] && userMap[openid].nickName) || '微信用户',
      avatarUrl: (userMap[openid] && userMap[openid].avatarUrl) || '',
      count: agg[openid].count,
      totalCalories: Math.round(agg[openid].totalCalories),
      totalDuration: agg[openid].totalDuration
    }))

    list.sort((a, b) => {
      if (b[sortBy] !== a[sortBy]) return b[sortBy] - a[sortBy]
      if (b.count !== a.count) return b.count - a.count
      return a.openid.localeCompare(b.openid)
    })

    const top = list.slice(0, 50)
    top.forEach((item, idx) => {
      item.rank = idx + 1
    })
    const myIndex = top.findIndex(t => t.openid === OPENID)
    const myRank = myIndex >= 0 ? top[myIndex].rank : 0

    return {
      code: 0,
      message: 'ok',
      data: {
        list: top,
        myRank,
        myData: myIndex >= 0 ? top[myIndex] : null,
        period,
        sortBy
      }
    }
  } catch (err) {
    console.error('[getGroupRanking]', err)
    return { code: 500, message: '获取排行失败，请重试' }
  }
}
