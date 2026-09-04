# 排行页「总榜」+ 大数紧凑格式化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 排行页新增第 5 个 tab「总榜」（本群全历史累计排行），并对排行页/我的页大数字采用「万/亿两位小数 + 千分位」紧凑展示，杜绝溢出。

**Architecture:** 云函数 `getGroupRanking` 新增 `total` 周期（不加日期过滤、聚合该群全部打卡、仅当前成员）；前端新增纯函数 `utils/format.js#compactNumber` 做展示格式化，排行页与我的页在 setData 前把原始数值换算成展示字符串，WXML 只渲染字符串。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS CommonJS）、微信云开发（wx-server-sdk）。本仓库无单元测试框架，校验采用 `node --check` 语法校验 + `node -e` 对纯函数做断言 + 开发者工具 Mock 走查。

## Global Constraints

- 展示格式规则（spec 已定，勿改）：`>=1e8` → `X.XX亿`；`>=1e4` → `X.XX万`；`<1e4` → 千分位整数（如 `9,876`）。万/亿固定两位小数、四舍五入、**不省尾零**（`10000 → 1.00万`）。
- Tab 文案：**总榜**，period value 统一用 `total`。
- 云函数写/读数据沿用现有集合权限约定（本功能只读 checkins/group_members/users，仅云函数改动，不带 `_openid`）。
- 缓存：`getGroupRanking` 沿用 60s，缓存 key 含 period，`total` 天然独立；`refresh` 参数语义不变。
- 排行仅统计**当前群成员**；非成员仍返回 `code:3`。
- 不新增任何注释；遵循仓库既有代码风格。
- push 前必须征得用户同意（项目 AGENTS.md）。

---

### Task 1: 新增纯函数 `utils/format.js`

**Files:**
- Create: `miniprogram/utils/format.js`
- Test: 命令行 `node -e` 断言（无测试框架）

**Interfaces:**
- Produces: `module.exports = { compactNumber(n) }` — `n:number → string`。`compactNumber` 供 Task 4、5 消费。

- [ ] **Step 1: 创建 `miniprogram/utils/format.js`**

```js
function compactNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '' + n
  const neg = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e8) return neg + (abs / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return neg + (abs / 1e4).toFixed(2) + '万'
  return neg + Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

module.exports = { compactNumber }
```

- [ ] **Step 2: 运行断言**

Run:
```bash
node -e "const {compactNumber}=require('./miniprogram/utils/format.js');const t=(a,b)=>console.assert(compactNumber(a)===b,a+' => '+compactNumber(a)+' expect '+b);t(9876,'9,876');t(999,'999');t(10000,'1.00万');t(12345,'1.23万');t(12345678,'1234.57万');t(100000000,'1.00亿');t(234567890,'2.35亿');t(9999,'9,999');console.log('format OK')"
```
Expected: prints `format OK`, no assertion errors.

- [ ] **Step 3: 提交**

```bash
git add miniprogram/utils/format.js && git commit -m "feat: 新增大数紧凑格式化 compactNumber"
```

---

### Task 2: Mock 与常量支持 `total`

**Files:**
- Modify: `miniprogram/utils/mock.js`（`aggGroup` 168-196 行、`getGroupRanking` handler 271-291 行）
- Modify: `miniprogram/utils/constants.js`（`RANK_PERIODS` 72-77 行）

**Interfaces:**
- Consumes: 无。
- Produces: `aggGroup(groupId, 'total')` 返回该群全历史累计列表；handler 对 `total` 透传；`constants.RANK_PERIODS` 含 total。

- [ ] **Step 1: `mock.js` `aggGroup` 支持 total**

将 `aggGroup` 开头改为（其余不变）：

```js
function aggGroup(groupId, period) {
  let range = null
  if (period !== 'total') {
    range = weekRange()
    if (period === 'month') range = monthRange()
    else if (period === 'lastWeek') range = lastWeekRange()
    else if (period === 'lastMonth') range = lastMonthRange()
  }
  const rows = mockCheckins.filter(c =>
    c.groupId === groupId && (!range || inRange(c.checkDate, range.start, range.end))
  )
```

- [ ] **Step 2: `mock.js` `getGroupRanking` handler 透传 total**

把 handler 内 `period2` 赋值改为：

```js
const period2 = ['total', 'lastWeek', 'lastMonth', 'month'].indexOf(period) >= 0 ? period : 'week'
```

- [ ] **Step 3: `constants.js` `RANK_PERIODS` 追加 total**

```js
  RANK_PERIODS: [
    { value: 'week', label: '本周' },
    { value: 'lastWeek', label: '上周' },
    { value: 'month', label: '本月' },
    { value: 'lastMonth', label: '上月' },
    { value: 'total', label: '总榜' }
  ],
```

- [ ] **Step 4: 语法校验**

