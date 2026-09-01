const api = require('../../utils/api')
const constants = require('../../utils/constants')

const app = getApp()

const PERIOD_TEXT = { week: '本周', lastWeek: '上周', month: '本月', lastMonth: '上月' }

Page({
  data: {
    groups: [],
    groupIndex: 0,
    currentGroup: null,
    selectedGroupId: '',
    period: 'week',
    sortBy: 'count',
    sortLabels: ['打卡次数', '消耗卡路里', '运动时长'],
    periodLabels: ['本周', '上周', '本月', '上月'],
    emptyText: '本周暂无打卡数据',
    list: [],
    myRank: 0,
    myData: null,
    myOpenid: '',
    loading: true
  },

  onLoad() {
    this._rankReqId = 0
  },

  onShow() {
    if (!app.throttleRefresh() && !this.data.loading) return
    this.init()
  },

  onPullDownRefresh() {
    if (!app.throttleRefresh(true)) {
      wx.stopPullDownRefresh()
      return
    }
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
  },

  loadRanking(pull) {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ list: [], myRank: 0, myData: null })
      return Promise.resolve()
    }
    const reqId = ++this._rankReqId
    return api.call('getGroupRanking', {
      groupId: group._id,
      period: this.data.period,
      sortBy: this.data.sortBy,
      refresh: !!pull
    }, { loading: false })
      .then(data => {
        if (reqId !== this._rankReqId) return
        const myOpenid = this.data.myOpenid
        const list = (data.list || []).map(item => ({
          ...item,
          isMe: item.openid === myOpenid,
          medal: item.rank <= 3 ? item.rank : 0
        }))
        this.setData({ list, myRank: data.myRank, myData: data.myData })
      })
      .catch(err => {
        if (reqId === this._rankReqId) {
          console.error('[ranking.loadRanking]', err)
        }
      })
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    const group = this.data.groups[index]
    if (!group) return
    this.setData({ groupIndex: index, currentGroup: group, selectedGroupId: group._id })
    this.loadRanking()
  },

  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    if (period === this.data.period) return
    this.setData({ period, emptyText: (PERIOD_TEXT[period] || '本周') + '暂无打卡数据' })
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
