const assert = require('assert')
const { calcAverage, countReferenceStats } = require('../utils/health-rules')
const { formatDateTime, groupByDate } = require('../utils/date')

const records = [
  { systolic: 120, diastolic: 80, heartRate: 72, measuredAt: '2026-04-12T08:30:00+08:00' },
  { systolic: 140, diastolic: 86, heartRate: 90, measuredAt: '2026-04-12T20:30:00+08:00' },
  { systolic: 160, diastolic: 90, heartRate: 78, measuredAt: '2026-04-11T08:30:00+08:00' },
]

assert.deepStrictEqual(calcAverage(records), { systolic: 140, diastolic: 85, heartRate: 80 })
assert.deepStrictEqual(countReferenceStats(records, {}), {
  bp: { inRange: 1, attention: 2 },
  hr: { inRange: 2, attention: 1 },
})
assert.strictEqual(formatDateTime('2026-04-12T08:30:00+08:00').includes('2026/4/12'), true)
const groups = groupByDate(records)
assert.strictEqual(groups.length, 2)
assert.strictEqual(groups[0].items.length, 2)

console.log('record utility checks passed')
