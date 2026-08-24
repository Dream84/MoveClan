# MoveClan（跃动圈）运动打卡小程序 — 设计文档

- 日期：2026-08-24
- 状态：已确认
- 技术栈：微信小程序原生框架（WXML/WXSS/JS）+ 微信云开发（CloudBase）

## 1. 项目定位

面向微信群的轻量级运动打卡工具。群成员记录每日运动数据，在群内查看周/月排行榜相互激励。
前期访问量小，但需支持截图保存等展示需求，具备扩展性且不超出微信云存储能力。

## 2. 关键决策

| 决策点 | 方案 |
|---|---|
| 打卡与群组归属 | 打卡时由用户选择群组（首页群选择器 + 表单内确认） |
| 排行榜/统计计算 | 实时聚合计算，不做定时快照（预留 `rankSnapshot` 优化说明） |
| 补打卡限制 | 仅限今天 ~ 前 7 天 |
| 订阅消息 | 仅 UI 开关 + 授权请求，模板 ID 占位预留，不写推送云函数 |
| 打卡记录管理 | 支持编辑 + 删除 |
| 成就系统 | 7/14/30 天连续打卡 → 轻量 CSS 彩带弹窗 |
| 通信架构 | 混合模式：读直连数据库（权限规则），写与业务校验走云函数 |
| 内容安全 | openapi `msgSecCheck` v2 / `imgSecCheck`，失败降级放行并记日志 |
| 界面风格 | 暖色运动色系、毛玻璃、圆角、柔和阴影 |

## 3. 数据模型（云数据库 4 集合）

### 3.1 users（用户档案）
权限：仅创建者可读写。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `openid` | string | 唯一 |
| `nickName` | string | 微信昵称 |
| `avatarUrl` | string | 微信头像 |
| `joinTime` | Date | 加入时间 |
| `defaultGroupId` | string? | 打卡默认群（前端记忆） |

### 3.2 groups（运动群）
权限：所有用户可读（群信息不敏感），写全走云函数。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `name` | string | 群名称 |
| `description` | string? | 简介 |
| `sportTheme` | string | running/fitness/swimming/general 等 |
| `inviteCode` | string | 6 位唯一邀请码 |
| `ownerOpenid` | string | 群主 openid |
| `memberCount` | number | 冗余计数 |
| `createTime` | Date | 创建时间 |
| `status` | string | active / dismissed |

### 3.3 group_members（成员关系）
权限：仅创建者可读写，其余走云函数。同一 (groupId, openid) 唯一（云函数先查后插 + 控制台唯一索引）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `groupId` | string | 群 id |
| `openid` | string | 用户 openid |
| `role` | string | owner / member |
| `joinTime` | Date | 加入时间 |
| `nickName` | string | 昵称快照 |
| `avatarUrl` | string | 头像快照 |

### 3.4 checkins（打卡记录）
权限：仅创建者可读写，聚合走云函数。索引：`(groupId, checkDate)` 组合索引，`(openid, checkDate)` 组合索引。

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 自动 |
| `groupId` | string | 群 id |
| `openid` | string | 用户 openid |
| `checkDate` | string | 打卡日期 YYYY-MM-DD |
| `sportType` | string | running/cycling/swimming/rope/yoga/fitness/ball/other |
| `duration` | number | 运动时长（分钟） |
| `calories` | number | 消耗卡路里（千卡） |
| `count` | number | 打卡次数（默认 1） |
| `imageFileId` | string? | 截图 fileID |
| `remark` | string? | 备注 ≤200 字 |
| `createTime` | Date | 创建时间 |
| `updateTime` | Date | 更新时间 |

同群同日允许多条记录（count 字段可调）。编辑/删除后实时聚合自然更新，无脏数据。

## 4. 云函数（13 个）

| 云函数 | 职责 |
|---|---|
| `login` | wx.login 换取 openid，查询/创建 users 档案，同步昵称头像 |
| `createGroup` | 校验输入，生成唯一 6 位邀请码（重试保证唯一），建群 + 写群主成员记录 |
| `joinGroup` | 按邀请码查群，校验未解散、未重复加入，写成员记录 |
| `getGroupInfo` | 群详情 + 调用者角色 |
| `getGroupMembers` | 校验调用者是成员，返回成员列表 |
| `removeMember` | 仅群主，移除成员 |
| `dismissGroup` | 仅群主，置 dismissed（软删） |
| `leaveGroup` | 成员退出；群主退出 = 解散群 |
| `submitCheckin` | 校验成员身份、日期合法（今天~前7天）、内容安全审核、写入 |
| `updateCheckin` | 编辑自己的记录（校验归属 + 内容安全） |
| `deleteCheckin` | 删除自己的记录 |
| `getGroupRanking` | 实时聚合：period(week/month) × sortBy(count/calories/duration)，返回排名 + 我的排名 |
| `getMyStats` | 周/月/累计次数与卡路里、连续天数、最高纪录、本月每日打卡状态（日历）、成就检查 |

