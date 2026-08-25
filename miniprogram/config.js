module.exports = {
  // ★ 部署上线前：改为你的云环境 ID，并将 MOCK_ENABLED 置为 false
  CLOUD_ENV_ID: 'your-env-id',
  // 本地 Mock 预览开关：true 时不连接云环境，使用本地假数据（utils/mock.js），
  // 用于微信开发者工具「游客模式」离线预览页面；联调/上线时置为 false
  MOCK_ENABLED: false,
  SUBSCRIBE_TEMPLATE_ID: '',
  CONTENT_CHECK_ENABLED: true
}
