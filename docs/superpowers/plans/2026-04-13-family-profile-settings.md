# Family Profile Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add editable family profile, family-page quick settings, settings-page configuration, and per-member permission entry from the family page.

**Architecture:** Keep all family profile/settings writes behind a new `updateFamilySettings` cloud function with admin-only checks. Use a pure normalization utility for profile/settings defaults and validation so cloud function and page state stay consistent. Reuse the existing `updateMemberPermission` cloud function, but move the member permission UI entry from settings to the family member area.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JS, CloudBase cloud functions with `wx-server-sdk`, existing `getFamily`, `getRecords`, and `updateMemberPermission` functions, Node smoke checks.

---

## Source Spec

Use `docs/superpowers/specs/2026-04-13-family-profile-settings-design.md` as the source of truth.

## File Structure

- `utils/family-settings.js`: pure defaults and normalization helpers for profile/settings.
- `scripts/verify-family-settings.js`: Node smoke checks for normalization.
- `cloudfunctions/_shared/auth.js`: update default profile/settings field names.
- `cloudfunctions/createFamily/_shared/auth.js`: copy updated defaults for this function package.
- `cloudfunctions/updateFamilySettings/*`: new admin-only cloud function to save profile/settings.
- `pages/family/*`: richer family profile display, edit profile modal, quick settings, per-member permission modal.
- `pages/settings/*`: settings page for notification, medication reminder, chart, and display settings.

## Task 1: Family Settings Data Helpers

**Files:**
- Create: `utils/family-settings.js`
- Create: `scripts/verify-family-settings.js`

- [ ] **Step 1: Write failing smoke check in `scripts/verify-family-settings.js`**

Create:

```js
const assert = require('assert')
const {
  calcAge,
  createDefaultProfile,
  createDefaultSettings,
  normalizeProfile,
  normalizeSettings,
} = require('../utils/family-settings')

assert.strictEqual(calcAge(1960, new Date('2026-04-13T00:00:00+08:00')), 66)
assert.strictEqual(calcAge('', new Date('2026-04-13T00:00:00+08:00')), '--')

assert.deepStrictEqual(createDefaultProfile(), {
  name: '',
  birthYear: null,
  medicationsText: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
})

assert.deepStrictEqual(createDefaultSettings(), {
  abnormalBpNotifyEnabled: false,
  notifyMemberIds: [],
  alertSystolic: 160,
  alertDiastolic: 100,
  medicationReminderEnabled: false,
  morningReminderTime: '08:00',
  eveningReminderTime: '20:00',
  morningEveningLabel: false,
  splitLines: false,
  fontSize: 'standard',
})

assert.deepStrictEqual(normalizeProfile({
  name: ' 妈妈 ',
  birthYear: '1960',
  medications: '旧字段',
  emergencyContact: '旧联系人',
  medicationsText: ' 氨氯地平 ',
  emergencyContactName: ' Ella ',
  emergencyContactPhone: ' 13812341223 ',
}), {
  name: '妈妈',
  birthYear: 1960,
  medicationsText: '氨氯地平',
  emergencyContactName: 'Ella',
  emergencyContactPhone: '13812341223',
})

assert.deepStrictEqual(normalizeSettings({
  notifyAll: true,
  notifyMemberIds: 'bad',
  alertSystolic: '170',
  alertDiastolic: '105',
  medicationReminderEnabled: true,
  morningReminderTime: '07:30',
  eveningReminderTime: '21:00',
  morningEveningLabel: true,
  splitLines: true,
  fontSize: 'huge',
}), {
  abnormalBpNotifyEnabled: false,
  notifyMemberIds: [],
  alertSystolic: 170,
  alertDiastolic: 105,
  medicationReminderEnabled: true,
  morningReminderTime: '07:30',
  eveningReminderTime: '21:00',
  morningEveningLabel: true,
  splitLines: true,
  fontSize: 'standard',
})

console.log('family settings checks passed')
```

- [ ] **Step 2: Run smoke check and confirm RED**

Run:

```bash
node scripts/verify-family-settings.js
```

Expected failure:

```text
Error: Cannot find module '../utils/family-settings'
```

- [ ] **Step 3: Implement `utils/family-settings.js`**

Create:

