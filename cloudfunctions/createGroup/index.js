const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CHAR_SET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const THEMES = ['running', 'fitness', 'general', 'cycling', 'swimming']

async function genInviteCode() {
  for (let i = 0; i < 5; i++) {
    let code = ''
    for (let j = 0; j < 6; j++) {
      code += CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)]
    }
    const exists = await db.collection('groups').where({ inviteCode: code }).count()
    if (exists.total === 0) return code
  }
  return null
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }
  const name = (event.name || '').trim().slice(0, 20)
  if (!name) {
    return { code: 1, message: '请输入群名称' }
  }
  const description = (event.description || '').trim().slice(0, 100)
  const sportTheme = THEMES.includes(event.sportTheme) ? event.sportTheme : 'general'

  try {
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    const user = userRes.data[0]
    const nickName = user ? user.nickName : '微信用户'
    const avatarUrl = user ? user.avatarUrl : ''

    const inviteCode = await genInviteCode()
    if (!inviteCode) {
      return { code: 500, message: '邀请码生成失败，请重试' }
    }

    const addRes = await db.collection('groups').add({
      data: {
        name,
        description,
        sportTheme,
        inviteCode,
        ownerOpenid: OPENID,
        memberCount: 1,
        createTime: db.serverDate(),
        status: 'active'
      }
    })

    await db.collection('group_members').add({
      data: {
        groupId: addRes._id,
        openid: OPENID,
        role: 'owner',
        joinTime: db.serverDate(),
        nickName,
        avatarUrl
      }
    })

    return { code: 0, message: 'ok', data: { _id: addRes._id, inviteCode } }
  } catch (err) {
    console.error('[createGroup]', err)
    return { code: 500, message: '创建失败，请重试' }
  }
}
