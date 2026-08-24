const config = require('./config')
const api = require('./utils/api')

App({
  globalData: {
    openid: '',
    userInfo: null,
    currentGroup: null,
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
  },

  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
    this.globalData.openid = userInfo && userInfo.openid || ''
    this.globalData.currentGroup = null
  },

  login() {
    if (this._loginPromise) return this._loginPromise
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
  }
})
