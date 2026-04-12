const { getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { formatInputDateTime, parseInputDateTime } = require('../../utils/date')

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
  },

  onLoad(options) {
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
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先创建或加入家庭组', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'saveRecord',
        data: {
          id: this.data.id || undefined,
          familyId: app.globalData.familyId,
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
      wx.showToast({ title: '保存成功', icon: 'success' })
      wx.navigateBack()
    } finally {
      this.setData({ saving: false })
    }
  },
})
