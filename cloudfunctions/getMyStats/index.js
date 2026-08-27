const cloud = require('wx-server-sdk')
const cache = require('cache')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const cacheStore = new cache(60 * 1000)

const ACHIEVEMENT_DAYS = [7, 14, 30]

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

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function diffDays(aStr, bStr) {
  const a = Date.parse(aStr + 'T00:00:00')
  const b = Date.parse(bStr + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

function calcStreak(allDates, today) {
  const set = new Set(allDates)
  let streak = 0
  let cursor = set.has(today) ? today : addDays(today, -1)
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }

  const sorted = Array.from(set).sort()
  let max = 0
  let run = 0
  let prev = null
  sorted.forEach(d => {
    if (prev && diffDays(prev, d) === 1) {
      run++
    } else {
      run = 1
    }
    if (run > max) max = run
    prev = d
  })

  return { streak, max }
}

async function fetchAll(where, fieldNames) {
  const all = []
  let offset = 0
  while (true) {
    const page = await db.collection('checkins')
      .where(where)
      .field(fieldNames)
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
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const groupId = event.groupId || ''
  const range = todayCN()

  const cacheKey = `stats:${OPENID}:${groupId || 'all'}`
  const cached = cacheStore.get(cacheKey)
  if (cached && event.refresh !== true) {
    return { code: 0, message: 'ok', data: cached }
  }

  try {
    if (groupId) {
      const member = await db.collection('group_members')
        .where({ groupId, openid: OPENID })
        .count()
      if (member.total === 0) {
        return { code: 3, message: '你不是该群成员' }
      }
    }
    const statsField = { groupId: true, openid: true, checkDate: true, duration: true, calories: true, count: true }

    const statsRows = await fetchAll({
      openid: OPENID,
      checkDate: _.gte(range.weekStart).and(_.lte(range.monthEnd))
    }, statsField)

    let weekCount = 0
    let weekCalories = 0
    let monthCount = 0
    let monthCalories = 0
    statsRows.forEach(c => {
      if (groupId && c.groupId !== groupId) return
      if (c.checkDate >= range.weekStart && c.checkDate <= range.weekEnd) {
        weekCount += c.count
        weekCalories += c.calories
      }
      monthCount += c.count
      monthCalories += c.calories
    })

    const allRows = await fetchAll({ openid: OPENID }, { openid: true, checkDate: true, count: true, calories: true })

    let totalCount = 0
    let totalCalories = 0
    const allDates = []
    allRows.forEach(c => {
      totalCount += c.count
      totalCalories += c.calories
      allDates.push(c.checkDate)
    })

    const streakInfo = calcStreak(allDates, range.today)

    const monthDaySet = {}
    allRows.forEach(c => {
      if (c.checkDate >= range.monthStart && c.checkDate <= range.monthEnd) {
        monthDaySet[c.checkDate] = (monthDaySet[c.checkDate] || 0) + c.count
      }
    })
    const monthDays = Object.keys(monthDaySet)
      .sort()
      .map(date => ({ date, count: monthDaySet[date] }))

    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    const user = userRes.data[0]
    const achieved = (user && user.achievedMilestones) || []
    const prevMax = (user && user.maxStreakDays) || 0

    const newMilestones = ACHIEVEMENT_DAYS.filter(m => streakInfo.streak >= m && achieved.indexOf(m) < 0)

    if ((streakInfo.streak > prevMax || newMilestones.length) && user) {
      const mergedMilestones = Array.from(new Set(achieved.concat(newMilestones)))
      await db.collection('users').doc(user._id).update({
        data: {
          maxStreakDays: Math.max(prevMax, streakInfo.streak),
          achievedMilestones: mergedMilestones
        }
      })
    }

    const data = {
      weekCount,
      weekCalories: Math.round(weekCalories),
      monthCount,
      monthCalories: Math.round(monthCalories),
      totalCount,
      totalCalories: Math.round(totalCalories),
      streakDays: streakInfo.streak,
      maxStreakDays: Math.max(prevMax, streakInfo.streak),
      monthDays,
      newMilestones,
      today: range.today
    }
    cacheStore.put(cacheKey, data)
    return { code: 0, message: 'ok', data }
  } catch (err) {
    console.error('[getMyStats]', err)
    return { code: 500, message: '获取统计数据失败，请重试' }
  }
}