```js
const FONT_SIZES = ['standard', 'large', 'xlarge']

function trim(value) {
  return String(value || '').trim()
}

function toNumberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function validTime(value, fallback) {
  const text = trim(value)
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

function calcAge(birthYear, now = new Date()) {
  const year = Number(birthYear)
  if (!Number.isFinite(year) || year <= 0) return '--'
  return Math.max(0, now.getFullYear() - year)
}

function createDefaultProfile() {
  return {
    name: '',
    birthYear: null,
    medicationsText: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}

function createDefaultSettings() {
  return {
    abnormalBpNotifyEnabled: false,
    notifyMemberIds: [],
    alertSystolic: 160,
    alertDiastolic: 100,
    medicationReminderEnabled: false,
    morningReminderTime: '08:00',
    eveningReminderTime: '20:00',
    morningEveningLabel: false,
    splitLines: false,
    fontSize: 'standard',
  }
}

function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
  }
}

function normalizeSettings(settings = {}) {
  const defaults = createDefaultSettings()
  const fontSize = FONT_SIZES.includes(settings.fontSize) ? settings.fontSize : defaults.fontSize
  return {
    ...defaults,
    abnormalBpNotifyEnabled: settings.abnormalBpNotifyEnabled === true,
    notifyMemberIds: Array.isArray(settings.notifyMemberIds) ? settings.notifyMemberIds : [],
    alertSystolic: toNumberOrDefault(settings.alertSystolic, defaults.alertSystolic),
    alertDiastolic: toNumberOrDefault(settings.alertDiastolic, defaults.alertDiastolic),
    medicationReminderEnabled: settings.medicationReminderEnabled === true,
    morningReminderTime: validTime(settings.morningReminderTime, defaults.morningReminderTime),
    eveningReminderTime: validTime(settings.eveningReminderTime, defaults.eveningReminderTime),
    morningEveningLabel: settings.morningEveningLabel === true,
    splitLines: settings.splitLines === true,
    fontSize,
  }
}

module.exports = {
  FONT_SIZES,
  calcAge,
  createDefaultProfile,
  createDefaultSettings,
  normalizeProfile,
  normalizeSettings,
}
```

- [ ] **Step 4: Run smoke check and syntax check**

Run:

```bash
node scripts/verify-family-settings.js
node --check utils/family-settings.js
node --check scripts/verify-family-settings.js
```

Expected:

```text
family settings checks passed
```

- [ ] **Step 5: Commit**

```bash
git add utils/family-settings.js scripts/verify-family-settings.js
git commit -m "feat: add family settings helpers"
```

## Task 2: Cloud Defaults and Save Function

**Files:**
- Modify: `cloudfunctions/_shared/auth.js`
- Modify: `cloudfunctions/createFamily/_shared/auth.js`
- Create: `cloudfunctions/updateFamilySettings/index.js`
- Create: `cloudfunctions/updateFamilySettings/package.json`
- Create: `cloudfunctions/updateFamilySettings/_shared/auth.js`

- [ ] **Step 1: Update default profile/settings in both auth helper copies**

In both `cloudfunctions/_shared/auth.js` and `cloudfunctions/createFamily/_shared/auth.js`, replace `createDefaultProfile()` with:

```js
function createDefaultProfile() {
  return {
    name: '',
    birthYear: null,
    medicationsText: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}
```

Replace `createDefaultSettings()` with:

```js
function createDefaultSettings() {
  return {
    abnormalBpNotifyEnabled: false,
    notifyMemberIds: [],
    alertSystolic: 160,
    alertDiastolic: 100,
    medicationReminderEnabled: false,
    morningReminderTime: '08:00',
    eveningReminderTime: '20:00',
    morningEveningLabel: false,
    splitLines: false,
    fontSize: 'standard',
  }
}
```

- [ ] **Step 2: Create `cloudfunctions/updateFamilySettings/package.json`**

```json
{
  "name": "updateFamilySettings",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 3: Copy auth helper**

Copy `cloudfunctions/_shared/auth.js` to:

```text
cloudfunctions/updateFamilySettings/_shared/auth.js
```

- [ ] **Step 4: Create `cloudfunctions/updateFamilySettings/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireAdmin, createDefaultProfile, createDefaultSettings } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function trim(value) {
  return String(value || '').trim()
}

function toNumberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function validTime(value, fallback) {
  const text = trim(value)
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
  }
}

