App({
  onLaunch() {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    })
    this.loginReady = this.refreshSession()
  },

  async doLogin() {
    return this.refreshSession()
  },

  async refreshSession() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      const result = res.result || {}
      const prevFamilyId = this.globalData.familyId
      this.globalData.openid = result.openid || ''
      this.globalData.familyId = result.familyId || ''
      this.globalData.role = result.role || ''
      this.globalData.memberPermissions = result.memberPermissions || {
        canWrite: false,
        canEdit: false,
      }
      // 若之前有家庭但现在没有（被移除或踢出），给用户明确提示
      if (prevFamilyId && !result.familyId) {
        wx.showToast({ title: '你已被移出家庭记录本', icon: 'none', duration: 3000 })
      }
      return result
    } catch (e) {
      console.error('Login failed', e)
      return null
    }
  },

  globalData: {
    openid: '',
    familyId: '',
    role: '',
    memberPermissions: { canWrite: false, canEdit: false },
    settings: {},
  },
})
