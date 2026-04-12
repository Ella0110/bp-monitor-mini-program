Page({
  data: {
    loading: true,
    family: null,
    sharePanelOpen: false,
  },

  onShow() {
    this.loadFamily()
  },

  async loadFamily() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, family: null })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      })
      this.setData({ loading: false, family: res.result.family })
    } catch (e) {
      wx.showToast({ title: '家庭信息加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async onCreateFamily() {
    const res = await wx.cloud.callFunction({
      name: 'createFamily',
      data: { nickname: '我' },
    })
    if (res.result && res.result.success) {
      getApp().globalData.familyId = res.result.familyId
      this.loadFamily()
    }
  },

  onJoinFamilyTap() {
    wx.showModal({
      title: '输入邀请码',
      editable: true,
      placeholderText: '6位邀请码',
      content: '如果家人发给你的是微信邀请卡片，直接点开卡片即可加入。',
      success: async (res) => {
        if (!res.confirm) return
        await this.joinByCode(res.content)
      },
    })
  },

  async joinByCode(code) {
    const inviteCode = String(code || '').trim().toUpperCase()
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' })
      return
    }
    const res = await wx.cloud.callFunction({
      name: 'joinFamily',
      data: { inviteCode, nickname: '家人' },
    })
    if (!res.result.success) {
      wx.showToast({ title: res.result.error || '加入失败', icon: 'none' })
      return
    }
    getApp().globalData.familyId = res.result.familyId
    wx.showToast({ title: '加入成功', icon: 'success' })
    this.loadFamily()
  },

  onInviteTap() {
    this.setData({ sharePanelOpen: true })
  },

  onCloseSharePanel() {
    this.setData({ sharePanelOpen: false })
  },

  onCopyInviteCode() {
    wx.setClipboardData({ data: this.data.family.inviteCode })
    this.setData({ sharePanelOpen: false })
  },

  onShareAppMessage() {
    const family = this.data.family || {}
    return {
      title: `邀请你加入「${family.displayName || '家庭健康记录'}」`,
      path: `/pages/join-family/join-family?inviteToken=${family.inviteToken}`,
    }
  },
})
