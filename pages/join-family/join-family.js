Page({
  data: {
    inviteToken: '',
    joining: false,
    displayName: '健康记录',
    nickname: '',
  },

  onLoad(options) {
    this.setData({ inviteToken: options.inviteToken || '' })
    this.loadInviteInfo()
  },

  async loadInviteInfo() {
    if (!this.data.inviteToken) return
    const res = await wx.cloud.callFunction({
      name: 'getInviteInfo',
      data: { inviteToken: this.data.inviteToken },
    })
    if (res.result && res.result.success) {
      this.setData({ displayName: res.result.displayName || '健康记录' })
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  async onJoin() {
    if (!this.data.inviteToken) {
      wx.showToast({ title: '邀请无效', icon: 'none' })
      return
    }
    const nickname = this.data.nickname.trim() || '家人'
    this.setData({ joining: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinFamily',
        data: { inviteToken: this.data.inviteToken, nickname },
      })
      if (!res.result.success) {
        wx.showToast({ title: res.result.error || '加入失败', icon: 'none' })
        return
      }
      getApp().globalData.familyId = res.result.familyId
      wx.showToast({ title: '加入成功', icon: 'success' })
      wx.switchTab({ url: '/pages/data/data' })
    } finally {
      this.setData({ joining: false })
    }
  },

  onCancel() {
    wx.switchTab({ url: '/pages/family/family' })
  },
})
