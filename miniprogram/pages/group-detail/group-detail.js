const api = require('../../utils/api')
const constants = require('../../utils/constants')

const app = getApp()

Page({
  data: {
    groupId: '',
    group: null,
    isOwner: false,
    isMember: false,
    members: [],
    loading: true
  },

  onLoad(options) {
    this.setData({ groupId: options.id || '' })
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    const { groupId } = this.data
    if (!groupId) return
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      const info = await api.call('getGroupInfo', { groupId })
      const membersRes = await api.call('getGroupMembers', { groupId })
      const members = (membersRes.members || []).map(m => ({
        ...m,
        isOwner: m.role === 'owner',
        roleLabel: constants.ROLE_LABELS[m.role] || '成员'
      }))
      this.setData({
        group: {
          ...info.group,
          themeLabel: constants.themeLabel(info.group.sportTheme)
        },
        isOwner: info.isOwner,
        isMember: info.isMember,
        members
      })
    } catch (err) {
      console.error('[group-detail.loadDetail]', err)
      if (err.code === 3 || err.code === 2) {
        wx.showModal({
          title: '提示',
          content: err.message,
          showCancel: false,
          success: () => wx.navigateBack()
        })
      }
    } finally {
      this.setData({ loading: false })
    }
  },

  copyInvite() {
    if (!this.data.group) return
    wx.setClipboardData({
      data: this.data.group.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'success' })
    })
  },

  onMemberAction(e) {
    const member = this.data.members[e.currentTarget.dataset.index]
    if (!member || member.isOwner) return
    wx.showModal({
      title: '移除成员',
      content: `确定移除「${member.nickName}」吗？`,
      confirmColor: '#F5222D',
      success: async res => {
        if (res.confirm) {
          await api.call('removeMember', {
            groupId: this.data.groupId,
            targetOpenid: member.openid
          })
          wx.showToast({ title: '已移除', icon: 'success' })
          this.loadDetail()
        }
      }
    })
  },

  onDismiss() {
    wx.showModal({
      title: '解散群组',
      content: '解散后所有成员将无法再进入该群，确定解散吗？',
      confirmColor: '#F5222D',
      success: async res => {
        if (res.confirm) {
          await api.call('dismissGroup', { groupId: this.data.groupId })
          wx.showToast({ title: '群已解散', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 600)
        }
      }
    })
  },

  onLeave() {
    wx.showModal({
      title: '退出群组',
      content: '确定退出该群吗？退出后打卡记录仍在榜上。',
      confirmColor: '#F5222D',
      success: async res => {
        if (res.confirm) {
          await api.call('leaveGroup', { groupId: this.data.groupId })
          wx.showToast({ title: '已退出', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 600)
        }
      }
    })
  }
})
