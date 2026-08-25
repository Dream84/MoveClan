const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const checkinId = event.checkinId || ''
  const content = (event.content || '').trim().slice(0, 200)
  if (!checkinId) {
    return { code: 1, message: '参数错误' }
  }
  if (!content) {
    return { code: 1, message: '请输入评论内容' }
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

    const check = await checkText(OPENID, content)
    if (check === false) {
      return { code: 4, message: '评论包含违规内容' }
    }

    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    const user = userRes.data[0]

    const comment = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      openid: OPENID,
      nickName: user ? user.nickName : '用户',
      avatarUrl: user ? user.avatarUrl : '',
      content,
      createTime: db.serverDate()
    }

    await db.collection('checkins').doc(checkinId).update({
      data: { comments: _.push(comment) }
    })

    return { code: 0, message: 'ok', data: { comment } }
  } catch (err) {
    console.error('[commentCheckin]', err)
    return { code: 500, message: '评论失败，请重试' }
  }
}
