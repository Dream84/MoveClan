module.exports = {
  SPORT_TYPES: [
    { value: 'running', label: '跑步' },
    { value: 'cycling', label: '骑行' },
    { value: 'swimming', label: '游泳' },
    { value: 'rope', label: '跳绳' },
    { value: 'yoga', label: '瑜伽' },
    { value: 'fitness', label: '健身' },
    { value: 'ball', label: '球类' },
    { value: 'other', label: '其他' }
  ],

  SPORT_THEMES: [
    { value: 'running', label: '跑步' },
    { value: 'fitness', label: '健身' },
    { value: 'general', label: '综合' },
    { value: 'cycling', label: '骑行' },
    { value: 'swimming', label: '游泳' }
  ],

  CALORIES_PER_MIN: {
    running: 10,
    cycling: 8,
    swimming: 9,
    rope: 11,
    yoga: 4,
    fitness: 7,
    ball: 8,
    other: 6
  },

  RANK_SORTS: [
    { value: 'count', label: '打卡次数' },
    { value: 'calories', label: '消耗卡路里' },
    { value: 'duration', label: '运动时长' }
  ],

  RANK_PERIODS: [
    { value: 'week', label: '本周' },
    { value: 'month', label: '本月' }
  ],

  ACHIEVEMENT_DAYS: [7, 14, 30],

  ROLE_LABELS: {
    owner: '群主',
    member: '成员'
  },

  SPORT_TYPE_LABELS: {
    running: '跑步',
    cycling: '骑行',
    swimming: '游泳',
    rope: '跳绳',
    yoga: '瑜伽',
    fitness: '健身',
    ball: '球类',
    other: '其他'
  },

  sportLabel(value) {
    const item = this.SPORT_TYPES.find(t => t.value === value)
    return item ? item.label : value
  },

  themeLabel(value) {
    const item = this.SPORT_THEMES.find(t => t.value === value)
    return item ? item.label : value
  },

  rankSortLabel(value) {
    const item = this.RANK_SORTS.find(t => t.value === value)
    return item ? item.label : value
  }
}
