/**
 * 本地 Mock 层：用于微信开发者工具「游客模式」离线预览页面，
 * 不依赖云开发环境。开启方式：miniprogram/config.js 中 MOCK_ENABLED = true。
 * 所有数据保存在内存中，每次启动重置。
 */
const dateUtil = require('./date')

const MOCK_OPENID = 'mockopenid'

const mockUsers = [
  {
    _id: 'u1',
    _openid: MOCK_OPENID,
    openid: MOCK_OPENID,
    nickName: '本地测试',
    avatarUrl: '',
    weightKg: 60,
    maxStreakDays: 10,
    achievedMilestones: [7]
  },
  {
    _id: 'u2',
    _openid: 'mock2',
    openid: 'mock2',
    nickName: '小明',
    avatarUrl: '',
    weightKg: 70,
    maxStreakDays: 3,
    achievedMilestones: []
  },
  {
    _id: 'u3',
    _openid: 'mock3',
    openid: 'mock3',
    nickName: '小红',
    avatarUrl: '',
    weightKg: 52,
    maxStreakDays: 5,
    achievedMilestones: []
  }
]

const mockGroups = [
  {
    _id: 'g1',
    _openid: MOCK_OPENID,
    name: '本地测试群',
    description: '这是 Mock 数据，可离线预览',
    sportTheme: 'general',
    inviteCode: 'MOCK01',
    ownerOpenid: MOCK_OPENID,
    memberCount: 3,
    createTime: new Date(),
    status: 'active',
    role: 'owner'
  }
]

