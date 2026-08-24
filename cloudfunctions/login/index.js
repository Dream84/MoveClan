const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const nickName = (event.nickName || '').toString().slice(0, 30)
  const avatarUrl = (event.avatarUrl || '').toString()

  try {
    const users = db.collection('users')
    const res = await users.where({ openid: OPENID }).get()

    if (res.data.length === 0) {
      const addRes = await users.add({
        data: {
          openid: OPENID,
          nickName: nickName || '微信用户',
          avatarUrl: avatarUrl || '',
          joinTime: db.serverDate(),
          defaultGroupId: '',
          maxStreakDays: 0,
          achievedMilestones: []
        }
      })
      return {
        code: 0,
        message: 'ok',
        data: {
          _id: addRes._id,
          openid: OPENID,
          nickName: nickName || '微信用户',
          avatarUrl: avatarUrl || '',
          isNew: true
        }
      }
    }

    const u = res.data[0]
    const updateData = {}
    if (nickName && nickName !== u.nickName) updateData.nickName = nickName
    if (avatarUrl && avatarUrl !== u.avatarUrl) updateData.avatarUrl = avatarUrl
    if (Object.keys(updateData).length) {
      await users.doc(u._id).update({ data: updateData })
    }
    return {
      code: 0,
      message: 'ok',
      data: Object.assign({}, u, updateData, { isNew: false })
    }
  } catch (err) {
    console.error('[login]', err)
    return { code: 500, message: '登录失败，请重试' }
  }
}
