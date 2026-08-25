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
        const msg = friendlyError(name, err)
        wx.showToast({ title: msg, icon: 'none' })
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

function friendlyError(name, err) {
  const code = String(err && (err.errCode || err.code) || '')
  const msg = String(err && (err.errMsg || err.message) || '')
  if (code === '-501000' || msg.indexOf('FUNCTION_NOT_FOUND') >= 0) {
    return `功能未部署：${name}，请先部署云函数`
  }
  if (code === '-501001' || msg.indexOf('FUNCTION_ABORT') >= 0) {
    return '云函数执行异常，请稍后再试'
  }
  if (msg.indexOf('Access Denied') >= 0 || code === '-502000') {
    return '权限不足，请检查数据库权限设置'
  }
  return (err && err.message) || '网络异常，请重试'
}

function avatarSrc(url, size) {
  if (!url) return ''
  const thumb = `?imageMogr2/thumbnail/${size}x`
  if (url.indexOf('cloud://') === 0) return url + thumb
  return url
}

module.exports = {
  call,
  uploadImage,
  avatarSrc
}
