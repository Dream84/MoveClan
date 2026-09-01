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
    weightRecords: [],
    statsLoaded: false,
    trendMetric: 'weight',
    trendPeriod: 'day',
    trendAnchor: '',
    trendAnchorLabel: '',
    trendPickerFields: '',
    trendPickerEnd: '',
    canNext: true,
    showEdit: false,
    editAvatarUrl: '',
    editAvatarTemp: '',
    editNickName: '',
    editWeight: '',
    editHeight: ''
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
        trendAnchor: this.data.trendAnchor || this.currentAnchor(this.data.trendPeriod)
      })
      this.syncTrendNav()
      await this.loadStats(!!pull)
      await this.loadWeight()
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
    if (!this._calReqId) this._calReqId = 0
    const reqId = ++this._calReqId
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
    if (reqId !== this._calReqId) return
    const calValue = Object.keys(countMap)
      .sort()
      .map(date => ({ date, count: countMap[date] }))
    this.setData({ calYear: year, calMonth: month, calValue })
  },

  onCalMonthChange(e) {
    this.loadMonthDays(e.detail.year, e.detail.month)
  },

  async loadWeight() {
    try {
      const data = await api.call('getWeightRecords', {}, { loading: false })
      this.setData({ weightRecords: data.list || [] })
    } catch (err) {
      console.error('[profile.loadWeight]', err)
    }
  },

  // ---------- 趋势：时间导航 ----------

  currentAnchor(period) {
    const n = new Date()
    if (period === 'week') {
      const day = n.getDay() === 0 ? 7 : n.getDay()
      const m = new Date(n)
      m.setDate(n.getDate() - (day - 1))
      return dateUtil.formatDate(m)
    }
    if (period === 'month') return dateUtil.formatDate(n).slice(0, 7)
    if (period === 'year') return String(n.getFullYear())
    return dateUtil.formatDate(n)
  },

  shiftAnchor(period, anchor, delta) {
    if (period === 'day') {
      return dateUtil.addDays(anchor, delta)
    }
    if (period === 'week') {
      return dateUtil.addDays(anchor, delta * 7)
    }
    if (period === 'month') {
      const parts = anchor.split('-').map(Number)
      const d = new Date(parts[0], parts[1] - 1 + delta, 1)
      return `${d.getFullYear()}-${dateUtil.pad(d.getMonth() + 1)}`
    }
    return String(Number(anchor) + delta)
  },

  syncTrendNav() {
    const { trendPeriod, trendAnchor } = this.data
    const cur = this.currentAnchor(trendPeriod)
    const next = this.shiftAnchor(trendPeriod, trendAnchor, 1)
    let canNext = false
    if (trendPeriod === 'year') canNext = Number(next) <= Number(cur)
    else canNext = next <= cur
    const today = dateUtil.today()
    const fields = trendPeriod === 'month' ? 'month' : trendPeriod === 'year' ? 'year' : ''
    const end = trendPeriod === 'month' ? today.slice(0, 7) : today
    let anchorLabel = trendAnchor
    if (trendPeriod === 'year') anchorLabel = trendAnchor + '年'
    else if (trendPeriod === 'week') {
      anchorLabel = `${trendAnchor.slice(5).replace('-', '.')}~${dateUtil.addDays(trendAnchor, 6).slice(5).replace('-', '.')}`
    }
    this.setData({
      canNext,
      trendPickerFields: fields,
      trendPickerEnd: end,
      trendAnchorLabel: anchorLabel
    })
  },

  onMetricChange(e) {
    this.setData({ trendMetric: e.currentTarget.dataset.metric })
  },

  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ trendPeriod: period, trendAnchor: this.currentAnchor(period) })
    this.syncTrendNav()
  },

  onPrevAnchor() {
    this.setData({ trendAnchor: this.shiftAnchor(this.data.trendPeriod, this.data.trendAnchor, -1) })
    this.syncTrendNav()
  },

  onNextAnchor() {
    const { trendPeriod, trendAnchor } = this.data
    const next = this.shiftAnchor(trendPeriod, trendAnchor, 1)
    const cur = this.currentAnchor(trendPeriod)
    const blocked = trendPeriod === 'year'
      ? Number(next) > Number(cur)
      : next > cur
    if (blocked) return
    this.setData({ trendAnchor: next })
    this.syncTrendNav()
  },

  onAnchorChange(e) {
    let val = e.detail.value || ''
    if (this.data.trendPeriod === 'year') val = val.slice(0, 4)
    if (this.data.trendPeriod === 'month') val = val.slice(0, 7)
    if (this.data.trendPeriod === 'week') {
      const d = dateUtil.parseDate(val)
      if (!isNaN(d.getTime())) {
        const day = d.getDay() === 0 ? 7 : d.getDay()
        d.setDate(d.getDate() - (day - 1))
        val = dateUtil.formatDate(d)
      }
    }
    if (val) {
      this.setData({ trendAnchor: val })
      this.syncTrendNav()
    }
  },

  // ---------- 编辑资料 ----------

  openEdit() {
    const u = this.data.userInfo
    const weight = Number(u && u.weightKg)
    const height = Number(u && u.heightCm)
    this.setData({
      showEdit: true,
      editAvatarUrl: (u && u.avatarUrl) || '',
      editAvatarTemp: '',
      editNickName: (u && u.nickName) || '',
      editWeight: weight >= 20 && weight <= 300 ? String(weight) : '50',
      editHeight: height >= 50 && height <= 250 ? String(height) : '170'
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

  onHeightInput(e) {
    this.setData({ editHeight: e.detail.value })
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
    const heightCm = Number(this.data.editHeight)
    if (this.data.editHeight && !(heightCm >= 50 && heightCm <= 250)) {
      wx.showToast({ title: '身高须为 50-250 厘米', icon: 'none' })
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
        weightKg: weightKg > 0 ? weightKg : 0,
        heightCm: heightCm > 0 ? heightCm : 0
      }, { loading: false })
      app.setUserInfo(user)
      this.setData({
        userInfo: user,
        avatarDisplay: api.avatarSrc(user.avatarUrl, 200),
        showEdit: false
      })
      await this.loadWeight()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      console.error('[profile.saveProfile]', err)
    } finally {
      wx.hideLoading()
    }
  }
})
