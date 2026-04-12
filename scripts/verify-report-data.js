const assert = require('assert')
const { buildReportData, periodTitle } = require('../utils/report-data')

const family = {
  displayName: '家庭健康记录',
  profile: { name: '妈妈' },
}

const records = [
  { _id: 'r3', systolic: 150, diastolic: 92, heartRate: 86, measuredAt: '2026-04-13T20:00:00+08:00' },
  { _id: 'r1', systolic: 122, diastolic: 78, heartRate: 72, measuredAt: '2026-04-11T08:00:00+08:00' },
  { _id: 'r2', systolic: 132, diastolic: 82, heartRate: 76, measuredAt: '2026-04-12T08:00:00+08:00' },
]

assert.strictEqual(periodTitle('7天'), '近7天')
assert.strictEqual(periodTitle('30天'), '近30天')

const report = buildReportData({ family, records, period: '30天', generatedAt: new Date('2026-04-13T21:00:00+08:00') })

assert.strictEqual(report.title, '血压心率就诊报告')
assert.strictEqual(report.familyName, '家庭健康记录')
assert.strictEqual(report.profileName, '妈妈')
assert.strictEqual(report.periodTitle, '近30天')
assert.strictEqual(report.totalCount, 3)
assert.deepStrictEqual(report.avg, { systolic: 135, diastolic: 84, heartRate: 78 })
assert.strictEqual(report.stats.bp.attention, 1)
assert.strictEqual(report.stats.hr.attention, 1)
assert.strictEqual(report.recentRecords.length, 3)
assert.strictEqual(report.recentRecords[0].id, 'r3')
assert.strictEqual(report.recentRecords[0].bpText, '150/92 mmHg')
assert.strictEqual(report.recentRecords[0].heartRateText, '86 bpm')
assert.strictEqual(report.bpChart.records.length, 3)
assert.strictEqual(report.hrChart.records.length, 3)

const empty = buildReportData({ family: {}, records: [], period: '90天', generatedAt: new Date('2026-04-13T21:00:00+08:00') })
assert.strictEqual(empty.familyName, '家庭健康记录')
assert.strictEqual(empty.profileName, '未设置')
assert.strictEqual(empty.totalCount, 0)
assert.strictEqual(empty.recentRecords.length, 0)

console.log('report data checks passed')
