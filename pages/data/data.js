const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { daysAgo, formatDateTime } = require('../../utils/date')
const { buildBloodPressureChart, buildHeartRateChart } = require('../../utils/chart-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')

function makeFontSizeStyle(cls) {
  if (cls === 'large') return [
    '--fs-title:44rpx', '--fs-time:30rpx', '--fs-metric:96rpx', '--fs-metric-sys:108rpx',
    '--fs-stat-num:56rpx', '--fs-stat-num-sm:44rpx', '--fs-stat:28rpx',
    '--fs-section:37rpx', '--fs-all:32rpx', '--fs-empty:37rpx',
    '--fs-add:39rpx', '--fs-key:41rpx', '--fs-key-act:32rpx', '--fs-key-sub:37rpx',
  ].join(';')
  if (cls === 'xlarge') return [
    '--fs-title:49rpx', '--fs-time:34rpx', '--fs-metric:110rpx', '--fs-metric-sys:124rpx',
    '--fs-stat-num:64rpx', '--fs-stat-num-sm:52rpx', '--fs-stat:31rpx',
    '--fs-section:42rpx', '--fs-all:36rpx', '--fs-empty:42rpx',
    '--fs-add:44rpx', '--fs-key:47rpx', '--fs-key-act:36rpx', '--fs-key-sub:42rpx',
  ].join(';')
  return [
    '--fs-title:38rpx', '--fs-time:26rpx', '--fs-metric:78rpx', '--fs-metric-sys:88rpx',
    '--fs-stat-num:48rpx', '--fs-stat-num-sm:36rpx', '--fs-stat:24rpx',
    '--fs-section:32rpx', '--fs-all:28rpx', '--fs-empty:32rpx',
    '--fs-add:34rpx', '--fs-key:36rpx', '--fs-key-act:28rpx', '--fs-key-sub:32rpx',
  ].join(';')
}

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
    contentStyle: '',
    heroStyle: `padding-top:${navHeight + 18}px;`,
  }
}

function syncTabBar(selected, fontSizeClass) {
  if (typeof this.getTabBar !== 'function' || !this.getTabBar()) return
  this.getTabBar().setData({
    selected,
    fontSizeClass: fontSizeClass || 'standard',
  })
}

