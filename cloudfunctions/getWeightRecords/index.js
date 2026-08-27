const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const limit = Math.min(500, Math.max(1, Number(event.limit) || 200))

  let list = []
  try {
    const res = await db.collection('weight_records')
      .where({ openid: OPENID })
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get()
    list = (res.data || []).reverse().map(r => ({
      weightKg: r.weightKg,
      createTime: r.createTime
    }))
  } catch (err) {
    // 集合尚未创建时降级为空列表，避免前端报错
    if (!/(not exist|not found|COLLECTION_NOT_EXIST|collection not exists)/i.test(err.errMsg || err.message || '')) {
      throw err
    }
  }

  return { code: 0, message: 'ok', data: { list } }
}
