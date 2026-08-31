const DESIGN = { w: 520, h: 440, cx: 260, cy: 260, r: 180, sw: 26 }

const SEGS = [
  { c: '#4fb3ff', a0: 135.9, a1: 210.6, label: '偏瘦' },
  { c: '#3ddc97', a0: 212.4, a1: 260.1, label: '正常' },
  { c: '#ffb020', a0: 261.9, a1: 296.1, label: '超重' },
  { c: '#ff5a5f', a0: 297.9, a1: 404.1, label: '肥胖' }
]

const angleOf = bmi => 135 + ((bmi - 10) / 30) * 270

function polar(cx, cy, radius, deg) {
  const rad = deg * Math.PI / 180
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
}

Component({
  properties: {
    heightCm: { type: Number, value: 0 },
    weightKg: { type: Number, value: 0 }
  },

  data: {
    legend: [
      { label: '偏瘦', range: '<18.5', color: '#4fb3ff' },
      { label: '正常', range: '18.5–23.9', color: '#3ddc97' },
      { label: '超重', range: '24–27.9', color: '#ffb020' },
      { label: '肥胖', range: '≥28', color: '#ff5a5f' }
    ]
  },

  observers: {
    'heightCm, weightKg': function () {
      this._recalc()
    }
  },

  lifetimes: {
    ready() {
      this._ensureCanvas(() => this._recalc(true))
    }
  },

  methods: {
    _ensureCanvas(cb) {
      const tryIt = n => {
        wx.createSelectorQuery().in(this).select('#bmiGaugeCanvas').fields({ node: true, size: true }).exec(res => {
          const info = res && res[0]
          if (info && info.node && info.width > 0) {
            this._canvas = info.node
            this._ctx = info.node.getContext('2d')
            this._w = info.width
            this._h = info.height
            if (cb) cb()
          } else if (n < 20) {
            setTimeout(() => tryIt(n + 1), 80)
          }
        })
      }
      tryIt(0)
    },

    _recalc(first) {
      const h = Number(this.data.heightCm)
      const w = Number(this.data.weightKg)
      const valid = h > 0 && w > 0
      this._valid = valid
      this._summary = valid ? `${h}cm · ${w}kg` : '录入身高体重后展示'
      if (!valid) {
        this._bmi = null
        this._category = { text: '待录入', color: '#6b7a90' }
        this._drawValue = null
        this._animate({ bmi: null, deg: 135, reveal: !!first })
        return
      }
      const bmi = w / Math.pow(h / 100, 2)
      let cat
      if (bmi < 18.5) cat = { text: '偏瘦', color: '#4fb3ff' }
      else if (bmi < 24) cat = { text: '正常', color: '#3ddc97' }
      else if (bmi < 28) cat = { text: '超重', color: '#ffb020' }
      else cat = { text: '肥胖', color: '#ff5a5f' }
      this._bmi = bmi
      this._category = cat
      const deg = Math.min(405, Math.max(135, angleOf(bmi)))
      this._animate({ bmi, deg, reveal: !!first })
    },

    _animate({ bmi, deg, reveal }) {
      const startBmi = this._drawValue != null ? this._drawValue : (bmi || 0)
      const startDeg = this._drawDeg != null ? this._drawDeg : 135
      const startReveal = this._reveal != null ? this._reveal : 0
      const hasBmi = bmi != null
      const t0 = Date.now()
      clearTimeout(this._tick)
      const dur = 700
      const ease = t => 1 - Math.pow(1 - t, 3)
      const step = () => {
        const t = Math.min(1, (Date.now() - t0) / dur)
        const tv = Math.min(1, t * (500 / dur))
        if (hasBmi) this._drawValue = startBmi + (bmi - startBmi) * ease(tv)
        this._drawDeg = startDeg + (deg - startDeg) * ease(t)
        this._drawReveal = startReveal + (1 - startReveal) * ease(tv)
        this._render()
        if (t < 1) {
          this._tick = setTimeout(step, 16)
        } else {
          if (hasBmi) this._drawValue = bmi
          this._drawDeg = deg
          this._drawReveal = 1
          this._render()
        }
      }
      step()
    },

    _render() {
      const ctx = this._ctx
      const w = this._w
      const h = this._h
      if (!ctx || !w || !h) return
      const dpr = (wx.getSystemInfoSync().pixelRatio) || 2
      if (this._canvas.width !== w * dpr) {
        this._canvas.width = w * dpr
        this._canvas.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const s = h / DESIGN.h
      const cx = DESIGN.cx * s
      const cy = DESIGN.cy * s
      const r = DESIGN.r * s
      const sw = DESIGN.sw * s
      const rad = d => d * Math.PI / 180
      const TWO_PI = Math.PI * 2

      // 背景
      ctx.beginPath()
      this._roundRect(ctx, 0, 0, w, h, 22 * s)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      // 弧带（入场按 reveal 渐进扫出）
      const reveal = this._drawReveal != null ? this._drawReveal : 1
      ctx.lineCap = 'butt'
      SEGS.forEach(seg => {
        const span = seg.a1 - seg.a0
        ctx.beginPath()
        ctx.arc(cx, cy, r, rad(seg.a0), rad(seg.a0 + span * reveal))
        ctx.lineWidth = sw
        ctx.strokeStyle = seg.c
        ctx.stroke()
      })

      // 刻度 + 数字标签（10-40）
      ctx.lineCap = 'round'
      for (let b = 10; b <= 40; b++) {
        const a = angleOf(b)
        const major = b % 5 === 0
        const rr0 = r + sw / 2 + (major ? 6 : 3)
        const rr1 = r + sw / 2 + (major ? 26 : 15)
        const p0 = polar(cx, cy, rr0, a)
        const p1 = polar(cx, cy, rr1, a)
        ctx.strokeStyle = major ? 'rgba(31,45,61,0.75)' : 'rgba(31,45,61,0.3)'
        ctx.lineWidth = major ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        if (major) {
          const lp = polar(cx, cy, r + sw / 2 + 44, a)
          ctx.fillStyle = '#8a94a6'
          ctx.font = `${Math.max(12, 15 * s)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(b), lp.x, lp.y)
        }
      }

      // 中心枢纽（双层圆环，浅色）
      ctx.beginPath()
      ctx.arc(cx, cy, 58 * s, 0, TWO_PI)
      ctx.fillStyle = '#f3f5f9'
      ctx.fill()
      ctx.strokeStyle = 'rgba(31,45,61,0.08)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 46 * s, 0, TWO_PI)
      ctx.fillStyle = '#ffffff'
      ctx.fill()

      ctx.textAlign = 'center'
      const value = this._drawValue
      if (value != null) {
        ctx.fillStyle = '#1f2d3d'
        ctx.font = `bold ${40 * s}px sans-serif`
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(value.toFixed(1), cx, cy - 2 * s)
        ctx.fillStyle = this._category.color
        ctx.font = `600 ${24 * s}px sans-serif`
        ctx.fillText(this._category.text, cx, cy + 30 * s)
      } else {
        ctx.fillStyle = '#c0c6d0'
        ctx.font = `bold ${34 * s}px sans-serif`
        ctx.fillText('--', cx, cy - 2 * s)
        ctx.fillStyle = '#8a94a6'
        ctx.font = `${20 * s}px sans-serif`
        ctx.fillText(this._category.text, cx, cy + 26 * s)
      }

      // 身高体重摘要：置于中心圆环下方，字号略小于 BMI 值
      ctx.fillStyle = '#5a6478'
      ctx.font = `bold ${28 * s}px sans-serif`
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(this._summary, cx, cy + 82 * s)

      // 白色发光小箭头（鼠标光标大小的弧线三角，尖端贴近弧带内缘）
      if (this._valid && this._drawDeg != null) {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(this._drawDeg * Math.PI / 180)
        const L = 166 * s
        const baseX = L - 16 * s
        const hw = 6 * s
        ctx.shadowColor = 'rgba(0,0,0,0.28)'
        ctx.shadowBlur = 4 * s
        ctx.fillStyle = '#1f2d3d'
        ctx.beginPath()
        ctx.moveTo(L, 0)
        ctx.quadraticCurveTo(L - 6 * s, hw + 2.5 * s, baseX, hw)
        ctx.quadraticCurveTo(baseX - 4 * s, 0, baseX, -hw)
        ctx.quadraticCurveTo(L - 6 * s, -hw - 2.5 * s, L, 0)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.restore()
      }
    },

    _roundRect(ctx, x, y, w, h, r) {
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }
  }
})
