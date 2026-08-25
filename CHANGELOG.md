# 变更日志（CHANGELOG）

本项目为微信小程序 + 云开发应用。每个版本条目列出「变更内容」与「重新部署需要进行的操作」。

## v0.4.0 — 性能优化 + 群信息编辑 + 头像缩略（工作区，待提交）

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

## v0.3.0 — 删除清理 + 最新资料 + 微信头像昵称（commit e4854db）

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

## v0.2.1 — `_openid` 修复（commit 69f7357）

### 变更内容
- 云开发中「仅创建者可读写」权限依赖记录的 `_openid` 字段，但云函数 `add()` 写入不会自动生成。为 `login`(users)、`createGroup`(groups+group_members)、`joinGroup`(group_members)、`submitCheckin`(checkins) 的所有写入手动补充 `_openid: OPENID`，修复客户端查不到自己数据（表现为「没有加入任何群组」）。
- 同步更新 `database/*.init.json` 示例文档与 `README.md`。

### 重新部署需要进行的操作
1. **云函数**（云端安装依赖）：`login`、`createGroup`、`joinGroup`、`submitCheckin`
2. **存量数据回填（重要）**：本修复只影响之后新写入的数据。环境里修复前产生的旧数据（`group_members` / `checkins` 无 `_openid`）仍不可见，需二选一：
   - 测试阶段：清空 `group_members` / `checkins` 后重新创建群、打卡；
   - 保留数据：云开发控制台对无 `_openid` 的记录批量编辑，将 `_openid` 设为该记录 `openid` 字段值。

---

## v0.2.0 — 弹窗冒泡修复（commit 2aac8ab）

### 变更内容
- 创建群/编辑资料弹窗容器 `catchtap=""` 空处理器无法拦截冒泡，改为 `catchtap="noop"` 并补充 `noop()` 方法，修复「点击弹窗内部即消失」。
- 群详情成员行动态空事件绑定 `bindtap="{{isOwner ? ... : ''}}"` 改为固定 `onMemberRowTap` 并内部判断权限。
- 新增 `docs/问题修复记录.md`（问题一）。

### 重新部署需要进行的操作
- 仅前端：重新编译小程序即可，无云函数改动。

---

## v0.1.0 — 初始版本（commit 236b2bc）

- 完整小程序源码：4 个 Tab 页 + 群详情/打卡表单 2 个子页 + 日历/彩带 2 组件。
- 14 个云函数（含后续新增说明见 README）。
- 数据库 4 集合初始化 JSON、部署说明 README、设计文档。
- 部署操作详见 `README.md`（建集合/权限/索引 → 部署云函数 → 审核前填写隐私指引）。

---

## 当前累计待部署清单（v0.4.0 全部落地后）

| 动作 | 对象 |
|---|---|
| 重新部署云函数（云端安装依赖） | `login`、`createGroup`、`joinGroup`、`submitCheckin`、`dismissGroup`、`leaveGroup`、`removeMember`、`getGroupRanking`、`getGroupMembers` |
| 新增云函数（云端安装依赖） | `updateGroup` |
| 重新编译前端 | 全部页面 |
| 存量数据回填 | `group_members` / `checkins` 补 `_openid`（如环境中有旧数据） |

> 未改动无需重部署的云函数：`getGroupInfo`、`updateCheckin`、`deleteCheckin`、`getMyStats`。
