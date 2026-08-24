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
    const my = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .count()
    if (my.total === 0) {
      return { code: 3, message: '你不是该群成员' }
    }

    const groupRes = await db.collection('groups').where({ _id: groupId }).get()
    if (groupRes.data.length === 0 || groupRes.data[0].status !== 'active') {
      return { code: 2, message: '群不存在或已解散' }
    }

    const res = await db.collection('group_members').where({ groupId }).limit(1000).get()
    const members = res.data

    const openids = members.map(m => m.openid)
    const userMap = {}
    if (openids.length) {
      const userRes = await db.collection('users').where({ openid: _.in(openids) }).get()
      userRes.data.forEach(u => {
        if (u.openid) userMap[u.openid] = u
      })
    }
    const merged = members.map(m => ({
      ...m,
      nickName: (userMap[m.openid] && userMap[m.openid].nickName) || m.nickName,
      avatarUrl: (userMap[m.openid] && userMap[m.openid].avatarUrl) || m.avatarUrl
    }))
    merged.sort((a, b) => {
      if (a.role === b.role) return 0
      return a.role === 'owner' ? -1 : 1
    })

    return { code: 0, message: 'ok', data: { members: merged } }
  } catch (err) {
    console.error('[getGroupMembers]', err)
    return { code: 500, message: '获取成员列表失败' }
  }
}
