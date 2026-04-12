# BP Mini-Program Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working foundation for the family health mini-program: reference rules, CloudBase auth, family creation, share-based invitation, fallback invite code, and member permissions.

**Architecture:** Keep the V1 app as a native WeChat Mini Program using CloudBase. Put reusable medical-reference logic in pure JS utilities that can be sanity-tested with Node, and keep data authorization in cloud functions rather than only in page UI. This phase does not implement charts, record CRUD, report export, or blood glucose.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JS, CloudBase cloud functions with `wx-server-sdk`, Node-based utility smoke tests.

---

## Source Spec

Use `docs/superpowers/specs/2026-04-12-blood-pressure-miniprogram-mvp-design.md` as the source of truth.

## File Structure

- `app.js`: CloudBase initialization, login bootstrapping, global user/family state.
- `app.json`: Add Phase 1 pages.
- `app.wxss`: Shared design tokens and elderly-friendly base styles.
- `utils/health-rules.js`: Blood pressure and heart-rate reference-status logic.
- `pages/family/*`: Family empty state, family overview, invite action sheet, fallback code entry.
- `pages/join-family/*`: Confirmation page opened by share cards.
- `pages/settings/*`: Phase 1 member-permission section only.
- `pages/data/*`, `pages/records/*`, `pages/add-record/*`: Temporary Phase 1 shells so app routing compiles before later feature phases.
- `cloudfunctions/_shared/auth.js`: Shared CloudBase auth and family permission helpers.
- `cloudfunctions/login/*`: Upsert user, return session context.
- `cloudfunctions/createFamily/*`: Create family with `displayName`, invite code/token, admin member.
- `cloudfunctions/getFamily/*`: Read family context for current user.
- `cloudfunctions/joinFamily/*`: Join via `inviteToken` or `inviteCode`.
- `cloudfunctions/updateMemberPermission/*`: Admin-only permission update.
- `scripts/verify-health-rules.js`: Node smoke checks for reference-rule utilities.

## Task 1: App Routing and Global State

**Files:**
- Modify: `app.json`
- Modify: `app.js`
- Modify: `app.wxss`
- Create: `pages/data/data.js`
- Create: `pages/data/data.wxml`
- Create: `pages/data/data.wxss`
- Create: `pages/data/data.json`
- Create: `pages/records/records.js`
- Create: `pages/records/records.wxml`
- Create: `pages/records/records.wxss`
- Create: `pages/records/records.json`
- Create: `pages/add-record/add-record.js`
- Create: `pages/add-record/add-record.wxml`
- Create: `pages/add-record/add-record.wxss`
- Create: `pages/add-record/add-record.json`

- [ ] **Step 1: Update pages in `app.json`**

Add `pages/join-family/join-family` and keep the two-tab structure:

```json
{
  "pages": [
    "pages/data/data",
    "pages/records/records",
    "pages/add-record/add-record",
    "pages/family/family",
    "pages/join-family/join-family",
    "pages/settings/settings"
  ],
  "tabBar": {
    "color": "#94A3B8",
    "selectedColor": "#3182F7",
    "backgroundColor": "#FFFFFF",
    "borderStyle": "white",
    "list": [
      {
        "pagePath": "pages/data/data",
        "text": "数据",
        "iconPath": "assets/icons/data.png",
        "selectedIconPath": "assets/icons/data-active.png"
      },
      {
        "pagePath": "pages/family/family",
        "text": "家庭",
        "iconPath": "assets/icons/family.png",
        "selectedIconPath": "assets/icons/family-active.png"
      }
    ]
  },
  "window": {
    "navigationBarBackgroundColor": "#3182F7",
    "navigationBarTitleText": "血压心率记录",
    "navigationBarTextStyle": "white",
    "backgroundTextStyle": "light",
    "backgroundColor": "#EEF3FB"
  },
  "usingComponents": {}
}
```

- [ ] **Step 2: Update `app.js` global state**

