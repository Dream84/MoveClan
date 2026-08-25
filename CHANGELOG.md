# 变更日志（CHANGELOG）

本项目为微信小程序 + 云开发应用。每个版本条目列出「变更内容」与「重新部署需要进行的操作」。

## v0.6.0 — 代码审查修复（2026-08-25，工作区，待提交）

### 变更内容
- **安全修复**：
  - 排行榜缓存此前把「我的排名/我的数据」按群级 key 缓存，同一分钟内其他成员可能拿到别人的排名数据 → 改为只缓存群列表，`myRank`/`myData` 每次按请求者即时计算；
  - `groups` 集合权限由「所有用户可读」收紧为「仅管理端可读写」，新增云函数 `getMyGroups`（60s 缓存）读取群列表，`getGroupInfo` 增加成员身份校验，堵住邀请码被任意读取绕过入群的问题。
- **Bug 修复**：
  - 排行榜按「卡路里/时长」排序失效（字段名与排序字段不匹配，实际回落为按次数）→ 增加字段映射；
  - 排名第 51 名及之后的成员 `myRank`/`myData` 错误 → 改为基于全量排序列表计算；
  - `updateCheckin` 未校验目标群成员身份，可把记录挪到非成员群 → 增加校验；
  - `createGroup` 群/成员两次写入失败无补偿 → 成员写入失败时回滚删除群文档；邀请码唯一索引冲突自动重试；
  - `backfill-openid.js` 对缺 `openid` 的记录会无限循环 → 增加已处理集合防死循环；
  - `getMyStats` 带群参数时无成员校验 → 增加校验。
- **前端修复**：
  - 首页切群不传播到打卡表单（`setCurrentGroup` 从未被调用）→ 切群/加载时同步到全局，且切群、onShow 后保持所选群不回跳第一个；
  - 最近打卡按 `openid` 分页后客户端过滤群，跨群用户分页错乱 → 查询条件加入 `groupId`，新增索引 `(groupId, openid, checkDate)`；
  - 切群时旧群分页请求可能覆盖新群数据 → 增加请求时效校验；
  - 排行页快速切换时旧响应覆盖新结果 → 增加请求序号防乱序；
  - 「我的」日历每月仅取 20 条（客户端上限）→ 分页拉全；
  - 「我的」统计加载失败卡骨架屏 → try/finally 兜底；
  - 头像 URL 仅在 `cloud://` 时追加缩略参数，避免污染非云存储地址；头像上传路径改用真实 openid；
  - 打卡成就弹窗仅在新建时触发；事件处理补 catch 防未处理拒绝；`wx:key` 修正；日历初始月份修正。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：
   - 新增：`getMyGroups`（含 cache 依赖，必须云端安装依赖）
   - 重部署：`getGroupRanking`、`getGroupInfo`、`updateCheckin`、`createGroup`、`getMyStats`
2. **数据库**：
   - `groups` 集合权限改为「仅管理端可读写」；
   - `checkins` 新建索引 `(groupId, openid, checkDate)`；
   - 存量数据回填 `_openid`（如存在旧数据，用 `database/backfill-openid.js`）。
3. **前端**：重新编译小程序。

---

## v0.5.0 — 科学估算 + 骨架屏 + 缓存/下拉刷新（2026-08-25，commit 5293b58，含 v0.4.1 内容）

### 变更内容
- **科学估算公式（默认隐藏）**：卡路里估算公式 `消耗热量(千卡) = MET值 × 体重(公斤) × 时长(小时)` 默认不展示；卡路里输入框旁有「?」图标，点击后展开显示公式与当前运动 MET。
- **默认体重 50kg**：未设置体重时估算自动按 50kg 计算，打卡阶段不重复要求填写体重；公式提示中注明「未填体重默认按 50kg 估算」。
- **历史数据体重处理**：`login` 云函数对无有效 `weightKg`（历史数据/旧版本 0 值）的用户自动回填 50；「我的 → 编辑资料」体重为空时预填 50；个人头部体重按「档案值或 50」显示。
- **更多运动类型**：运动类型扩充至 17 种，新增「减脂操、羽毛球、篮球、足球、乒乓球、拳击、举铁、舞蹈、徒步/爬山」，骑行改名为「骑行/单车」，含游泳。
- **MET 值本地常量**：`miniprogram/utils/constants.js` 的 `MET_VALUES` 表（前端本地维护）。
- **云函数同步**：`submitCheckin` / `updateCheckin` 的运动类型白名单同步扩充到 17 种。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：`login`、`submitCheckin`、`updateCheckin`
2. **前端**：重新编译小程序。
3. 无需数据库变更（`weightKg` 为新增可选字段，旧记录无此字段时按未填写处理）。