Run: `node --check "D:\workspace\MoveClan\miniprogram\utils\mock.js" && node --check "D:\workspace\MoveClan\miniprogram\utils\constants.js" && echo OK`
Expected: prints `OK`.

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/mock.js miniprogram/utils/constants.js && git commit -m "feat: mock/常量支持排行 total 周期"
```

---

### Task 3: 云函数 `getGroupRanking` 支持 `total`

**Files:**
- Modify: `cloudfunctions/getGroupRanking/index.js`（112 行 period 白名单、151-164 行日期范围/取数）

**Interfaces:**
- Produces: `period === 'total'` 时返回 `{ code:0, data:{ list, myRank, myData, period:'total', sortBy } }`，list 为该群**全部历史**按当前成员聚合。

- [ ] **Step 1: period 白名单加 total**

第 112 行改为：

```js
  const period = ['week', 'lastWeek', 'month', 'lastMonth', 'total'].indexOf(event.period) >= 0 ? event.period : 'week'
```

- [ ] **Step 2: total 时跳过日期过滤**

把 151-164 行整段（从 `const range = todayCN()` 到 `fetchAll({...})`）替换为：

```js
    let rows
    if (period === 'total') {
      rows = await fetchAll({ groupId })
    } else {
      const range = todayCN()
      const start = range[RANGE_MAP[period][0]]
      const end = range[RANGE_MAP[period][1]]
      rows = await fetchAll({
        groupId,
        checkDate: _.gte(start).and(_.lte(end))
      })
    }
```

（`RANGE_MAP` 声明保留在原位置不动；确认其仅剩 4 个周期映射，无 total 项即可。）

- [ ] **Step 3: 语法校验**

Run: `node --check "D:\workspace\MoveClan\cloudfunctions\getGroupRanking\index.js" && echo OK`
Expected: prints `OK`.

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/getGroupRanking/index.js && git commit -m "feat: getGroupRanking 支持 total 全历史排行"
```

---

### Task 4: 排行页「总榜」tab + 大数格式化

**Files:**
- Modify: `miniprogram/pages/ranking/ranking.js`
- Modify: `miniprogram/pages/ranking/ranking.wxml`
- Modify: `miniprogram/pages/ranking/ranking.wxss`

**Interfaces:**
- Consumes: `compactNumber`（`../../utils/format.js`）。

- [ ] **Step 1: `ranking.js` 引入并格式化**

- 顶部第 2 行后新增：`const format = require('../../utils/format')`
- `PERIOD_TEXT` 加 `total: '总榜'`（第 6 行）
- data 内 `periodLabels`（第 17 行）改为 `['本周', '上周', '本月', '上月', '总榜']`
- 新增方法（放在 `goGroups` 前）：

```js
  emptyTextFor(period) {
    if (period === 'total') return '本群暂无打卡数据'
    return (PERIOD_TEXT[period] || '本周') + '暂无打卡数据'
  },

  decorate(item) {
    const sortBy = this.data.sortBy
    const countText = format.compactNumber(item.count)
    const calText = format.compactNumber(item.totalCalories)
    const minText = format.compactNumber(item.totalDuration)
    const isMe = item.openid === this.data.myOpenid
    const valueText =
      sortBy === 'count' ? countText + ' 次'
        : sortBy === 'calories' ? calText + ' 千卡'
          : minText + ' 分钟'
    return {
      ...item,
      isMe,
      medal: item.rank <= 3 ? item.rank : 0,
      statLine: countText + '次 · ' + calText + '千卡 · ' + minText + '分钟',
      valueText
    }
  },
```

- `loadRanking` 的 `.then` 内 list 映射（90-94 行）替换为：

```js
        const list = (data.list || []).map(item => this.decorate(item))
        this.setData({
          list,
          myRank: data.myRank,
          myData: data.myData ? this.decorate(data.myData) : null
        })
```

- `onPeriodChange`（112-117 行）内 `emptyText` 改为 `this.emptyTextFor(period)`。

- [ ] **Step 2: `ranking.wxml` 加第 5 个 tab 并改绑文本**

- 在「上月」tab `</view>`（29 行）后插入：

```xml
    <view
      class="tab {{period === 'total' ? 'active' : ''}}"
      data-period="total"
      bindtap="onPeriodChange"
    >总榜</view>
```

- 副行（85 行）改为：`<view class="rank-sub">{{item.statLine}}</view>`
- 右侧值（88 行）改为：`<view class="rank-value">{{item.valueText}}</view>`
- 底部我的排名值（97 行）改为：`{{myData.statLine}}`

- [ ] **Step 3: `ranking.wxss` 大数兜底**

`.rank-value`（161-167 行）改为：

