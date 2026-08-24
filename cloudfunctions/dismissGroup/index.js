const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function removeAll(collectionName, where) {
  while (true) {
    const res = await db.collection(collectionName).where(where).limit(100).get()
    if (!res.data.length) break
    const ids = res.data.map(d => d._id)
    await db.collection(collectionName).where({ _id: _.in(ids) }).remove()
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const groupId = event.groupId || ''
  if (!groupId) {
    return { code: 1, message: '参数错误' }
  }

  try {
    const me = await db.collection('group_members')
      .where({ groupId, openid: OPENID })
      .get()
    if (me.data.length === 0 || me.data[0].role !== 'owner') {
      return { code: 3, message: '仅群主可解散群' }
    }

    await removeAll('group_members', { groupId })
    await removeAll('checkins', { groupId })
    await db.collection('groups').doc(groupId).remove()

    return { code: 0, message: 'ok', data: {} }
  } catch (err) {
    console.error('[dismissGroup]', err)
    return { code: 500, message: '解散失败，请重试' }
  }
}