---

## v0.4.1 — 加载态优化 + 数据缓存与下拉刷新（工作区，待提交）

### 变更内容
- **修复「加载中却显示无数据」**：各页面空状态提示均增加 `loading` 门控，加载完成前不再误显示「无数据/0」。
- **骨架屏动画**：新增全局 `.sk-block`/`.sk-circle` 骨架屏样式（微光扫过动画），首页（本周概览、最近打卡）、排行页、群组页、我的页（统计）、群详情（成员列表）在加载时展示骨架占位。
- **60 秒数据缓存**：`getMyStats`、`getGroupMembers` 新增与排行榜一致的 60 秒内存缓存（`cache` 包），切换页面重复进入不再重复查库。
- **下拉刷新强制更新**：排行/统计/成员接口支持 `refresh` 参数绕过缓存；首页、排行页、我的页、群详情页的下拉刷新均传入 `refresh:true` 获取最新数据。
- **打卡成就检查强制刷新**：提交打卡后的成就检测传 `refresh:true`，避免命中旧缓存导致成就弹窗不触发。
- **群详情并行加载**：`getGroupInfo` 与 `getGroupMembers` 改为 `Promise.all` 并行请求。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：
   - `getMyStats`（新增 `cache` 依赖，必须云端安装依赖）
   - `getGroupMembers`（新增 `cache` 依赖，必须云端安装依赖）
   - `getGroupRanking`（支持 `refresh`，建议一并重部署）
2. **前端**：重新编译小程序。

---

## v0.4.0 — 性能优化 + 群信息编辑 + 头像缩略（2026-08-25 09:53:12，commit 430988b）

### 变更内容
- **排行榜缓存**：`getGroupRanking` 内置 60 秒内存缓存（新增 `cache` 依赖），同一分钟多次查看只查一次数据库，减轻数据库压力。
- **头像图片处理（零成本提速）**：
  - `getGroupRanking` / `getGroupMembers` 将成员 `cloud://` 头像 fileID 批量换临时链接并追加 `imageMogr2/thumbnail/200x` 缩略参数，他人头像可正常显示且加载更快。
  - 首页、我的页、编辑资料弹窗头像：`cloud://` fileID 直接追加 `?imageMogr2/thumbnail/200x`。
  - 打卡编辑页截图预览：temp URL 追加 `thumbnail/320x`。
- **前端分页**：首页「最近打卡」每页 5 条，上滑触底自动加载下一页（`skip`/`limit`）。
- **页面加载提速**：
  - `app.js` 用户信息本地缓存 + `onLaunch` 后台预热登录；
  - 新增 `app.getMyGroups()` 群列表缓存（首页/排行/群组/打卡表单复用），增删改群后 `invalidateMyGroups()` 失效重拉；
  - 首页周概览+最近记录、打卡表单群列表+记录、群详情群信息+成员改为并行加载。
- **群信息编辑**：新增云函数 `updateGroup`（仅群主可修改群名称/简介）；`group-detail` 页群主可见「编辑」按钮，弹窗保存。
- 文档：`README.md`（云函数 14 个 + 性能说明）、`docs/问题修复记录.md`（问题四）。

### 重新部署需要进行的操作
1. **云函数**（开发者工具中逐个右键 →「上传并部署：云端安装依赖」）：
   - `getGroupRanking`（新增 `cache` 依赖，必须云端安装依赖）
   - `getGroupMembers`
   - **`updateGroup`（新函数）**
2. **前端**：重新编译小程序（改动了 `app.js`、6 个页面）。

---

## v0.3.0 — 删除清理 + 最新资料 + 微信头像昵称（2026-08-24 23:28:31，commit e4854db）

