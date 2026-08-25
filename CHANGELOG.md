# 变更日志（CHANGELOG）

本项目为微信小程序 + 云开发应用。每个版本条目列出「变更内容」与「重新部署需要进行的操作」。

## v1.7.5 — 默认昵称改为「用户+随机串」（2026-08-25，工作区，待提交）

### 变更内容
- 首次登录未授权微信资料时，默认昵称由「微信用户」改为 **「用户」+ 6 位随机字符**（如 `用户a3f9k2`），避免多名默认用户重名。
- 各云函数显示兜底统一为「用户」；首页「一键设置」引导条对默认昵称（`用户` 开头）同样显示，换昵称/头像后消失。

### 重新部署需要进行的操作
- 云函数：重部署 `login`（新建用户时生成默认昵称）；其余 `joinGroup`/`createGroup`/`getFeed`/`getGroupRanking`/`commentCheckin` 为显示兜底，可一并重部署
- 前端：重新编译小程序

---

## v1.7.4 — 打卡图片上传前压缩（2026-08-25，commit 6bef500）

### 变更内容
- 打卡图片选择已用 `wx.chooseMedia` 的 `sizeType:['compressed']`；在此基础上新增 `wx.compressImage` 硬压缩后再上传，显著减小存储与上传体积。
- 新增功能配置（`miniprogram/settings.js`）：`CHECKIN_IMAGE_QUALITY`（质量，默认 80）、`CHECKIN_IMAGE_MAX_WIDTH`（最大宽度，默认 1280，高度等比）。
- 压缩失败自动降级（去掉宽度限制重试 → 仍失败则上传原压缩件），不影响打卡。
- 展示侧：动态列表只显示 320px 缩略图（`imageMogr2/thumbnail`），**点按预览时才加载原图**（`getFeed` 新增返回 `imageFullUrl` 原图链接），列表加载体积最小。

### 重新部署需要进行的操作
- **仅前端**：重新编译小程序即可。

---

## v1.7.3 — 使用 logo.png 作为小程序 Logo（2026-08-25，commit 0285e47）

### 变更内容
- 小程序 Logo 原图存放于 `miniprogram/images/logo.png`（2043×2043 方形）。
- 由 `logo.png` 生成 TabBar 图标（`miniprogram/images/tab-*.png`，81×81，普通灰度 + 选中彩色共 10 个），`app.json` tabBar 已引用，5 个 Tab 均带图标。
- `README.md` 顶部展示 Logo，并新增「小程序 Logo」章节（说明微信端头像需在公众平台上传、TabBar 图标与原图已内嵌于 `miniprogram/images/`）。

### 重新部署需要进行的操作
- **仅前端**：重新编译小程序即可。
- 微信端「小程序头像」需在微信公众平台上传（建议 144×144，可用 `logo.png` 裁剪）。

---

## v1.7.2 — 动态分页条数可配置（2026-08-25，commit f97a9af）

### 变更内容
- 新增 `miniprogram/settings.js`（功能类配置项专用，与环境配置 `config.js` 分离），含 `FEED_PAGE_SIZE`（默认 10，1-50 可配）。动态页每页默认展示 10 条，上滑触底自动再加载 10 条。
- `getFeed` 云函数支持 `pageSize` 参数（默认 10，上限 50）；前端与 Mock 同步。

### 重新部署需要进行的操作
- 云函数：重部署 `getFeed`（云端安装依赖）
- 前端：重新编译小程序

---

## v1.7.1 — 群动态 + 点赞 + 评论 + 刷新限频（2026-08-25，tag v1.7.1，合并原 v0.7.0/v0.7.1）

### 变更内容
- **新增「动态」Tab（第 2 个，位于「打卡」右侧）**：`pages/feed/feed`，按群展示成员打卡动态，时间倒序、上滑分页（每页 20 条）、下拉刷新、骨架屏、群选择器（保持所选群）、图片预览。
- **新增云函数**：
  - `getFeed`：分页拉取群动态，合并成员最新昵称/头像，头像/图片换临时链接缩略，返回点赞数、是否已赞、评论数与最新评论；
  - `likeCheckin`：点赞/取消点赞（`likeOpenids` 原子 `addToSet`/`pull` + `likeCount` 增减）；
  - `commentCheckin`：评论（≤200 字 + `msgSecCheck` 内容安全审核），存 `{id, openid, nickName, avatarUrl, content, createTime}` 快照。
