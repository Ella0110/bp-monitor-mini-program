const { daysAgo } = require('../../utils/date')
const { buildReportData } = require('../../utils/report-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')
const { drawReportImage, reportImageHeight } = require('../../utils/report-canvas')
const { getBPStatus, getHRStatus } = require('../../utils/health-rules')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

function buildNavMetrics() {
  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const statusBarHeight = windowInfo.statusBarHeight || 0
  const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
  const navHeight = menuButton ? menuButton.bottom + menuButton.top - statusBarHeight : statusBarHeight + 44
  const titleTop = menuButton ? menuButton.top : statusBarHeight + 6
  const titleHeight = menuButton ? menuButton.height : 32

  return {
    navStyle: `height:${navHeight}px;`,
    navTitleStyle: `top:${titleTop}px;height:${titleHeight}px;line-height:${titleHeight}px;`,
    navBackStyle: `top:${titleTop}px;height:${titleHeight}px;`,
    contentStyle: `top:${navHeight}px;`,
  }
}

Page({
  data: {
    period: '30天',
    periods: ['7天', '30天', '90天'],
    family: null,
    records: [],
    report: null,
    loading: true,
    error: '',
    hidePrivacy: false,
    isSparseData: false,
    statusLevel: 'normal',
    statusTitle: '',
    statusDesc: '',
    navStyle: '',
    navTitleStyle: '',
    navBackStyle: '',
    contentStyle: '',
  },

  onLoad() {
    this.setData(buildNavMetrics())
    this.loadReport()
  },

  async loadReport() {
    const app = getApp()
    await app.loginReady
    if (!app.globalData.familyId) {
      this.setData({ loading: false, error: '请先保存一条记录，或查看家人的记录' })
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
      const statusInfo = this._calcStatusInfo(report)
      const isSparseData = report.rawRecords.length > 0 && report.rawRecords.length < 3
      this.setData({ family, records, report, loading: false, isSparseData, ...statusInfo })
      this.drawPreviewCharts()
    } catch (err) {
      console.error('Load report failed', err)
      wx.showToast({ title: '报告加载失败', icon: 'none' })
      this.setData({ loading: false, error: '报告加载失败' })
    }
  },

  _calcStatusInfo(report) {
    const records = report.rawRecords || []
    const refLines = report.refLines || {}
    const bpT = { systolic: refLines.systolic, diastolic: refLines.diastolic }
    const hrT = { min: refLines.hrMin, max: refLines.hrMax }
    if (!records.length) {
      return { statusLevel: 'empty', statusTitle: '暂无数据', statusDesc: '当前周期尚无记录' }
    }
    let worst = 0
    records.forEach(r => {
      const bp = getBPStatus(r.systolic, r.diastolic, bpT)
      const hr = getHRStatus(r.heartRate, hrT)
      const bn = bp.level === 'critical' ? 3 : bp.level === 'veryHigh' ? 2 : bp.attention ? 1 : 0
      const hn = (hr.level === 'veryFast' || hr.level === 'verySlow') ? 2 : hr.attention ? 1 : 0
      worst = Math.max(worst, bn, hn)
    })
    const LEVELS = [
      { statusLevel: 'normal',    statusTitle: '整体正常', statusDesc: '所有测量均在参考范围内' },
      { statusLevel: 'attention', statusTitle: '轻微偏高', statusDesc: '部分测量超出参考值，请继续观察' },
      { statusLevel: 'warning',   statusTitle: '明显偏高', statusDesc: '存在明显偏高测量，建议近期就医' },
      { statusLevel: 'danger',    statusTitle: '血压过高', statusDesc: '存在极高血压测量，请尽快就医' },
    ]
    return LEVELS[Math.min(worst, 3)]
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
        const dpr = Math.min(wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        if (type === 'bp') drawBloodPressureChart(ctx, this.data.report.bpChart, width, height)
        if (type === 'hr') drawHeartRateChart(ctx, this.data.report.hrChart, width, height)
      })
  },

  onSaveReport() {
    if (!this.data.report) {
      wx.showToast({ title: '报告生成失败', icon: 'none' })
      return
    }

    const query = wx.createSelectorQuery()
    query.select('#reportExportCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas) {
          wx.showToast({ title: '报告生成失败', icon: 'none' })
          return
        }

        const width = 750
        const height = reportImageHeight(this.data.report)
        const dpr = Math.min(wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        drawReportImage(ctx, this.data.report, width, height, { hidePrivacy: this.data.hidePrivacy })

        wx.canvasToTempFilePath({
          canvas,
          destWidth: width * dpr,
          destHeight: height * dpr,
          success: file => this.saveReportImage(file.tempFilePath),
          fail: () => wx.showToast({ title: '报告生成失败', icon: 'none' }),
        })
      })
  },

  saveReportImage(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存到相册后再保存报告图片。',
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

  onTogglePrivacy(e) {
    this.setData({ hidePrivacy: e.detail.value })
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 })
  },
})
