const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SPORT_TYPES = ['running', 'cycling', 'swimming', 'rope', 'aerobics', 'badminton', 'basketball', 'football', 'tabletennis', 'boxing', 'weightlifting', 'yoga', 'fitness', 'dance', 'hiking', 'climbing', 'stepper', 'ball', 'other']

function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.toISOString().slice(0, 10)
}

async function checkText(openid, content) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      scene: 2,
      openid,
      version: 2,
      content
    })
    if (res && res.errCode === 0 && res.result) {
      return res.result.suggest !== 'risky'
    }
    return false
  } catch (err) {
    console.error('[msgSecCheck]', err)
    return null
  }
}

async function checkImage(fileID) {
  try {
    const res = await cloud.openapi.security.imgSecCheck({
      media: { contentType: 'image', value: fileID }
    })
    return !!(res && res.errCode === 0)
  } catch (err) {
    console.error('[imgSecCheck]', err)
    return null
  }
}

function validate(event, today) {
  const groupId = (event.groupId || '').trim()
  const checkDate = (event.checkDate || '').trim()
  const sportType = (event.sportType || '').trim()
  const duration = Number(event.duration)
  const calories = Number(event.calories)
  const count = Number(event.count) || 1
  const remark = (event.remark || '').trim().slice(0, 200)
  const imageFileId = (event.imageFileId || '').trim()

  if (!groupId) return { error: '群组信息缺失' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkDate)) return { error: '日期格式不正确' }

  const min = Date.parse(today + 'T00:00:00') - 7 * 86400000
  const max = Date.parse(today + 'T00:00:00')
  const t = Date.parse(checkDate + 'T00:00:00')
  if (t < min || t > max) return { error: '仅支持今天及前 7 天的打卡' }

  if (!SPORT_TYPES.includes(sportType)) return { error: '请选择运动类型' }
  if (!(duration >= 1 && duration <= 1440)) return { error: '运动时长须为 1-1440 分钟' }
  if (!(calories >= 0 && calories <= 100000)) return { error: '卡路里数值不合法' }
  if (!(count >= 1 && count <= 100)) return { error: '打卡次数须为 1-100' }

  return { groupId, checkDate, sportType, duration, calories, count, remark, imageFileId }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }

  const checkinId = (event.checkinId || '').trim()
  if (!checkinId) {
    return { code: 1, message: '参数错误' }
  }

  const v = validate(event, todayCN())
  if (v.error) return { code: 1, message: v.error }

  try {
    const res = await db.collection('checkins').doc(checkinId).get()
    const doc = res.data
    if (!doc || doc.openid !== OPENID) {
      return { code: 3, message: '无权编辑该记录' }
    }

    const member = await db.collection('group_members')
      .where({ groupId: v.groupId, openid: OPENID })
      .count()
    if (member.total === 0) {
      return { code: 3, message: '你不是该群成员' }
    }

    if (v.remark) {
      const r = await checkText(OPENID, v.remark)
      if (r === false) return { code: 4, message: '备注包含违规内容' }
    }
    if (v.imageFileId) {
      const r = await checkImage(v.imageFileId)
      if (r === false) return { code: 4, message: '图片包含违规内容' }
    }

    await db.collection('checkins').doc(checkinId).update({
      data: {
        groupId: v.groupId,
        checkDate: v.checkDate,
        sportType: v.sportType,
        duration: v.duration,
        calories: v.calories,
        count: v.count,
        imageFileId: v.imageFileId,
        remark: v.remark,
        updateTime: db.serverDate()
      }
    })

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    if (err && (err.errCode === -502004 || err.errCode === -1)) {
      return { code: 2, message: '记录不存在' }
    }
    console.error('[updateCheckin]', err)
    return { code: 500, message: '更新失败，请重试' }
  }
}
