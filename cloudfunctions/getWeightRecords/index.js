const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const limit = Math.min(500, Math.max(1, Number(event.limit) || 200))

  try {
    const res = await db.collection('weight_records')
      .where({ openid: OPENID })
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get()
    const list = (res.data || []).reverse().map(r => ({
      weightKg: r.weightKg,
      createTime: r.createTime
    }))
    return { code: 0, message: 'ok', data: { list } }
  } catch (err) {
    console.error('[getWeightRecords]', err)
    return { code: 500, message: '获取体重记录失败，请重试' }
  }
}
