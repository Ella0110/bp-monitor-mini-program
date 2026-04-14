App({
  onLaunch() {
    wx.cloud.init({
      env: wx.cloud.DYNAMIC_CURRENT_ENV,
      traceUser: true,
    })
    this.loginReady = this.doLogin()
  },

  async doLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      const result = res.result || {}
      this.globalData.openid = result.openid || ''
      this.globalData.familyId = result.familyId || ''
      this.globalData.role = result.role || ''
      this.globalData.memberPermissions = result.memberPermissions || {
        canWrite: false,
        canEdit: false,
      }
    } catch (e) {
      console.error('Login failed', e)
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
