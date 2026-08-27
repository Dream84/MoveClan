const dateUtil = require('../../utils/date')

Component({
  properties: {
    records: { type: Array, value: [] },
    period: { type: String, value: 'day' },
    metric: { type: String, value: 'weight' },
    anchor: { type: String, value: '' },
    heightCm: { type: Number, value: 170 }
  },

  data: {
    empty: true
  },

  observers: {
    'records, period, metric, anchor, heightCm': function () {
      this._activeIndex = -1
      if (this._ready) this.draw()
    }
  },

  lifetimes: {
    ready() {
      this._ready = true
      setTimeout(() => this.draw(), 50)
    }
  },

  methods: {
    labelFor(period, pos) {
      if (period === 'day') return `${pos}:00`
      if (period === 'month') return `${pos + 1}日`
      return `${pos + 1}月`
    },

    bucketTotal() {
      const { period, anchor } = this.data
      if (period === 'day') return 24
      if (period === 'month') {
        const p = anchor.split('-')
        return new Date(Number(p[0]), Number(p[1]), 0).getDate()
      }
      return 12
    },

    buildPoints() {
      const { records, period, anchor, metric, heightCm } = this.data
      const agg = {}
      ;(records || []).forEach(r => {
        const s = dateUtil.formatDateTime(r.createTime)
        if (!s) return
        const dateStr = s.slice(0, 10)
        const key = period === 'day' ? dateStr : period === 'month' ? dateStr.slice(0, 7) : dateStr.slice(0, 4)
        if (key !== anchor) return
        const weight = Number(r.weightKg)
        if (!(weight > 0)) return
        const value = metric === 'bmi' && heightCm > 0 ? weight / Math.pow(heightCm / 100, 2) : weight
        const pos = period === 'day'
          ? Number(s.slice(11, 13))
          : period === 'month'
            ? Number(dateStr.slice(8, 10)) - 1
            : Number(dateStr.slice(5, 7)) - 1
        if (!agg[pos]) agg[pos] = { sum: 0, n: 0 }
        agg[pos].sum += value
        agg[pos].n++
      })
      return Object.keys(agg).map(Number).sort((a, b) => a - b).map(pos => ({
        pos,
        value: agg[pos].sum / agg[pos].n,
        label: this.labelFor(period, pos)
      }))
    },

    draw() {
      const query = wx.createSelectorQuery().in(this)
      query.select('#weightCanvas').fields({ node: true, size: true }).exec(res => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const w = res[0].width
        const h = res[0].height
        this._canvasW = w
        const dpr = (wx.getSystemInfoSync().pixelRatio) || 2
        canvas.width = w * dpr
        canvas.height = h * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, w, h)

        const points = this.buildPoints()
        this._points = points
        this.setData({ empty: points.length === 0 })
        if (points.length === 0) return
        this.paint(ctx, w, h, points)
      })
    },

    paint(ctx, w, h, points) {
      const { period, metric } = this.data
      const total = this.bucketTotal()
      const padL = 44
      const padR = 18
      const padT = 18
      const padB = 26
      const plotW = w - padL - padR
      const plotH = h - padT - padB

      const x = pos => padL + (pos / (total - 1)) * plotW

      let min = Infinity
      let max = -Infinity
      points.forEach(p => {
        if (p.value < min) min = p.value
        if (p.value > max) max = p.value
      })
      if (max - min < 2) {
        const mid = (max + min) / 2
        min = mid - 1
        max = mid + 1
      }
      min = Math.floor(min - 0.5)
      max = Math.ceil(max + 0.5)
      const y = v => padT + ((max - v) / (max - min)) * plotH

      // 网格与 y 刻度
      ctx.font = '10px sans-serif'
      ctx.fillStyle = '#9AA0A6'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let i = 0; i <= 3; i++) {
        const v = max - ((max - min) / 3) * i
        const yy = y(v)
        ctx.strokeStyle = '#F0F0F0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(padL, yy)
        ctx.lineTo(w - padR, yy)
        ctx.stroke()
        ctx.fillText(metric === 'bmi' ? v.toFixed(1) : v.toFixed(1), padL - 6, yy)
      }

      // x 轴刻度标签
      const ticks = this.xTicks(total)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ticks.forEach(t => {
        ctx.fillStyle = '#9AA0A6'
        ctx.fillText(t.label, x(t.pos), h - padB + 6)
      })

      // 折线（跳过空槽：points 仅含非空槽，直接按序连线）
      if (points.length >= 2) {
        ctx.strokeStyle = '#FF7A45'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.beginPath()
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(x(p.pos), y(p.value))
          else ctx.lineTo(x(p.pos), y(p.value))
        })
        ctx.stroke()
      }

      // 数据点
      points.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(x(p.pos), y(p.value), 3, 0, Math.PI * 2)
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
        ctx.strokeStyle = '#FF7A45'
        ctx.lineWidth = 2
        ctx.stroke()
      })

      // 触摸高亮 + 数值气泡
      const active = this._activeIndex
      if (active >= 0 && points[active]) {
        const p = points[active]
        const px = x(p.pos)
        const py = y(p.value)
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#FF7A45'
        ctx.fill()

        const text = `${p.label}：${p.value.toFixed(1)}${metric === 'weight' ? 'kg' : ''}`
        ctx.font = '11px sans-serif'
        const tw = ctx.measureText(text).width
        const bw = tw + 16
        const bh = 22
        let bx = px - bw / 2
        const by = py - bh - 10
        if (bx < 0) bx = 2
        if (bx + bw > w - 2) bx = w - bw - 2
        ctx.fillStyle = 'rgba(44,44,44,0.9)'
        this.roundRect(ctx, bx, by, bw, bh, 6)
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, bx + bw / 2, by + bh / 2 + 1)
      }
    },

    xTicks(total) {
      const { period } = this.data
      const ticks = []
      if (period === 'day') {
        ;[0, 6, 12, 18].forEach(h => ticks.push({ pos: h, label: String(h).padStart(2, '0') }))
      } else if (period === 'month') {
        const days = total
        const steps = [0, Math.floor(days / 3), Math.floor((days * 2) / 3), days - 1]
        ;[...new Set(steps)].forEach(d => ticks.push({ pos: d, label: String(d + 1) }))
      } else {
        ;[0, 3, 6, 9, 11].forEach(m => ticks.push({ pos: m, label: String(m + 1) }))
      }
      return ticks
    },

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    },

    onTouchStart(e) {
      const touches = e.touches || []
      if (!touches.length || !this._points || !this._points.length || !this._canvasW) return
      const tx = touches[0].x
      const total = this.bucketTotal()
      const padL = 44
      const padR = 18
      const plotW = this._canvasW - padL - padR
      const x = pos => padL + (pos / (total - 1)) * plotW
      let best = -1
      let bestD = 24
      this._points.forEach((p, i) => {
        const d = Math.abs(x(p.pos) - tx)
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      this._activeIndex = best >= 0 ? best : -1
      this.draw()
    }
  }
})
