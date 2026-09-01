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
    if (config.MOCK_ENABLED) {
      const mock = require('./utils/mock')
      mock.install()
      return
    }
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
    if (!force && this._loginPromise) return this._loginPromise
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
    if (!this.globalData.openid) {
      this.globalData.myGroups = []
      return []
    }
    try {
      const groups = await api.call('getMyGroups', { refresh: !!force }, { loading: false })
      this.globalData.myGroups = groups || []
      return this.globalData.myGroups
    } catch (err) {
      console.error('[getMyGroups]', err)
      return this.globalData.myGroups || []
    }
  },

  invalidateMyGroups() {
    this.globalData.myGroups = null
  },

  throttleRefresh(showToast) {
    const now = Date.now()
    const WINDOW = 60 * 1000
    const LIMIT = 10
    this._refreshTimes = (this._refreshTimes || []).filter(t => now - t < WINDOW)
    if (this._refreshTimes.length >= LIMIT) {
      if (showToast) {
        wx.showToast({ title: '操作太频繁，请稍后再试', icon: 'none' })
      }
      return false
    }
    this._refreshTimes.push(now)
    return true
  }
})
