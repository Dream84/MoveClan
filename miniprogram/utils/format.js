function compactNumber(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '' + n
  const neg = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e8) return neg + (abs / 1e8).toFixed(2) + '亿'
  if (abs >= 1e4) return neg + (abs / 1e4).toFixed(2) + '万'
  return neg + Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

module.exports = { compactNumber }