Use this shape. Keep `env: ''` until the user provides a CloudBase environment ID:

```js
App({
  onLaunch() {
    wx.cloud.init({
      env: '',
      traceUser: true,
    })
    this.doLogin()
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
```

- [ ] **Step 3: Keep `app.wxss` tokens and add accessible tap helpers**

Append:

```css
.tap-row {
  min-height: 96rpx;
  display: flex;
  align-items: center;
}

.muted {
  color: var(--text2);
}

.danger-text {
  color: var(--red);
}
```

- [ ] **Step 4: Verify route config**

Create temporary route shells for pages that later plans will replace.

`pages/data/data.js`:

```js
Page({})
```

`pages/data/data.wxml`:

```xml
<view class="shell">
  <text class="shell-title">血压心率记录</text>
  <text class="shell-subtitle">功能建设中。</text>
</view>
```

`pages/data/data.wxss`:

```css
.shell { min-height: 100vh; background: #EEF3FB; padding: 80rpx 40rpx; box-sizing: border-box; }
.shell-title { display: block; font-size: 40rpx; font-weight: 800; color: #0F172A; }
.shell-subtitle { display: block; margin-top: 20rpx; color: #64748B; font-size: 28rpx; }
```

`pages/data/data.json`:

```json
{
  "navigationBarTitleText": "血压心率记录"
}
```

`pages/records/records.js`:

```js
Page({})
```

`pages/records/records.wxml`:

```xml
<view class="shell">
  <text class="shell-title">全部记录</text>
  <text class="shell-subtitle">功能建设中。</text>
</view>
```

`pages/records/records.wxss`:

```css
.shell { min-height: 100vh; background: #EEF3FB; padding: 80rpx 40rpx; box-sizing: border-box; }
.shell-title { display: block; font-size: 40rpx; font-weight: 800; color: #0F172A; }
.shell-subtitle { display: block; margin-top: 20rpx; color: #64748B; font-size: 28rpx; }
```

`pages/records/records.json`:

```json
{
  "navigationBarTitleText": "全部记录"
}
```

`pages/add-record/add-record.js`:

```js
Page({})
```

`pages/add-record/add-record.wxml`:

```xml
<view class="shell">
  <text class="shell-title">添加记录</text>
  <text class="shell-subtitle">功能建设中。</text>
</view>
```

`pages/add-record/add-record.wxss`:

```css
.shell { min-height: 100vh; background: #EEF3FB; padding: 80rpx 40rpx; box-sizing: border-box; }
.shell-title { display: block; font-size: 40rpx; font-weight: 800; color: #0F172A; }
.shell-subtitle { display: block; margin-top: 20rpx; color: #64748B; font-size: 28rpx; }
```

`pages/add-record/add-record.json`:

```json
{
  "navigationBarTitleText": "添加记录"
}
```

- [ ] **Step 5: Verify route config**

Run in WeChat DevTools after the page files exist:

```text
Compile
```

Expected: no “page not found” errors.

- [ ] **Step 6: Commit**

```bash
git add app.json app.js app.wxss pages/data pages/records pages/add-record
git commit -m "feat: configure phase one app routes and state"
```

## Task 2: Reference Rule Utilities

**Files:**
- Create: `utils/health-rules.js`
- Create: `scripts/verify-health-rules.js`

- [ ] **Step 1: Create `utils/health-rules.js`**

