Page({
  data: {
    family: null,
    members: [],
    loading: true,
  },

  onShow() {
    this.loadFamily()
  },

  async loadFamily() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, family: null, members: [] })
      return
    }
    const res = await wx.cloud.callFunction({
      name: 'getFamily',
      data: { familyId: app.globalData.familyId },
    })
    const family = res.result.family
    this.setData({
      family,
      members: (family.members || []).filter(member => member.role !== 'admin'),
      loading: false,
    })
  },

  async onPermissionToggle(e) {
    const { openid, key } = e.currentTarget.dataset
    const members = this.data.members.map(member => {
      if (member.openid !== openid) return member
      return { ...member, [key]: !member[key] }
    })
    const target = members.find(member => member.openid === openid)
    this.setData({ members })
    await wx.cloud.callFunction({
      name: 'updateMemberPermission',
      data: {
        familyId: this.data.family._id,
        targetOpenid: openid,
        canWrite: target.canWrite === true,
        canEdit: target.canEdit === true,
      },
    })
  },
})
