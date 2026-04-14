const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { daysAgo, formatDateTime } = require('../../utils/date')
const { buildBloodPressureChart, buildHeartRateChart } = require('../../utils/chart-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }
const QUICK_FIELDS = ['systolic', 'diastolic', 'heartRate']
const QUICK_LABELS = { systolic: '高压', diastolic: '低压', heartRate: '心率' }
const EMPTY_VALUE_CLASS = 'empty'

Page({
  data: {
    period: '7天',
    records: [],
    profile: null,
    fontSizeClass: 'standard',
    latestRecord: null,
    latestTime: '',
    latestBPStatus: null,
    latestHRStatus: null,
    bpValueClass: EMPTY_VALUE_CLASS,
    hrValueClass: EMPTY_VALUE_CLASS,
    stats: {
      bp: { inRange: 0, attention: 0 },
      hr: { inRange: 0, attention: 0 },
      avg: { systolic: '--', diastolic: '--', heartRate: '--' },
    },
    bpChart: null,
    hrChart: null,
    hasChartRecords: false,
    loading: false,
    quickForm: {
      systolic: '',
      diastolic: '',
      heartRate: '',
    },
    quickEntryActive: false,
    quickField: 'systolic',
    quickFieldLabel: '高压',
    quickBpValueClass: EMPTY_VALUE_CLASS,
    quickHrValueClass: EMPTY_VALUE_CLASS,
    quickSaving: false,
  },

  onShow() {
    this.setData({ fontSizeClass: getApp().globalData.fontSizeClass || 'standard' })
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    await app.loginReady
    if (!app.globalData.familyId) {
      this.setData({
        records: [],
        latestRecord: null,
        latestTime: '',
        latestBPStatus: null,
        latestHRStatus: null,
        bpValueClass: EMPTY_VALUE_CLASS,
        hrValueClass: EMPTY_VALUE_CLASS,
        bpChart: null,
        hrChart: null,
        hasChartRecords: false,
        loading: false,
      })
      return
    }
    this.setData({ loading: true })
    try {
      const days = PERIODS[this.data.period] || 7
      const [recordsRes, familyRes] = await Promise.all([
        wx.cloud.callFunction({
          name: 'getRecords',
          data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
        }),
        wx.cloud.callFunction({
          name: 'getFamily',
          data: { familyId: app.globalData.familyId },
        }),
      ])
      const records = recordsRes.result.records || []
      const family = familyRes.result.family || {}
      const profile = family.profile || {}
      const fontSizeClass = (family.settings || {}).fontSize || 'standard'
      app.globalData.fontSizeClass = fontSizeClass
      const latestRecord = records[0] || null
      const latestBPStatus = latestRecord ? getBPStatus(latestRecord.systolic, latestRecord.diastolic) : null
      const latestHRStatus = latestRecord ? getHRStatus(latestRecord.heartRate) : null
      const bpChart = buildBloodPressureChart(records)
      const hrChart = buildHeartRateChart(records)
      this.setData({
        records,
        profile,
        fontSizeClass,
        latestRecord,
        latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
        latestBPStatus,
        latestHRStatus,
        bpValueClass: this.getStatusClass(latestBPStatus),
        hrValueClass: this.getStatusClass(latestHRStatus),
        stats: {
          ...countReferenceStats(records, profile),
          avg: calcAverage(records),
        },
        bpChart,
        hrChart,
        hasChartRecords: records.length > 0,
      })
      this.drawCharts()
    } catch (err) {
      console.error('loadRecords failed', err)
      wx.showToast({ title: '数据加载失败，请重试', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
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

  getStatusClass(status) {
    if (!status) return EMPTY_VALUE_CLASS
    if (status.level === 'inRange') return 'normal'
    if (status.level === 'critical' || status.level === 'veryHigh' || status.level === 'veryFast' || status.level === 'verySlow') return 'danger'
    return 'warning'
  },

  getQuickValueClasses(form) {
    const systolic = Number(form.systolic)
    const diastolic = Number(form.diastolic)
    const heartRate = Number(form.heartRate)
    const bpReady = systolic >= 60 && diastolic >= 40
    const hrReady = heartRate >= 30
    return {
      quickBpValueClass: bpReady ? this.getStatusClass(getBPStatus(systolic, diastolic)) : EMPTY_VALUE_CLASS,
      quickHrValueClass: hrReady ? this.getStatusClass(getHRStatus(heartRate)) : EMPTY_VALUE_CLASS,
    }
  },

  onStartQuickEntry() {
    if (this.data.quickEntryActive) return
    this.setData({
      quickEntryActive: true,
      quickField: 'systolic',
      quickFieldLabel: QUICK_LABELS.systolic,
      quickForm: { systolic: '', diastolic: '', heartRate: '' },
      quickBpValueClass: EMPTY_VALUE_CLASS,
      quickHrValueClass: EMPTY_VALUE_CLASS,
    })
  },

  setQuickField(field) {
    this.setData({
      quickField: field,
      quickFieldLabel: QUICK_LABELS[field],
    })
  },

  moveToNextField() {
    const index = QUICK_FIELDS.indexOf(this.data.quickField)
    if (index < QUICK_FIELDS.length - 1) this.setQuickField(QUICK_FIELDS[index + 1])
  },

  moveToPreviousField() {
    const index = QUICK_FIELDS.indexOf(this.data.quickField)
    if (index > 0) this.setQuickField(QUICK_FIELDS[index - 1])
  },

  onKeypadDigit(e) {
    const digit = String(e.currentTarget.dataset.value || '')
    if (!digit) return
    const field = this.data.quickField
    const current = String(this.data.quickForm[field] || '')
    if (current.length >= 3) return
    const next = `${current}${digit}`
    const nextForm = { ...this.data.quickForm, [field]: next }
    this.setData({ [`quickForm.${field}`]: next, ...this.getQuickValueClasses(nextForm) }, () => {
      if (next.length >= 3) this.moveToNextField()
    })
  },

  onKeypadDelete() {
    const field = this.data.quickField
    const current = String(this.data.quickForm[field] || '')
    if (current) {
      const next = current.slice(0, -1)
      const nextForm = { ...this.data.quickForm, [field]: next }
      this.setData({ [`quickForm.${field}`]: next, ...this.getQuickValueClasses(nextForm) })
      return
    }
    this.moveToPreviousField()
  },

  onKeypadNext() {
    const current = String(this.data.quickForm[this.data.quickField] || '')
    if (!current) {
      wx.showToast({ title: '请先输入当前项', icon: 'none' })
      return
    }
    this.moveToNextField()
  },

  onCancelQuickEntry() {
    this.setData({
      quickEntryActive: false,
      quickField: 'systolic',
      quickFieldLabel: QUICK_LABELS.systolic,
      quickForm: { systolic: '', diastolic: '', heartRate: '' },
      quickBpValueClass: EMPTY_VALUE_CLASS,
      quickHrValueClass: EMPTY_VALUE_CLASS,
    })
  },

  validateQuickForm() {
    const sys = Number(this.data.quickForm.systolic)
    const dia = Number(this.data.quickForm.diastolic)
    const hr = Number(this.data.quickForm.heartRate)
    if (!sys || sys < 60 || sys > 300) {
      wx.showToast({ title: '高压值不正确', icon: 'none' })
      return false
    }
    if (!dia || dia < 40 || dia > 200) {
      wx.showToast({ title: '低压值不正确', icon: 'none' })
      return false
    }
    if (!hr || hr < 30 || hr > 250) {
      wx.showToast({ title: '心率不正确', icon: 'none' })
      return false
    }
    return true
  },

  async onQuickSave() {
    if (!this.validateQuickForm()) return
    const app = getApp()
    this.setData({ quickSaving: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'saveRecord',
        data: {
          familyId: app.globalData.familyId || undefined,
          systolic: Number(this.data.quickForm.systolic),
          diastolic: Number(this.data.quickForm.diastolic),
          heartRate: Number(this.data.quickForm.heartRate),
          measuredAt: new Date().toISOString(),
          period: null,
        },
      })
      if (!res.result.success) {
        wx.showToast({ title: res.result.error || '保存失败', icon: 'none' })
        return
      }
      if (res.result.familyId) app.globalData.familyId = res.result.familyId
      this.setData({
        quickForm: { systolic: '', diastolic: '', heartRate: '' },
        quickEntryActive: false,
        quickField: 'systolic',
        quickFieldLabel: QUICK_LABELS.systolic,
        quickBpValueClass: EMPTY_VALUE_CLASS,
        quickHrValueClass: EMPTY_VALUE_CLASS,
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
      await this.loadRecords()
    } finally {
      this.setData({ quickSaving: false })
    }
  },

  onAddRecord() {
    this.onStartQuickEntry()
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
