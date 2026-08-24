const api = require('../../utils/api')
const constants = require('../../utils/constants')

const app = getApp()

Page({
  data: {
    myGroups: [],
    loading: true,
    inviteCode: '',
    showCreate: false,
    createName: '',
    createDesc: '',
    themeIndex: 0,
    themes: constants.SPORT_THEMES
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      await this.loadGroups()
    } catch (err) {
      console.error('[groups.refresh]', err)
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
      this.setData({ myGroups: [] })
      return
    }
    const ids = mems.map(m => m.groupId)
    const groupRes = await db.collection('groups')
      .where({ _id: _.in(ids), status: 'active' })
      .get()
    const groups = groupRes.data || []
    const roleMap = {}
    mems.forEach(m => {
      roleMap[m.groupId] = m.role
    })
    const myGroups = groups.map(g => ({
      ...g,
      role: roleMap[g._id] || 'member',
      roleLabel: constants.ROLE_LABELS[roleMap[g._id]] || '成员',
      themeLabel: constants.themeLabel(g.sportTheme)
    }))
    this.setData({ myGroups })
  },

  openCreate() {
    this.setData({ showCreate: true })
  },

  noop() {},

  closeCreate() {
    this.setData({ showCreate: false })
  },

  onNameInput(e) {
    this.setData({ createName: e.detail.value })
  },

  onDescInput(e) {
    this.setData({ createDesc: e.detail.value })
  },

  onThemeChange(e) {
    this.setData({ themeIndex: Number(e.detail.value) })
  },

  async doCreate() {
    const name = this.data.createName.trim()
    if (!name) {
      wx.showToast({ title: '请输入群名称', icon: 'none' })
      return
    }
    const theme = this.data.themes[this.data.themeIndex].value
    const data = await api.call('createGroup', {
      name,
      description: this.data.createDesc,
      sportTheme: theme
    })
    this.setData({ showCreate: false, createName: '', createDesc: '', themeIndex: 0 })
    wx.showModal({
      title: '创建成功 🎉',
      content: '群邀请码：' + data.inviteCode,
      confirmText: '复制邀请码',
      success: res => {
        if (res.confirm) {
          wx.setClipboardData({ data: data.inviteCode })
        }
      }
    })
    this.refresh()
  },

  onInviteInput(e) {
    this.setData({ inviteCode: e.detail.value })
  },

  async doJoin() {
    const code = this.data.inviteCode.trim()
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    await api.call('joinGroup', { inviteCode: code })
    this.setData({ inviteCode: '' })
    wx.showToast({ title: '加入成功', icon: 'success' })
    this.refresh()
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/group-detail/group-detail?id=' + e.currentTarget.dataset.id })
  }
})
