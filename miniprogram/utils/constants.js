module.exports = {
  SPORT_TYPES: [
    { value: 'running', label: '跑步' },
    { value: 'cycling', label: '骑行/单车' },
    { value: 'swimming', label: '游泳' },
    { value: 'rope', label: '跳绳' },
    { value: 'aerobics', label: '减脂操' },
    { value: 'badminton', label: '羽毛球' },
    { value: 'basketball', label: '篮球' },
    { value: 'football', label: '足球' },
    { value: 'tabletennis', label: '乒乓球' },
    { value: 'boxing', label: '拳击' },
    { value: 'weightlifting', label: '举铁' },
    { value: 'strength', label: '力量训练' },
    { value: 'yoga', label: '瑜伽' },
    { value: 'fitness', label: '健身' },
    { value: 'dance', label: '舞蹈' },
    { value: 'pilates', label: '普拉提' },
    { value: 'kickboxing', label: '搏击操' },
    { value: 'hiking', label: '徒步/爬山' },
    { value: 'climbing', label: '爬坡' },
    { value: 'stepper', label: '爬楼机' },
    { value: 'stairs', label: '爬楼' },
    { value: 'hiit', label: 'HIIT' },
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

  // MET 代谢当量（参考《体力活动纲要 Compendium of Physical Activities》）
  // 消耗热量(千卡) = MET × 体重(公斤) × 运动时间(小时)
  MET_VALUES: {
    running: 8.3,
    cycling: 7.5,
    swimming: 7.0,
    rope: 11.8,
    aerobics: 7.3,
    badminton: 6.0,
    basketball: 7.8,
    football: 7.0,
    tabletennis: 4.0,
    boxing: 7.8,
    weightlifting: 6.0,
    strength: 5.5,
    yoga: 3.0,
    fitness: 5.0,
    dance: 5.0,
    pilates: 3.0,
    kickboxing: 7.8,
    hiking: 5.3,
    climbing: 7.0,
    stepper: 8.8,
    stairs: 8.8,
    hiit: 9.0,
    ball: 7.3,
    other: 5.0
  },

  RANK_SORTS: [
    { value: 'count', label: '打卡次数' },
    { value: 'calories', label: '消耗卡路里' },
    { value: 'duration', label: '运动时长' }
  ],

  RANK_PERIODS: [
    { value: 'week', label: '本周' },
    { value: 'lastWeek', label: '上周' },
    { value: 'month', label: '本月' },
    { value: 'lastMonth', label: '上月' },
    { value: 'total', label: '总榜' }
  ],

  ACHIEVEMENT_DAYS: [7, 14, 30],

  ROLE_LABELS: {
    owner: '群主',
    member: '成员'
  },

  SPORT_TYPE_LABELS: {
    running: '跑步',
    cycling: '骑行/单车',
    swimming: '游泳',
    rope: '跳绳',
    aerobics: '减脂操',
    badminton: '羽毛球',
    basketball: '篮球',
    football: '足球',
    tabletennis: '乒乓球',
    boxing: '拳击',
    weightlifting: '举铁',
    strength: '力量训练',
    yoga: '瑜伽',
    fitness: '健身',
    dance: '舞蹈',
    pilates: '普拉提',
    kickboxing: '搏击操',
    hiking: '徒步/爬山',
    climbing: '爬坡',
    stepper: '爬楼机',
    stairs: '爬楼',
    hiit: 'HIIT',
    ball: '球类',
    other: '其他'
  },

  sportLabel(value) {
    const item = this.SPORT_TYPES.find(t => t.value === value)
    return item ? item.label : value
  },

  sportMet(value) {
    return this.MET_VALUES[value] || 5
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
