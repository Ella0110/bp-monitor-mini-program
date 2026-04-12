const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('./health-rules')
const { formatDateTime } = require('./date')
const { buildBloodPressureChart, buildHeartRateChart } = require('./chart-data')

const REPORT_TITLE = '血压心率就诊报告'
const DISCLAIMER = '本报告仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。'

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

function periodTitle(period) {
  return `近${String(period || '30天').replace('天', '')}天`
}

function sortDesc(records) {
  return [...records].sort((a, b) => toDate(b.measuredAt) - toDate(a.measuredAt))
}

function buildRecentRecords(records) {
  return sortDesc(records).slice(0, 10).map(record => {
    const bpStatus = getBPStatus(record.systolic, record.diastolic)
    const hrStatus = getHRStatus(record.heartRate)
    return {
      id: record._id,
      time: formatDateTime(record.measuredAt),
      bpText: `${record.systolic}/${record.diastolic} mmHg`,
      heartRateText: `${record.heartRate} bpm`,
      bpStatus: bpStatus.label,
      hrStatus: hrStatus.label,
    }
  })
}

function buildReportData({ family = {}, records = [], period = '30天', generatedAt = new Date() }) {
  const safeRecords = records || []
  const profile = family.profile || {}
  return {
    title: REPORT_TITLE,
    familyName: family.displayName || '家庭健康记录',
    profileName: profile.name || '未设置',
    period,
    periodTitle: periodTitle(period),
    generatedAt: formatDateTime(generatedAt),
    totalCount: safeRecords.length,
    stats: countReferenceStats(safeRecords, {}),
    avg: calcAverage(safeRecords),
    bpChart: buildBloodPressureChart(safeRecords),
    hrChart: buildHeartRateChart(safeRecords),
    recentRecords: buildRecentRecords(safeRecords),
    disclaimer: DISCLAIMER,
  }
}

module.exports = {
  DISCLAIMER,
  REPORT_TITLE,
  buildRecentRecords,
  buildReportData,
  periodTitle,
}