function normalizeSettings(settings = {}) {
  const defaults = createDefaultSettings()
  const fontSize = ['standard', 'large', 'xlarge'].includes(settings.fontSize) ? settings.fontSize : defaults.fontSize
  return {
    ...defaults,
    abnormalBpNotifyEnabled: settings.abnormalBpNotifyEnabled === true,
    notifyMemberIds: Array.isArray(settings.notifyMemberIds) ? settings.notifyMemberIds : [],
    alertSystolic: toNumberOrDefault(settings.alertSystolic, defaults.alertSystolic),
    alertDiastolic: toNumberOrDefault(settings.alertDiastolic, defaults.alertDiastolic),
    medicationReminderEnabled: settings.medicationReminderEnabled === true,
    morningReminderTime: validTime(settings.morningReminderTime, defaults.morningReminderTime),
    eveningReminderTime: validTime(settings.eveningReminderTime, defaults.eveningReminderTime),
    morningEveningLabel: settings.morningEveningLabel === true,
    splitLines: settings.splitLines === true,
    fontSize,
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId } = event
  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  const existingProfile = family.profile || {}
  const existingSettings = family.settings || {}
  const profile = normalizeProfile({ ...existingProfile, ...(event.profile || {}) })
  const settings = normalizeSettings({ ...existingSettings, ...(event.settings || {}) })

  await familyRef.update({
    data: {
      profile,
      settings,
      updatedAt: db.serverDate(),
    },
  })

  return { success: true, profile, settings }
}
```

- [ ] **Step 5: Run syntax checks**

Run:

```bash
node --check cloudfunctions/_shared/auth.js
node --check cloudfunctions/createFamily/_shared/auth.js
node --check cloudfunctions/updateFamilySettings/index.js
node -e "JSON.parse(require('fs').readFileSync('cloudfunctions/updateFamilySettings/package.json','utf8')); console.log('updateFamilySettings json ok')"
```

Expected:

```text
updateFamilySettings json ok
```

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/_shared/auth.js cloudfunctions/createFamily/_shared/auth.js cloudfunctions/updateFamilySettings
git commit -m "feat: add family settings cloud function"
```

## Task 3: Family Page Profile, Quick Settings, and Member Permission Modal

**Files:**
- Modify: `pages/family/family.js`
- Modify: `pages/family/family.wxml`
- Modify: `pages/family/family.wxss`

- [ ] **Step 1: Add imports and data in `pages/family/family.js`**

At the top add:

```js
const { calcAge, normalizeProfile, normalizeSettings } = require('../../utils/family-settings')
const { formatDateTime } = require('../../utils/date')
```

Extend `data` with:

```js
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
```

- [ ] **Step 2: Load latest record and normalized profile/settings**

In `loadFamily()`, after `getFamily`, also call `getRecords` with no `since` limit:

```js
const family = res.result.family
const recordRes = await wx.cloud.callFunction({
  name: 'getRecords',
  data: { familyId: app.globalData.familyId },
})
const latestRecord = (recordRes.result.records || [])[0] || null
const profile = normalizeProfile(family.profile || {})
const settings = normalizeSettings(family.settings || {})
const profileView = {
  age: calcAge(profile.birthYear),
  currentBpText: latestRecord ? `${latestRecord.systolic} / ${latestRecord.diastolic} mmHg` : '暂无记录',
  currentHrText: latestRecord && latestRecord.heartRate ? `${latestRecord.heartRate} bpm` : '暂无记录',
  emergencyText: profile.emergencyContactName || profile.emergencyContactPhone ? `${profile.emergencyContactName || '未设置'} · ${profile.emergencyContactPhone || '未设置'}` : '未设置',
}
this.setData({
  loading: false,
  family: { ...family, profile, settings },
  latestRecord,
  latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
  profileView,
})
```

- [ ] **Step 3: Use `profileView` for display-only profile text**

Do not concatenate latest record strings in WXML. Keep age, current blood pressure, current heart rate, and emergency contact text in `profileView` from Step 2, then bind those fields directly in WXML.

- [ ] **Step 4: Add profile edit methods**

Add:

```js
onEditProfileTap() {
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
```

- [ ] **Step 5: Add quick setting methods**

Add:

```js
async updateSettingsPatch(patch) {
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
```

- [ ] **Step 6: Add member permission modal methods**

Add:

```js
onMemberTap(e) {
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
```

- [ ] **Step 7: Update family WXML**

Replace the current first profile card with:

