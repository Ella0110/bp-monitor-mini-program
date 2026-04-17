const { normalizeSettings } = require('../../utils/family-settings')

function notifyMemberText(memberIds) {
  const count = (memberIds || []).length
  return count ? `${count}人` : '未选择'
}

function makeFontSizeStyle(cls) {
  if (cls === 'large')  return '--fs-label:23rpx;--fs-title:32rpx;--fs-sub:25rpx;--fs-val:30rpx;--fs-seg:28rpx;--fs-note:25rpx;--row-h:108rpx;--card-px:30rpx'
  if (cls === 'xlarge') return '--fs-label:26rpx;--fs-title:36rpx;--fs-sub:28rpx;--fs-val:34rpx;--fs-seg:32rpx;--fs-note:28rpx;--row-h:120rpx;--card-px:32rpx'
  return '--fs-label:20rpx;--fs-title:28rpx;--fs-sub:22rpx;--fs-val:26rpx;--fs-seg:24rpx;--fs-note:22rpx;--row-h:96rpx;--card-px:28rpx'
}

function buildRefLines(profile = {}) {
  return {
    systolic: profile.targetSystolic || 135,
    diastolic: profile.targetDiastolic || 85,
    hrMin: profile.targetHRMin || 60,
    hrMax: profile.targetHRMax || 80,
  }
}

function isDefaultRefLines(refLines) {
  return refLines.systolic === 135 && refLines.diastolic === 85
    && refLines.hrMin === 60 && refLines.hrMax === 80
}

function profileMatchesRefLines(profile, refLines) {
  return Number(profile && profile.targetSystolic) === refLines.systolic
    && Number(profile && profile.targetDiastolic) === refLines.diastolic
    && Number(profile && profile.targetHRMin) === refLines.hrMin
    && Number(profile && profile.targetHRMax) === refLines.hrMax
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
    navBackStyle: `top:${titleTop}px;height:${titleHeight}px;`,
    contentStyle: `top:${navHeight}px;`,
  }
}

