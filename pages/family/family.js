const { calcAge, normalizeProfile, normalizeSettings } = require('../../utils/family-settings')
const { formatDateTime } = require('../../utils/date')

function buildProfileView(profile, latestRecord) {
  return {
    age: calcAge(profile.birthYear),
    currentBpText: latestRecord ? `${latestRecord.systolic} / ${latestRecord.diastolic} mmHg` : '暂无记录',
    currentHrText: latestRecord && latestRecord.heartRate ? `${latestRecord.heartRate} bpm` : '暂无记录',
    emergencyText: profile.emergencyContactName || profile.emergencyContactPhone ? `${profile.emergencyContactName || '未设置'} · ${profile.emergencyContactPhone || '未设置'}` : '未设置',
  }
}

function hasProfileInfo(profile) {
  return Boolean(
    profile.name ||
    profile.birthYear ||
    profile.medicationsText ||
    profile.emergencyContactName ||
    profile.emergencyContactPhone
  )
}

Page({
  data: {
    loading: true,
    family: null,
    currentMember: null,
    canManage: false,
    hasProfileInfo: false,
    latestRecord: null,
    latestTime: '',
    profileView: {
      age: '--',
      currentBpText: '暂无记录',
      currentHrText: '暂无记录',
      emergencyText: '未设置',
    },
    profileFormOpen: false,
    profileForm: {},
    permissionPanelOpen: false,
    selectedMember: null,
    sharePanelOpen: false,
  },

  onShow() {
    this.loadFamily()
  },

  async loadFamily() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, family: null, currentMember: null, canManage: false })
      return
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      })
      const family = res.result.family
      const recordRes = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId: app.globalData.familyId },
      })
      const latestRecord = (recordRes.result.records || [])[0] || null
      const profile = normalizeProfile(family.profile || {})
      const settings = normalizeSettings(family.settings || {})
      this.setData({
        loading: false,
        family: { ...family, profile, settings },
        currentMember: res.result.member || null,
        canManage: res.result.member && res.result.member.role === 'admin',
        hasProfileInfo: hasProfileInfo(profile),
        latestRecord,
        latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
        profileView: buildProfileView(profile, latestRecord),
      })
    } catch (e) {
      wx.showToast({ title: '家庭信息加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onSettingsTap() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onGoRecordTap() {
    wx.switchTab({ url: '/pages/data/data' })
  },

  onInviteTap() {
    this.setData({ sharePanelOpen: true })
  },

  onCloseSharePanel() {
    this.setData({ sharePanelOpen: false })
  },

  onShareAppMessage() {
    const family = this.data.family || {}
    return {
      title: `邀请你查看「${family.displayName || '健康记录'}」`,
      path: `/pages/join-family/join-family?inviteToken=${family.inviteToken}`,
    }
  },

  onReportTap() {
    wx.navigateTo({ url: '/pages/report/report' })
  },

  onEditProfileTap() {
    if (!this.data.canManage) return
    this.setData({
      profileFormOpen: true,
      profileForm: { ...this.data.family.profile },
    })
  },

  onProfileInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`profileForm.${field}`]: e.detail.value })
  },

  onCloseProfileForm() {
    this.setData({ profileFormOpen: false })
  },

  async onSaveProfile() {
    const profile = normalizeProfile(this.data.profileForm)
    const res = await wx.cloud.callFunction({
      name: 'updateFamilySettings',
      data: {
        familyId: this.data.family._id,
        profile,
        settings: this.data.family.settings,
      },
    })
    if (!res.result.success) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      return
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ profileFormOpen: false })
    this.loadFamily()
  },

  async updateSettingsPatch(patch) {
    if (!this.data.canManage) return
    const settings = normalizeSettings({ ...this.data.family.settings, ...patch })
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
    this.setData({ 'family.settings': settings })
  },

  onToggleMedicationReminder() {
    this.updateSettingsPatch({ medicationReminderEnabled: !this.data.family.settings.medicationReminderEnabled })
  },

  onToggleAbnormalNotify() {
    this.updateSettingsPatch({ abnormalBpNotifyEnabled: !this.data.family.settings.abnormalBpNotifyEnabled })
  },

  onFontSizeTap(e) {
    this.updateSettingsPatch({ fontSize: e.currentTarget.dataset.value })
  },

  onMemberTap(e) {
    if (!this.data.canManage) return
    const openid = e.currentTarget.dataset.openid
    const selectedMember = (this.data.family.members || []).find(member => member.openid === openid)
    if (!selectedMember || selectedMember.role === 'admin') return
    this.setData({ selectedMember, permissionPanelOpen: true })
  },

  onClosePermissionPanel() {
    this.setData({ permissionPanelOpen: false, selectedMember: null })
  },

  async onMemberPermissionToggle(e) {
    const key = e.currentTarget.dataset.key
    const selectedMember = { ...this.data.selectedMember, [key]: !this.data.selectedMember[key] }
    const res = await wx.cloud.callFunction({
      name: 'updateMemberPermission',
      data: {
        familyId: this.data.family._id,
        targetOpenid: selectedMember.openid,
        canWrite: selectedMember.canWrite === true,
        canEdit: selectedMember.canEdit === true,
      },
    })
    if (!res.result.success) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      return
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    this.setData({ selectedMember })
    this.loadFamily()
  },
})