```xml
<view class="card">
  <view class="card-head">
    <text class="section-title">被监护人档案</text>
    <text class="link" bindtap="onEditProfileTap">编辑</text>
  </view>
  <view class="profile-grid">
    <text>姓名：{{family.profile.name || '未设置'}}</text>
    <text>出生年：{{family.profile.birthYear || '未设置'}}</text>
    <text>年龄：{{profileView.age}}</text>
    <text>当前血压：{{profileView.currentBpText}}</text>
    <text>当前心率：{{profileView.currentHrText}}</text>
    <text>当前用药：{{family.profile.medicationsText || '未设置'}}</text>
    <text>紧急联系人：{{profileView.emergencyText}}</text>
  </view>
</view>
```

Make each member tappable:

```xml
<view wx:for="{{family.members}}" wx:key="openid" class="member" bindtap="onMemberTap" data-openid="{{item.openid}}">
```

Add quick settings after the report/medicine cards:

```xml
<view class="card">
  <text class="section-title">快捷设置</text>
  <view class="setting-row" bindtap="onToggleMedicationReminder">
    <view><text class="setting-title">用药提醒</text><text class="setting-sub">按晨/晚时间提醒</text></view>
    <view class="switch {{family.settings.medicationReminderEnabled ? 'on' : ''}}"><view class="knob"></view></view>
  </view>
  <view class="setting-row" bindtap="onToggleAbnormalNotify">
    <view><text class="setting-title">异常血压通知家人</text><text class="setting-sub">超过阈值时通知已选择成员</text></view>
    <view class="switch {{family.settings.abnormalBpNotifyEnabled ? 'on' : ''}}"><view class="knob"></view></view>
  </view>
  <view class="setting-row">
    <view><text class="setting-title">字体大小</text><text class="setting-sub">调整全局显示大小</text></view>
    <view class="segmented">
      <text class="{{family.settings.fontSize==='standard'?'active':''}}" bindtap="onFontSizeTap" data-value="standard">标准</text>
      <text class="{{family.settings.fontSize==='large'?'active':''}}" bindtap="onFontSizeTap" data-value="large">大</text>
      <text class="{{family.settings.fontSize==='xlarge'?'active':''}}" bindtap="onFontSizeTap" data-value="xlarge">超大</text>
    </view>
  </view>
</view>
```

Add profile edit modal and permission modal at the bottom before share panel:

```xml
<view wx:if="{{profileFormOpen}}" class="mask" bindtap="onCloseProfileForm"></view>
<view wx:if="{{profileFormOpen}}" class="modal">
  <text class="modal-title">编辑档案</text>
  <input value="{{profileForm.name}}" data-field="name" bindinput="onProfileInput" placeholder="姓名" />
  <input value="{{profileForm.birthYear}}" data-field="birthYear" bindinput="onProfileInput" type="number" placeholder="出生年" />
  <input value="{{profileForm.medicationsText}}" data-field="medicationsText" bindinput="onProfileInput" placeholder="当前用药" />
  <input value="{{profileForm.emergencyContactName}}" data-field="emergencyContactName" bindinput="onProfileInput" placeholder="紧急联系人姓名" />
  <input value="{{profileForm.emergencyContactPhone}}" data-field="emergencyContactPhone" bindinput="onProfileInput" type="number" placeholder="紧急联系人电话" />
  <button class="primary" bindtap="onSaveProfile">保存</button>
</view>

<view wx:if="{{permissionPanelOpen}}" class="mask" bindtap="onClosePermissionPanel"></view>
<view wx:if="{{permissionPanelOpen}}" class="modal">
  <text class="modal-title">成员权限</text>
  <text class="modal-sub">家人加入后默认可以查看家庭健康记录。</text>
  <text class="modal-sub">{{selectedMember.nickname || '家人'}}</text>
  <view class="setting-row" bindtap="onMemberPermissionToggle" data-key="canWrite">
    <view><text class="setting-title">可录入</text><text class="setting-sub">允许新增记录</text></view>
    <view class="switch {{selectedMember.canWrite ? 'on' : ''}}"><view class="knob"></view></view>
  </view>
  <view class="setting-row" bindtap="onMemberPermissionToggle" data-key="canEdit">
    <view><text class="setting-title">可编辑</text><text class="setting-sub">允许修改或删除记录</text></view>
    <view class="switch {{selectedMember.canEdit ? 'on' : ''}}"><view class="knob"></view></view>
  </view>
</view>
```

- [ ] **Step 8: Add family WXSS helpers**

Add styles for `.card-head`, `.link`, `.profile-grid`, `.setting-row`, `.setting-title`, `.setting-sub`, `.switch`, `.knob`, `.segmented`, `.modal`, `.modal-title`, `.modal-sub`, and modal inputs.