- **数据模型**：`checkins` 内嵌 `likeOpenids`、`likeCount`、`comments`；新增索引 `(groupId, createTime)`。
- **前端交互**：点赞乐观更新 + 失败回滚；评论展示最新 5 条 + 「查看全部 N 条」展开；底部评论输入栏。
- **刷新限频**：`app.js` 新增 `throttleRefresh()`（全局滑动窗口，1 分钟内最多 10 次数据刷新）；首页/动态/排行/群组/我的/群详情接入（`onShow` 已有数据时限频、首次加载不受限；下拉刷新超频提示），打卡表单页不参与。
- **Mock**：`utils/mock.js` 补充 `getFeed`/`likeCheckin`/`commentCheckin`，游客模式可预览互动。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：新增 `getFeed`、`likeCheckin`、`commentCheckin`
2. **数据库**：`checkins` 新建索引 `(groupId, createTime)`
3. **前端**：重新编译小程序（新增「动态」Tab + 刷新限频）
4. 审核前在「用户隐私保护指引」补充说明收集「评论内容」

---

## v0.6.1 — 本地 Mock 预览层（2026-08-25，commit 980267d）

### 变更内容
- 新增 `miniprogram/utils/mock.js` 本地 Mock 层：`config.js` 中 `MOCK_ENABLED: true` 时，不连接云环境，`wx.cloud` 全部替换为内存假数据（登录/群列表/打卡/排行/统计/日历/上传）。
- 用于微信开发者工具「游客模式」（`touristappid`）离线预览全部页面，无需注册小程序账号、无需云环境。
- 假数据：默认用户「本地测试」、示例群「本地测试群」（含 3 名成员）、近 30 天打卡记录（含连续打卡）、卡路里估算公式等。

### 重新部署需要进行的操作
- **仅前端**：重新编译小程序即可。Mock 不影响云端部署，但**上线前务必**将 `config.js` 的 `MOCK_ENABLED` 置为 `false` 并填写真实 `CLOUD_ENV_ID`。

---

## v0.6.0 — 代码审查修复（2026-08-25，commit 2ed9bcc）

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

## v0.5.0 — 科学估算 + 骨架屏 + 缓存/下拉刷新（2026-08-25，commit 5293b58，原 v0.4.1 内容已并入本版本）

### 变更内容
- **科学估算公式（默认隐藏）**：卡路里估算公式 `消耗热量(千卡) = MET值 × 体重(公斤) × 时长(小时)` 默认不展示；卡路里输入框旁有「?」图标，点击后展开显示公式与当前运动 MET。
- **默认体重 50kg**：未设置体重时估算自动按 50kg 计算，打卡阶段不重复要求填写体重；公式提示中注明「未填体重默认按 50kg 估算」。
- **历史数据体重处理**：`login` 云函数对无有效 `weightKg`（历史数据/旧版本 0 值）的用户自动回填 50；「我的 → 编辑资料」体重为空时预填 50；个人头部体重按「档案值或 50」显示。
- **更多运动类型**：运动类型扩充至 17 种，新增「减脂操、羽毛球、篮球、足球、乒乓球、拳击、举铁、舞蹈、徒步/爬山」，骑行改名为「骑行/单车」，含游泳。
- **MET 值本地常量**：`miniprogram/utils/constants.js` 的 `MET_VALUES` 表（前端本地维护）。
- **云函数同步**：`submitCheckin` / `updateCheckin` 的运动类型白名单同步扩充到 17 种。
- **加载态优化**：修复「加载中却显示无数据」（空状态加 `loading` 门控）；新增全局骨架屏动画（`.sk-block`/`.sk-circle`），各列表加载时展示骨架占位。
- **60 秒数据缓存**：`getMyStats`、`getGroupMembers` 新增与排行榜一致的 60 秒内存缓存（`cache` 包），切换页面不再重复查库。
- **下拉刷新强制更新**：排行/统计/成员接口支持 `refresh` 参数绕过缓存；首页/排行/我的/群详情下拉刷新传入 `refresh:true`；打卡后成就检测强制刷新。
- **群详情并行加载**：`getGroupInfo` 与 `getGroupMembers` 改为 `Promise.all` 并行请求。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：`login`、`submitCheckin`、`updateCheckin`
2. **前端**：重新编译小程序。
3. 无需数据库变更（`weightKg` 为新增可选字段，旧记录无此字段时按未填写处理）。

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

## 当前累计待部署清单（v1.7.1 全部落地后）

| 动作 | 对象 |
|---|---|
| 新增云函数（云端安装依赖） | `getMyGroups`、`updateGroup`、`getFeed`、`likeCheckin`、`commentCheckin` |
| 重新部署云函数（云端安装依赖） | `login`、`createGroup`、`joinGroup`、`submitCheckin`、`updateCheckin`、`dismissGroup`、`leaveGroup`、`removeMember`、`getGroupRanking`、`getGroupMembers`、`getMyStats`、`getGroupInfo` |
| 数据库配置 | `groups` 权限改「仅管理端可读写」；`checkins` 建索引 `(groupId, openid, checkDate)`、`(groupId, createTime)` |
| 存量数据回填 | `group_members` / `checkins` 补 `_openid`（如环境中有旧数据） |
| 重新编译前端 | 全部页面（含新「动态」Tab） |

> 未改动无需重部署的云函数：`deleteCheckin`。