### 4.1 排行榜输出格式
每人：`openid`、`nickName`、`avatarUrl`、`count`、`totalCalories`、`totalDuration`，按 sortBy 降序；
返回 `myRank`（当前用户排名，未上榜为 0）。

### 4.2 内容安全降级策略
`cloud.openapi.security.msgSecCheck`（v2，传 scene 与 openid）/ `imgSecCheck`（传 media fileID）。
调用异常或类目不支持（如错误码 87014 类）时降级放行并 `console.error` 记录，不阻断打卡。

## 5. 前端结构

### 5.1 tabBar（4 页）
1. `pages/index/index` — 首页：欢迎语+头像、群选择器、大号打卡按钮、本周概览卡（次数/卡路里/连续天数）、最近 5 条打卡记录（可编辑）
2. `pages/ranking/ranking` — 排行：群选择器、周/月 Tab、排序维度（次数/卡路里/时长）、列表（高亮自己）、底部「我的排名：第 X 名」、下拉刷新
3. `pages/groups/groups` — 群组：创建群组按钮、邀请码加入、群列表（名称/成员数/我的角色）
4. `pages/profile/profile` — 我的：头像昵称、累计数据卡、打卡日历、订阅消息开关（预留）、下拉刷新

### 5.2 子页面 / 组件
- `pages/checkin-edit/checkin-edit` — 打卡表单（新建/编辑共用）：日期 picker（今天~前7天）、运动类型 picker、时长/卡路里/次数输入、卡路里估算参考、截图上传（wx.chooseMedia + 云上传进度条）、备注 ≤200 字
- `pages/group-detail/group-detail` — 群详情：群信息、邀请码复制、成员列表（角色标签）、退出/解散
- `components/calendar/` — 日历组件（月切换、颜色深浅按当日次数）
- `components/confetti/` — 成就彩带弹窗（CSS 动画）

### 5.3 全局
- `app.js`：云环境初始化（env 从 `config.js` 读）
- `app.json`：tabBar/页面/window，暖色风格
- `app.wxss`：毛玻璃/圆角/柔和阴影设计变量
- `config.js`：云环境 env ID、订阅消息模板占位、内容安全开关

## 6. 交互与体验
- 打卡成功 → 「🎉 打卡成功」Toast + 成就检查（7/14/30 天连续 → confetti 弹窗）
- 排行榜当前用户行浅橙色高亮
- 排行页、我的页支持下拉刷新
- 所有请求显示 Loading；图片上传显示进度条
- 删除/退出/解散等破坏性操作二次确认

## 7. 安全与合规
- 文本/图片走内容安全接口（含降级策略）
- 打卡记录权限：仅创建者可读写 + 云函数校验成员身份，防跨群访问
- 群成员列表、排行榜经云函数校验调用者为群成员
- 部署文档包含：隐私保护指引填写说明、`privacy` 相关说明

## 8. 交付物
```
MoveClan/
├── project.config.json、sitemap.json
├── app.js / app.json / app.wxss / config.js
├── pages/          (index, ranking, groups, profile, group-detail, checkin-edit)
├── components/     (calendar, confetti)
├── cloudfunctions/ (13 个云函数，各含 index.js + package.json)
├── database/       (4 集合初始化 JSON：索引建议 + 权限说明 + 示例文档)
└── README.md       (部署说明)
```

## 9. 部署说明要点（README）
1. 注册小程序、开通云开发、创建环境，env ID 填入 `config.js`
2. 创建 4 集合并设置权限（第 3 节所述）与索引
3. 逐个部署云函数（云端安装依赖）；云开发控制台开通「开放接口」权限（内容安全）
4. 真机预览；提交审核前填写「用户隐私保护指引」
5. 后续优化：`rankSnapshot` 定时快照云函数 + 每日更新触发器
