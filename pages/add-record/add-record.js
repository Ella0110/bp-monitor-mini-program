const { getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { formatInputDateTime, parseInputDateTime } = require('../../utils/date')

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
    contentStyle: `padding-top:${navHeight + 32}px;`,
  }
}

Page({
  data: {
    id: '',
    systolic: '',
    diastolic: '',
    heartRate: '',
    measuredAt: '',
    period: '',
    statusText: '',
    statusColor: '#64748B',
    saving: false,
    navStyle: '',
    navTitleStyle: '',
    navBackStyle: '',
    contentStyle: '',
  },

  onLoad(options) {
    this.setData(buildNavMetrics())
    if (options.record) {
      const record = JSON.parse(decodeURIComponent(options.record))
      this.setData({
        id: record._id,
        systolic: String(record.systolic),
        diastolic: String(record.diastolic),
        heartRate: String(record.heartRate),
        measuredAt: formatInputDateTime(record.measuredAt),
        period: record.period || '',
      })
      this.updateStatus()
      return
    }
    this.setData({ measuredAt: formatInputDateTime(new Date()) })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
    this.updateStatus()
  },

  onPeriodTap(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period: this.data.period === period ? '' : period })
  },

  updateStatus() {
    const { systolic, diastolic, heartRate } = this.data
    if (!systolic || !diastolic || !heartRate) return
    const bp = getBPStatus(systolic, diastolic)
    const hr = getHRStatus(heartRate)
    this.setData({
      statusText: `血压${bp.label}，心率${hr.label}`,
      statusColor: bp.attention ? bp.color : hr.color,
    })
  },

  validate() {
    const sys = Number(this.data.systolic)
    const dia = Number(this.data.diastolic)
    const hr = Number(this.data.heartRate)
    if (!sys || sys < 60 || sys > 300) { wx.showToast({ title: '高压值不正确', icon: 'none' }); return false }
    if (!dia || dia < 40 || dia > 200) { wx.showToast({ title: '低压值不正确', icon: 'none' }); return false }
    if (!hr || hr < 30 || hr > 250) { wx.showToast({ title: '心率不正确', icon: 'none' }); return false }
    return true
  },

  async onSave() {
    if (!this.validate()) return
    const app = getApp()

    this.setData({ saving: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'saveRecord',
        data: {
          id: this.data.id || undefined,
          familyId: app.globalData.familyId || undefined,
          systolic: Number(this.data.systolic),
          diastolic: Number(this.data.diastolic),
          heartRate: Number(this.data.heartRate),
          measuredAt: parseInputDateTime(this.data.measuredAt).toISOString(),
          period: this.data.period || null,
        },
      })
      if (!res.result.success) {
        wx.showToast({ title: res.result.error || '保存失败', icon: 'none' })
        return
      }
      if (res.result.familyId) app.globalData.familyId = res.result.familyId
      wx.showToast({ title: '保存成功', icon: 'success' })
      wx.navigateBack()
    } finally {
      this.setData({ saving: false })
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 })
  },
})