Page({
  data: {
    family: null,
    settings: null,
    members: [],
    notifyMemberText: '未选择',
    loading: true,
    fontSizeClass: 'standard',
    fontSizeStyle: makeFontSizeStyle('standard'),
    navStyle: '',
    navTitleStyle: '',
    navBackStyle: '',
    contentStyle: '',
    refLines: { systolic: 135, diastolic: 85, hrMin: 60, hrMax: 80 },
    refLinesIsDefault: true,
  },

  onLoad() {
    this.setData(buildNavMetrics())
  },

  onShow() {
    const cls = getApp().globalData.fontSizeClass || 'standard'
    this.setData({ fontSizeClass: cls, fontSizeStyle: makeFontSizeStyle(cls) })
    this.loadFamily()
  },

  async loadFamily() {
    const app = getApp()
    await app.loginReady
    if (!app.globalData.familyId) {
      this.setData({ loading: false, family: null, settings: null, members: [], notifyMemberText: '未选择' })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      })
      const family = res.result.family
      const settings = normalizeSettings(family.settings || {})
      const fontSizeClass = settings.fontSize || 'standard'
      getApp().globalData.fontSizeClass = fontSizeClass
      const profile = family.profile || {}
      const refLines = buildRefLines(profile)
      const refLinesIsDefault = isDefaultRefLines(refLines)
      this.setData({
        family,
        settings,
        members: family.members || [],
        notifyMemberText: notifyMemberText(settings.notifyMemberIds),
        loading: false,
        fontSizeClass,
        fontSizeStyle: makeFontSizeStyle(fontSizeClass),
        refLines,
        refLinesIsDefault,
      })
    } catch (e) {
      wx.showToast({ title: '设置加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async updateSettings(patch) {
    if (this.savingSettings || !this.data.family) return
    this.savingSettings = true
    const settings = normalizeSettings({ ...this.data.settings, ...patch })
    const fontSizeClass = settings.fontSize || 'standard'
    getApp().globalData.fontSizeClass = fontSizeClass
    this.setData({
      settings,
      fontSizeClass,
      fontSizeStyle: makeFontSizeStyle(fontSizeClass),
      notifyMemberText: notifyMemberText(settings.notifyMemberIds),
    })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateFamilySettings',
        data: { familyId: this.data.family._id, profile: this.data.family.profile, settings },
      })
      if (!res.result.success) wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.savingSettings = false
    }
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    this.updateSettings({ [key]: !this.data.settings[key] })
  },

  onStepperTap(e) {
    const { key, delta, min, max } = e.currentTarget.dataset
    const current = this.data.settings[key] || 0
    const next = Math.min(max, Math.max(min, current + delta))
    if (next !== current) this.updateSettings({ [key]: next })
  },

  onTimeChange(e) {
    const key = e.currentTarget.dataset.key
    this.updateSettings({ [key]: e.detail.value })
  },

  async onFontSizeTap(e) {
    await this.updateSettings({ fontSize: e.currentTarget.dataset.value })
    this.loadFamily()
  },

  onFeedback() {
    wx.setClipboardData({ data: 'bp-monitor-feedback@example.com' })
  },

  onNotifyMembersTap() {
    if (!this.data.members.length) {
      wx.showToast({ title: '暂无家庭成员', icon: 'none' })
      return
    }
    wx.showActionSheet({
      itemList: this.data.members.map(member => member.nickname || '家人'),
      success: (res) => {
        const member = this.data.members[res.tapIndex]
        const current = this.data.settings.notifyMemberIds || []
        const exists = current.includes(member.openid)
        const notifyMemberIds = exists ? current.filter(id => id !== member.openid) : current.concat(member.openid)
        this.updateSettings({ notifyMemberIds })
      },
    })
  },

  onRefLineStep(e) {
    const { field, delta } = e.currentTarget.dataset
    const limits = {
      systolic:  { min: 100, max: 180 },
      diastolic: { min: 60,  max: 120 },
      hrMin:     { min: 40,  max: 80  },
      hrMax:     { min: 60,  max: 120 },
    }
    const current = this.data.refLines[field]
    const next = Math.min(limits[field].max, Math.max(limits[field].min, current + delta))
    if (next === current) return
    const refLines = { ...this.data.refLines, [field]: next }
    const refLinesIsDefault = isDefaultRefLines(refLines)
    this.setData({ refLines, refLinesIsDefault })
    this.queueRefLinesSave(refLines)
  },

  onResetRefLines() {
    const refLines = { systolic: 135, diastolic: 85, hrMin: 60, hrMax: 80 }
    this.setData({ refLines, refLinesIsDefault: true })
    this.queueRefLinesSave(refLines)
  },

  queueRefLinesSave(refLines) {
    this.pendingRefLines = { ...refLines }
    if (this.refLinesSaveTimer) clearTimeout(this.refLinesSaveTimer)
    this.refLinesSaveTimer = setTimeout(() => {
      this.refLinesSaveTimer = null
      this.flushRefLinesSave()
    }, 350)
  },

  async saveRefLines(refLines) {
    if (!this.data.family) return false
    this.savingRefLines = true
    try {
      const profile = {
        ...(this.data.family.profile || {}),
        targetSystolic: refLines.systolic,
        targetDiastolic: refLines.diastolic,
        targetHRMin: refLines.hrMin,
        targetHRMax: refLines.hrMax,
      }
      const res = await wx.cloud.callFunction({
        name: 'updateFamilySettings',
        data: { familyId: this.data.family._id, profile },
      })
      if (!res.result.success || !profileMatchesRefLines(res.result.profile, refLines)) {
        wx.showToast({ title: '保存失败', icon: 'none' })
        return false
      }
      this.setData({ 'family.profile': res.result.profile })
      const app = getApp()
      app.globalData.familyProfile = { ...(app.globalData.familyProfile || {}), ...res.result.profile }
      return true
    } catch (e) {
      console.error('saveRefLines failed', e)
      wx.showToast({ title: '参考线保存失败', icon: 'none' })
      return false
    } finally {
      this.savingRefLines = false
    }
  },

  async flushRefLinesSave() {
    if (this.savingRefLines || !this.pendingRefLines) return
    let saved = false
    while (this.pendingRefLines) {
      const refLines = this.pendingRefLines
      this.pendingRefLines = null
      saved = await this.saveRefLines(refLines)
      if (!saved) return
    }
    if (saved) wx.showToast({ title: '已保存', icon: 'success' })
  },

  async onBackTap() {
    if (this.refLinesSaveTimer) {
      clearTimeout(this.refLinesSaveTimer)
      this.refLinesSaveTimer = null
      await this.flushRefLinesSave()
    }
    wx.navigateBack({ delta: 1 })
  },
})
