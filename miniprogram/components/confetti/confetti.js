Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    text: { type: String, value: '' }
  },

  data: {
    pieces: []
  },

  observers: {
    show(v) {
      if (v) {
        const colors = ['#FF7A45', '#4A90E2', '#34C77B', '#F5C518', '#FF6A9A', '#8E6CEF']
        const pieces = []
        for (let i = 0; i < 18; i++) {
          pieces.push({
            left: Math.floor(Math.random() * 100),
            delay: (Math.random() * 1.2).toFixed(2),
            duration: (2 + Math.random() * 1.5).toFixed(2),
            size: 12 + Math.floor(Math.random() * 10),
            color: colors[i % colors.length],
            shape: i % 3
          })
        }
        this.setData({ pieces })
      }
    }
  },

  methods: {
    close() {
      this.triggerEvent('close')
    }
  }
})