```js
const BP_STATUS = {
  LOW: { level: 'low', label: '偏低', color: '#FF9500', attention: true },
  IN_RANGE: { level: 'inRange', label: '参考范围内', color: '#34C759', attention: false },
  HIGH: { level: 'high', label: '偏高', color: '#FF9500', attention: true },
  VERY_HIGH: { level: 'veryHigh', label: '明显偏高', color: '#FF3B30', attention: true },
  CRITICAL: { level: 'critical', label: '很高', color: '#C81E1E', attention: true },
}

const HR_STATUS = {
  SLOW: { level: 'slow', label: '偏慢', color: '#FF9500', attention: true },
  VERY_SLOW: { level: 'verySlow', label: '明显偏慢', color: '#C81E1E', attention: true },
  IN_RANGE: { level: 'inRange', label: '参考范围内', color: '#34C759', attention: false },
  FAST: { level: 'fast', label: '偏快', color: '#FF9500', attention: true },
  VERY_FAST: { level: 'veryFast', label: '明显偏快', color: '#FF3B30', attention: true },
}

function cloneStatus(status) {
  return { ...status }
}

function getBPStatus(systolic, diastolic, target) {
  const sys = Number(systolic)
  const dia = Number(diastolic)
  const tSys = Number(target && target.systolic) || 135
  const tDia = Number(target && target.diastolic) || 85

  if (sys < 90 || dia < 60) return cloneStatus(BP_STATUS.LOW)
  if (sys >= 180 || dia >= 110) return cloneStatus(BP_STATUS.CRITICAL)
  if (sys >= 160 || dia >= 100) return cloneStatus(BP_STATUS.VERY_HIGH)
  if (sys >= tSys || dia >= tDia) return cloneStatus(BP_STATUS.HIGH)
  return cloneStatus(BP_STATUS.IN_RANGE)
}

function getHRStatus(heartRate, target) {
  const hr = Number(heartRate)
  const min = Number(target && target.min) || 60
  const max = Number(target && target.max) || 80

  if (hr < 50) return cloneStatus(HR_STATUS.VERY_SLOW)
  if (hr < min) return cloneStatus(HR_STATUS.SLOW)
  if (hr > 100) return cloneStatus(HR_STATUS.VERY_FAST)
  if (hr > max) return cloneStatus(HR_STATUS.FAST)
  return cloneStatus(HR_STATUS.IN_RANGE)
}

function calcAverage(records) {
  if (!records.length) return { systolic: '--', diastolic: '--', heartRate: '--' }
  const avg = key => Math.round(records.reduce((sum, record) => sum + Number(record[key]), 0) / records.length)
  return {
    systolic: avg('systolic'),
    diastolic: avg('diastolic'),
    heartRate: avg('heartRate'),
  }
}

function countReferenceStats(records, profile) {
  const bpTarget = {
    systolic: profile && profile.targetSystolic,
    diastolic: profile && profile.targetDiastolic,
  }
  const hrTarget = {
    min: profile && profile.targetHRMin,
    max: profile && profile.targetHRMax,
  }

  let bpInRange = 0
  let hrInRange = 0
  records.forEach(record => {
    if (!getBPStatus(record.systolic, record.diastolic, bpTarget).attention) bpInRange += 1
    if (!getHRStatus(record.heartRate, hrTarget).attention) hrInRange += 1
  })

  return {
    bp: { inRange: bpInRange, attention: records.length - bpInRange },
    hr: { inRange: hrInRange, attention: records.length - hrInRange },
  }
}

module.exports = {
  getBPStatus,
  getHRStatus,
  calcAverage,
  countReferenceStats,
}
```

- [ ] **Step 2: Create `scripts/verify-health-rules.js`**

```js
const assert = require('assert')
const {
  getBPStatus,
  getHRStatus,
  calcAverage,
  countReferenceStats,
} = require('../utils/health-rules')

assert.strictEqual(getBPStatus(120, 80).level, 'inRange')
assert.strictEqual(getBPStatus(138, 84).level, 'high')
assert.strictEqual(getBPStatus(160, 90).level, 'veryHigh')
assert.strictEqual(getBPStatus(180, 90).level, 'critical')
assert.strictEqual(getBPStatus(88, 58).level, 'low')

assert.strictEqual(getHRStatus(72).level, 'inRange')
assert.strictEqual(getHRStatus(90).level, 'fast')
assert.strictEqual(getHRStatus(105).level, 'veryFast')
assert.strictEqual(getHRStatus(55).level, 'slow')
assert.strictEqual(getHRStatus(45).level, 'verySlow')

const records = [
  { systolic: 120, diastolic: 80, heartRate: 72 },
  { systolic: 140, diastolic: 86, heartRate: 90 },
]
assert.deepStrictEqual(calcAverage(records), { systolic: 130, diastolic: 83, heartRate: 81 })
assert.deepStrictEqual(countReferenceStats(records, {}), {
  bp: { inRange: 1, attention: 1 },
  hr: { inRange: 1, attention: 1 },
})

console.log('health rule checks passed')
```

