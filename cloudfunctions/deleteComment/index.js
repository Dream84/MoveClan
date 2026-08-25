const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const checkinId = event.checkinId || ''
  const commentId = event.commentId || ''
  if (!checkinId || !commentId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const res = await db.collection('checkins').doc(checkinId).get()
    const doc = res.data
    if (!doc) {
      return { code: 2, message: '动态不存在' }
    }

    const member = await db.collection('group_members')
      .where({ groupId: doc.groupId, openid: OPENID })
      .get()
    if (!member.data.length) {
      return { code: 3, message: '你不是该群成员' }
    }
    const isOwner = member.data[0].role === 'owner'

    const comments = doc.comments || []
    const target = comments.find(c => c.id === commentId)
    if (!target) {
      return { code: 2, message: '评论不存在' }
    }

    const canDelete = target.openid === OPENID || isOwner || doc.openid === OPENID
    if (!canDelete) {
      return { code: 3, message: '无权删除该评论' }
    }

    await db.collection('checkins').doc(checkinId).update({
      data: { comments: _.pull({ id: commentId }) }
    })

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    console.error('[deleteComment]', err)
    return { code: 500, message: '删除失败，请重试' }
  }
}
