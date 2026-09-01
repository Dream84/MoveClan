const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const checkinId = event.checkinId || ''
  if (!checkinId) {
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
      .count()
    if (member.total === 0) {
      return { code: 3, message: '你不是该群成员' }
    }

    const liked = (doc.likeOpenids || []).indexOf(OPENID) >= 0
    if (liked) {
      await db.collection('checkins').doc(checkinId).update({
        data: {
          likeOpenids: _.pull(OPENID),
          likeCount: _.inc(-1)
        }
      })
    } else {
      await db.collection('checkins').doc(checkinId).update({
        data: {
          likeOpenids: _.addToSet(OPENID),
          likeCount: _.inc(1)
        }
      })
    }

    // 重读最新状态返回，避免并发 toggle 造成计数漂移
    const after = await db.collection('checkins').doc(checkinId).get()
    const doc2 = after.data
    const finalLiked = (doc2.likeOpenids || []).indexOf(OPENID) >= 0
    return {
      code: 0,
      message: 'ok',
      data: {
        liked: finalLiked,
        likeCount: (doc2.likeOpenids || []).length
      }
    }
  } catch (err) {
    console.error('[likeCheckin]', err)
    return { code: 500, message: '操作失败，请重试' }
  }
}