function statusClassToBarIndex(cls) {
  if (cls === 'danger') return 0
  if (cls === 'warning') return 1
  if (cls === 'normal') return 2
  return -1
}

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
    fontSizeStyle: makeFontSizeStyle('standard'),
    navStyle: '',
    navTitleStyle: '',
    contentStyle: '',
    heroStyle: '',
    navScrolled: false,
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
    quickInputValue: '',
    quickInputFocus: false,
    quickBpValueClass: EMPTY_VALUE_CLASS,
    quickHrValueClass: EMPTY_VALUE_CLASS,
    quickSaving: false,
    bpBarActive: -1,
  },

  onLoad() {
    this.setNavMetrics()
  },

  onShow() {
    const cls = getApp().globalData.fontSizeClass || 'standard'
    this.setData({ fontSizeClass: cls, fontSizeStyle: makeFontSizeStyle(cls) })
    syncTabBar.call(this, 0, cls)
    this.loadRecords()
  },

  setNavMetrics() {
    this.setData(buildNavMetrics())
  },

  setNavScrolled(scrollTop) {
    const navScrolled = scrollTop > 12
    if (navScrolled !== this.data.navScrolled) this.setData({ navScrolled })
  },

  onDataScroll(e) {
    const scrollTop = (e.detail && e.detail.scrollTop) || 0
    this.setNavScrolled(scrollTop)
  },

  onPageScroll(e) {
    this.setNavScrolled(e.scrollTop || 0)
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
      const fontSizeStyle = makeFontSizeStyle(fontSizeClass)
      const latestRecord = records[0] || null
      const latestBPStatus = latestRecord ? getBPStatus(latestRecord.systolic, latestRecord.diastolic) : null
      const latestHRStatus = latestRecord ? getHRStatus(latestRecord.heartRate) : null
      const bpChart = buildBloodPressureChart(records)
      const hrChart = buildHeartRateChart(records)
      this.setData({
        records,
        profile,
        fontSizeClass,
        fontSizeStyle,
        latestRecord,
        latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
        latestBPStatus,
        latestHRStatus,
        bpValueClass: this.getStatusClass(latestBPStatus),
        hrValueClass: this.getStatusClass(latestHRStatus),
        bpBarActive: statusClassToBarIndex(this.getStatusClass(latestBPStatus)),
        stats: {
          ...countReferenceStats(records, profile),
          avg: calcAverage(records),
        },
        bpChart,
        hrChart,
        hasChartRecords: records.length > 0,
      })
      syncTabBar.call(this, 0, fontSizeClass)
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
    const bpCls = bpReady ? this.getStatusClass(getBPStatus(systolic, diastolic)) : EMPTY_VALUE_CLASS
    return {
      quickBpValueClass: bpCls,
      quickHrValueClass: hrReady ? this.getStatusClass(getHRStatus(heartRate)) : EMPTY_VALUE_CLASS,
      bpBarActive: statusClassToBarIndex(bpCls),
    }
  },

  onStartQuickEntry() {
    if (this.data.quickEntryActive) return
    this.setData({
      quickEntryActive: true,
      quickField: 'systolic',
      quickFieldLabel: QUICK_LABELS.systolic,
      quickInputValue: '',
      quickInputFocus: true,
      quickForm: { systolic: '', diastolic: '', heartRate: '' },
      quickBpValueClass: EMPTY_VALUE_CLASS,
      quickHrValueClass: EMPTY_VALUE_CLASS,
    })
  },

  setQuickField(field) {
    if (!QUICK_FIELDS.includes(field)) return
    this.setData({
      quickField: field,
      quickFieldLabel: QUICK_LABELS[field],
      quickInputValue: String(this.data.quickForm[field] || ''),
      quickInputFocus: false,
    }, () => {
      this.setData({ quickInputFocus: true })
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

  normalizeQuickInputValue(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 3)
  },

  shouldAdvanceQuickField(field, value) {
    if (String(value).length < 2) return false
    if (field === 'heartRate') return String(value).length >= 3 || Number(value) >= 30
    return String(value).length >= 3 || Number(value) > 30
  },

  onQuickNativeInput(e) {
    const field = this.data.quickField
    const next = this.normalizeQuickInputValue(e.detail.value)
    const nextForm = { ...this.data.quickForm, [field]: next }
    this.setData({ quickInputValue: next, [`quickForm.${field}`]: next, ...this.getQuickValueClasses(nextForm) }, () => {
      if (!this.shouldAdvanceQuickField(field, next)) return
      if (field === 'heartRate') {
        this.finishQuickEntryInput()
        return
      }
      this.moveToNextField()
    })
  },

  onQuickNativeBlur() {
    this.setData({ quickInputFocus: false })
  },

  onQuickNativeConfirm() {
    if (this.data.quickField === 'heartRate') {
      this.finishQuickEntryInput()
      return
    }
    this.onQuickNextField()
  },

  onQuickFieldTap(e) {
    if (!this.data.quickEntryActive) return
    this.setQuickField(e.currentTarget.dataset.field)
  },

  onQuickNextField() {
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
      quickInputValue: '',
      quickInputFocus: false,
      quickForm: { systolic: '', diastolic: '', heartRate: '' },
      quickBpValueClass: EMPTY_VALUE_CLASS,
      quickHrValueClass: EMPTY_VALUE_CLASS,
      bpBarActive: statusClassToBarIndex(this.getStatusClass(this.data.latestBPStatus)),
    })
  },

  getQuickFormError() {
    const sys = Number(this.data.quickForm.systolic)
    const dia = Number(this.data.quickForm.diastolic)
    const hr = Number(this.data.quickForm.heartRate)
    if (!sys || sys < 60 || sys > 300) {
      return { field: 'systolic', title: '高压值不正确' }
    }
    if (!dia || dia < 40 || dia > 200) {
      return { field: 'diastolic', title: '低压值不正确' }
    }
    if (!hr || hr < 30 || hr > 250) {
      return { field: 'heartRate', title: '心率不正确' }
    }
    return null
  },

  finishQuickEntryInput() {
    if (this.data.quickSaving) return
    const error = this.getQuickFormError()
    if (error) {
      wx.showToast({ title: error.title, icon: 'none' })
      this.setQuickField(error.field)
      return
    }
    this.setData({ quickInputFocus: false })
    this.onQuickSave()
  },

  validateQuickForm() {
    const error = this.getQuickFormError()
    if (error) {
      wx.showToast({ title: error.title, icon: 'none' })
      return false
    }
    return true
  },

  async onQuickSave() {
    if (this.data.quickSaving) return
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
        quickInputValue: '',
        quickInputFocus: false,
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
