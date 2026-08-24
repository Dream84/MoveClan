function call(name, data, options) {
  const opts = options || {}
  const showLoading = opts.loading !== false
  const loadingText = opts.loadingText || '加载中...'

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true })
  }

  return wx.cloud.callFunction({ name, data })
    .then(res => {
      const r = res && res.result
      if (r && r.code === 0) {
        return r.data
      }
      const err = new Error((r && r.message) || '请求失败')
      err.code = (r && r.code) || -1
      throw err
    })
    .catch(err => {
      console.error(`[cloud:${name}]`, err)
      if (opts.toast !== false) {
        wx.showToast({ title: err.message || '网络异常，请重试', icon: 'none' })
      }
      throw err
    })
    .finally(() => {
      if (showLoading) wx.hideLoading()
    })
}

function uploadImage(filePath, openid, onProgress) {
  const cloudPath = `checkins/${openid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${getExt(filePath)}`
  return new Promise((resolve, reject) => {
    const task = wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => resolve({ fileID: res.fileID, cloudPath }),
      fail: err => reject(err)
    })
    if (typeof onProgress === 'function') {
      task.onProgressUpdate(onProgress)
    }
  })
}

function getExt(filePath) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filePath || '')
  return m ? '.' + m[1].toLowerCase() : '.jpg'
}

module.exports = {
  call,
  uploadImage
}
