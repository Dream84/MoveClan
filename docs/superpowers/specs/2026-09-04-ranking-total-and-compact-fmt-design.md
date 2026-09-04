# 设计：排行页「总榜」+ 大数紧凑格式化

日期：2026-09-04
状态：已批准

## 目标

1. 排行页新增第 5 个 tab「总榜」，按本群**全历史累计**（打卡次数/消耗千卡/运动分钟）排行，可与现有 3 个指标排序。
2. 数值过大时（总榜累计、我的页总卡路里等）不破坏布局、可读性良好，采用**万/亿紧凑缩写 + 千分位**。

## 已确认决策

- Tab 标签字：**总榜**（value: `total`）。
- 统计范围：该群创建至今全部打卡累计；仅统计**当前群成员**（退群者不计，与现有 tab 一致）。
- 大数显示规则（`compactNumber`）：
  - `>= 1e8` → `X.XX亿`（两位小数，四舍五入，不省尾零）
  - `>= 1e4` → `X.XX万`
  - `< 1e4` → 千分位整数（如 `9,876`）
- 格式化作用于：排行页列表（副行 statLine、右侧主指标 valueText、底部我的排名）与我的页 stats 卡片（总打卡次数、总卡路里、本周/本月副行）；最高连续天数等小数字不缩写（统一走同函数，函数内 <1万 只是千分位，效果一致）。
- 其他页面（feed 单条、群详情成员总量等）本轮**不改**。

## 改动文件

### 1. 云函数 `cloudfunctions/getGroupRanking/index.js`
- 合法 period 列表加 `total`。
- `period === 'total'` 时不追加 `checkDate` 过滤（fetchAll 取该群全部 checkins）。
- 成员过滤（当前群成员 openidSet）、排序/破平、top50、myRank、60s 缓存逻辑不变；缓存 key `rank:{groupId}:total:{sortBy}` 天然独立。

### 2. 新增 `miniprogram/utils/format.js`
- `module.exports.compactNumber(n)`：实现上述规则。输入为整数（count/千卡/分钟均已取整）。输出字符串，负数等异常输入直接返回 `'' + n`。

### 3. 前端排行页 `pages/ranking/`
- `ranking.wxml`：第 5 个 tab `<view data-period="total">总榜</view>`；副行改绑 `statLine`；右侧主指标改绑 `valueText`；底部我的排名绑 `myData.statLine`。
- `ranking.js`：
  - `PERIOD_TEXT`/`periodLabels` 加 `total: '总榜'`；`period` 合法集合加 total。
  - 空态：total 时 `本群暂无打卡数据`，其余仍为 `<期间>暂无打卡数据`。
  - `loadRanking` 映射 list 时，用 `compactNumber` 预计算每项 `statLine`（`X次 · Y千卡 · Z分钟`）与按当前 `sortBy` 的 `valueText`（含单位），`myData` 同样预处理。
- `ranking.wxss`：`rank-value` 加 `max-width + white-space:nowrap + overflow:hidden + text-overflow:ellipsis` 兜底；`rank-sub` 允许换行不挤压。

### 4. 我的页 `pages/profile/`
- `profile.js`：`loadStats` 拿到 stats 后生成 `statsText = { totalCountText, totalCaloriesText, weekLine, monthLine }` 一并 setData。weekLine=`本周 {fmt(weekCount)}次 / {fmt(weekCalories)}千卡`，monthLine 同理。
- `profile.wxml`：stats 大卡改绑 `statsText.totalCountText/totalCaloriesText`；副行两行改绑 `statsText.weekLine/monthLine`。

### 5. Mock 与常量
- `miniprogram/utils/mock.js`：
  - `aggGroup(groupId, period)`：`period === 'total'` 时跳过日期过滤（range 置空）。
  - `getGroupRanking` handler：period 白名单透传 total；返回 `period: period2`。
- `miniprogram/utils/constants.js`：`RANK_PERIODS` 追加 `{ value: 'total', label: '总榜' }`。

## 数据流

```
云函数 getGroupRanking(period=total)         我的页 getMyStats(不变)
  ├─ fetchAll 全群 checkins(无日期过滤)          ├─ 返回数值字段(不变)
  ├─ 按当前成员聚合 count/cal/分钟               └─ profile.js compactNumber → statsText
  └─ 返回 list/myRank/myData(原始数值)
        │
        └─ ranking.js compactNumber → statLine/valueText → setData
```

## 错误处理与边界

- 全新群无打卡：总榜列表空，空态文案 `本群暂无打卡数据`。
- total 数据量可能大于单周期：fetchAll 已按 100/页 分页拉全量。
- 非成员访问：沿用现有 code:3。
- 格式化异常输入（NaN/负数/非数）：回退原始值字符串。

## 校验

- 对全部改动 JS 执行 `node --check`；JSON 语法校验。
- Mock 预览走查：5 tab 切换、3 指标排序、空群文案、大数显示。

## 部署

- 需重部署云函数：`getGroupRanking`。
- 其余为前端改动：重新编译小程序。
- 我的页格式化纯前端，无需部署云函数。

## 备注

- 文档编号 v1.11；CHANGELOG 追加条目并同步更新。
- 后续如群详情等也要统一大数格式，抽出 utils/format.js 已就绪，直接复用。
