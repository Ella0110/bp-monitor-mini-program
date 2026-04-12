const assert = require('assert')
const {
  getBPStatus,
  getHRStatus,
  calcAverage,
  countReferenceStats,
} = require('../utils/health-rules')

assert.strictEqual(getBPStatus(120, 80).level, 'inRange')
assert.strictEqual(getBPStatus(138, 84).level, 'high')
assert.strictEqual(getBPStatus(160, 90).level, 'veryHigh')
assert.strictEqual(getBPStatus(180, 90).level, 'critical')
assert.strictEqual(getBPStatus(88, 58).level, 'low')

assert.strictEqual(getHRStatus(72).level, 'inRange')
assert.strictEqual(getHRStatus(90).level, 'fast')
assert.strictEqual(getHRStatus(105).level, 'veryFast')
assert.strictEqual(getHRStatus(55).level, 'slow')
assert.strictEqual(getHRStatus(45).level, 'verySlow')

const records = [
  { systolic: 120, diastolic: 80, heartRate: 72 },
  { systolic: 140, diastolic: 86, heartRate: 90 },
]
assert.deepStrictEqual(calcAverage(records), { systolic: 130, diastolic: 83, heartRate: 81 })
assert.deepStrictEqual(countReferenceStats(records, {}), {
  bp: { inRange: 1, attention: 1 },
  hr: { inRange: 1, attention: 1 },
})

console.log('health rule checks passed')
