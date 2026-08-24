const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const groupRes = await db.collection('groups').where({ _id: groupId }).get()
    if (groupRes.data.length === 0) {
      return { code: 2, message: '群不存在' }
    }
    const group = groupRes.data[0]

    const memberRes = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .get()
    const isMember = memberRes.data.length > 0
    const role = isMember ? memberRes.data[0].role : ''

    return {
      code: 0,
      message: 'ok',
      data: {
        group,
        role,
        isMember,
        isOwner: role === 'owner'
      }
    }
  } catch (err) {
    console.error('[getGroupInfo]', err)
    return { code: 500, message: '获取失败' }
  }
}
