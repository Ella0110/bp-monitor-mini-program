const assert = require('assert')
const { buildBloodPressureChart, buildHeartRateChart, labelDate } = require('../utils/chart-data')

const records = [
  { _id: 'r2', systolic: 148, diastolic: 92, heartRate: 86, measuredAt: '2026-04-12T20:00:00+08:00' },
  { _id: 'r1', systolic: 122, diastolic: 78, heartRate: 72, measuredAt: '2026-04-11T08:00:00+08:00' },
]

assert.strictEqual(labelDate('2026-04-12T20:00:00+08:00'), '4/12')

const bp = buildBloodPressureChart(records)
assert.deepStrictEqual(bp.refs, [135, 85])
assert.strictEqual(bp.records[0].id, 'r1')
assert.strictEqual(bp.records[1].abnormal, true)
assert.strictEqual(bp.range.min <= 85, true)
assert.strictEqual(bp.range.max >= 148, true)

const hr = buildHeartRateChart(records)
assert.deepStrictEqual(hr.refs, [60, 80])
assert.strictEqual(hr.records[0].abnormal, false)
assert.strictEqual(hr.records[1].abnormal, true)
assert.strictEqual(hr.range.min <= 60, true)
assert.strictEqual(hr.range.max >= 86, true)

console.log('chart data checks passed')
