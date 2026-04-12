const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { daysAgo, formatDateTime } = require('../../utils/date')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

Page({
  data: {
    period: '7天',
    records: [],
    latestRecord: null,
    latestTime: '',
    latestBPStatus: null,
    latestHRStatus: null,
    stats: {
      bp: { inRange: 0, attention: 0 },
      hr: { inRange: 0, attention: 0 },
      avg: { systolic: '--', diastolic: '--', heartRate: '--' },
    },
    loading: false,
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ records: [], latestRecord: null, latestTime: '', loading: false })
      return
    }
    this.setData({ loading: true })
    const days = PERIODS[this.data.period] || 7
    const res = await wx.cloud.callFunction({
      name: 'getRecords',
      data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
    })
    const records = res.result.records || []
    const latestRecord = records[0] || null
    this.setData({
      records,
      latestRecord,
      latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
      latestBPStatus: latestRecord ? getBPStatus(latestRecord.systolic, latestRecord.diastolic) : null,
      latestHRStatus: latestRecord ? getHRStatus(latestRecord.heartRate) : null,
      stats: {
        ...countReferenceStats(records, {}),
        avg: calcAverage(records),
      },
      loading: false,
    })
  },

  onPeriodChange(e) {
    this.setData({ period: e.currentTarget.dataset.period })
    this.loadRecords()
  },

  onAddRecord() {
    wx.navigateTo({ url: '/pages/add-record/add-record' })
  },

  onAllRecords() {
    wx.navigateTo({ url: '/pages/records/records' })
  },

  onBPNotice() {
    wx.showModal({
      title: '血压数据须知',
      content: '血压参考范围和状态提示参考《中国高血压防治指南（2024年修订版）》及家庭血压管理常用标准。本小程序的状态提示和图表结果仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。',
      showCancel: false,
      confirmText: '我知道了',
    })
  },

  onHRNotice() {
    wx.showModal({
      title: '心率数据须知',
      content: '心率参考范围和状态提示参考《中国高血压患者心率管理多学科专家共识（2021年版）》及常用静息心率范围。本小程序的状态提示和图表结果仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。',
      showCancel: false,
      confirmText: '我知道了',
    })
  },
})
