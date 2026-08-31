Page({
  data: {
    heightCm: 165,
    weightKg: 67
  },

  onHeightInput(e) {
    const v = Number(e.detail.value)
    this.setData({ heightCm: v > 0 ? v : 0 })
  },

  onWeightInput(e) {
    const v = Number(e.detail.value)
    this.setData({ weightKg: v > 0 ? v : 0 })
  },

  setSample(e) {
    const { h, w } = e.currentTarget.dataset
    this.setData({ heightCm: Number(h), weightKg: Number(w) })
  }
})
