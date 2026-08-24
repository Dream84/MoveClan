const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, targetOpenid } = event
  if (!groupId || !targetOpenid) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const me = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .get()
    if (me.data.length === 0 || me.data[0].role !== 'owner') {
      return { code: 3, message: '仅群主可移除成员' }
    }

    const groupRes = await db.collection('groups').where({ _id: groupId }).get()
    if (groupRes.data.length === 0 || groupRes.data[0].status !== 'active') {
      return { code: 2, message: '群不存在或已解散' }
    }

    if (targetOpenid === OPENID) {
      return { code: 4, message: '不能移除自己' }
    }

    const target = await db.collection('group_members')
      .where({ groupId, openid: targetOpenid })
      .get()
    if (target.data.length) {
      await db.collection('group_members').doc(target.data[0]._id).remove()
      await db.collection('groups').doc(groupId).update({
        data: { memberCount: _.inc(-1) }
      })
    }

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    console.error('[removeMember]', err)
    return { code: 500, message: '移除失败，请重试' }
  }
}
