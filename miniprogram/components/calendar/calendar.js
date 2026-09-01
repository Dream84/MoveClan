const dateUtil = require('../../utils/date')

Component({
  properties: {
    year: { type: Number, value: 2026 },
    month: { type: Number, value: 1 },
    value: { type: Array, value: [] }
  },

  observers: {
    'year, month, value': function () {
      this.build()
    }
  },

  data: {
    weeks: [],
    title: ''
  },

  lifetimes: {
    attached() {
      this.build()
    }
  },

  methods: {
    build() {
      const { year, month } = this.data
      const countMap = {}
      this.data.value.forEach(item => {
        countMap[item.date] = item.count
      })
      const first = new Date(year, month - 1, 1)
      const startDay = first.getDay() === 0 ? 7 : first.getDay()
      const total = new Date(year, month, 0).getDate()
      const todayStr = dateUtil.today()

      const cells = []
      for (let i = 1; i < startDay; i++) cells.push(null)
      for (let d = 1; d <= total; d++) {
        const date = `${year}-${dateUtil.pad(month)}-${dateUtil.pad(d)}`
        const count = countMap[date] || 0
        cells.push({
          key: date,
          day: d,
          date,
          isToday: date === todayStr,
          level: count >= 3 ? 3 : count === 2 ? 2 : count === 1 ? 1 : 0
        })
      }
      while (cells.length % 7 !== 0) cells.push(null)

      const weeks = []
      for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7))
      }

      this.setData({
        weeks,
        title: `${year}年${month}月`
      })
    },

    prev() {
      let { year, month } = this.data
      month--
      if (month < 1) {
        month = 12
        year--
      }
      this.triggerEvent('monthchange', { year, month })
    },

    next() {
      let { year, month } = this.data
      month++
      if (month > 12) {
        month = 1
        year++
      }
      this.triggerEvent('monthchange', { year, month })
    }
  }
})
