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

Page({
  data: {
    family: null,
    settings: null,
    members: [],
    notifyMemberText: '未选择',
    loading: true,
    fontSizeClass: 'standard',
    fontSizeStyle: makeFontSizeStyle('standard'),
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
      this.setData({
        family,
        settings,
        members: family.members || [],
        notifyMemberText: notifyMemberText(settings.notifyMemberIds),
        loading: false,
        fontSizeClass,
        fontSizeStyle: makeFontSizeStyle(fontSizeClass),
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
})