Use existing colors and radius; do not do final UI polish.

- [ ] **Step 9: Run syntax check**

Run:

```bash
node --check pages/family/family.js
```

Expected: exit code 0 and no output.

- [ ] **Step 10: Commit**

```bash
git add pages/family/family.js pages/family/family.wxml pages/family/family.wxss
git commit -m "feat: add family profile quick settings"
```

## Task 4: Settings Page Rebuild

**Files:**
- Modify: `pages/settings/settings.js`
- Modify: `pages/settings/settings.wxml`
- Modify: `pages/settings/settings.wxss`

- [ ] **Step 1: Replace settings page JS with family settings editor**

Use:

```js
const { normalizeSettings } = require('../../utils/family-settings')

Page({
  data: {
    family: null,
    settings: null,
    members: [],
    loading: true,
  },

  onShow() {
    this.loadFamily()
  },

  async loadFamily() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, family: null, settings: null, members: [] })
      return
    }
    const res = await wx.cloud.callFunction({
      name: 'getFamily',
      data: { familyId: app.globalData.familyId },
    })
    const family = res.result.family
    this.setData({
      family,
      settings: normalizeSettings(family.settings || {}),
      members: family.members || [],
      loading: false,
    })
  },

  async updateSettings(patch) {
    const settings = normalizeSettings({ ...this.data.settings, ...patch })
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
    this.setData({ settings })
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
    wx.showActionSheet({
      itemList: (this.data.members || []).map(member => member.nickname || '家人'),
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
```

- [ ] **Step 2: Replace settings WXML**

Use grouped cards with small descriptions:

```xml
<scroll-view scroll-y class="container">
  <text class="sec-label">通知设置</text>
  <view class="settings-card">
    <view class="setting-row" bindtap="onToggle" data-key="abnormalBpNotifyEnabled">
      <view><text class="setting-title">异常血压通知</text><text class="setting-sub">超过阈值时通知已选择成员</text></view>
      <view class="switch {{settings.abnormalBpNotifyEnabled ? 'on' : ''}}"><view class="knob"></view></view>
    </view>
    <view class="setting-row" bindtap="onNotifyMembersTap">
      <view><text class="setting-title">通知对象</text><text class="setting-sub">血压异常时通知谁</text></view>
      <text class="value">{{settings.notifyMemberIds.length ? settings.notifyMemberIds.length + '人' : '未选择'}} ></text>
    </view>
    <view class="setting-row">
      <view><text class="setting-title">高压告警阈值</text><text class="setting-sub">收缩压超过此值时触发通知</text></view>
      <input class="number-input" type="number" value="{{settings.alertSystolic}}" bindblur="onThresholdChange" data-key="alertSystolic" />
    </view>
    <view class="setting-row">
      <view><text class="setting-title">低压告警阈值</text><text class="setting-sub">舒张压超过此值时触发通知</text></view>
      <input class="number-input" type="number" value="{{settings.alertDiastolic}}" bindblur="onThresholdChange" data-key="alertDiastolic" />
    </view>
  </view>

  <text class="sec-label">提醒设置</text>
  <view class="settings-card">
    <view class="setting-row" bindtap="onToggle" data-key="medicationReminderEnabled">
      <view><text class="setting-title">用药提醒</text><text class="setting-sub">每日定时提醒服药</text></view>
      <view class="switch {{settings.medicationReminderEnabled ? 'on' : ''}}"><view class="knob"></view></view>
    </view>
    <picker mode="time" value="{{settings.morningReminderTime}}" bindchange="onTimeChange" data-key="morningReminderTime">
      <view class="setting-row"><view><text class="setting-title">晨提醒时间</text><text class="setting-sub">早晨服药提醒时间</text></view><text class="value">{{settings.morningReminderTime}} ></text></view>
    </picker>
    <picker mode="time" value="{{settings.eveningReminderTime}}" bindchange="onTimeChange" data-key="eveningReminderTime">
      <view class="setting-row"><view><text class="setting-title">晚提醒时间</text><text class="setting-sub">晚上服药提醒时间</text></view><text class="value">{{settings.eveningReminderTime}} ></text></view>
    </picker>
  </view>

  <text class="sec-label">图表设置</text>
  <view class="settings-card">
    <view class="setting-row" bindtap="onToggle" data-key="morningEveningLabel">
      <view><text class="setting-title">晨/晚测标注</text><text class="setting-sub">录入时选择测量时段</text></view>
      <view class="switch {{settings.morningEveningLabel ? 'on' : ''}}"><view class="knob"></view></view>
    </view>
    <view class="setting-row" bindtap="onToggle" data-key="splitLines">
      <view><text class="setting-title">早晚分线显示</text><text class="setting-sub">图表中晨/晚测分两条线</text></view>
      <view class="switch {{settings.splitLines ? 'on' : ''}}"><view class="knob"></view></view>
    </view>
  </view>

  <text class="sec-label">显示设置</text>
  <view class="settings-card">
    <view class="setting-row">
      <view><text class="setting-title">字体大小</text><text class="setting-sub">超大模式适合老人使用</text></view>
      <view class="segmented">
        <text class="{{settings.fontSize==='standard'?'active':''}}" bindtap="onFontSizeTap" data-value="standard">标准</text>
        <text class="{{settings.fontSize==='large'?'active':''}}" bindtap="onFontSizeTap" data-value="large">大</text>
        <text class="{{settings.fontSize==='xlarge'?'active':''}}" bindtap="onFontSizeTap" data-value="xlarge">超大</text>
      </view>
    </view>
  </view>

  <text class="note">当前仅保存配置，暂不接微信订阅消息或真实提醒服务。</text>
</scroll-view>
```

