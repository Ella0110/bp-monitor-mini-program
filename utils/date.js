function pad(n) {
  return String(n).padStart(2, '0')
}

function toDate(value) {
  if (value instanceof Date) return value
  return new Date(value)
}

function formatDateTime(value) {
  const date = toDate(value)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(value) {
  const date = toDate(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatInputDateTime(value) {
  const date = value ? toDate(value) : new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseInputDateTime(value) {
  const normalized = String(value || '').replace(' ', 'T')
  return new Date(normalized)
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days + 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function groupByDate(records) {
  const groups = {}
  records.forEach(record => {
    const date = toDate(record.measuredAt)
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  })
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      items: groups[date].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt)),
      open: false,
    }))
}

module.exports = {
  formatDateTime,
  formatTime,
  formatInputDateTime,
  parseInputDateTime,
  daysAgo,
  groupByDate,
}
