/**
 * 功能类配置项（与部署/环境配置 config.js 分离）
 * 此处仅放置与业务功能相关的可调参数，不涉及环境与密钥。
 */
module.exports = {
  // 动态页：首次加载条数
  FEED_FIRST_PAGE_SIZE: 8,
  // 动态页：上滑触底每页追加条数
  FEED_PAGE_SIZE: 5,

  // 打卡图片压缩：wx.compressImage 质量（0-100）与最大宽度（像素，高度等比缩放）
  CHECKIN_IMAGE_QUALITY: 80,
  CHECKIN_IMAGE_MAX_WIDTH: 1280
}
