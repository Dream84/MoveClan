const api = require('../../utils/api')
const constants = require('../../utils/constants')

const app = getApp()

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 9) return '早上好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

Page({
  data: {
    userInfo: null,
    greeting: '',
    groups: [],
    groupIndex: 0,
    currentGroup: null,
    weekStats: { weekCount: 0, weekCalories: 0, streakDays: 0 },
    recentCheckins: [],
    loading: true
  },

  onShow() {
    this.refresh()
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh())
  },

  async refresh() {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      this.setData({
        userInfo: app.globalData.userInfo,
        greeting: greeting()
      })
      await this.loadGroups()
      await this.loadWeekStats()
      await this.loadRecent()
    } catch (err) {
      console.error('[index.refresh]', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadGroups() {
    const db = wx.cloud.database()
    const _ = db.command
    const me = app.globalData.openid
    const memRes = await db.collection('group_members').where({ openid: me }).get()
    const mems = memRes.data || []
    if (!mems.length) {
      this.setData({ groups: [], currentGroup: null, groupIndex: 0, recentCheckins: [] })
      return
    }
    const ids = mems.map(m => m.groupId)
    const groupRes = await db.collection('groups')
      .where({ _id: _.in(ids), status: 'active' })
      .get()
    const groups = groupRes.data || []
    const currentGroup = groups[0] || null
    this.setData({ groups, currentGroup, groupIndex: 0 })
  },

  async loadWeekStats() {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ weekStats: { weekCount: 0, weekCalories: 0, streakDays: 0 } })
      return
    }
    const stats = await api.call('getMyStats', { groupId: group._id }, { loading: false })
    this.setData({
      weekStats: {
        weekCount: stats.weekCount,
        weekCalories: stats.weekCalories,
        streakDays: stats.streakDays
      }
    })
  },

  async loadRecent() {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ recentCheckins: [] })
      return
    }
    const db = wx.cloud.database()
    const res = await db.collection('checkins')
      .where({ openid: app.globalData.openid })
      .orderBy('checkDate', 'desc')
      .limit(20)
      .get()
    const recent = (res.data || [])
      .filter(c => c.groupId === group._id)
      .slice(0, 5)
      .map(c => ({
        _id: c._id,
        sportLabel: constants.sportLabel(c.sportType),
        duration: c.duration,
        calories: c.calories,
        checkDate: c.checkDate,
        count: c.count,
        hasImage: !!c.imageFileId
      }))
    this.setData({ recentCheckins: recent })
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    const group = this.data.groups[index]
    if (!group) return
    this.setData({ groupIndex: index, currentGroup: group })
    this.loadWeekStats()
    this.loadRecent()
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
  }
})
