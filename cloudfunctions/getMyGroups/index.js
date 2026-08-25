const cloud = require('wx-server-sdk')
const cache = require('cache')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const cacheStore = new cache(60 * 1000)

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: 500, message: '获取用户身份失败' }
  }

  const cacheKey = `mygroups:${OPENID}`
  const cached = cacheStore.get(cacheKey)
  if (cached && event.refresh !== true) {
    return { code: 0, message: 'ok', data: cached }
  }

  try {
    const memRes = await db.collection('group_members')
      .where({ openid: OPENID })
      .limit(1000)
      .get()
    const mems = memRes.data || []
    if (!mems.length) {
      cacheStore.put(cacheKey, [])
      return { code: 0, message: 'ok', data: [] }
    }

    const ids = mems.map(m => m.groupId)
    const roleMap = {}
    mems.forEach(m => {
      roleMap[m.groupId] = m.role
    })

    const groupRes = await db.collection('groups')
      .where({ _id: _.in(ids), status: 'active' })
      .limit(1000)
      .get()

    const data = (groupRes.data || []).map(g => ({
      ...g,
      role: roleMap[g._id] || 'member'
    }))
    cacheStore.put(cacheKey, data)
    return { code: 0, message: 'ok', data }
  } catch (err) {
    console.error('[getMyGroups]', err)
    return { code: 500, message: '获取群组列表失败，请重试' }
  }
}
