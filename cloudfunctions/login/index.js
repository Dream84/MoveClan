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

function defaultName() {
  return '用户' + Math.random().toString(36).slice(2, 8)
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
  const rawHeight = Number(event.heightCm)
  const hasHeight = event.heightCm !== undefined && event.heightCm !== '' && rawHeight >= 50 && rawHeight <= 250

  try {
    const users = db.collection('users')
    const res = await users.where({ openid: OPENID }).get()

    if (res.data.length === 0) {
      const effectiveNick = nickName || defaultName()
      const effectiveAvatar = avatarUrl || ''
      const addRes = await users.add({
        data: {
          _openid: OPENID,
          openid: OPENID,
          nickName: effectiveNick,
          avatarUrl: effectiveAvatar,
          weightKg: hasWeight ? rawWeight : 50,
          heightCm: hasHeight ? rawHeight : 170,
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
          heightCm: hasHeight ? rawHeight : 170,
          isNew: true
        }
      }
    }

    const u = res.data[0]
    const updateData = {}
    if (nickName && nickName !== u.nickName) updateData.nickName = nickName
    if (avatarUrl && avatarUrl !== u.avatarUrl) updateData.avatarUrl = avatarUrl
    if (hasWeight && rawWeight !== u.weightKg) {
      updateData.weightKg = rawWeight
      await db.collection('weight_records').add({
        data: {
          _openid: OPENID,
          openid: OPENID,
          weightKg: rawWeight,
          createTime: db.serverDate()
        }
      })
    }
    if (!hasWeight && !(u.weightKg >= 20 && u.weightKg <= 300)) updateData.weightKg = 50
    if (hasHeight && rawHeight !== u.heightCm) updateData.heightCm = rawHeight
    if (!hasHeight && !(u.heightCm >= 50 && u.heightCm <= 250)) updateData.heightCm = 170

    // 老用户起始基线：已有有效体重但 weight_records 为空（且本次未改体重）→ 插入一条起始记录，保证趋势不断档
    if (!hasWeight && u.weightKg >= 20 && u.weightKg <= 300) {
      const cnt = await db.collection('weight_records').where({ openid: OPENID }).count()
      if (cnt.total === 0) {
        await db.collection('weight_records').add({
          data: {
            _openid: OPENID,
            openid: OPENID,
            weightKg: u.weightKg,
            createTime: db.serverDate()
          }
        })
      }
    }

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
