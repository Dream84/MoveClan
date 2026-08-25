const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }
  const name = (event.name || '').trim().slice(0, 20)
  if (!name) {
    return { code: 1, message: '请输入群名称' }
  }
  const description = (event.description || '').trim().slice(0, 100)

  try {
    const me = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .get()
    if (me.data.length === 0 || me.data[0].role !== 'owner') {
      return { code: 3, message: '仅群主可修改群信息' }
    }

    const groupRes = await db.collection('groups').where({ _id: groupId }).get()
    if (groupRes.data.length === 0) {
      return { code: 2, message: '群不存在' }
    }

    await db.collection('groups').doc(groupId).update({
      data: {
        name,
        description,
        updateTime: db.serverDate()
      }
    })

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    console.error('[updateGroup]', err)
    return { code: 500, message: '修改失败，请重试' }
  }
}
