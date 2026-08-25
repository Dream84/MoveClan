const api = require('../../utils/api')
const constants = require('../../utils/constants')

const app = getApp()

Page({
  data: {
    groups: [],
    groupIndex: 0,
    currentGroup: null,
    period: 'week',
    sortBy: 'count',
    sortLabels: ['打卡次数', '消耗卡路里', '运动时长'],
    periodLabels: ['本周', '本月'],
    list: [],
    myRank: 0,
    myData: null,
    myOpenid: '',
    loading: true
  },

  onShow() {
    this.init()
  },

  onPullDownRefresh() {
    this.loadRanking(true).finally(() => wx.stopPullDownRefresh())
  },

  async init() {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      this.setData({ myOpenid: app.globalData.openid })
      await this.loadGroups()
      await this.loadRanking()
    } catch (err) {
      console.error('[ranking.init]', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadGroups() {
    const groups = await app.getMyGroups()
    this.setData({ groups, currentGroup: groups[0] || null, groupIndex: 0 })
  },

  async loadRanking(pull) {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ list: [], myRank: 0, myData: null })
      return
    }
    const data = await api.call('getGroupRanking', {
      groupId: group._id,
      period: this.data.period,
      sortBy: this.data.sortBy,
      refresh: !!pull
    }, { loading: false })
    const myOpenid = this.data.myOpenid
    const list = (data.list || []).map(item => ({
      ...item,
      isMe: item.openid === myOpenid,
      medal: item.rank <= 3 ? item.rank : 0
    }))
    this.setData({ list, myRank: data.myRank, myData: data.myData })
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    const group = this.data.groups[index]
    if (!group) return
    this.setData({ groupIndex: index, currentGroup: group })
    this.loadRanking()
  },

  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    if (period === this.data.period) return
    this.setData({ period })
    this.loadRanking()
  },

  onSortChange(e) {
    const sortBy = e.currentTarget.dataset.sort
    if (sortBy === this.data.sortBy) return
    this.setData({ sortBy })
    this.loadRanking()
  },

  goGroups() {
    wx.switchTab({ url: '/pages/groups/groups' })
  }
})