const mockMembers = [
  { _id: 'm1', _openid: MOCK_OPENID, groupId: 'g1', openid: MOCK_OPENID, role: 'owner', nickName: '本地测试', avatarUrl: '' },
  { _id: 'm2', _openid: 'mock2', groupId: 'g1', openid: 'mock2', role: 'member', nickName: '小明', avatarUrl: '' },
  { _id: 'm3', _openid: 'mock3', groupId: 'g1', openid: 'mock3', role: 'member', nickName: '小红', avatarUrl: '' }
]

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function dayStr(offset) {
  const d = new Date(Date.now() + offset * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildMockCheckins() {
  const list = []
  const plan = {
    [MOCK_OPENID]: [
      { offset: -0, count: 1, dur: 30, cal: 300, type: 'running' },
      { offset: -1, count: 1, dur: 25, cal: 260, type: 'aerobics' },
      { offset: -2, count: 1, dur: 40, cal: 400, type: 'cycling' },
      { offset: -3, count: 2, dur: 20, cal: 200, type: 'rope' },
      { offset: -4, count: 1, dur: 35, cal: 300, type: 'badminton' },
      { offset: -5, count: 1, dur: 30, cal: 280, type: 'running' },
      { offset: -6, count: 1, dur: 45, cal: 450, type: 'weightlifting' },
      { offset: -8, count: 1, dur: 30, cal: 300, type: 'running' },
      { offset: -10, count: 1, dur: 60, cal: 600, type: 'swimming' },
      { offset: -15, count: 1, dur: 25, cal: 250, type: 'yoga' }
    ],
    mock2: [
      { offset: -0, count: 1, dur: 20, cal: 200, type: 'running' },
      { offset: -2, count: 1, dur: 30, cal: 240, type: 'cycling' },
      { offset: -5, count: 1, dur: 25, cal: 200, type: 'running' }
    ],
    mock3: [
      { offset: -1, count: 1, dur: 40, cal: 360, type: 'dance' },
      { offset: -3, count: 1, dur: 20, cal: 160, type: 'yoga' },
      { offset: -7, count: 1, dur: 30, cal: 300, type: 'running' }
    ]
  }
  Object.keys(plan).forEach(openid => {
    plan[openid].forEach((item, i) => {
      list.push({
        _id: `c_${openid}_${i}`,
        _openid: openid,
        groupId: 'g1',
        openid,
        checkDate: dayStr(-item.offset),
        sportType: item.type,
        duration: item.dur,
        calories: item.cal,
        count: item.count,
        imageFileId: '',
        remark: '',
        createTime: new Date(Date.now() - item.offset * 86400000)
      })
    })
  })
  return list
}

let mockCheckins = buildMockCheckins()

function userByOpenid(openid) {
  return mockUsers.find(u => u.openid === openid) || mockUsers[0]
}

function weekRange() {
  const r = dateUtil.getWeekRange(dateUtil.today())
  return { start: r.start, end: r.end }
}

function monthRange() {
  const r = dateUtil.getMonthRange(dateUtil.today())
  return { start: r.start, end: r.end }
}

function inRange(dateStr, start, end) {
  return dateStr >= start && dateStr <= end
}

function aggGroup(groupId, period) {
  const range = period === 'month' ? monthRange() : weekRange()
  const rows = mockCheckins.filter(c =>
    c.groupId === groupId && inRange(c.checkDate, range.start, range.end)
  )
  const map = {}
  rows.forEach(c => {
    if (!map[c.openid]) {
      map[c.openid] = { openid: c.openid, count: 0, totalCalories: 0, totalDuration: 0 }
    }
    map[c.openid].count += c.count
    map[c.openid].totalCalories += c.calories
    map[c.openid].totalDuration += c.duration
  })
  return Object.keys(map).map(k => {
    const u = userByOpenid(k)
    return {
      openid: k,
      nickName: u.nickName,
      avatarUrl: u.avatarUrl,
      count: map[k].count,
      totalCalories: Math.round(map[k].totalCalories),
      totalDuration: map[k].totalDuration
    }
  })
}

function statsOf(openid, groupId) {
  const rows = mockCheckins.filter(c => c.openid === openid && (!groupId || c.groupId === groupId))
  const w = weekRange()
  const m = monthRange()
  const weekCount = rows.filter(c => inRange(c.checkDate, w.start, w.end)).reduce((s, c) => s + c.count, 0)
  const weekCalories = rows.filter(c => inRange(c.checkDate, w.start, w.end)).reduce((s, c) => s + c.calories, 0)
  const monthRows = rows.filter(c => inRange(c.checkDate, m.start, m.end))
  const monthCount = monthRows.reduce((s, c) => s + c.count, 0)
  const monthCalories = monthRows.reduce((s, c) => s + c.calories, 0)
  const totalCount = rows.reduce((s, c) => s + c.count, 0)
  const dates = Array.from(new Set(rows.map(c => c.checkDate))).sort()
  let streak = 0
  let cursor = dateUtil.today()
  if (!dates.includes(cursor)) cursor = dateUtil.addDays(cursor, -1)
  while (dates.includes(cursor)) {
    streak++
    cursor = dateUtil.addDays(cursor, -1)
  }
  let max = 0
  let run = 0
  let prev = null
  dates.forEach(d => {
    run = prev && dateUtil.diffDays(prev, d) === 1 ? run + 1 : 1
    if (run > max) max = run
    prev = d
  })
  const monthDaySet = {}
  monthRows.forEach(c => {
    monthDaySet[c.checkDate] = (monthDaySet[c.checkDate] || 0) + c.count
  })
  const monthDays = Object.keys(monthDaySet).sort().map(date => ({ date, count: monthDaySet[date] }))
  return {
    weekCount,
    weekCalories: Math.round(weekCalories),
    monthCount,
    monthCalories: Math.round(monthCalories),
    totalCount,
    streakDays: streak,
    maxStreakDays: Math.max(max, streak),
    monthDays,
    newMilestones: [],
    today: dateUtil.today()
  }
}

// ---------------- 云函数 Mock ----------------

const handlers = {
  login() {
    return { code: 0, message: 'ok', data: Object.assign({}, userByOpenid(MOCK_OPENID), { isNew: false }) }
  },

  getMyGroups() {
    return { code: 0, message: 'ok', data: mockGroups.map(g => ({ ...g, role: 'owner' })) }
  },

  getGroupInfo({ groupId }) {
    const group = mockGroups.find(g => g._id === groupId)
    if (!group) return { code: 2, message: '群不存在' }
    return { code: 0, message: 'ok', data: { group, role: 'owner', isMember: true, isOwner: true } }
  },

  getGroupMembers({ groupId }) {
    const members = mockMembers.filter(m => m.groupId === groupId).map(m => ({
      ...m,
      nickName: userByOpenid(m.openid).nickName,
      avatarUrl: userByOpenid(m.openid).avatarUrl
    }))
    return { code: 0, message: 'ok', data: { members } }
  },

  getGroupRanking({ groupId, period, sortBy }) {
    const period2 = period === 'month' ? 'month' : 'week'
    const sortField = sortBy === 'calories' ? 'totalCalories' : sortBy === 'duration' ? 'totalDuration' : 'count'
    const list = aggGroup(groupId || 'g1', period2)
    list.sort((a, b) => b[sortField] - a[sortField] || b.count - a.count || a.openid.localeCompare(b.openid))
    list.forEach((item, idx) => { item.rank = idx + 1 })
    const top = list.slice(0, 50)
    const myIndex = top.findIndex(t => t.openid === MOCK_OPENID)
    const fullIndex = list.findIndex(t => t.openid === MOCK_OPENID)
    return {
      code: 0,
      message: 'ok',
      data: {
        list: top,
        myRank: fullIndex >= 0 ? fullIndex + 1 : 0,
        myData: fullIndex >= 0 ? { ...list[fullIndex], rank: fullIndex + 1 } : null,
        period: period2,
        sortBy: sortBy === 'calories' ? 'calories' : sortBy === 'duration' ? 'duration' : 'count'
      }
    }
  },

  getMyStats({ groupId }) {
    return { code: 0, message: 'ok', data: statsOf(MOCK_OPENID, groupId || '') }
  },

  createGroup({ name, description, sportTheme }) {
    const group = {
      _id: 'g' + Date.now(),
      _openid: MOCK_OPENID,
      name,
      description: description || '',
      sportTheme: sportTheme || 'general',
      inviteCode: 'MOCK' + Math.floor(100 + Math.random() * 900),
      ownerOpenid: MOCK_OPENID,
      memberCount: 1,
      createTime: new Date(),
      status: 'active',
      role: 'owner'
    }
    mockGroups.unshift(group)
    mockMembers.push({ _id: 'm' + Date.now(), _openid: MOCK_OPENID, groupId: group._id, openid: MOCK_OPENID, role: 'owner', nickName: '本地测试', avatarUrl: '' })
    return { code: 0, message: 'ok', data: { _id: group._id, inviteCode: group.inviteCode } }
  },

  joinGroup({ inviteCode }) {
    const group = mockGroups.find(g => g.inviteCode === inviteCode && g.status === 'active')
    if (!group) return { code: 2, message: '邀请码不存在' }
    if (mockMembers.some(m => m.groupId === group._id && m.openid === MOCK_OPENID)) {
      return { code: 4, message: '你已加入该群' }
    }
    mockMembers.push({ _id: 'm' + Date.now(), _openid: MOCK_OPENID, groupId: group._id, openid: MOCK_OPENID, role: 'member', nickName: '本地测试', avatarUrl: '' })
    group.memberCount++
    return { code: 0, message: 'ok', data: { groupId: group._id, name: group.name } }
  },

  updateGroup({ groupId, name, description }) {
    const group = mockGroups.find(g => g._id === groupId)
    if (!group) return { code: 2, message: '群不存在' }
    group.name = name
    group.description = description || ''
    return { code: 0, message: 'ok', data: {} }
  },

  removeMember({ groupId, targetOpenid }) {
    const idx = mockMembers.findIndex(m => m.groupId === groupId && m.openid === targetOpenid)
    if (idx >= 0) {
      mockMembers.splice(idx, 1)
      const group = mockGroups.find(g => g._id === groupId)
      if (group) group.memberCount = Math.max(0, group.memberCount - 1)
      mockCheckins = mockCheckins.filter(c => !(c.groupId === groupId && c.openid === targetOpenid))
    }
    return { code: 0, message: 'ok', data: {} }
  },

  dismissGroup({ groupId }) {
    mockGroups = mockGroups.filter(g => g._id !== groupId)
    mockMembers = mockMembers.filter(m => m.groupId !== groupId)
    mockCheckins = mockCheckins.filter(c => c.groupId !== groupId)
    return { code: 0, message: 'ok', data: {} }
  },

  leaveGroup({ groupId }) {
    const group = mockGroups.find(g => g._id === groupId)
    if (group && group.ownerOpenid === MOCK_OPENID) {
      return handlers.dismissGroup({ groupId })
    }
    mockMembers = mockMembers.filter(m => !(m.groupId === groupId && m.openid === MOCK_OPENID))
    mockCheckins = mockCheckins.filter(c => !(c.groupId === groupId && c.openid === MOCK_OPENID))
    if (group) group.memberCount = Math.max(0, group.memberCount - 1)
    return { code: 0, message: 'ok', data: { dismissed: false } }
  },

  submitCheckin(event) {
    const c = {
      _id: 'c' + Date.now() + Math.floor(Math.random() * 1000),
      _openid: MOCK_OPENID,
      groupId: event.groupId,
      openid: MOCK_OPENID,
      checkDate: event.checkDate,
      sportType: event.sportType,
      duration: event.duration,
      calories: event.calories,
      count: event.count,
      imageFileId: event.imageFileId || '',
      remark: event.remark || '',
      createTime: new Date(),
      updateTime: new Date()
    }
    mockCheckins.push(c)
    return { code: 0, message: 'ok', data: { _id: c._id } }
  },

  updateCheckin(event) {
    const c = mockCheckins.find(x => x._id === event.checkinId)
    if (!c) return { code: 2, message: '记录不存在' }
    Object.assign(c, {
      groupId: event.groupId,
      checkDate: event.checkDate,
      sportType: event.sportType,
      duration: event.duration,
      calories: event.calories,
      count: event.count,
      imageFileId: event.imageFileId || '',
      remark: event.remark || '',
      updateTime: new Date()
    })
    return { code: 0, message: 'ok', data: {} }
  },

  deleteCheckin({ checkinId }) {
    mockCheckins = mockCheckins.filter(c => c._id !== checkinId)
    return { code: 0, message: 'ok', data: {} }
  }
}

// ---------------- 数据库 Mock ----------------

function makeOp(op, v) {
  const o = { __op: op, v }
  o.and = next => ({ __op: 'and', conds: [o, next] })
  return o
}

const command = {
  gte: v => makeOp('gte', v),
  lte: v => makeOp('lte', v),
  in: v => ({ __op: 'in', v })
}

function matches(doc, cond) {
  for (const key in cond) {
    const val = cond[key]
    if (val && typeof val === 'object' && val.__op) {
      if (val.__op === 'gte') { if (!(doc[key] >= val.v)) return false }
      else if (val.__op === 'lte') { if (!(doc[key] <= val.v)) return false }
      else if (val.__op === 'in') { if (!(val.v || []).includes(doc[key])) return false }
      else if (val.__op === 'and') {
        for (const c of val.conds) {
          if (!matches(doc, { [key]: c })) return false
        }
      } else return false
    } else if (doc[key] !== val) {
      return false
    }
  }
  return true
}

function collectionStore(name) {
  if (name === 'users') return mockUsers
  if (name === 'groups') return mockGroups
  if (name === 'group_members') return mockMembers
  if (name === 'checkins') return mockCheckins
  return []
}

function database() {
  return {
    command,
    collection(name) {
      return {
        where(cond) {
          let data = collectionStore(name).filter(d => matches(d, cond || {}))
          const q = {
            _data: data,
            _sort: null,
            _skip: 0,
            _limit: Infinity,
            _fields: null,
            orderBy(field, dir) { this._sort = { field, dir }; return this },
            skip(n) { this._skip = n; return this },
            limit(n) { this._limit = n; return this },
            field(f) { this._fields = f; return this },
            get() {
              let arr = this._data.slice()
              if (this._sort) {
                const f = this._sort.field
                arr.sort((a, b) => {
                  const r = String(a[f]).localeCompare(String(b[f]))
                  return this._sort.dir === 'desc' ? -r : r
                })
              }
              arr = arr.slice(this._skip, this._skip + this._limit)
              if (this._fields) {
                arr = arr.map(d => {
                  const o = {}
                  for (const k in this._fields) if (k in d) o[k] = d[k]
                  return o
                })
              }
              return Promise.resolve({ data: arr })
            },
            count() {
              return Promise.resolve({ total: this._data.length })
            }
          }
          return q
        },
        doc(id) {
          return {
            get() {
              const d = collectionStore(name).find(x => x._id === id)
              if (!d) {
                return Promise.reject({ errMsg: 'document.get:fail document not exists' })
              }
              return Promise.resolve({ data: d })
            }
          }
        }
      }
    }
  }
}

function uploadFile({ filePath }) {
  return Promise.resolve({ fileID: 'cloud://mock-env/mock/' + Date.now() + '.jpg', cloudPath: filePath })
}

function getTempFileURL({ fileList }) {
  const list = (fileList || []).map(fileID => ({ fileID, tempFileURL: 'https://example.com/mock.jpg', status: 0 }))
  return Promise.resolve({ fileList: list })
}

function mockCallFunction({ name, data }) {
  const handler = handlers[name]
  const result = handler ? handler(data || {}) : { code: 0, message: 'ok', data: {} }
  return Promise.resolve({ result })
}

function install() {
  if (!wx.cloud) wx.cloud = {}
  wx.cloud.init = function () {}
  wx.cloud.callFunction = mockCallFunction
  wx.cloud.database = database
  wx.cloud.uploadFile = uploadFile
  wx.cloud.getTempFileURL = getTempFileURL
  console.log('[mock] 已启用本地 Mock 数据（MOCK_ENABLED=true），不连接云环境')
}

module.exports = { install }