```css
.rank-value {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--primary);
  flex-shrink: 0;
  margin-left: 12rpx;
  max-width: 240rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: 语法校验**

Run:
```bash
node --check "D:\workspace\MoveClan\miniprogram\pages\ranking\ranking.js" && echo OK
```
Expected: prints `OK`。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/ranking/ && git commit -m "feat: 排行页新增总榜 tab 与大数紧凑显示"
```

---

### Task 5: 我的页 stats 大数格式化

**Files:**
- Modify: `miniprogram/pages/profile/profile.js`
- Modify: `miniprogram/pages/profile/profile.wxml`

**Interfaces:**
- Consumes: `compactNumber`。

- [ ] **Step 1: `profile.js` 引入并生成 statsText**

- 顶部 `dateUtil` require 后新增：`const format = require('../../utils/format')`
- data 内（19 行 `statsLoaded` 前）加默认：

```js
    statsText: {
      totalCountText: '0',
      totalCaloriesText: '0',
      weekLine: '',
      monthLine: ''
    },
```

- `loadStats`（74-75 行）改为：

```js
      const stats = await api.call('getMyStats', { refresh: !!pull }, { loading: false })
      const fmt = format.compactNumber
      const statsText = {
        totalCountText: fmt(stats.totalCount),
        totalCaloriesText: fmt(stats.totalCalories),
        weekLine: '本周 ' + fmt(stats.weekCount) + '次 / ' + fmt(stats.weekCalories) + '千卡',
        monthLine: '本月 ' + fmt(stats.monthCount) + '次 / ' + fmt(stats.monthCalories) + '千卡'
      }
      this.setData({ stats, statsText, statsLoaded: true })
```

- [ ] **Step 2: `profile.wxml` 改绑**

- 38 行 `{{stats.totalCount}}` → `{{statsText.totalCountText}}`
- 42 行 `{{stats.totalCalories}}` → `{{statsText.totalCaloriesText}}`
- 51 行整行 text 替换为：`<text>{{statsText.weekLine}}</text>`
- 52 行整行 text 替换为：`<text>{{statsText.monthLine}}</text>`

- [ ] **Step 3: 语法校验**

Run:
```bash
node --check "D:\workspace\MoveClan\miniprogram\pages\profile\profile.js" && echo OK
```
Expected: prints `OK`。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/profile/ && git commit -m "feat: 我的页总卡路里/打卡数大数紧凑显示"
```

---

### Task 6: 全量校验 + CHANGELOG + 提交

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: 全量语法与 JSON 校验**

Run:
```bash
$ErrorActionPreference='Stop'
$js = Get-ChildItem -Path "D:\workspace\MoveClan" -Recurse -Include *.js | Where-Object { $_.FullName -notmatch 'node_modules' }
$fail = 0
foreach ($f in $js) { & node --check $f.FullName 2>$null; if ($LASTEXITCODE -ne 0) { $fail++; Write-Output ("JS FAIL: "+$f.FullName) } }
$json = Get-ChildItem -Path "D:\workspace\MoveClan" -Recurse -Include *.json | Where-Object { $_.FullName -notmatch 'node_modules' }
foreach ($f in $json) { try { Get-Content -Raw -LiteralPath $f.FullName | ConvertFrom-Json | Out-Null } catch { $fail++; Write-Output ("JSON FAIL: "+$f.FullName) } }
Write-Output ("FAIL total: "+$fail)
```
Expected: `FAIL total: 0`。

- [ ] **Step 2: CHANGELOG 顶部追加 v1.11 条目**

在文件顶部（第一个 `#`/`##` 标题前）写入：

```markdown
## v1.11 — 排行「总榜」+ 大数紧凑显示（2026-09-04，工作区，待提交）

### 变更内容
- 排行页新增第 5 个 tab「总榜」：统计本群创建至今全部打卡（次数/千卡/分钟）累计排行，可按 3 指标排序；仍仅统计当前群成员；空群显示「本群暂无打卡数据」。
- 大数紧凑格式化 `utils/format.js#compactNumber`：≥1亿 → X.XX亿、≥1万 → X.XX万（两位小数）、<1万 → 千分位。
- 排行页列表副行/主指标/我的排名条、我的页总打卡次数/总卡路里/本周·本月副行均改用紧凑显示，避免长数字溢出布局。
- 常量 `RANK_PERIODS`、Mock 层同步支持 `total`。

### 重新部署需要进行的操作
1. 云函数（云端安装依赖）：重部署 `getGroupRanking`
2. 前端：重新编译小程序

---

```

- [ ] **Step 3: 提交**

```bash
git add -A && git commit -m "feat: v1.11 排行总榜与大数紧凑显示（CHANGELOG）"
```

- [ ] **Step 4: 汇报并询问推送**

向用户汇报改动范围、校验结果、部署清单，询问是否推送（AGENTS.md 规则：push 前必须询问）。