- [ ] **Step 3: Run utility verification**

```bash
node scripts/verify-health-rules.js
```

Expected:

```text
health rule checks passed
```

- [ ] **Step 4: Commit**

```bash
git add utils/health-rules.js scripts/verify-health-rules.js
git commit -m "feat: add health reference rule utilities"
```

## Task 3: Shared Cloud Function Auth Helpers

**Files:**
- Create: `cloudfunctions/_shared/auth.js`

- [ ] **Step 1: Create `cloudfunctions/_shared/auth.js`**

```js
function findMember(family, openid) {
  if (!family || !Array.isArray(family.members)) return null
  return family.members.find(member => member.openid === openid) || null
}

function requireMember(family, openid) {
  const member = findMember(family, openid)
  if (!member) {
    const err = new Error('无权访问该家庭组')
    err.code = 'FORBIDDEN'
    throw err
  }
  return member
}

function requireAdmin(family, openid) {
  const member = requireMember(family, openid)
  if (member.role !== 'admin') {
    const err = new Error('仅管理员可操作')
    err.code = 'ADMIN_REQUIRED'
    throw err
  }
  return member
}

function canWriteRecord(member) {
  return member.role === 'admin' || member.canWrite === true
}

function canEditRecord(member) {
  return member.role === 'admin' || member.canEdit === true
}

function createDefaultProfile() {
  return {
    name: '',
    birthYear: null,
    targetSystolic: 135,
    targetDiastolic: 85,
    targetHRMin: 60,
    targetHRMax: 80,
    medications: '',
    emergencyContact: '',
  }
}

function createDefaultSettings() {
  return {
    alertSystolic: 160,
    alertDiastolic: 100,
    notifyAll: true,
    notifyMemberIds: [],
    morningEveningLabel: false,
    splitLines: false,
    fontSize: 'large',
  }
}

module.exports = {
  findMember,
  requireMember,
  requireAdmin,
  canWriteRecord,
  canEditRecord,
  createDefaultProfile,
  createDefaultSettings,
}
```

- [ ] **Step 2: Commit**

```bash
git add cloudfunctions/_shared/auth.js
git commit -m "feat: add shared cloud auth helpers"
```

## Task 4: Login and Family Cloud Functions

**Files:**
- Create: `cloudfunctions/login/index.js`
- Create: `cloudfunctions/login/package.json`
- Create: `cloudfunctions/createFamily/index.js`
- Create: `cloudfunctions/createFamily/package.json`
- Create: `cloudfunctions/getFamily/index.js`
- Create: `cloudfunctions/getFamily/package.json`
- Create: `cloudfunctions/joinFamily/index.js`
- Create: `cloudfunctions/joinFamily/package.json`

- [ ] **Step 1: Create cloud function package files**

Use this package for each function folder:

