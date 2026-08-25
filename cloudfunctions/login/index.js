const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function syncMembership(openid, nickName, avatarUrl) {
  const res = await db.collection('group_members').where({ openid }).limit(1000).get()
  for (const m of res.data) {
    await db.collection('group_members').doc(m._id).update({
      data: { nickName, avatarUrl }
    })
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const nickName = (event.nickName || '').toString().slice(0, 30)
  const avatarUrl = (event.avatarUrl || '').toString()
  const rawWeight = Number(event.weightKg)
  const hasWeight = event.weightKg !== undefined && event.weightKg !== '' && rawWeight >= 20 && rawWeight <= 300

  try {
    const users = db.collection('users')
    const res = await users.where({ openid: OPENID }).get()

    if (res.data.length === 0) {
      const effectiveNick = nickName || '微信用户'
      const effectiveAvatar = avatarUrl || ''
      const addRes = await users.add({
        data: {
          _openid: OPENID,
          openid: OPENID,
          nickName: effectiveNick,
          avatarUrl: effectiveAvatar,
          weightKg: hasWeight ? rawWeight : 50,
          joinTime: db.serverDate(),
          defaultGroupId: '',
          maxStreakDays: 0,
          achievedMilestones: []
        }
      })
      await syncMembership(OPENID, effectiveNick, effectiveAvatar)
      return {
        code: 0,
        message: 'ok',
        data: {
          _id: addRes._id,
          openid: OPENID,
          nickName: effectiveNick,
          avatarUrl: effectiveAvatar,
          weightKg: hasWeight ? rawWeight : 50,
          isNew: true
        }
      }
    }

    const u = res.data[0]
    const updateData = {}
    if (nickName && nickName !== u.nickName) updateData.nickName = nickName
    if (avatarUrl && avatarUrl !== u.avatarUrl) updateData.avatarUrl = avatarUrl
    if (hasWeight && rawWeight !== u.weightKg) updateData.weightKg = rawWeight
    if (!hasWeight && !(u.weightKg >= 20 && u.weightKg <= 300)) updateData.weightKg = 50
    const finalUser = Object.assign({}, u, updateData)
    if (Object.keys(updateData).length) {
      await users.doc(u._id).update({ data: updateData })
      await syncMembership(OPENID, finalUser.nickName, finalUser.avatarUrl)
    }
    return {
      code: 0,
      message: 'ok',
      data: Object.assign({}, finalUser, { isNew: false })
    }
  } catch (err) {
    console.error('[login]', err)
    return { code: 500, message: '登录失败，请重试' }
  }
}
