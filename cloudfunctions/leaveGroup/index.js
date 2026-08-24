const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
    if (me.data.length === 0) {
      return { code: 4, message: '你不是该群成员' }
    }

    const groupRes = await db.collection('groups').where({ _id: groupId }).get()
    const group = groupRes.data[0]

    if (me.data[0].role === 'owner') {
      await db.collection('groups').doc(groupId).update({
        data: { status: 'dismissed' }
      })
      return { code: 0, message: 'ok', data: { dismissed: true } }
    }

    await db.collection('group_members').doc(me.data[0]._id).remove()
    if (group && group.status === 'active') {
      await db.collection('groups').doc(groupId).update({
        data: { memberCount: _.inc(-1) }
      })
    }

    return { code: 0, message: 'ok', data: { dismissed: false } }
  } catch (err) {
    console.error('[leaveGroup]', err)
    return { code: 500, message: '退出失败，请重试' }
  }
}
