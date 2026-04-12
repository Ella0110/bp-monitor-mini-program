Page({
  data: {
    inviteToken: '',
    joining: false,
    displayName: '家庭健康记录',
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
      this.setData({ displayName: res.result.displayName || '家庭健康记录' })
    }
  },

  async onJoin() {
    if (!this.data.inviteToken) {
      wx.showToast({ title: '邀请无效', icon: 'none' })
      return
    }
    this.setData({ joining: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinFamily',
        data: { inviteToken: this.data.inviteToken, nickname: '家人' },
      })
      if (!res.result.success) {
        wx.showToast({ title: res.result.error || '加入失败', icon: 'none' })
        return
      }
      getApp().globalData.familyId = res.result.familyId
      wx.showToast({ title: '加入成功', icon: 'success' })
      wx.switchTab({ url: '/pages/family/family' })
    } finally {
      this.setData({ joining: false })
    }
  },

  onCancel() {
    wx.switchTab({ url: '/pages/family/family' })
  },
})
