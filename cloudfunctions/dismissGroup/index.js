const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const me = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .get()
    if (me.data.length === 0 || me.data[0].role !== 'owner') {
      return { code: 3, message: '仅群主可解散群' }
    }

    await db.collection('groups').doc(groupId).update({
      data: { status: 'dismissed' }
    })

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    console.error('[dismissGroup]', err)
    return { code: 500, message: '解散失败，请重试' }
  }
}