```json
{
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

Set `"name"` to the folder name for each package.

- [ ] **Step 2: Implement `login/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const userRef = db.collection('users').doc(OPENID)
  let user = null

  try {
    user = (await userRef.get()).data
  } catch (e) {
    await userRef.set({
      data: {
        _id: OPENID,
        nickname: '',
        avatarUrl: '',
        familyId: '',
        role: '',
        preferences: {},
        createdAt: db.serverDate(),
      },
    })
    user = (await userRef.get()).data
  }

  let memberPermissions = { canWrite: false, canEdit: false }
  if (user.familyId) {
    const family = (await db.collection('families').doc(user.familyId).get()).data
    const member = (family.members || []).find(item => item.openid === OPENID)
    if (member) {
      memberPermissions = {
        canWrite: member.role === 'admin' || member.canWrite === true,
        canEdit: member.role === 'admin' || member.canEdit === true,
      }
    }
  }

  return {
    openid: OPENID,
    familyId: user.familyId || '',
    role: user.role || '',
    memberPermissions,
  }
}
```

- [ ] **Step 3: Implement `createFamily/index.js`**

```js
const cloud = require('wx-server-sdk')
const {
  createDefaultProfile,
  createDefaultSettings,
} = require('../_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toUpperCase()
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const profile = { ...createDefaultProfile(), ...(event.profile || {}) }
  const displayName = event.displayName || (profile.name ? `${profile.name}的健康记录` : '家庭健康记录')

  const familyRes = await db.collection('families').add({
    data: {
      displayName,
      inviteCode: randomCode(),
      inviteToken: randomToken(),
      createdBy: OPENID,
      members: [{
        openid: OPENID,
        role: 'admin',
        nickname: event.nickname || '我',
        avatarUrl: event.avatarUrl || '',
        canWrite: true,
        canEdit: true,
        joinedAt: db.serverDate(),
      }],
      profile,
      settings: createDefaultSettings(),
      createdAt: db.serverDate(),
    },
  })

  await db.collection('users').doc(OPENID).update({
    data: { familyId: familyRes._id, role: 'admin' },
  })

  return { success: true, familyId: familyRes._id }
}
```

- [ ] **Step 4: Implement `getFamily/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireMember } = require('../_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId } = event
  const family = (await db.collection('families').doc(familyId).get()).data
  const member = requireMember(family, OPENID)
  return { success: true, family, member }
}
```

- [ ] **Step 5: Implement `joinFamily/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { inviteToken, inviteCode, nickname, avatarUrl } = event
  const where = inviteToken ? { inviteToken } : { inviteCode }

  const res = await db.collection('families').where(where).limit(1).get()
  if (!res.data.length) return { success: false, error: '邀请无效，请让家人重新邀请' }

  const family = res.data[0]
  if ((family.members || []).some(member => member.openid === OPENID)) {
    return { success: false, error: '你已经是该家庭成员' }
  }
  if ((family.members || []).length >= 10) {
    return { success: false, error: '家庭成员已达上限（10人）' }
  }

  await db.collection('families').doc(family._id).update({
    data: {
      members: _.push({
        openid: OPENID,
        role: 'member',
        nickname: nickname || '家人',
        avatarUrl: avatarUrl || '',
        canWrite: false,
        canEdit: false,
        joinedAt: db.serverDate(),
      }),
    },
  })

  await db.collection('users').doc(OPENID).update({
    data: { familyId: family._id, role: 'member' },
  })

  return { success: true, familyId: family._id }
}
```

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/login cloudfunctions/createFamily cloudfunctions/getFamily cloudfunctions/joinFamily
git commit -m "feat: add family auth and invite cloud functions"
```

## Task 5: Family Page and Join Page

**Files:**
- Create: `pages/family/family.js`
- Create: `pages/family/family.wxml`
- Create: `pages/family/family.wxss`
- Create: `pages/family/family.json`
- Create: `pages/join-family/join-family.js`
- Create: `pages/join-family/join-family.wxml`
- Create: `pages/join-family/join-family.wxss`
- Create: `pages/join-family/join-family.json`

- [ ] **Step 1: Create page JSON files**

`pages/family/family.json`:

```json
{
  "navigationBarTitleText": "家庭",
  "navigationBarBackgroundColor": "#FFFFFF",
  "navigationBarTextStyle": "black"
}
```

`pages/join-family/join-family.json`:

