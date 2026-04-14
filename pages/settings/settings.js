const { normalizeSettings } = require('../../utils/family-settings')

function notifyMemberText(memberIds) {
  const count = (memberIds || []).length
  return count ? `${count}人` : '未选择'
}

Page({
  data: {
    family: null,
    settings: null,
    members: [],
    notifyMemberText: '未选择',
    loading: true,
    fontSizeClass: 'standard',
  },

  onShow() {
    this.setData({ fontSizeClass: getApp().globalData.fontSizeClass || 'standard' })
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
      this.setData({
        family,
        settings,
        members: family.members || [],
        notifyMemberText: notifyMemberText(settings.notifyMemberIds),
        loading: false,
      })
    } catch (e) {
      wx.showToast({ title: '设置加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async updateSettings(patch) {
    if (this.savingSettings) return
    this.savingSettings = true
    const settings = normalizeSettings({ ...this.data.settings, ...patch })
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateFamilySettings',
        data: {
          familyId: this.data.family._id,
          profile: this.data.family.profile,
          settings,
        },
      })
      if (!res.result.success) {
        wx.showToast({ title: '保存失败', icon: 'none' })
        return
      }
      const fontSizeClass = settings.fontSize || 'standard'
      getApp().globalData.fontSizeClass = fontSizeClass
      this.setData({
        settings,
        fontSizeClass,
        notifyMemberText: notifyMemberText(settings.notifyMemberIds),
      })
    } finally {
      this.savingSettings = false
    }
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    this.updateSettings({ [key]: !this.data.settings[key] })
  },

  onThresholdChange(e) {
    const key = e.currentTarget.dataset.key
    this.updateSettings({ [key]: Number(e.detail.value) })
  },

  onTimeChange(e) {
    const key = e.currentTarget.dataset.key
    this.updateSettings({ [key]: e.detail.value })
  },

  onFontSizeTap(e) {
    this.updateSettings({ fontSize: e.currentTarget.dataset.value })
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
