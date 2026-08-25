const api = require('../../utils/api')
const constants = require('../../utils/constants')
const settings = require('../../settings')

const app = getApp()

Page({
  data: {
    groups: [],
    groupIndex: 0,
    currentGroup: null,
    selectedGroupId: '',
    list: [],
    page: 0,
    hasMore: true,
    loading: true,
    feedLoading: false,
    myOpenid: '',
    commentTarget: null,
    commentText: '',
    commentFocus: false
  },

  onLoad() {
    this._feedReqId = 0
  },

  onShow() {
    if (!app.throttleRefresh() && !this.data.loading) return
    this.init()
  },

  onHide() {
    this.showTab()
  },

  onPullDownRefresh() {
    if (!app.throttleRefresh(true)) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadFeed(true).finally(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.feedLoading) {
      this.loadFeed(false)
    }
  },

  async init() {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      this.setData({ myOpenid: app.globalData.openid })
      await this.loadGroups()
      await this.loadFeed(true)
    } catch (err) {
      console.error('[feed.init]', err)
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

  loadFeed(reset) {
    const group = this.data.currentGroup
    if (!group) {
      this.setData({ list: [], hasMore: false })
      return Promise.resolve()
    }
    const page = reset ? 0 : this.data.page
    if (this.data.feedLoading) return Promise.resolve()
    const reqId = ++this._feedReqId
    const reqGroupId = group._id
    this.setData({ feedLoading: true })
    return api.call('getFeed', { groupId: reqGroupId, page, pageSize: settings.FEED_PAGE_SIZE, refresh: !!reset }, { loading: false })
      .then(data => {
        if (reqId !== this._feedReqId || !this.data.currentGroup || this.data.currentGroup._id !== reqGroupId) return
        const rows = (data.list || []).map(item => ({
          ...item,
          sportLabel: constants.sportLabel(item.sportType),
          isMe: item.openid === this.data.myOpenid,
          expanded: false,
          commentList: item.comments || []
        }))
        this.setData({
          list: reset ? rows : this.data.list.concat(rows),
          page: page + 1,
          hasMore: data.hasMore
        })
      })
      .catch(err => {
        if (reqId === this._feedReqId) console.error('[feed.loadFeed]', err)
      })
      .finally(() => {
        if (reqId === this._feedReqId) this.setData({ feedLoading: false })
      })
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    const group = this.data.groups[index]
    if (!group) return
    this.setData({ groupIndex: index, currentGroup: group, selectedGroupId: group._id })
    this.loadFeed(true)
  },

  toggleLike(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return
    const wasLiked = item.isLiked
    const newLiked = !wasLiked
    const delta = newLiked ? 1 : -1
    const newCount = Math.max(0, item.likeCount + delta)
    this.setData({
      [`list[${index}].isLiked`]: newLiked,
      [`list[${index}].likeCount`]: newCount
    })
    api.call('likeCheckin', { checkinId: item._id }, { loading: false, toast: false })
      .then(res => {
        this.setData({
          [`list[${index}].isLiked`]: res.liked,
          [`list[${index}].likeCount`]: res.likeCount
        })
      })
      .catch(err => {
        this.setData({
          [`list[${index}].isLiked`]: wasLiked,
          [`list[${index}].likeCount`]: item.likeCount
        })
        console.error('[feed.like]', err)
      })
  },

  openComment(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.list[index]
    if (!item) return
    this.setData({ commentTarget: item, commentText: '', commentFocus: false })
    this.hideTab()
    setTimeout(() => {
      this.setData({ commentFocus: true })
    }, 120)
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  onCommentBlur() {
    // 输入法框关闭（失焦）时自动取消评论栏；留 200ms 让「发送」点击先执行
    setTimeout(() => {
      if (this.data.commentTarget) {
        this.setData({ commentTarget: null, commentText: '', commentFocus: false })
        this.showTab()
      }
    }, 200)
  },

  closeComment() {
    this.setData({ commentTarget: null, commentText: '', commentFocus: false })
    this.showTab()
  },

  hideTab() {
    try {
      wx.hideTabBar({ animation: false })
    } catch (err) {
      console.error('[hideTabBar]', err)
    }
  },

  showTab() {
    try {
      wx.showTabBar({ animation: false })
    } catch (err) {
      console.error('[showTabBar]', err)
    }
  },

  async submitComment() {
    const content = this.data.commentText.trim()
    const item = this.data.commentTarget
    if (!item) {
      return
    }
    if (!content) {
      wx.showToast({ title: '请输入评论', icon: 'none' })
      return
    }
    try {
      const res = await api.call('commentCheckin', { checkinId: item._id, content }, { loadingText: '发送中...' })
      if (res && res.comment) {
        const idx = this.data.list.findIndex(x => x._id === item._id)
        if (idx >= 0) {
          const newComments = [res.comment].concat(this.data.list[idx].commentList || [])
          this.setData({
            [`list[${idx}].commentList`]: newComments,
            [`list[${idx}].commentCount`]: newComments.length
          })
          setTimeout(() => {
            wx.pageScrollTo({ selector: `#feed-${item._id}`, duration: 300 })
          }, 150)
        }
      }
      this.setData({ commentTarget: null, commentText: '', commentFocus: false })
      this.showTab()
    } catch (err) {
      console.error('[feed.comment]', err)
    }
  },

  expandComments(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`list[${index}].expanded`]: true })
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.previewImage({ urls: [url] })
    }
  },

  goGroups() {
    wx.switchTab({ url: '/pages/groups/groups' })
  }
})