### 变更内容
- **删除即清理数据库**：
  - `dismissGroup`：解散群删除该群全部 `group_members`、`checkins`，并物理删除 `groups` 文档；
  - `leaveGroup`：群主退出=解散（同上全删）；成员退出删除本人成员记录 + 本人在该群打卡；
  - `removeMember`：移除成员同步删除其在该群打卡记录。
- **排行榜/成员列表显示最新资料**：`getGroupRanking`、`getGroupMembers` 改用 `users` 集合最新昵称/头像，不再依赖加入时快照；`login` 资料变更时同步刷新该用户所有群成员快照。
- **登录默认使用微信资料**：首页新增「一键设置」引导条，`wx.getUserProfile` 获取微信昵称/头像，上传云存储存 fileID。
- 文档：`docs/问题修复记录.md`（问题三）。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：
   - `login`、`dismissGroup`、`leaveGroup`、`removeMember`、`getGroupRanking`、`getGroupMembers`
2. **前端**：重新编译小程序。

---

## v0.2.1 — `_openid` 修复（2026-08-24 23:06:18，commit 69f7357）

### 变更内容
- 云开发中「仅创建者可读写」权限依赖记录的 `_openid` 字段，但云函数 `add()` 写入不会自动生成。为 `login`(users)、`createGroup`(groups+group_members)、`joinGroup`(group_members)、`submitCheckin`(checkins) 的所有写入手动补充 `_openid: OPENID`，修复客户端查不到自己数据（表现为「没有加入任何群组」）。
- 同步更新 `database/*.init.json` 示例文档与 `README.md`。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：`login`、`createGroup`、`joinGroup`、`submitCheckin`
2. **存量数据回填（重要）**：本修复只影响之后新写入的数据。环境里修复前产生的旧数据（`group_members` / `checkins` 无 `_openid`）仍不可见，需二选一：
   - 测试阶段：清空 `group_members` / `checkins` 后重新创建群、打卡；
   - 保留数据：云开发控制台对无 `_openid` 的记录批量编辑，将 `_openid` 设为该记录 `openid` 字段值。

---

## v0.2.0 — 弹窗冒泡修复（2026-08-24 22:55:43，commit 2aac8ab）

### 变更内容
- 创建群/编辑资料弹窗容器 `catchtap=""` 空处理器无法拦截冒泡，改为 `catchtap="noop"` 并补充 `noop()` 方法，修复「点击弹窗内部即消失」。
- 群详情成员行动态空事件绑定 `bindtap="{{isOwner ? ... : ''}}"` 改为固定 `onMemberRowTap` 并内部判断权限。
- 新增 `docs/问题修复记录.md`（问题一）。

### 重新部署需要进行的操作
- 仅前端：重新编译小程序即可，无云函数改动。

---

## v0.1.0 — 初始版本（2026-08-24 22:41:28，commit 236b2bc）

- 完整小程序源码：4 个 Tab 页 + 群详情/打卡表单 2 个子页 + 日历/彩带 2 组件。
- 14 个云函数（含后续新增说明见 README）。
- 数据库 4 集合初始化 JSON、部署说明 README、设计文档。
- 部署操作详见 `README.md`（建集合/权限/索引 → 部署云函数 → 审核前填写隐私指引）。

---

## 当前累计待部署清单（v0.6.0 全部落地后）

| 动作 | 对象 |
|---|---|
| 新增云函数（云端安装依赖） | `getMyGroups`（含 cache 依赖）、`updateGroup` |
| 重新部署云函数（云端安装依赖） | `login`、`createGroup`、`joinGroup`、`submitCheckin`、`updateCheckin`、`dismissGroup`、`leaveGroup`、`removeMember`、`getGroupRanking`、`getGroupMembers`、`getMyStats`、`getGroupInfo` |
| 数据库配置 | `groups` 权限改「仅管理端可读写」；`checkins` 建索引 `(groupId, openid, checkDate)` |
| 存量数据回填 | `group_members` / `checkins` 补 `_openid`（如环境中有旧数据） |
| 重新编译前端 | 全部页面 |

> 未改动无需重部署的云函数：`deleteCheckin`。
