const api = require('../../utils/api')
const dateUtil = require('../../utils/date')
const constants = require('../../utils/constants')

const app = getApp()

Page({
  data: {
    id: '',
    mode: 'new',
    groups: [],
    groupIndex: 0,
    groupLabel: '',
    checkDate: '',
    dateStart: '',
    dateEnd: '',
    sportTypes: constants.SPORT_TYPES,
    sportIndex: 0,
    estimateHint: '',
    duration: '',
    calories: '',
    count: 1,
    remark: '',
    remarkCount: 0,
    imageTempPath: '',
    imageFileId: '',
    imageUrl: '',
    uploadProgress: 0,
    uploading: false,
    submitting: false,
    showConfetti: false,
    confettiTitle: '',
    confettiText: ''
  },

  onLoad(options) {
    const id = options.id || ''
    const today = dateUtil.today()
    this.setData({
      id,
      mode: id ? 'edit' : 'new',
      checkDate: today,
      dateStart: dateUtil.addDays(today, -7),
      dateEnd: today
    })
  },

  async onShow() {
    try {
      if (!app.globalData.userInfo) {
        await app.login()
      }
      await this.loadContext()
    } catch (err) {
      console.error('[checkin-edit.onShow]', err)
      if (this.data.mode === 'edit') {
        wx.showToast({ title: '记录不存在或已删除', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 900)
      }
    }
  },

  async loadContext() {
    const { id, mode } = this.data
    const groupsPromise = app.getMyGroups()

    if (mode === 'new') {
      const groups = await groupsPromise
      let groupIndex = 0
      const cur = app.globalData.currentGroup
      if (cur) {
        const idx = groups.findIndex(g => g._id === cur._id)
        if (idx >= 0) groupIndex = idx
      }
      const sport = constants.SPORT_TYPES[0]
      this.setData({
        groups,
        groupIndex,
        groupLabel: groups[groupIndex] ? groups[groupIndex].name : '',
        estimateHint: `${sport.label}每分钟约${constants.CALORIES_PER_MIN[sport.value]}千卡`
      })
      if (!groups.length) {
        wx.showToast({ title: '请先加入运动群', icon: 'none' })
      }
      return
    }

    const db = wx.cloud.database()
    const [groups, recRes] = await Promise.all([
      groupsPromise,
      db.collection('checkins').doc(id).get()
    ])
    const r = recRes.data
    const sportIndex = Math.max(0, constants.SPORT_TYPES.findIndex(s => s.value === r.sportType))
    const sport = constants.SPORT_TYPES[sportIndex]
    const group = groups.find(g => g._id === r.groupId)
    let imageUrl = ''
    if (r.imageFileId) {
      try {
        const t = await wx.cloud.getTempFileURL({ fileList: [r.imageFileId] })
        let url = (t.fileList && t.fileList[0] && t.fileList[0].tempFileURL) || ''
        if (url) {
          const qIdx = url.indexOf('?')
          url = qIdx >= 0
            ? url.slice(0, qIdx) + '?imageMogr2/thumbnail/320x' + '&' + url.slice(qIdx + 1)
            : url + '?imageMogr2/thumbnail/320x'
        }
        imageUrl = url
      } catch (e) {
        console.error('[getTempFileURL]', e)
      }
    }
    this.setData({
      groups,
      groupLabel: group ? group.name : '',
      checkDate: r.checkDate,
      sportIndex,
      estimateHint: `${sport.label}每分钟约${constants.CALORIES_PER_MIN[sport.value]}千卡`,
      duration: String(r.duration),
      calories: String(r.calories),
      count: r.count || 1,
      remark: r.remark || '',
      remarkCount: (r.remark || '').length,
      imageFileId: r.imageFileId || '',
      imageUrl
    })
  },

  onGroupChange(e) {
    const index = Number(e.detail.value)
    this.setData({
      groupIndex: index,
      groupLabel: this.data.groups[index] ? this.data.groups[index].name : ''
    })
  },

  onDateChange(e) {
    this.setData({ checkDate: e.detail.value })
  },

  onSportChange(e) {
    const sportIndex = Number(e.detail.value)
    const sport = constants.SPORT_TYPES[sportIndex]
    this.setData({
      sportIndex,
      estimateHint: `${sport.label}每分钟约${constants.CALORIES_PER_MIN[sport.value]}千卡`
    })
  },

  onDurationInput(e) {
    this.setData({ duration: e.detail.value })
  },

  onCaloriesInput(e) {
    this.setData({ calories: e.detail.value })
  },

  estimateCalories() {
    const duration = Number(this.data.duration)
    if (!(duration > 0)) {
      wx.showToast({ title: '先填写运动时长', icon: 'none' })
      return
    }
    const sport = constants.SPORT_TYPES[this.data.sportIndex]
    const cal = Math.round(duration * constants.CALORIES_PER_MIN[sport.value])
    this.setData({ calories: String(cal) })
    wx.showToast({ title: `估算约 ${cal} 千卡`, icon: 'none' })
  },

  onCountMinus() {
    if (this.data.count > 1) {
      this.setData({ count: this.data.count - 1 })
    }
  },

  onCountPlus() {
    if (this.data.count < 100) {
      this.setData({ count: this.data.count + 1 })
    }
  },

  onRemarkInput(e) {
    const v = e.detail.value
    if (v.length > 200) return
    this.setData({ remark: v, remarkCount: v.length })
  },

  chooseImage() {
    if (this.data.uploading) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const file = res.tempFiles[0]
        this.setData({
          imageTempPath: file.tempFilePath,
          imageUrl: file.tempFilePath
        })
        this.upload()
      }
    })
  },

  async upload() {
    const temp = this.data.imageTempPath
    if (!temp) return
    this.setData({ uploading: true, uploadProgress: 0 })
    try {
      const openid = app.globalData.openid
      const res = await api.uploadImage(temp, openid, prog => {
        this.setData({ uploadProgress: prog.progress || 0 })
      })
      this.setData({
        imageFileId: res.fileID,
        imageTempPath: '',
        uploading: false,
        uploadProgress: 100
      })
      wx.showToast({ title: '图片上传成功', icon: 'success' })
    } catch (err) {
      console.error('[upload]', err)
      this.setData({ uploading: false, imageTempPath: '', imageUrl: '' })
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    }
  },

  removeImage() {
    if (this.data.uploading) return
    this.setData({
      imageTempPath: '',
      imageFileId: '',
      imageUrl: '',
      uploadProgress: 0
    })
  },

  async submit() {
    if (this.data.submitting || this.data.uploading) {
      if (this.data.uploading) {
        wx.showToast({ title: '图片上传中，请稍候', icon: 'none' })
      }
      return
    }
    const {
      groups, groupIndex, checkDate, sportIndex,
      duration, calories, count, remark, imageFileId, id, mode
    } = this.data
    const group = groups[groupIndex]
    if (!group) {
      wx.showToast({ title: '请选择运动群', icon: 'none' })
      return
    }
    const dur = Number(duration)
    const cal = Number(calories)
    if (!(dur >= 1 && dur <= 1440)) {
      wx.showToast({ title: '请输入有效运动时长（1-1440分钟）', icon: 'none' })
      return
    }
    if (!(cal >= 0 && cal <= 100000)) {
      wx.showToast({ title: '请输入有效卡路里', icon: 'none' })
      return
    }

    const payload = {
      groupId: group._id,
      checkDate,
      sportType: constants.SPORT_TYPES[sportIndex].value,
      duration: dur,
      calories: cal,
      count,
      remark: remark.trim(),
      imageFileId
    }

    this.setData({ submitting: true })
    try {
      if (mode === 'edit') {
        await api.call('updateCheckin', Object.assign({}, payload, { checkinId: id }), { loadingText: '保存中...' })
      } else {
        await api.call('submitCheckin', payload, { loadingText: '打卡中...' })
      }

      let newMilestones = []
      try {
        const stats = await api.call('getMyStats', {}, { loading: false })
        newMilestones = stats.newMilestones || []
      } catch (e) {
        console.error('[achievement check]', e)
      }

      if (newMilestones.length) {
        this.setData({
          showConfetti: true,
          confettiTitle: `连续打卡 ${newMilestones[0]} 天`,
          confettiText: '太棒了，继续保持！'
        })
      } else {
        wx.showToast({ title: '🎉 打卡成功', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 800)
      }
    } catch (err) {
      console.error('[checkin-edit.submit]', err)
    } finally {
      this.setData({ submitting: false })
    }
  },

  onConfettiClose() {
    this.setData({ showConfetti: false })
    setTimeout(() => wx.navigateBack(), 200)
  },

  deleteRecord() {
    if (this.data.mode !== 'edit' || this.data.submitting) return
    wx.showModal({
      title: '删除打卡记录',
      content: '确定删除该打卡记录吗？删除后群排行榜将同步更新。',
      confirmColor: '#F5222D',
      success: async res => {
        if (!res.confirm) return
        try {
          await api.call('deleteCheckin', { checkinId: this.data.id })
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 800)
        } catch (err) {
          console.error('[checkin-edit.deleteRecord]', err)
        }
      }
    })
  }
})
