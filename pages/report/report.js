const { daysAgo } = require('../../utils/date')
const { buildReportData } = require('../../utils/report-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')
const { drawReportImage, reportImageHeight } = require('../../utils/report-canvas')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

Page({
  data: {
    period: '30天',
    periods: ['7天', '30天', '90天'],
    family: null,
    records: [],
    report: null,
    loading: true,
    error: '',
  },

  onLoad() {
    this.loadReport()
  },

  async loadReport() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, error: '请先创建或加入家庭组' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      const days = PERIODS[this.data.period] || 30
      const familyRes = await wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      })
      const recordsRes = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
      })
      const family = familyRes.result.family || {}
      const records = recordsRes.result.records || []
      const report = buildReportData({ family, records, period: this.data.period })
      this.setData({ family, records, report, loading: false })
      this.drawPreviewCharts()
    } catch (err) {
      console.error('Load report failed', err)
      wx.showToast({ title: '报告加载失败', icon: 'none' })
      this.setData({ loading: false, error: '报告加载失败' })
    }
  },

  onPeriodChange(e) {
    this.setData({ period: e.currentTarget.dataset.period })
    this.loadReport()
  },

  drawPreviewCharts() {
    if (!this.data.report) return
    wx.nextTick(() => {
      this.drawPreviewChart('#reportBPChart', 'bp')
      this.drawPreviewChart('#reportHRChart', 'hr')
    })
  },

  drawPreviewChart(selector, type) {
    const query = wx.createSelectorQuery()
    query.select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas || !this.data.report) return
        const width = result.width
        const height = result.height
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        if (type === 'bp') drawBloodPressureChart(ctx, this.data.report.bpChart, width, height)
        if (type === 'hr') drawHeartRateChart(ctx, this.data.report.hrChart, width, height)
      })
  },

  onSaveReport() {
    wx.showToast({ title: '报告保存建设中', icon: 'none' })
  },
})
