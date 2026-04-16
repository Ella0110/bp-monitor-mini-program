const { calcAge, normalizeProfile, normalizeSettings } = require('../../utils/family-settings')
const { formatDateTime } = require('../../utils/date')

function makeFontSizeStyle(cls) {
  if (cls === 'large') return '--fs-title:41rpx;--fs-prof-name:36rpx;--fs-sub:27rpx;--fs-ir:30rpx;--fs-mn:23rpx;--fs-at:32rpx;--fs-ats:25rpx;--fs-st:32rpx;--fs-ss:25rpx;--fs-seg:28rpx;--qs-row-h:108rpx'
  if (cls === 'xlarge') return '--fs-title:46rpx;--fs-prof-name:41rpx;--fs-sub:30rpx;--fs-ir:34rpx;--fs-mn:26rpx;--fs-at:36rpx;--fs-ats:28rpx;--fs-st:36rpx;--fs-ss:28rpx;--fs-seg:32rpx;--qs-row-h:120rpx'
  return '--fs-title:36rpx;--fs-prof-name:32rpx;--fs-sub:24rpx;--fs-ir:26rpx;--fs-mn:20rpx;--fs-at:28rpx;--fs-ats:22rpx;--fs-st:28rpx;--fs-ss:22rpx;--fs-seg:24rpx;--qs-row-h:96rpx'
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
    contentStyle: `top:${navHeight}px;`,
    emptyStyle: `padding-top:${navHeight}px;`,
  }
}

