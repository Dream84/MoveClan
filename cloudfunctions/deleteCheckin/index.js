const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const checkinId = event.checkinId || ''
  if (!checkinId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const res = await db.collection('checkins').doc(checkinId).get()
    const doc = res.data
    if (!doc || doc.openid !== OPENID) {
      return { code: 3, message: '无权删除该记录' }
    }

    await db.collection('checkins').doc(checkinId).remove()
    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    if (err && err.errCode === -502004) {
      return { code: 2, message: '记录不存在' }
    }
    console.error('[deleteCheckin]', err)
    return { code: 500, message: '删除失败，请重试' }
  }
}
