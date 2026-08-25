const config = require('./config')
const api = require('./utils/api')

const USER_CACHE_KEY = 'moveclan_user_cache'

App({
  globalData: {
    openid: '',
    userInfo: null,
    currentGroup: null,
    myGroups: null,
    subscribeTemplateId: config.SUBSCRIBE_TEMPLATE_ID,
    contentCheckEnabled: config.CONTENT_CHECK_ENABLED
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: config.CLOUD_ENV_ID,
      traceUser: true
    })

    const cached = wx.getStorageSync(USER_CACHE_KEY)
    if (cached && cached.openid) {
      this.setUserInfo(cached)
    }
    this.warmUp()
  },

  warmUp() {
    this.login(true).catch(err => {
      console.error('[warmUp]', err)
    })
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.openid = userInfo && userInfo.openid || ''
    this.globalData.currentGroup = null
    if (userInfo && userInfo.openid) {
      try {
        wx.setStorageSync(USER_CACHE_KEY, userInfo)
      } catch (e) {
        console.error('[setUserInfo:cache]', e)
      }
    }
  },

  login(force) {
    if (this._loginPromise) return this._loginPromise
    if (!force && this.globalData.userInfo && this.globalData.userInfo.openid) {
      return Promise.resolve(this.globalData.userInfo)
    }
    this._loginPromise = api.call('login', {}, { loading: false })
      .then(user => {
        this.setUserInfo(user)
        return user
      })
      .catch(err => {
        this._loginPromise = null
        throw err
      })
    return this._loginPromise
  },

  setCurrentGroup(group) {
    this.globalData.currentGroup = group
  },

  async getMyGroups(force) {
    if (!force && this.globalData.myGroups) {
      return this.globalData.myGroups
    }
    const me = this.globalData.openid
    if (!me) {
      this.globalData.myGroups = []
      return []
    }
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const memRes = await db.collection('group_members').where({ openid: me }).get()
      const mems = memRes.data || []
      if (!mems.length) {
        this.globalData.myGroups = []
        return []
      }
      const ids = mems.map(m => m.groupId)
      const roleMap = {}
      mems.forEach(m => {
        roleMap[m.groupId] = m.role
      })
      const groupRes = await db.collection('groups')
        .where({ _id: _.in(ids), status: 'active' })
        .get()
      this.globalData.myGroups = (groupRes.data || []).map(g => ({
        ...g,
        role: roleMap[g._id] || 'member'
      }))
      return this.globalData.myGroups
    } catch (err) {
      console.error('[getMyGroups]', err)
      return this.globalData.myGroups || []
    }
  },

  invalidateMyGroups() {
    this.globalData.myGroups = null
  }
})
