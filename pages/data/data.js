const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { daysAgo, formatDateTime } = require('../../utils/date')
const { buildBloodPressureChart, buildHeartRateChart } = require('../../utils/chart-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')

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
    bpChart: null,
    hrChart: null,
    hasChartRecords: false,
    loading: false,
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({
        records: [],
        latestRecord: null,
        latestTime: '',
        bpChart: null,
        hrChart: null,
        hasChartRecords: false,
        loading: false,
      })
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
    const bpChart = buildBloodPressureChart(records)
    const hrChart = buildHeartRateChart(records)
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
      bpChart,
      hrChart,
      hasChartRecords: records.length > 0,
      loading: false,
    })
    this.drawCharts()
  },

  drawCharts() {
    if (!this.data.hasChartRecords) return
    wx.nextTick(() => {
      this.drawChart('#bpChart', 'bp')
      this.drawChart('#hrChart', 'hr')
    })
  },

  drawChart(selector, type) {
    const query = wx.createSelectorQuery()
    query.select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas) return
        const width = result.width
        const height = result.height
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        if (type === 'bp') drawBloodPressureChart(ctx, this.data.bpChart, width, height)
        if (type === 'hr') drawHeartRateChart(ctx, this.data.hrChart, width, height)
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

  onDownloadBPChart() {
    this.downloadChart('bp')
  },

  onDownloadHRChart() {
    this.downloadChart('hr')
  },

  downloadChart(type) {
    if (!this.data.hasChartRecords) {
      wx.showToast({ title: '当前周期暂无可下载图表', icon: 'none' })
      return
    }

    const chart = type === 'bp' ? this.data.bpChart : this.data.hrChart
    const title = type === 'bp' ? '血压趋势图' : '心率趋势图'
    const query = wx.createSelectorQuery()
    query.select('#exportChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas) {
          wx.showToast({ title: '图表生成失败', icon: 'none' })
          return
        }

        const width = 750
        const height = 900
        const chartHeight = height - 80
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        if (type === 'bp') drawBloodPressureChart(ctx, chart, width, chartHeight, { title: `${title}（${this.data.period}）` })
        if (type === 'hr') drawHeartRateChart(ctx, chart, width, chartHeight, { title: `${title}（${this.data.period}）` })
        ctx.fillStyle = '#64748B'
        ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif'
        ctx.fillText('仅供健康记录与就诊沟通参考', 24, height - 28)

        wx.canvasToTempFilePath({
          canvas,
          destWidth: width * dpr,
          destHeight: height * dpr,
          success: file => this.saveChartImage(file.tempFilePath),
          fail: () => wx.showToast({ title: '图表生成失败', icon: 'none' }),
        })
      })
  },

  saveChartImage(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存到相册后再下载图表。',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting()
            },
          })
          return
        }
        wx.showToast({ title: '保存失败', icon: 'none' })
      },
    })
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
