function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function today() {
  return formatDate(new Date())
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return formatDate(d)
}

function parseDate(dateStr) {
  const parts = dateStr.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

function diffDays(aStr, bStr) {
  const a = parseDate(aStr)
  const b = parseDate(bStr)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function getWeekRange(dateStr) {
  const d = parseDate(dateStr)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: formatDate(monday), end: formatDate(sunday) }
}

function getMonthRange(dateStr) {
  const d = parseDate(dateStr)
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(lastDay)}`
  return { start, end }
}

function getMonthDays(year, month) {
  const days = []
  const total = new Date(year, month, 0).getDate()
  for (let i = 1; i <= total; i++) {
    days.push(`${year}-${pad(month)}-${pad(i)}`)
  }
  return days
}

function isValidDateRange(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr + 'T00:00:00')
  return !isNaN(d.getTime()) && formatDate(d) === dateStr
}

module.exports = {
  pad,
  formatDate,
  today,
  addDays,
  parseDate,
  diffDays,
  getWeekRange,
  getMonthRange,
  getMonthDays,
  isValidDateRange
}