```json
{
  "navigationBarTitleText": "加入家庭组",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 2: Implement `pages/family/family.js`**

```js
Page({
  data: {
    loading: true,
    family: null,
    joinCode: '',
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
    this.setData({ joinCode: '' })
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
    wx.showActionSheet({
      itemList: ['发送微信邀请', '复制邀请码'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showToast({ title: '请点击页面内邀请按钮发送', icon: 'none' })
        }
        if (res.tapIndex === 1) {
          wx.setClipboardData({ data: this.data.family.inviteCode })
        }
      },
    })
  },

  onShareAppMessage() {
    const family = this.data.family || {}
    return {
      title: `邀请你加入「${family.displayName || '家庭健康记录'}」`,
      path: `/pages/join-family/join-family?inviteToken=${family.inviteToken}`,
    }
  },
})
```

- [ ] **Step 3: Implement `pages/family/family.wxml`**

```xml
<view class="container">
  <view class="fam-header">
    <text class="fam-title">家庭</text>
  </view>

  <view wx:if="{{!family && !loading}}" class="empty">
    <text class="empty-title">你还没有加入家庭组</text>
    <button class="primary" bindtap="onCreateFamily">创建家庭组</button>
    <button class="secondary" bindtap="onJoinFamilyTap">加入家人的家庭组</button>
    <text class="empty-hint">如果家人发给你的是微信邀请卡片，直接点开卡片即可加入。</text>
  </view>

  <scroll-view wx:if="{{family}}" scroll-y class="body">
    <view class="card">
      <text class="section-title">{{family.displayName || '家庭健康记录'}}</text>
      <text class="muted">被监护人：{{family.profile.name || '未设置'}}</text>
    </view>

    <view class="card">
      <view class="row-title">家庭成员</view>
      <view class="member-row">
        <view wx:for="{{family.members}}" wx:key="openid" class="member">
          <view class="avatar">{{item.nickname ? item.nickname[0] : '家'}}</view>
          <text>{{item.nickname || '家人'}}</text>
        </view>
        <button class="invite-button" open-type="share">＋\n邀请</button>
        <button class="code-button" bindtap="onInviteTap">邀请码</button>
      </view>
    </view>

    <view class="action-card">
      <text class="action-title">📄 生成就诊报告</text>
      <text class="muted">选择时间段，导出图片</text>
    </view>

    <view class="action-card disabled">
      <text class="action-title">💊 药物管理</text>
      <text class="muted">即将上线</text>
    </view>
  </scroll-view>
