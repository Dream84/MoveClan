const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const inviteCode = (event.inviteCode || '').trim().toUpperCase()
  if (!/^[A-Z0-9]{6}$/.test(inviteCode)) {
    return { code: 1, message: '邀请码格式不正确（6位字母数字）' }
  }

  try {
    const groupRes = await db.collection('groups').where({ inviteCode }).get()
    if (groupRes.data.length === 0) {
      return { code: 2, message: '邀请码不存在' }
    }
    const group = groupRes.data[0]
    if (group.status !== 'active') {
      return { code: 4, message: '该群已解散' }
    }

    const exist = await db.collection('group_members')
      .where({ groupId: group._id, openid: OPENID })
      .count()
    if (exist.total > 0) {
      return { code: 4, message: '你已加入该群，无需重复加入' }
    }

    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    const user = userRes.data[0]

    await db.collection('group_members').add({
      data: {
        _openid: OPENID,
        groupId: group._id,
        openid: OPENID,
        role: 'member',
        joinTime: db.serverDate(),
        nickName: user ? user.nickName : '微信用户',
        avatarUrl: user ? user.avatarUrl : ''
      }
    })

    await db.collection('groups').doc(group._id).update({
      data: { memberCount: _.inc(1) }
    })

    return { code: 0, message: 'ok', data: { groupId: group._id, name: group.name } }
  } catch (err) {
    console.error('[joinGroup]', err)
    return { code: 500, message: '加入失败，请重试' }
  }
}
