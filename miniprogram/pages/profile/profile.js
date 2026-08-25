const api = require('../../utils/api')
const dateUtil = require('../../utils/date')

const app = getApp()

Page({
  data: {
    userInfo: null,
    avatarDisplay: '',
    stats: {
      totalCount: 0,
      totalCalories: 0,
      maxStreakDays: 0,
      weekCount: 0,
      monthCount: 0,
      weekCalories: 0,
      monthCalories: 0,
      streakDays: 0
    },
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth() + 1,
    calValue: [],
    statsLoaded: false,
    subscribeEnabled: false,
    showEdit: false,
    editAvatarUrl: '',
    editAvatarTemp: '',
    editNickName: '',
    editWeight: ''
  },

  onShow() {
    if (!app.throttleRefresh() && this.data.statsLoaded) return
    this.refresh()
  },

  onPullDownRefresh() {
    if (!app.throttleRefresh(true)) {
      wx.stopPullDownRefresh()
      return
    }
    this.refresh(true).finally(() => wx.stopPullDownRefresh())
  },

  async refresh(pull) {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      this.setData({
        userInfo: app.globalData.userInfo,
        avatarDisplay: api.avatarSrc(app.globalData.userInfo && app.globalData.userInfo.avatarUrl, 200),
        subscribeEnabled: wx.getStorageSync('subscribeEnabled') || false
      })
      await this.loadStats(!!pull)
    } catch (err) {
      console.error('[profile.refresh]', err)
    }
  },

  async loadStats(pull) {
    this.setData({ statsLoaded: false })
    try {
      const stats = await api.call('getMyStats', { refresh: !!pull }, { loading: false })
      this.setData({ stats, statsLoaded: true })
    } catch (err) {
      console.error('[profile.loadStats]', err)
      this.setData({ statsLoaded: true })
    }
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    await this.loadMonthDays(year, month)
  },

  async loadMonthDays(year, month) {
    const db = wx.cloud.database()
    const _ = db.command
    const range = dateUtil.getMonthRange(`${year}-${dateUtil.pad(month)}-01`)
    const countMap = {}
    let offset = 0
    while (true) {
      const res = await db.collection('checkins')
        .where({
          openid: app.globalData.openid,
          checkDate: _.gte(range.start).and(_.lte(range.end))
        })
        .field({ checkDate: true, count: true })
        .orderBy('checkDate', 'asc')
        .skip(offset)
        .limit(20)
        .get()
      ;(res.data || []).forEach(c => {
        countMap[c.checkDate] = (countMap[c.checkDate] || 0) + c.count
      })
      if (!res.data || res.data.length < 20) break
      offset += 20
    }
    const calValue = Object.keys(countMap)
      .sort()
      .map(date => ({ date, count: countMap[date] }))
    this.setData({ calYear: year, calMonth: month, calValue })
  },

  onCalMonthChange(e) {
    this.loadMonthDays(e.detail.year, e.detail.month)
  },

  openEdit() {
    const u = this.data.userInfo
    const weight = Number(u && u.weightKg)
    this.setData({
      showEdit: true,
      editAvatarUrl: (u && u.avatarUrl) || '',
      editAvatarTemp: '',
      editNickName: (u && u.nickName) || '',
      editWeight: weight >= 20 && weight <= 300 ? String(weight) : '50'
    })
  },

  noop() {},

  closeEdit() {
    this.setData({ showEdit: false })
  },

  onChooseAvatar(e) {
    this.setData({ editAvatarTemp: e.detail.avatarUrl })
  },

  onNickInput(e) {
    this.setData({ editNickName: e.detail.value })
  },

  onWeightInput(e) {
    this.setData({ editWeight: e.detail.value })
  },

  async saveProfile() {
    const nickName = this.data.editNickName.trim()
    if (!nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    const weightKg = Number(this.data.editWeight)
    if (this.data.editWeight && !(weightKg >= 20 && weightKg <= 300)) {
      wx.showToast({ title: '体重须为 20-300 公斤', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      let avatarUrl = this.data.editAvatarUrl
      if (this.data.editAvatarTemp) {
        const openid = app.globalData.openid
        const res = await api.uploadImage(this.data.editAvatarTemp, openid, null)
        avatarUrl = res.fileID
      }
      const user = await api.call('login', {
        nickName,
        avatarUrl,
        weightKg: weightKg > 0 ? weightKg : 0
      }, { loading: false })
      app.setUserInfo(user)
      this.setData({
        userInfo: user,
        avatarDisplay: api.avatarSrc(user.avatarUrl, 200),
        showEdit: false
      })
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      console.error('[profile.saveProfile]', err)
    } finally {
      wx.hideLoading()
    }
  },

  onSubSwitch(e) {
    const enabled = e.detail.value
    if (enabled) {
      const tid = app.globalData.subscribeTemplateId
      if (!tid) {
        wx.showToast({ title: '订阅消息模板未配置', icon: 'none' })
        this.setData({ subscribeEnabled: false })
        return
      }
      wx.requestSubscribeMessage({
        tmplIds: [tid],
        success: res => {
          const ok = res[tid] === 'accept'
          this.setData({ subscribeEnabled: ok })
          wx.setStorageSync('subscribeEnabled', ok)
          wx.showToast({ title: ok ? '已开启订阅' : '未授权订阅', icon: 'none' })
        },
        fail: () => {
          this.setData({ subscribeEnabled: false })
          wx.setStorageSync('subscribeEnabled', false)
        }
      })
    } else {
      this.setData({ subscribeEnabled: false })
      wx.setStorageSync('subscribeEnabled', false)
    }
  }
})
