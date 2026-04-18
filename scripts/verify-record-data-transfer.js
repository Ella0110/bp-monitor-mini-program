const fs = require('fs')
const assert = require('assert')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assertIncludes(path, text) {
  const content = read(path)
  if (!content.includes(text)) {
    throw new Error(`${path} should include: ${text}`)
  }
}

const {
  buildRecordsExportData,
  dedupeImportedRecords,
  parseRecordsDataText,
} = require('../utils/record-data-transfer')

const sampleText = `
血压心率数据记录
数据记录时间：2026年4月11日-4月17日
测量时间 高压 低压 心率
4月17日 08:47 155 94 84
4月16日 07:44 162 111 68
4月15日 22:53 167 117 79
`

const parsed = parseRecordsDataText(sampleText)
assert.strictEqual(parsed.records.length, 3)
assert.strictEqual(parsed.records[0].systolic, 155)
assert.strictEqual(parsed.records[0].diastolic, 94)
assert.strictEqual(parsed.records[0].heartRate, 84)
assert.strictEqual(new Date(parsed.records[0].measuredAt).getFullYear(), 2026)
assert.strictEqual(new Date(parsed.records[0].measuredAt).getMonth(), 3)
assert.strictEqual(new Date(parsed.records[0].measuredAt).getDate(), 17)

const exportData = buildRecordsExportData(parsed.records)
assert.strictEqual(exportData.title, '血压心率数据记录')
assert.strictEqual(exportData.rangeText, '数据记录时间：2026年4月15日-4月17日')
assert.deepStrictEqual(exportData.columns, ['测量时间', '高压\n(mmHg)', '低压\n(mmHg)', '心率\n(bpm)'])
assert.strictEqual(exportData.rows[0].timeText, '4月17日 08:47')
assert.strictEqual(exportData.rows[0].systolic, 155)

const existingSameMinute = {
  ...parsed.records[0],
  measuredAt: new Date(2026, 3, 17, 8, 47, 38).toISOString(),
}
const deduped = dedupeImportedRecords(parsed.records, [existingSameMinute])
assert.strictEqual(deduped.newRecords.length, 2)
assert.strictEqual(deduped.duplicateCount, 1)

assertIncludes('utils/records-data-canvas.js', 'function drawRecordsDataImage')
assertIncludes('utils/records-data-canvas.js', 'function recordsDataImageHeight')
assertIncludes('pages/records/records.js', 'onDownloadRecords')
assertIncludes('pages/records/records.js', 'onImportRecordsTap')
assertIncludes('pages/records/records.js', "name: 'saveRecord'")
assertIncludes('pages/records/records.wxml', 'bindtap="onDownloadRecords"')
assertIncludes('pages/records/records.wxml', 'bindtap="onImportRecordsTap"')
assertIncludes('pages/records/records.wxml', 'id="recordsExportCanvas"')

console.log('record data transfer checks passed')