function buildProfileView(profile, latestRecord) {
  const age = calcAge(profile.birthYear)
  return {
    age,
    birthText: profile.birthYear ? `${profile.birthYear}年生 · ${age}岁` : '出生年未设置',
    currentBpText: latestRecord ? `${latestRecord.systolic} / ${latestRecord.diastolic} mmHg` : '暂无记录',
    currentHrText: latestRecord && latestRecord.heartRate ? `${latestRecord.heartRate} bpm` : '暂无记录',
    targetBpText: (profile.targetSystolic && profile.targetDiastolic) ? `＜ ${profile.targetSystolic} / ${profile.targetDiastolic} mmHg` : '未设置',
    targetHrText: (profile.targetHRMin && profile.targetHRMax) ? `${profile.targetHRMin} – ${profile.targetHRMax} bpm` : '未设置',
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

function getMemberStatusText(member) {
  if (member.canWrite && member.canEdit) return '当前：可录入 · 可编辑'
  if (member.canWrite) return '当前：可录入 · 不可编辑'
  return '当前：仅可查看'
}

function syncTabBar(selected, fontSizeClass) {
  if (typeof this.getTabBar !== 'function' || !this.getTabBar()) return
  this.getTabBar().setData({
    selected,
    fontSizeClass: fontSizeClass || 'standard',
  })
}

function hideTabBar() {
  if (typeof this.getTabBar !== 'function' || !this.getTabBar()) return
  this.getTabBar().setData({ hidden: true })
}

function showTabBar() {
  if (typeof this.getTabBar !== 'function' || !this.getTabBar()) return
  this.getTabBar().setData({ hidden: false })
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
    selectedMemberStatus: '',
    sharePanelOpen: false,
    fontSizeClass: 'standard',
    fontSizeStyle: makeFontSizeStyle('standard'),
    navStyle: '',
    navTitleStyle: '',
    contentStyle: '',
    emptyStyle: '',
  },

  onLoad() {
    this.setNavMetrics()
  },

  onShow() {
    const fontSizeClass = getApp().globalData.fontSizeClass || 'standard'
    this.setData({ fontSizeClass, fontSizeStyle: makeFontSizeStyle(fontSizeClass) })
    syncTabBar.call(this, 1, fontSizeClass)
    this.loadFamily()
  },

  setNavMetrics() {
    this.setData(buildNavMetrics())
  },

  async loadFamily() {
    const app = getApp()
    await app.loginReady
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
      const fontSizeClass = settings.fontSize || 'standard'
      app.globalData.fontSizeClass = fontSizeClass
      const fontSizeStyle = makeFontSizeStyle(fontSizeClass)
      this.setData({
        loading: false,
        family: { ...family, profile, settings },
        currentMember: res.result.member || null,
        canManage: res.result.member && res.result.member.role === 'admin',
        hasProfileInfo: hasProfileInfo(profile),
        latestRecord,
        latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
        profileView: buildProfileView(profile, latestRecord),
        fontSizeClass,
        fontSizeStyle,
      })
      syncTabBar.call(this, 1, fontSizeClass)
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
    hideTabBar.call(this)
  },

  onCloseSharePanel() {
    this.setData({ sharePanelOpen: false })
    showTabBar.call(this)
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
    hideTabBar.call(this)
  },

  onProfileInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`profileForm.${field}`]: e.detail.value })
  },

  onCloseProfileForm() {
    this.setData({ profileFormOpen: false })
    showTabBar.call(this)
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
    showTabBar.call(this)
    this.loadFamily()
  },

  async updateSettingsPatch(patch) {
    if (!this.data.canManage || !this.data.family) return
    const app = getApp()
    const previousSettings = this.data.family.settings || {}
    const previousFontSizeClass = this.data.fontSizeClass || 'standard'
    const settings = normalizeSettings({ ...previousSettings, ...patch })
    const hasFontSizePatch = Object.prototype.hasOwnProperty.call(patch, 'fontSize')
    const fontSizeClass = settings.fontSize || 'standard'
    const rollback = () => {
      const data = { 'family.settings': previousSettings }
      if (hasFontSizePatch) {
        app.globalData.fontSizeClass = previousFontSizeClass
        data.fontSizeClass = previousFontSizeClass
        data.fontSizeStyle = makeFontSizeStyle(previousFontSizeClass)
      }
      this.setData(data)
      if (hasFontSizePatch) syncTabBar.call(this, 1, previousFontSizeClass)
    }

    const optimisticData = { 'family.settings': settings }
    if (hasFontSizePatch) {
      app.globalData.fontSizeClass = fontSizeClass
      optimisticData.fontSizeClass = fontSizeClass
      optimisticData.fontSizeStyle = makeFontSizeStyle(fontSizeClass)
    }
    this.setData(optimisticData)
    if (hasFontSizePatch) syncTabBar.call(this, 1, fontSizeClass)

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
        rollback()
        wx.showToast({ title: '保存失败', icon: 'none' })
        return
      }
      const savedSettings = normalizeSettings(res.result.settings || settings)
      const savedFontSizeClass = savedSettings.fontSize || 'standard'
      const savedData = { 'family.settings': savedSettings }
      if (hasFontSizePatch) {
        app.globalData.fontSizeClass = savedFontSizeClass
        savedData.fontSizeClass = savedFontSizeClass
        savedData.fontSizeStyle = makeFontSizeStyle(savedFontSizeClass)
      }
      this.setData(savedData)
      if (hasFontSizePatch) syncTabBar.call(this, 1, savedFontSizeClass)
    } catch (e) {
      console.error('Update settings failed', e)
      rollback()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  onToggleMedicationReminder() {
    this.updateSettingsPatch({ medicationReminderEnabled: !this.data.family.settings.medicationReminderEnabled })
  },

  onToggleAbnormalNotify() {
    this.updateSettingsPatch({ abnormalBpNotifyEnabled: !this.data.family.settings.abnormalBpNotifyEnabled })
  },

  onFontSizeTap(e) {
    return this.updateSettingsPatch({ fontSize: e.currentTarget.dataset.value })
  },

  onMemberTap(e) {
    if (!this.data.canManage) return
    const openid = e.currentTarget.dataset.openid
    const selectedMember = (this.data.family.members || []).find(member => member.openid === openid)
    if (!selectedMember || selectedMember.role === 'admin') return
    this.setData({ selectedMember, selectedMemberStatus: getMemberStatusText(selectedMember), permissionPanelOpen: true })
    hideTabBar.call(this)
  },

  onClosePermissionPanel() {
    this.setData({ permissionPanelOpen: false, selectedMember: null })
    showTabBar.call(this)
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
    this.setData({ selectedMember, selectedMemberStatus: getMemberStatusText(selectedMember) })
    this.loadFamily()
  },

  async onMemberNicknameBlur(e) {
    const nickname = e.detail.value.trim()
    if (!nickname || nickname === this.data.selectedMember.nickname) return
    const res = await wx.cloud.callFunction({
      name: 'updateMemberPermission',
      data: {
        familyId: this.data.family._id,
        targetOpenid: this.data.selectedMember.openid,
        canWrite: this.data.selectedMember.canWrite === true,
        canEdit: this.data.selectedMember.canEdit === true,
        nickname,
      },
    })
    if (!res.result.success) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      return
    }
    wx.showToast({ title: '备注已保存', icon: 'success' })
    this.setData({ 'selectedMember.nickname': nickname })
    this.loadFamily()
  },

  onRemoveMember() {
    const member = this.data.selectedMember
    if (!member) return
    const name = member.nickname || '该成员'
    wx.showModal({
      title: '移除成员',
      content: `确定要将「${name}」从家庭记录本中移除吗？移除后他将无法查看和录入数据。`,
      confirmText: '确认移除',
      confirmColor: '#EF4444',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.showLoading({ title: '处理中' })
          const result = await wx.cloud.callFunction({
            name: 'removeMember',
            data: {
              familyId: this.data.family._id,
              targetOpenid: member.openid,
            },
          })
          wx.hideLoading()
          if (!result.result.success) {
            wx.showToast({ title: '移除失败', icon: 'none' })
            return
          }
          wx.showToast({ title: '已移除', icon: 'success' })
          this.setData({ permissionPanelOpen: false, selectedMember: null })
          showTabBar.call(this)
          this.loadFamily()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '移除失败', icon: 'none' })
        }
      },
    })
  },
})
