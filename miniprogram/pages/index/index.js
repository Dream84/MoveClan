const api = require('../../utils/api')
const constants = require('../../utils/constants')
const dateUtil = require('../../utils/date')

const app = getApp()

const RECENT_PAGE_SIZE = 5

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function isDefaultProfile(userInfo) {
  if (!userInfo) return false
  const nick = userInfo.nickName || ''
  return !userInfo.avatarUrl || nick === '微信用户' || nick.indexOf('用户') === 0
}

Page({
  data: {
    userInfo: null,
    avatarDisplay: '',
    showProfileTip: false,
    greeting: '',
    groups: [],
    groupIndex: 0,
    currentGroup: null,
    selectedGroupId: '',
    weekStats: { weekCount: 0, weekCalories: 0, streakDays: 0 },
    recentCheckins: [],
    recentPage: 0,
    recentHasMore: false,
    recentLoading: false,
    loading: true
  },

  onShow() {
    if (!app.throttleRefresh() && !this.data.loading) return
    this.refresh()
  },

  onPullDownRefresh() {
    if (!app.throttleRefresh(true)) {
      wx.stopPullDownRefresh()
      return
    }
    this.refresh(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.recentHasMore && !this.data.recentLoading) {
      this.loadRecent(false)
    }
  },

  async refresh(pull) {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      this.setData({
        userInfo: app.globalData.userInfo,
        avatarDisplay: api.avatarSrc(app.globalData.userInfo && app.globalData.userInfo.avatarUrl, 200),
        showProfileTip: isDefaultProfile(app.globalData.userInfo),
        greeting: greeting()
      })
      await this.loadGroups(!!pull)
      await Promise.all([this.loadWeekStats(!!pull), this.loadRecent(true)])
    } catch (err) {
      console.error('[index.refresh]', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadGroups(force) {
    const groups = await app.getMyGroups(force)
    let groupIndex = 0
    if (this.data.selectedGroupId) {
      const idx = groups.findIndex(g => g._id === this.data.selectedGroupId)
      if (idx >= 0) groupIndex = idx
    }
    const currentGroup = groups[groupIndex] || null
    this.setData({
      groups,
      currentGroup,
      groupIndex,
      selectedGroupId: currentGroup ? currentGroup._id : ''
    })
    if (currentGroup) {
      app.setCurrentGroup(currentGroup)
    }
  },

  async loadWeekStats(force) {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ weekStats: { weekCount: 0, weekCalories: 0, streakDays: 0 } })
      return
    }
    const stats = await api.call('getMyStats', { groupId: group._id, refresh: !!force }, { loading: false })
    this.setData({
      weekStats: {
        weekCount: stats.weekCount,
        weekCalories: stats.weekCalories,
        streakDays: stats.streakDays
      }
    })
  },

  async loadRecent(reset) {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ recentCheckins: [], recentHasMore: false })
      return
    }
    const page = reset ? 0 : this.data.recentPage
    if (this.data.recentLoading && !reset) return
    const reqGroupId = group._id
    this.setData({ recentLoading: true })
    try {
      const db = wx.cloud.database()
      const res = await db.collection('checkins')
        .where({ groupId: reqGroupId, openid: app.globalData.openid })
        .orderBy('checkDate', 'desc')
        .skip(page * RECENT_PAGE_SIZE)
        .limit(RECENT_PAGE_SIZE)
        .get()
      if (!this.data.currentGroup || this.data.currentGroup._id !== reqGroupId) return
      const raw = res.data || []
      const rows = raw.map(c => ({
        _id: c._id,
        sportLabel: constants.sportLabel(c.sportType),
        duration: c.duration,
        calories: c.calories,
        checkDate: c.checkDate,
        showTime: dateUtil.formatDateTime(c.createTime),
        count: c.count,
        hasImage: !!c.imageFileId
      }))
      this.setData({
        recentCheckins: reset ? rows : this.data.recentCheckins.concat(rows),
        recentPage: page + 1,
        recentHasMore: raw.length === RECENT_PAGE_SIZE
      })
    } catch (err) {
      console.error('[index.loadRecent]', err)
    } finally {
      this.setData({ recentLoading: false })
    }
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    const group = this.data.groups[index]
    if (!group) return
    this.setData({ groupIndex: index, currentGroup: group, selectedGroupId: group._id })
    app.setCurrentGroup(group)
    this.loadWeekStats()
    this.loadRecent(true)
  },

  goCheckin() {
    if (!this.data.currentGroup) {
      wx.showToast({ title: '请先加入一个运动群', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/checkin-edit/checkin-edit' })
  },

  editCheckin(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({ url: '/pages/checkin-edit/checkin-edit?id=' + id })
    }
  },

  goGroups() {
    wx.switchTab({ url: '/pages/groups/groups' })
  },

  async useWechatProfile() {
    try {
      const { userInfo } = await wx.getUserProfile({ desc: '用于展示您的昵称和头像' })
      if (!userInfo || !userInfo.nickName) return
      wx.showLoading({ title: '设置中...', mask: true })
      let avatarUrl = ''
      if (userInfo.avatarUrl) {
        const up = await api.uploadImage(userInfo.avatarUrl, app.globalData.openid, null)
        avatarUrl = up.fileID
      }
      const u = app.globalData.userInfo || {}
      const user = await api.call('login', {
        nickName: userInfo.nickName,
        avatarUrl,
        weightKg: Number(u.weightKg) || 0,
        heightCm: Number(u.heightCm) || 0
      }, { loading: false })
      app.setUserInfo(user)
      this.setData({
        userInfo: user,
        avatarDisplay: api.avatarSrc(user.avatarUrl, 200),
        showProfileTip: false
      })
      wx.showToast({ title: '已使用微信资料', icon: 'success' })
    } catch (err) {
      console.error('[useWechatProfile]', err)
      if (err && err.errMsg && err.errMsg.indexOf('deny') >= 0) {
        wx.showToast({ title: '已取消授权', icon: 'none' })
      }
    } finally {
      wx.hideLoading()
    }
  }
})