</view>
```

- [ ] **Step 4: Implement `pages/join-family/join-family.js`**

```js
Page({
  data: {
    inviteToken: '',
    joining: false,
    displayName: '家庭健康记录',
  },

  onLoad(options) {
    this.setData({ inviteToken: options.inviteToken || '' })
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
```

- [ ] **Step 5: Implement page styles**

`pages/family/family.wxss`:

```css
.container { min-height: 100vh; background: #EEF3FB; }
.fam-header { background: #fff; padding: 88rpx 40rpx 28rpx; border-bottom: 2rpx solid #DDE6F5; }
.fam-title { font-size: 56rpx; font-weight: 800; color: #0F172A; }
.empty { padding: 120rpx 40rpx; text-align: center; }
.empty-title { display: block; font-size: 34rpx; font-weight: 700; color: #0F172A; margin-bottom: 40rpx; }
.empty-hint { display: block; color: #64748B; font-size: 26rpx; line-height: 1.6; margin-top: 28rpx; }
.primary, .secondary { min-height: 96rpx; border-radius: 28rpx; font-size: 32rpx; font-weight: 700; margin-top: 20rpx; }
.primary { background: #3182F7; color: #fff; }
.secondary { background: #EAF2FF; color: #3182F7; }
.body { padding: 32rpx; }
.card, .action-card { background: #fff; border-radius: 32rpx; padding: 32rpx; margin-bottom: 24rpx; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.section-title { display: block; font-size: 36rpx; font-weight: 800; color: #0F172A; margin-bottom: 12rpx; }
.row-title { font-size: 32rpx; font-weight: 700; color: #0F172A; margin-bottom: 24rpx; }
.member-row { display: flex; gap: 20rpx; overflow-x: auto; padding-bottom: 8rpx; }
.member { min-width: 112rpx; display: flex; flex-direction: column; align-items: center; gap: 10rpx; color: #64748B; font-size: 24rpx; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: #EAF2FF; color: #3182F7; display: flex; align-items: center; justify-content: center; font-size: 32rpx; font-weight: 700; }
.invite-button, .code-button { min-width: 112rpx; height: 132rpx; border-radius: 24rpx; font-size: 24rpx; line-height: 1.4; white-space: pre-line; }
.invite-button { background: #3182F7; color: #fff; }
.code-button { background: #F8FAFF; color: #3182F7; border: 2rpx solid #DDE6F5; }
.action-title { display: block; font-size: 32rpx; font-weight: 700; color: #0F172A; margin-bottom: 8rpx; }
.disabled { opacity: 0.55; }
```

`pages/join-family/join-family.wxss`:

```css
.container { min-height: 100vh; background: #EEF3FB; padding: 64rpx 40rpx; box-sizing: border-box; }
.join-card { background: #fff; border-radius: 32rpx; padding: 48rpx 36rpx; text-align: center; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.title { display: block; font-size: 40rpx; font-weight: 800; color: #0F172A; margin-bottom: 36rpx; }
.invite-text { display: block; font-size: 30rpx; color: #64748B; margin-bottom: 12rpx; }
.family-name { display: block; font-size: 38rpx; font-weight: 800; color: #0F172A; margin-bottom: 20rpx; }
.hint { display: block; font-size: 28rpx; color: #64748B; line-height: 1.6; margin-bottom: 40rpx; }
.primary, .secondary { min-height: 96rpx; border-radius: 28rpx; font-size: 32rpx; font-weight: 700; margin-top: 20rpx; }
.primary { background: #3182F7; color: #fff; }
.secondary { background: #F8FAFF; color: #64748B; border: 2rpx solid #DDE6F5; }
```

`pages/join-family/join-family.wxml`:

```xml
<view class="container">
  <view class="join-card">
    <text class="title">加入家庭组</text>
    <text class="invite-text">家人邀请你加入</text>
    <text class="family-name">{{displayName}}</text>
    <text class="hint">加入后可以查看家庭共享的健康数据和报告。</text>
    <button class="primary" bindtap="onJoin" loading="{{joining}}">同意加入</button>
    <button class="secondary" bindtap="onCancel">暂不加入</button>
  </view>
</view>
```

- [ ] **Step 6: Commit**

```bash
git add pages/family pages/join-family
git commit -m "feat: add family invite and join pages"
```

## Task 6: Member Permission Function and Settings Slice

**Files:**
- Create: `cloudfunctions/updateMemberPermission/index.js`
- Create: `cloudfunctions/updateMemberPermission/package.json`
- Create: `pages/settings/settings.js`
- Create: `pages/settings/settings.wxml`
- Create: `pages/settings/settings.wxss`
- Create: `pages/settings/settings.json`

- [ ] **Step 1: Implement `updateMemberPermission/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireAdmin } = require('../_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, targetOpenid, canWrite, canEdit } = event
  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  const members = (family.members || []).map(member => {
    if (member.openid !== targetOpenid) return member
    if (member.role === 'admin') return member
    return { ...member, canWrite: canWrite === true, canEdit: canEdit === true }
  })

  await familyRef.update({ data: { members } })
  return { success: true }
}
```

- [ ] **Step 2: Implement `pages/settings/settings.js`**

```js
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
```

- [ ] **Step 3: Implement `pages/settings/settings.wxml`**

```xml
<scroll-view scroll-y class="container">
  <text class="sec-label">成员权限</text>
  <view wx:if="{{!members.length && !loading}}" class="empty-card">
    <text>暂无可配置成员</text>
  </view>

  <view wx:for="{{members}}" wx:key="openid" class="member-card">
    <view>
      <text class="member-name">{{item.nickname || '家人'}}</text>
      <text class="member-sub">普通成员</text>
    </view>
    <view class="perm-row">
      <view class="perm" bindtap="onPermissionToggle" data-openid="{{item.openid}}" data-key="canWrite">
        <text>可录入</text>
        <view class="switch {{item.canWrite ? 'on' : ''}}"><view class="knob"></view></view>
      </view>
      <view class="perm" bindtap="onPermissionToggle" data-openid="{{item.openid}}" data-key="canEdit">
        <text>可编辑</text>
        <view class="switch {{item.canEdit ? 'on' : ''}}"><view class="knob"></view></view>
      </view>
    </view>
  </view>
</scroll-view>
```

- [ ] **Step 4: Implement `pages/settings/settings.wxss`**

```css
.container { min-height: 100vh; background: #EEF3FB; padding: 32rpx; box-sizing: border-box; }
.sec-label { display: block; font-size: 24rpx; font-weight: 700; color: #94A3B8; margin: 20rpx 0 20rpx; }
.empty-card, .member-card { background: #fff; border-radius: 28rpx; padding: 32rpx; margin-bottom: 20rpx; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.member-name { display: block; font-size: 32rpx; font-weight: 700; color: #0F172A; }
.member-sub { display: block; font-size: 26rpx; color: #64748B; margin-top: 6rpx; }
.perm-row { margin-top: 28rpx; display: flex; gap: 20rpx; }
.perm { flex: 1; min-height: 88rpx; border-radius: 20rpx; background: #F8FAFF; display: flex; align-items: center; justify-content: space-between; padding: 0 20rpx; color: #0F172A; font-size: 28rpx; }
.switch { width: 88rpx; height: 52rpx; border-radius: 26rpx; background: #CBD5E1; position: relative; }
.switch.on { background: #3182F7; }
.knob { width: 40rpx; height: 40rpx; background: #fff; border-radius: 50%; position: absolute; top: 6rpx; left: 6rpx; transition: left 0.18s; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.18); }
.switch.on .knob { left: 42rpx; }
```

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/updateMemberPermission pages/settings
git commit -m "feat: add member permission management"
```

## Task 7: Phase 1 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run local utility smoke test**

```bash
node scripts/verify-health-rules.js
```

Expected:

```text
health rule checks passed
```

- [ ] **Step 2: Compile in WeChat DevTools**

Expected:

```text
No missing page, component, or syntax errors.
```

- [ ] **Step 3: Manual CloudBase verification**

In DevTools, deploy these functions:

```text
login
createFamily
getFamily
joinFamily
updateMemberPermission
```

Expected:

```text
Each upload finishes without dependency errors.
```

- [ ] **Step 4: Manual product flow verification**

Check:

- New user sees family empty state.
- New user can create a family.
- Created family has `displayName = "家庭健康记录"` if no profile name is provided.
- Family member area shows invite controls.
- Invite card path contains `inviteToken`.
- User can join by invite code.
- Re-joining the same family returns “你已经是该家庭成员”.
- Admin can toggle member permissions.

- [ ] **Step 5: Commit verification notes if needed**

If manual verification requires docs changes, update the plan or spec and commit:

```bash
git add docs/superpowers/plans/2026-04-12-bp-miniprogram-phase1-foundation.md docs/superpowers/specs/2026-04-12-blood-pressure-miniprogram-mvp-design.md
git commit -m "docs: update phase one verification notes"
```

## Plan Self-Review

- Spec coverage: Phase 1 covers invitation naming, fallback invite code, family display name, login, family creation, join flow, member permissions, and health reference rules. Charts, record CRUD, report export, notifications, and blood glucose are outside this Phase 1 foundation plan.
- Placeholder scan: No `TODO` or `TBD` placeholders. The plan includes concrete page styling and settings-page code for the Phase 1 UI slices.
- Type consistency: `displayName`, `inviteCode`, `inviteToken`, `canWrite`, `canEdit`, and `preferences.defaultModule` naming matches the spec.