- [ ] **Step 3: Replace settings WXSS**

Add concrete styles for:

- `.container`: full-height light background with page padding.
- `.sec-label`: small bold grey section label with top and bottom margin.
- `.settings-card`: white rounded card with vertical rows and subtle shadow.
- `.setting-row`: flex row with `min-height: 112rpx`, centered content, and bottom border except the last row.
- `.setting-title`: bold dark label.
- `.setting-sub`: block grey subtitle below the title.
- `.value`: grey right-aligned value text.
- `.switch`, `.switch.on`, `.knob`, `.switch.on .knob`: same switch geometry as the current settings page.
- `.number-input`: fixed-width right-aligned number input with light blue background.
- `.segmented` and `.segmented text`: three-option segmented control; active state blue background and white text.
- `.note`: muted explanatory text at the bottom.

- [ ] **Step 4: Run syntax check**

Run:

```bash
node --check pages/settings/settings.js
node -e "JSON.parse(require('fs').readFileSync('pages/settings/settings.json','utf8')); console.log('settings json ok')"
```

Expected:

```text
settings json ok
```

- [ ] **Step 5: Commit**

```bash
git add pages/settings/settings.js pages/settings/settings.wxml pages/settings/settings.wxss
git commit -m "feat: rebuild settings page"
```

## Task 5: Verification and Handoff

**Files:**
- Verify only.

- [ ] **Step 1: Run smoke checks**

Run:

```bash
node scripts/verify-health-rules.js
node scripts/verify-record-utils.js
node scripts/verify-chart-data.js
node scripts/verify-report-data.js
node scripts/verify-family-settings.js
```

Expected:

```text
health rule checks passed
record utility checks passed
chart data checks passed
report data checks passed
family settings checks passed
```

- [ ] **Step 2: Run JS syntax checks**

Run:

```bash
find . -path './.git' -prune -o -path './.worktrees' -prune -o -name '*.js' -print -exec node --check {} \;
```

Expected: exit code 0.

- [ ] **Step 3: Run JSON parse checks**

Run:

```bash
node -e "const fs=require('fs'); for (const f of ['app.json','project.config.json','pages/data/data.json','pages/records/records.json','pages/report/report.json','pages/add-record/add-record.json','pages/family/family.json','pages/join-family/join-family.json','pages/settings/settings.json','cloudfunctions/updateFamilySettings/package.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json checks passed')"
```

Expected:

```text
json checks passed
```

- [ ] **Step 4: WeChat DevTools manual checks**

After merge, ask the user to upload/deploy the new `updateFamilySettings` cloud function, then compile and verify:

- 家庭页显示档案信息、当前血压、当前心率、当前用药、紧急联系人。
- 家庭页可编辑档案字段并保存。
- 家庭页快捷设置可保存。
- 设置页每个设置项都有小字解释。
- 通知对象默认不选，可选择成员。
- 用药提醒只显示晨/晚两个时间。
- 家庭成员处可进入单个成员权限配置。
- 加入家庭的成员默认可查看，只有可录入/可编辑可配置。

- [ ] **Step 5: Use finishing branch workflow**

After all checks pass, use `finishing-a-development-branch` to choose merge/push/keep/discard.
