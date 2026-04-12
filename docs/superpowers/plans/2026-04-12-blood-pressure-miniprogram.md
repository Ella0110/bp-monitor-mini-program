# Blood Pressure Monitor Mini-Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat mini-program for family blood pressure monitoring with data charts, multi-member sharing, and CloudBase backend.

**Architecture:** 2-tab native WeChat mini-program (WXML/WXSS/JS). Data is stored in CloudBase (database + cloud functions). Family sharing uses invite codes. Charts are drawn with Canvas 2D API via a lightweight custom component. No external JS libraries except `wx-charts` for chart rendering.

**Tech Stack:** WeChat Mini-Program (native), CloudBase (Serverless DB + Cloud Functions), wx-charts, WeChat Login (wx.login)

---

## WeChat Mini-Program vs React — Key Differences

Since you know React, here's what maps to what:

| React | WeChat Mini-Program |
|---|---|
| `.jsx` / `.tsx` | `.wxml` (template) |
| `.css` / `.scss` | `.wxss` (styles, same syntax as CSS) |
| Component `state` | `this.data` (set via `this.setData({})`) |
| `useEffect` / lifecycle | `onLoad`, `onShow`, `onReady` |
| `props` | Component `properties` |
| `fetch` | `wx.request()` or `wx.cloud.callFunction()` |
| React Router | `wx.navigateTo({ url: '/pages/...' })` |
| Context / Redux | `app.globalData` |

---

## File Structure

```
blood-pressure-monitor-mini-program/
├── app.js                          # App lifecycle + global init
├── app.json                        # Tab bar, pages list, window config
├── app.wxss                        # Global styles + CSS variables
├── project.config.json             # AppID, cloudbaseEnv, devtools config
├── project.private.config.json     # Local overrides (gitignored)
│
├── pages/
│   ├── data/                       # Tab 1 — Data & charts
│   │   ├── data.js
│   │   ├── data.wxml
│   │   ├── data.wxss
│   │   └── data.json
│   ├── records/                    # All records list (push from data page)
│   │   ├── records.js
│   │   ├── records.wxml
│   │   ├── records.wxss
│   │   └── records.json
│   ├── add-record/                 # Add / edit a single record
│   │   ├── add-record.js
│   │   ├── add-record.wxml
│   │   ├── add-record.wxss
│   │   └── add-record.json
│   ├── family/                     # Tab 2 — Family management
│   │   ├── family.js
│   │   ├── family.wxml
│   │   ├── family.wxss
│   │   └── family.json
│   └── settings/                   # Settings (navigateTo from family)
│       ├── settings.js
│       ├── settings.wxml
│       ├── settings.wxss
│       └── settings.json
│
├── components/
│   ├── bp-card/                    # Latest record display card
│   │   ├── bp-card.js
│   │   ├── bp-card.wxml
│   │   ├── bp-card.wxss
│   │   └── bp-card.json
│   ├── bp-chart/                   # Blood pressure line chart (Canvas)
│   │   ├── bp-chart.js
│   │   ├── bp-chart.wxml
│   │   ├── bp-chart.wxss
│   │   └── bp-chart.json
│   └── hr-chart/                   # Heart rate bar chart (Canvas)
│       ├── hr-chart.js
│       ├── hr-chart.wxml
│       ├── hr-chart.wxss
│       └── hr-chart.json
│
├── utils/
│   ├── bp.js                       # BP level + color calculation
│   ├── date.js                     # Date formatting helpers
│   └── chart.js                    # Chart data computation (aggregation)
│
├── cloudfunctions/
│   ├── login/                      # WeChat login → upsert user doc
│   │   ├── index.js
│   │   └── package.json
│   ├── getRecords/                 # Fetch records for a period
│   │   ├── index.js
│   │   └── package.json
│   ├── saveRecord/                 # Create or update a record
│   │   ├── index.js
│   │   └── package.json
│   ├── deleteRecord/               # Delete a record
│   │   ├── index.js
│   │   └── package.json
│   ├── createFamily/               # Create family group + invite code
│   │   ├── index.js
│   │   └── package.json
│   ├── joinFamily/                 # Join family via invite code
│   │   ├── index.js
│   │   └── package.json
│   └── saveSettings/               # Update family settings
│       ├── index.js
│       └── package.json
│
└── docs/
    └── superpowers/plans/          # This file lives here
```

---

## CloudBase Data Models

### Collection: `users`
```json
{
  "_id": "openid_string",
  "nickname": "Ella",
  "avatarUrl": "https://...",
  "familyId": "family_doc_id",
  "role": "admin",
  "createdAt": "Date"
}
```

### Collection: `families`
```json
{
  "_id": "auto_id",
  "inviteCode": "A1B2C3",
  "createdBy": "openid_string",
  "members": [
    { "openid": "...", "role": "admin", "nickname": "Ella", "joinedAt": "Date" }
  ],
  "profile": {
    "name": "爸爸",
    "birthYear": 1952,
    "targetSystolic": 140,
    "targetDiastolic": 90,
    "targetHRMin": 60,
    "targetHRMax": 100,
    "medications": "苯磺酸氨氯地平",
    "emergencyContact": "Ella 138xxxx1234"
  },
  "settings": {
    "alertSystolic": 160,
    "alertDiastolic": 100,
    "notifyAll": true,
    "morningEveningLabel": false,
    "splitLines": false,
    "fontSize": "normal"
  },
  "createdAt": "Date"
}
```

### Collection: `records`
```json
{
  "_id": "auto_id",
  "familyId": "family_doc_id",
  "systolic": 138,
  "diastolic": 85,
  "heartRate": 76,
  "measuredAt": "Date",
  "period": "morning",
  "recordedBy": "openid_string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

---

## Task 1: Project Setup in WeChat DevTools

**Files:**
- Create: `project.config.json`
- Create: `app.json`
- Create: `app.js`
- Create: `app.wxss`

- [ ] **Step 1: Download WeChat DevTools**

  Download from https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
  Install and log in with your WeChat account.

- [ ] **Step 2: Create new mini-program project**

  In DevTools → New Project:
  - Project directory: `/Users/ella/Documents/Code/Demo/WeChatProjects/blood-pressure-monitor-mini-program`
  - AppID: use your registered AppID (or click "Test Account" for now)
  - Template: **Blank template with Cloud Development**
  - Language: JavaScript

- [ ] **Step 3: Enable CloudBase environment**

  In DevTools top toolbar → Cloud Development → Create a new environment named `bp-monitor-prod`
  Note down the **env ID** (looks like `bp-monitor-prod-xxxxxxx`).

- [ ] **Step 4: Write `project.config.json`**

```json
{
  "appid": "YOUR_APPID_HERE",
  "projectname": "blood-pressure-monitor",
  "description": "家庭血压心率记录",
  "miniprogramRoot": "./",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true
  },
  "condition": {}
}
```

- [ ] **Step 5: Write `app.json`**

```json
{
  "pages": [
    "pages/data/data",
    "pages/records/records",
    "pages/add-record/add-record",
    "pages/family/family",
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

- [ ] **Step 6: Write `app.js`**

```js
App({
  onLaunch() {
    wx.cloud.init({
      env: 'YOUR_ENV_ID_HERE',
      traceUser: true
    })
  },
  globalData: {
    openid: null,
    familyId: null,
    role: null,
    settings: {}
  }
})
```

- [ ] **Step 7: Write `app.wxss`**

```css
/* Global design tokens */
page {
  --blue: #3182F7;
  --blue-dark: #1A5FCC;
  --blue-light: #EAF2FF;
  --bg: #EEF3FB;
  --card: #FFFFFF;
  --red: #FF3B30;
  --orange: #FF9500;
  --green: #34C759;
  --text: #0F172A;
  --text2: #64748B;
  --border: #DDE6F5;
  font-family: -apple-system, 'PingFang SC', sans-serif;
  background: var(--bg);
  font-size: 28rpx;
}

/* Reusable card */
.card {
  background: var(--card);
  border-radius: 32rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09);
  margin-bottom: 8rpx;
}

/* Section label (uppercase) */
.sec-label {
  font-size: 22rpx;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin: 40rpx 0 20rpx;
}

/* Primary button */
.btn-primary {
  width: 100%;
  background: var(--blue);
  color: #fff;
  border: none;
  border-radius: 28rpx;
  padding: 30rpx;
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
}
```

- [ ] **Step 8: Commit**

```bash
git init
git add app.js app.json app.wxss project.config.json
git commit -m "feat: project scaffold with CloudBase config"
```

---

## Task 2: BP Utility Functions

**Files:**
- Create: `utils/bp.js`
- Create: `utils/date.js`

- [ ] **Step 1: Write `utils/bp.js`**

```js
// BP status levels matching the 3-segment color bar
// Returns: { level: 'normal'|'caution'|'danger', color: string, label: string }
function getBPStatus(systolic, diastolic) {
  if (systolic >= 160 || diastolic >= 100) {
    return { level: 'danger',  color: '#FF3B30', label: '危险' }
  }
  if (systolic >= 130 || diastolic >= 80) {
    return { level: 'caution', color: '#FF9500', label: '注意' }
  }
  return { level: 'normal', color: '#34C759', label: '正常' }
}

// Heart rate: normal 60–100 bpm
function getHRStatus(heartRate) {
  if (heartRate > 100 || heartRate < 50) {
    return { level: 'danger',  color: '#FF3B30', label: '异常' }
  }
  return { level: 'normal', color: '#34C759', label: '正常' }
}

// Count records that are within target
function countOnTarget(records, targetSystolic, targetDiastolic) {
  let onTarget = 0
  records.forEach(r => {
    if (r.systolic < targetSystolic && r.diastolic < targetDiastolic) onTarget++
  })
  return { onTarget, offTarget: records.length - onTarget }
}

// Average systolic/diastolic over an array of records
function calcAverage(records) {
  if (!records.length) return { systolic: '--', diastolic: '--', heartRate: '--' }
  const avg = key => Math.round(records.reduce((s, r) => s + r[key], 0) / records.length)
  return { systolic: avg('systolic'), diastolic: avg('diastolic'), heartRate: avg('heartRate') }
}

module.exports = { getBPStatus, getHRStatus, countOnTarget, calcAverage }
```

- [ ] **Step 2: Write `utils/date.js`**

```js
// Format a JS Date or timestamp string to "YYYY/M/D HH:mm"
function formatDateTime(d) {
  const dt = d instanceof Date ? d : new Date(d)
  const pad = n => String(n).padStart(2, '0')
  return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

// Format to "M/D" for chart x-axis labels
function formatMonthDay(d) {
  const dt = d instanceof Date ? d : new Date(d)
  return `${dt.getMonth()+1}/${dt.getDate()}`
}

// Get start Date for N days ago (midnight)
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

// Group records by date string "YYYY-MM-DD"
function groupByDate(records) {
  const groups = {}
  records.forEach(r => {
    const key = new Date(r.measuredAt).toISOString().slice(0, 10)
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  })
  // Return sorted descending
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
}

module.exports = { formatDateTime, formatMonthDay, daysAgo, groupByDate }
```

- [ ] **Step 3: Commit**

```bash
git add utils/
git commit -m "feat: add bp and date utility functions"
```

---

## Task 3: CloudBase Collections & Security Rules

**Files:**
- No code files — configuration in CloudBase console

- [ ] **Step 1: Open CloudBase console**

  DevTools → Cloud Development → Database → Add Collection
  Create three collections: `users`, `families`, `records`

- [ ] **Step 2: Set security rules for `users` collection**

  In CloudBase console → Database → users → Security Rules:
```json
{
  "read": "doc._id == auth.openid",
  "write": "doc._id == auth.openid"
}
```

- [ ] **Step 3: Set security rules for `families` collection**

```json
{
  "read": "auth.openid in doc.members[].openid",
  "write": "doc.createdBy == auth.openid"
}
```

- [ ] **Step 4: Set security rules for `records` collection**

```json
{
  "read": "auth.openid in get('databases/families/' + doc.familyId).members[].openid",
  "write": "auth.openid in get('databases/families/' + doc.familyId).members[].openid"
}
```

- [ ] **Step 5: Create indexes on `records`**

  In CloudBase console → Database → records → Indexes:
  - Add index on `familyId` (ascending)
  - Add compound index on `familyId + measuredAt` (both ascending)

---

## Task 4: Login Cloud Function

**Files:**
- Create: `cloudfunctions/login/index.js`
- Create: `cloudfunctions/login/package.json`

- [ ] **Step 1: Write `cloudfunctions/login/package.json`**

```json
{
  "name": "login",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: Write `cloudfunctions/login/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID, APPID } = cloud.getWXContext()

  // Upsert user document
  const userRef = db.collection('users').doc(OPENID)
  const existing = await userRef.get().catch(() => null)

  if (!existing) {
    await userRef.set({
      data: {
        _id: OPENID,
        nickname: '',
        avatarUrl: '',
        familyId: '',
        role: '',
        createdAt: db.serverDate()
      }
    })
  }

  // Return openid + existing familyId/role
  const user = (await userRef.get()).data
  return { openid: OPENID, familyId: user.familyId, role: user.role }
}
```

- [ ] **Step 3: Deploy cloud function**

  In DevTools: right-click `cloudfunctions/login` → Upload and deploy (all files).

- [ ] **Step 4: Call login on app launch — update `app.js`**

```js
App({
  onLaunch() {
    wx.cloud.init({ env: 'YOUR_ENV_ID_HERE', traceUser: true })
    this.doLogin()
  },

  async doLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      this.globalData.openid   = res.result.openid
      this.globalData.familyId = res.result.familyId
      this.globalData.role     = res.result.role
    } catch (e) {
      console.error('Login failed', e)
    }
  },

  globalData: { openid: null, familyId: null, role: null, settings: {} }
})
```

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/login/ app.js
git commit -m "feat: WeChat login cloud function + app launch auth"
```

---

## Task 5: Family Cloud Functions (Create + Join)

**Files:**
- Create: `cloudfunctions/createFamily/index.js`
- Create: `cloudfunctions/createFamily/package.json`
- Create: `cloudfunctions/joinFamily/index.js`
- Create: `cloudfunctions/joinFamily/package.json`

- [ ] **Step 1: Write `cloudfunctions/createFamily/package.json`**

```json
{ "name": "createFamily", "version": "1.0.0", "main": "index.js", "dependencies": { "wx-server-sdk": "~2.6.3" } }
```

- [ ] **Step 2: Write `cloudfunctions/createFamily/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { profile } = event  // profile object from family page form

  const inviteCode = randomCode()

  const familyRes = await db.collection('families').add({
    data: {
      inviteCode,
      createdBy: OPENID,
      members: [{ openid: OPENID, role: 'admin', nickname: event.nickname || '', joinedAt: db.serverDate() }],
      profile: profile || { name: '', birthYear: null, targetSystolic: 140, targetDiastolic: 90, targetHRMin: 60, targetHRMax: 100, medications: '', emergencyContact: '' },
      settings: {
        alertSystolic: 160,
        alertDiastolic: 100,
        notifyAll: true,
        morningEveningLabel: false,
        splitLines: false,
        fontSize: 'normal'
      },
      createdAt: db.serverDate()
    }
  })

  const familyId = familyRes._id

  // Link user to this family
  await db.collection('users').doc(OPENID).update({
    data: { familyId, role: 'admin' }
  })

  return { familyId, inviteCode }
}
```

- [ ] **Step 3: Write `cloudfunctions/joinFamily/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { inviteCode, nickname } = event

  // Find family with this invite code
  const res = await db.collection('families')
    .where({ inviteCode })
    .limit(1)
    .get()

  if (!res.data.length) {
    return { success: false, error: '邀请码无效' }
  }

  const family = res.data[0]
  const familyId = family._id

  // Check not already a member
  const alreadyMember = family.members.some(m => m.openid === OPENID)
  if (alreadyMember) {
    return { success: false, error: '您已经是该家庭成员' }
  }

  // Check member limit (10)
  if (family.members.length >= 10) {
    return { success: false, error: '家庭成员已达上限（10人）' }
  }

  // Add member
  await db.collection('families').doc(familyId).update({
    data: {
      members: db.command.push({
        openid: OPENID,
        role: 'member',
        nickname: nickname || '',
        joinedAt: db.serverDate()
      })
    }
  })

  // Link user
  await db.collection('users').doc(OPENID).update({
    data: { familyId, role: 'member' }
  })

  return { success: true, familyId }
}
```

- [ ] **Step 4: Deploy both cloud functions**

  Right-click `createFamily` → Upload and deploy. Repeat for `joinFamily`.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/createFamily/ cloudfunctions/joinFamily/
git commit -m "feat: createFamily and joinFamily cloud functions"
```

---

## Task 6: Record CRUD Cloud Functions

**Files:**
- Create: `cloudfunctions/getRecords/index.js`
- Create: `cloudfunctions/saveRecord/index.js`
- Create: `cloudfunctions/deleteRecord/index.js`
- (All need `package.json` identical to Task 5 Step 1 pattern)

- [ ] **Step 1: Write `cloudfunctions/getRecords/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { familyId, since } = event  // since: ISO date string

  const res = await db.collection('records')
    .where({
      familyId,
      measuredAt: _.gte(new Date(since))
    })
    .orderBy('measuredAt', 'asc')
    .limit(200)
    .get()

  return { records: res.data }
}
```

- [ ] **Step 2: Write `cloudfunctions/saveRecord/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { id, familyId, systolic, diastolic, heartRate, measuredAt, period } = event

  const data = {
    familyId,
    systolic: Number(systolic),
    diastolic: Number(diastolic),
    heartRate: Number(heartRate),
    measuredAt: new Date(measuredAt),
    period: period || null,
    recordedBy: OPENID,
    updatedAt: db.serverDate()
  }

  if (id) {
    // Update existing
    await db.collection('records').doc(id).update({ data })
    return { success: true, id }
  } else {
    // Create new
    data.createdAt = db.serverDate()
    const res = await db.collection('records').add({ data })
    return { success: true, id: res._id }
  }
}
```

- [ ] **Step 3: Write `cloudfunctions/deleteRecord/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { id } = event
  await db.collection('records').doc(id).remove()
  return { success: true }
}
```

- [ ] **Step 4: Deploy all three cloud functions**

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/getRecords/ cloudfunctions/saveRecord/ cloudfunctions/deleteRecord/
git commit -m "feat: record CRUD cloud functions"
```

---

## Task 7: Data Page — Layout & Data Loading

**Files:**
- Create: `pages/data/data.js`
- Create: `pages/data/data.wxml`
- Create: `pages/data/data.wxss`
- Create: `pages/data/data.json`

- [ ] **Step 1: Write `pages/data/data.json`**

```json
{
  "navigationBarTitleText": "血压心率记录",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white",
  "usingComponents": {
    "bp-card": "/components/bp-card/bp-card",
    "bp-chart": "/components/bp-chart/bp-chart",
    "hr-chart": "/components/hr-chart/hr-chart"
  }
}
```

- [ ] **Step 2: Write `pages/data/data.js`**

```js
const { daysAgo } = require('../../utils/date')
const { countOnTarget, calcAverage } = require('../../utils/bp')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

Page({
  data: {
    period: '7天',
    records: [],
    latestRecord: null,
    bpStats: { onTarget: 0, offTarget: 0, avg: { systolic: '--', diastolic: '--' } },
    hrStats: { onTarget: 0, offTarget: 0, avg: { heartRate: '--' } },
    loading: true
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    const familyId = app.globalData.familyId
    if (!familyId) return

    const days = PERIODS[this.data.period]
    this.setData({ loading: true })

    try {
      const res = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId, since: daysAgo(days).toISOString() }
      })
      const records = res.result.records

      // Latest record
      const sorted = [...records].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt))
      const latestRecord = sorted[0] || null

      // BP stats (target from settings, default 140/90)
      const settings = app.globalData.settings || {}
      const tSys = settings.targetSystolic || 140
      const tDia = settings.targetDiastolic || 90
      const { onTarget: bpOn, offTarget: bpOff } = countOnTarget(records, tSys, tDia)
      const bpAvg = calcAverage(records)

      // HR stats (normal: 60-100)
      const hrNormal = records.filter(r => r.heartRate >= 60 && r.heartRate <= 100).length
      const hrAvg = calcAverage(records)

      this.setData({
        records,
        latestRecord,
        bpStats: { onTarget: bpOn, offTarget: bpOff, avg: { systolic: bpAvg.systolic, diastolic: bpAvg.diastolic } },
        hrStats: { onTarget: hrNormal, offTarget: records.length - hrNormal, avg: { heartRate: hrAvg.heartRate } },
        loading: false
      })
    } catch (e) {
      console.error('loadRecords failed', e)
      this.setData({ loading: false })
    }
  },

  onPeriodChange(e) {
    this.setData({ period: e.currentTarget.dataset.period })
    this.loadRecords()
  },

  onAddRecord() {
    wx.navigateTo({ url: '/pages/add-record/add-record' })
  },

  onAllRecords() {
    wx.navigateTo({ url: '/pages/records/records' })
  }
})
```

- [ ] **Step 3: Write `pages/data/data.wxml`**

```xml
<view class="container">

  <!-- Blue gradient header -->
  <view class="header">
    <view class="header-title">血压心率记录</view>

    <!-- Latest record card component -->
    <bp-card record="{{latestRecord}}" />

    <!-- Add record button -->
    <button class="add-btn" bindtap="onAddRecord">＋ &nbsp; 添加记录</button>
  </view>

  <!-- Content area -->
  <scroll-view scroll-y class="content">

    <!-- Controls row -->
    <view class="ctrl-row">
      <view class="period-sw">
        <view wx:for="{{['7天','30天','90天']}}" wx:key="*this"
          class="pb {{item === period ? 'active' : ''}}"
          bindtap="onPeriodChange" data-period="{{item}}">{{item}}</view>
      </view>
      <view class="all-link" bindtap="onAllRecords">全部记录 ›</view>
    </view>

    <!-- Blood pressure section -->
    <view class="section-head">
      <text class="st">🌡️ 血压数据</text>
    </view>
    <view class="card">
      <view class="stat-row">
        <view class="stat-block">
          <text class="sn">{{bpStats.onTarget}}</text>
          <text class="sd">已达标（次）</text>
        </view>
        <view class="stat-block">
          <text class="sn red">{{bpStats.offTarget}}</text>
          <text class="sd">不达标（次）</text>
        </view>
        <view class="stat-block">
          <text class="sn sm">{{bpStats.avg.systolic}}/{{bpStats.avg.diastolic}}</text>
          <text class="sd">均值（mmHg）</text>
        </view>
      </view>
      <bp-chart records="{{records}}" period="{{period}}" />
    </view>

    <!-- Heart rate section -->
    <view class="section-head" style="margin-top:40rpx">
      <text class="st">💓 心率数据</text>
    </view>
    <view class="card">
      <view class="stat-row">
        <view class="stat-block">
          <text class="sn">{{hrStats.onTarget}}</text>
          <text class="sd">已达标（次）</text>
        </view>
        <view class="stat-block">
          <text class="sn red">{{hrStats.offTarget}}</text>
          <text class="sd">不达标（次）</text>
        </view>
        <view class="stat-block">
          <text class="sn">{{hrStats.avg.heartRate}}</text>
          <text class="sd">均值（bpm）</text>
        </view>
      </view>
      <hr-chart records="{{records}}" period="{{period}}" />
    </view>

  </scroll-view>
</view>
```

- [ ] **Step 4: Write `pages/data/data.wxss`**

```css
.container { display: flex; flex-direction: column; height: 100vh; }

.header {
  background: linear-gradient(170deg, #72BBFF 0%, #3182F7 40%, #1A5FCC 100%);
  padding: 88rpx 36rpx 56rpx;
  border-radius: 0 0 64rpx 64rpx;
}
.header-title { text-align: center; font-size: 36rpx; font-weight: 700; color: #fff; margin-bottom: 28rpx; }

.add-btn {
  width: 100%; background: #fff; color: #3182F7;
  border-radius: 28rpx; padding: 30rpx;
  font-size: 34rpx; font-weight: 700; margin-top: 4rpx;
}

.content { flex: 1; padding: 28rpx 32rpx 200rpx; }

.ctrl-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32rpx; }
.period-sw { display: flex; background: #EAF2FF; border-radius: 40rpx; padding: 6rpx; }
.pb { padding: 10rpx 32rpx; border-radius: 34rpx; font-size: 26rpx; font-weight: 600; color: #3182F7; }
.pb.active { background: #3182F7; color: #fff; }
.all-link { font-size: 28rpx; color: #3182F7; font-weight: 500; }

.section-head { margin-bottom: 20rpx; }
.st { font-size: 30rpx; font-weight: 700; color: #0F172A; }

.stat-row { display: flex; justify-content: space-around; padding-bottom: 28rpx; border-bottom: 2rpx solid #EEF3FB; margin-bottom: 28rpx; }
.stat-block { text-align: center; }
.sn { display: block; font-size: 48rpx; font-weight: 800; color: #0F172A; }
.sn.red { color: #FF3B30; }
.sn.sm { font-size: 36rpx; }
.sd { display: block; font-size: 24rpx; color: #94A3B8; margin-top: 8rpx; }
```

- [ ] **Step 5: Commit**

```bash
git add pages/data/
git commit -m "feat: data page layout with stats and chart placeholders"
```

---

## Task 8: BP Card Component

**Files:**
- Create: `components/bp-card/bp-card.js`
- Create: `components/bp-card/bp-card.wxml`
- Create: `components/bp-card/bp-card.wxss`
- Create: `components/bp-card/bp-card.json`

- [ ] **Step 1: Write `components/bp-card/bp-card.json`**

```json
{ "component": true, "usingComponents": {} }
```

- [ ] **Step 2: Write `components/bp-card/bp-card.js`**

```js
const { getBPStatus, getHRStatus } = require('../../utils/bp')
const { formatDateTime } = require('../../utils/date')

Component({
  properties: {
    record: { type: Object, value: null }
  },

  computed: {
    // Not native — use observers instead
  },

  observers: {
    'record': function(record) {
      if (!record) {
        this.setData({ bpColor: '#94A3B8', hrColor: '#94A3B8', timeStr: '暂无记录', activeSegment: 'none' })
        return
      }
      const bp = getBPStatus(record.systolic, record.diastolic)
      const hr = getHRStatus(record.heartRate)
      this.setData({
        bpColor: bp.color,
        hrColor: hr.color,
        activeSegment: bp.level,
        timeStr: formatDateTime(record.measuredAt)
      })
    }
  },

  data: {
    bpColor: '#94A3B8',
    hrColor: '#94A3B8',
    activeSegment: 'none',
    timeStr: '暂无记录'
  }
})
```

- [ ] **Step 3: Write `components/bp-card/bp-card.wxml`**

```xml
<view class="outer-card">
  <view class="rec-time">最近一次记录时间：{{timeStr}}</view>
  <view class="rec-body">
    <!-- Inner white card -->
    <view class="inner-card">
      <!-- ECG icon (top-right) -->
      <view class="ecg-icon">〜♥〜</view>

      <!-- Systolic -->
      <view class="field-top">
        <text class="field-label">高压值\n(mmHg)</text>
        <text class="field-val-lg" style="color:{{record ? bpColor : '#94A3B8'}}">
          {{record ? record.systolic : '--'}}
        </text>
      </view>

      <!-- Diastolic + HR -->
      <view class="field-bottom">
        <view class="field">
          <text class="field-label">低压值\n(mmHg)</text>
          <text class="field-val-md" style="color:{{record ? bpColor : '#94A3B8'}}">
            {{record ? record.diastolic : '--'}}
          </text>
        </view>
        <view class="field">
          <text class="field-label">心率\n(bpm)</text>
          <text class="field-val-md" style="color:{{record ? hrColor : '#94A3B8'}}">
            {{record ? record.heartRate : '--'}}
          </text>
        </view>
      </view>
    </view>

    <!-- Status bar: 3 segments, active one at full opacity -->
    <view class="status-bar">
      <view class="seg" style="background:#FF3B30; opacity:{{activeSegment==='danger' ? 1 : 0.25}}"></view>
      <view class="seg" style="background:#FF9500; opacity:{{activeSegment==='caution' ? 1 : 0.25}}"></view>
      <view class="seg" style="background:#34C759; opacity:{{activeSegment==='normal' ? 1 : 0.25}}"></view>
    </view>
  </view>
</view>
```

- [ ] **Step 4: Write `components/bp-card/bp-card.wxss`**

```css
.outer-card {
  background: rgba(255,255,255,0.16);
  border: 2rpx solid rgba(255,255,255,0.30);
  border-radius: 40rpx;
  padding: 28rpx 28rpx 28rpx 32rpx;
  margin-bottom: 28rpx;
}
.rec-time { font-size: 24rpx; color: rgba(255,255,255,0.75); text-align: center; margin-bottom: 24rpx; }
.rec-body { display: flex; align-items: stretch; gap: 20rpx; }

.inner-card {
  flex: 1; background: rgba(255,255,255,0.88);
  border-radius: 28rpx; padding: 28rpx 32rpx; position: relative;
}
.ecg-icon { position: absolute; top: 24rpx; right: 28rpx; font-size: 36rpx; color: #0F172A; opacity: 0.15; }

.field-top { margin-bottom: 24rpx; }
.field-bottom { display: flex; }
.field { flex: 1; }

.field-label { display: block; font-size: 26rpx; color: #64748B; line-height: 1.4; margin-bottom: 6rpx; white-space: pre-line; }
.field-val-lg { display: block; font-size: 100rpx; font-weight: 800; line-height: 1; }
.field-val-md { display: block; font-size: 76rpx; font-weight: 800; line-height: 1; }

.status-bar { width: 16rpx; border-radius: 8rpx; overflow: hidden; display: flex; flex-direction: column; }
.seg { flex: 1; }
```

- [ ] **Step 5: Commit**

```bash
git add components/bp-card/
git commit -m "feat: bp-card component with color-coded values and status bar"
```

---

## Task 9: Add Record Page

**Files:**
- Create: `pages/add-record/add-record.js`
- Create: `pages/add-record/add-record.wxml`
- Create: `pages/add-record/add-record.wxss`
- Create: `pages/add-record/add-record.json`

- [ ] **Step 1: Write `pages/add-record/add-record.json`**

```json
{
  "navigationBarTitleText": "添加记录",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 2: Write `pages/add-record/add-record.js`**

```js
const { getBPStatus } = require('../../utils/bp')

Page({
  data: {
    // Form fields
    systolic: '',
    diastolic: '',
    heartRate: '',
    measuredAt: '',   // ISO string, defaults to now
    period: null,     // 'morning' | 'evening' | null
    recordId: null,   // set when editing existing record
    // Feedback
    bpStatusColor: '',
    bpStatusLabel: '',
    saving: false
  },

  onLoad(options) {
    // Editing mode: options.id + options.record (JSON encoded)
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const defaultTime = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`

    if (options.id) {
      const r = JSON.parse(decodeURIComponent(options.record))
      const dt = new Date(r.measuredAt)
      const iso = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
      this.setData({ recordId: options.id, systolic: String(r.systolic), diastolic: String(r.diastolic), heartRate: String(r.heartRate), measuredAt: iso, period: r.period || null })
    } else {
      this.setData({ measuredAt: defaultTime })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
    this.updateBPStatus()
  },

  updateBPStatus() {
    const sys = Number(this.data.systolic)
    const dia = Number(this.data.diastolic)
    if (!sys || !dia) return
    const status = getBPStatus(sys, dia)
    this.setData({ bpStatusColor: status.color, bpStatusLabel: status.label })
  },

  onPeriodSelect(e) {
    const p = e.currentTarget.dataset.period
    this.setData({ period: this.data.period === p ? null : p })
  },

  validate() {
    const { systolic, diastolic, heartRate } = this.data
    const sys = Number(systolic), dia = Number(diastolic), hr = Number(heartRate)
    if (!sys || sys < 60 || sys > 300) { wx.showToast({ title: '高压值不正确', icon: 'none' }); return false }
    if (!dia || dia < 40 || dia > 200) { wx.showToast({ title: '低压值不正确', icon: 'none' }); return false }
    if (!hr  || hr  < 30 || hr  > 250) { wx.showToast({ title: '心率不正确', icon: 'none' }); return false }
    return true
  },

  async onSave() {
    if (!this.validate()) return
    const app = getApp()
    this.setData({ saving: true })

    try {
      await wx.cloud.callFunction({
        name: 'saveRecord',
        data: {
          id: this.data.recordId || undefined,
          familyId: app.globalData.familyId,
          systolic: Number(this.data.systolic),
          diastolic: Number(this.data.diastolic),
          heartRate: Number(this.data.heartRate),
          measuredAt: new Date(this.data.measuredAt).toISOString(),
          period: this.data.period
        }
      })
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
```

- [ ] **Step 3: Write `pages/add-record/add-record.wxml`**

```xml
<view class="container">
  <view class="form-card">

    <!-- Systolic -->
    <view class="form-row">
      <text class="form-label">高压值（mmHg）</text>
      <input class="form-input" type="number" placeholder="如：130"
        value="{{systolic}}" bindinput="onInput" data-field="systolic" maxlength="3"/>
    </view>

    <!-- Diastolic -->
    <view class="form-row">
      <text class="form-label">低压值（mmHg）</text>
      <input class="form-input" type="number" placeholder="如：80"
        value="{{diastolic}}" bindinput="onInput" data-field="diastolic" maxlength="3"/>
    </view>

    <!-- Heart rate -->
    <view class="form-row">
      <text class="form-label">心率（bpm）</text>
      <input class="form-input" type="number" placeholder="如：72"
        value="{{heartRate}}" bindinput="onInput" data-field="heartRate" maxlength="3"/>
    </view>

    <!-- BP status feedback -->
    <view class="bp-feedback" wx:if="{{bpStatusLabel}}">
      <view class="bp-dot" style="background:{{bpStatusColor}}"></view>
      <text style="color:{{bpStatusColor}}">{{bpStatusLabel}}</text>
    </view>

    <!-- Time -->
    <view class="form-row">
      <text class="form-label">测量时间</text>
      <picker mode="date" value="{{measuredAt}}" bindchange="onInput" data-field="measuredAt">
        <view class="picker-val">{{measuredAt || '请选择时间'}}</view>
      </picker>
    </view>

  </view>

  <!-- Save button -->
  <button class="save-btn" bindtap="onSave" disabled="{{saving}}">
    {{saving ? '保存中...' : '保存记录'}}
  </button>
</view>
```

- [ ] **Step 4: Write `pages/add-record/add-record.wxss`**

```css
.container { padding: 32rpx; background: #EEF3FB; min-height: 100vh; }
.form-card { background: #fff; border-radius: 32rpx; padding: 8rpx 0; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); margin-bottom: 32rpx; }
.form-row { display: flex; justify-content: space-between; align-items: center; padding: 32rpx 36rpx; border-bottom: 2rpx solid #EEF3FB; }
.form-label { font-size: 30rpx; color: #0F172A; font-weight: 500; }
.form-input { font-size: 36rpx; font-weight: 700; color: #3182F7; text-align: right; width: 200rpx; }
.picker-val { font-size: 30rpx; color: #3182F7; }
.bp-feedback { display: flex; align-items: center; gap: 12rpx; padding: 20rpx 36rpx; }
.bp-dot { width: 16rpx; height: 16rpx; border-radius: 50%; }
.save-btn { background: #3182F7; color: #fff; border-radius: 28rpx; font-size: 34rpx; font-weight: 700; padding: 30rpx; margin-top: 16rpx; }
```

- [ ] **Step 5: Test in simulator**

  Open DevTools simulator → navigate to add-record page → enter 138/85/76 → should show 橙色「注意」feedback → tap 保存记录 → should navigate back to data page.

- [ ] **Step 6: Commit**

```bash
git add pages/add-record/
git commit -m "feat: add-record form with BP status feedback and validation"
```

---

## Task 10: All Records Page

**Files:**
- Create: `pages/records/records.js`
- Create: `pages/records/records.wxml`
- Create: `pages/records/records.wxss`
- Create: `pages/records/records.json`

- [ ] **Step 1: Write `pages/records/records.json`**

```json
{
  "navigationBarTitleText": "全部记录",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 2: Write `pages/records/records.js`**

```js
const { groupByDate, formatDateTime } = require('../../utils/date')
const { getBPStatus } = require('../../utils/bp')

Page({
  data: { groups: [], loading: true },

  onLoad() { this.loadAll() },
  onShow()  { this.loadAll() },

  async loadAll() {
    const app = getApp()
    this.setData({ loading: true })

    const res = await wx.cloud.callFunction({
      name: 'getRecords',
      data: { familyId: app.globalData.familyId, since: new Date('2000-01-01').toISOString() }
    })

    const records = res.result.records.map(r => ({
      ...r,
      timeStr: formatDateTime(r.measuredAt),
      bpStatus: getBPStatus(r.systolic, r.diastolic),
      expanded: false
    }))

    const raw = groupByDate(records)
    // Add collapsed state per group; latest open by default
    const groups = raw.map((g, i) => ({ ...g, open: i === 0 }))
    this.setData({ groups, loading: false })
  },

  toggleGroup(e) {
    const idx = e.currentTarget.dataset.idx
    const key = `groups[${idx}].open`
    this.setData({ [key]: !this.data.groups[idx].open })
  },

  onEdit(e) {
    const { record } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/add-record/add-record?id=${record._id}&record=${encodeURIComponent(JSON.stringify(record))}`
    })
  },

  async onDelete(e) {
    const { id } = e.currentTarget.dataset
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        await wx.cloud.callFunction({ name: 'deleteRecord', data: { id } })
        this.loadAll()
      }
    })
  }
})
```

- [ ] **Step 3: Write `pages/records/records.wxml`**

```xml
<scroll-view scroll-y class="container">
  <block wx:for="{{groups}}" wx:key="date" wx:for-item="group" wx:for-index="gi">
    <view class="dg">
      <!-- Date header -->
      <view class="dg-head {{group.open ? 'open' : ''}}" bindtap="toggleGroup" data-idx="{{gi}}">
        <view>
          <text class="dg-date">{{group.date}}</text>
          <text class="dg-cnt">{{group.items.length}}条</text>
        </view>
        <text class="chev">›</text>
      </view>

      <!-- Records for this date -->
      <block wx:if="{{group.open}}">
        <view wx:for="{{group.items}}" wx:key="_id" class="ri">
          <view class="ri-left">
            <text class="ri-time">{{item.timeStr}}</text>
            <text wx:if="{{item.period}}" class="ri-tag">{{item.period === 'morning' ? '晨测' : '晚测'}}</text>
          </view>
          <view class="ri-vals">
            <text class="ri-bp" style="color:{{item.bpStatus.color}}">{{item.systolic}} / {{item.diastolic}} mmHg</text>
            <text class="ri-hr">心率 {{item.heartRate}} bpm</text>
          </view>
          <view class="ri-status" style="background:{{item.bpStatus.level==='normal'?'#F0FDF4':item.bpStatus.level==='caution'?'#FFF7ED':'#FFF1F2'}}; color:{{item.bpStatus.color}}">
            {{item.bpStatus.label}}
          </view>
          <view class="ri-actions">
            <view class="rbtn" bindtap="onEdit" data-record="{{item}}">修改</view>
            <view class="rbtn del" bindtap="onDelete" data-id="{{item._id}}">删除</view>
          </view>
        </view>
      </block>
    </view>
  </block>
</scroll-view>
```

- [ ] **Step 4: Write `pages/records/records.wxss`**

```css
.container { padding: 28rpx 32rpx 160rpx; background: #EEF3FB; min-height: 100vh; }
.dg { margin-bottom: 20rpx; }
.dg-head { display: flex; justify-content: space-between; align-items: center; background: #fff; padding: 24rpx 28rpx; border-radius: 24rpx; box-shadow: 0 2rpx 16rpx rgba(49,130,247,0.07); }
.dg-head.open { border-radius: 24rpx 24rpx 0 0; }
.dg-date { font-size: 28rpx; font-weight: 700; color: #0F172A; }
.dg-cnt { font-size: 24rpx; color: #94A3B8; margin-left: 12rpx; }
.chev { color: #94A3B8; font-size: 28rpx; }
.ri { background: #fff; border-top: 2rpx solid #EEF3FB; padding: 24rpx 28rpx; display: flex; align-items: center; gap: 16rpx; }
.ri:last-child { border-radius: 0 0 24rpx 24rpx; }
.ri-left { display: flex; flex-direction: column; align-items: center; min-width: 88rpx; }
.ri-time { font-size: 26rpx; font-weight: 600; color: #374151; }
.ri-tag { font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 99rpx; background: #EAF2FF; color: #3182F7; margin-top: 6rpx; }
.ri-vals { flex: 1; }
.ri-bp { display: block; font-size: 30rpx; font-weight: 700; }
.ri-hr { display: block; font-size: 24rpx; color: #64748B; margin-top: 4rpx; }
.ri-status { font-size: 24rpx; padding: 6rpx 16rpx; border-radius: 99rpx; font-weight: 600; }
.ri-actions { display: flex; gap: 12rpx; }
.rbtn { font-size: 24rpx; padding: 8rpx 20rpx; border-radius: 16rpx; border: 2rpx solid #DDE6F5; background: #F8FAFF; color: #374151; }
.rbtn.del { color: #FF3B30; border-color: #FECACA; background: #FFF1F2; }
```

- [ ] **Step 5: Commit**

```bash
git add pages/records/
git commit -m "feat: all records page with grouped list, edit and delete"
```

---

## Task 11: Family Page

**Files:**
- Create: `pages/family/family.js`
- Create: `pages/family/family.wxml`
- Create: `pages/family/family.wxss`
- Create: `pages/family/family.json`

- [ ] **Step 1: Write `pages/family/family.json`**

```json
{
  "navigationBarTitleText": "家庭",
  "navigationBarBackgroundColor": "#FFFFFF",
  "navigationBarTextStyle": "black",
  "usingComponents": {}
}
```

- [ ] **Step 2: Write `pages/family/family.js`**

```js
Page({
  data: { family: null, members: [], profile: null, loading: true },

  onShow() { this.loadFamily() },

  async loadFamily() {
    const app = getApp()
    const familyId = app.globalData.familyId
    if (!familyId) {
      this.setData({ loading: false })
      return
    }
    const db = wx.cloud.database()
    const res = await db.collection('families').doc(familyId).get()
    const family = res.data
    this.setData({ family, members: family.members, profile: family.profile, loading: false })
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onEditProfile() {
    wx.navigateTo({ url: '/pages/settings/settings?tab=profile' })
  },

  onInvite() {
    const code = this.data.family?.inviteCode
    if (!code) return
    wx.showModal({
      title: '邀请家人',
      content: `邀请码：${code}\n\n将邀请码发给家人，他们在小程序中输入即可加入。`,
      showCancel: false
    })
  },

  onReport() {
    wx.navigateTo({ url: '/pages/records/records?mode=report' })
  },

  async onCreateFamily() {
    const res = await wx.cloud.callFunction({ name: 'createFamily', data: { nickname: '我' } })
    getApp().globalData.familyId = res.result.familyId
    this.loadFamily()
  }
})
```

- [ ] **Step 3: Write `pages/family/family.wxml`**

```xml
<view class="container">
  <!-- Header: white, minimal (iOS settings style) -->
  <view class="fam-header">
    <text class="fam-title">家庭</text>
    <view class="gear-btn" bindtap="onSettings">
      <!-- Gear icon (simplified) -->
      <text class="gear-icon">⚙</text>
    </view>
  </view>

  <scroll-view scroll-y class="fam-body">

    <!-- No family yet -->
    <block wx:if="{{!family && !loading}}">
      <view class="empty-state">
        <text class="empty-text">还没有家庭组</text>
        <button class="create-btn" bindtap="onCreateFamily">创建家庭组</button>
      </view>
    </block>

    <block wx:if="{{family}}">
      <!-- Profile card -->
      <text class="sec-label">被监护人档案</text>
      <view class="card">
        <view class="prof-top">
          <view class="prof-av">{{profile.name ? profile.name[0] : '?'}}</view>
          <view class="prof-info">
            <text class="prof-name">{{profile.name || '未设置'}}</text>
            <text class="prof-sub">{{profile.birthYear ? (2026 - profile.birthYear) + '岁' : ''}}</text>
          </view>
          <view class="edit-btn" bindtap="onEditProfile">编辑 ›</view>
        </view>
        <view class="info-row"><text class="il">目标血压</text><text class="iv">＜ {{family.profile.targetSystolic}} / {{family.profile.targetDiastolic}} mmHg</text></view>
        <view class="info-row"><text class="il">长期用药</text><text class="iv">{{profile.medications || '未填写'}}</text></view>
        <view class="info-row"><text class="il">紧急联系人</text><text class="iv">{{profile.emergencyContact || '未填写'}}</text></view>
      </view>

      <!-- Members -->
      <text class="sec-label">家庭成员</text>
      <view class="card">
        <scroll-view scroll-x class="mem-row">
          <view wx:for="{{members}}" wx:key="openid" class="mc">
            <view class="mav {{item.role === 'admin' ? 'admin' : ''}}">
              {{item.nickname ? item.nickname[0] : '?'}}
            </view>
            <text class="mn">{{item.nickname}}{{item.role === 'admin' ? '\n(管理员)' : ''}}</text>
          </view>
          <view class="mc" bindtap="onInvite">
            <view class="mav invite">＋</view>
            <text class="mn">邀请</text>
          </view>
        </scroll-view>
        <text class="mem-hint">成员可查看全部记录 · 最多10人</text>
      </view>

      <!-- Actions -->
      <text class="sec-label">功能</text>
      <view class="action-row" bindtap="onReport">
        <view class="aico ai-b"><text>📄</text></view>
        <view><text class="at">生成就诊报告</text><text class="ats">选择时间段，导出图片</text></view>
        <text class="aa">›</text>
      </view>
      <view class="action-row disabled">
        <view class="aico ai-o"><text>💊</text></view>
        <view><text class="at">药物管理</text><text class="ats">拍照 / 扫码录入药品</text></view>
        <text class="soon">即将上线</text>
      </view>
    </block>

  </scroll-view>
</view>
```

- [ ] **Step 4: Write `pages/family/family.wxss`**

```css
.container { display: flex; flex-direction: column; height: 100vh; background: #EEF3FB; }
.fam-header { background: #fff; padding: 88rpx 40rpx 28rpx; border-bottom: 2rpx solid #DDE6F5; display: flex; justify-content: space-between; align-items: flex-end; }
.fam-title { font-size: 56rpx; font-weight: 800; color: #0F172A; }
.gear-btn { width: 72rpx; height: 72rpx; border-radius: 50%; background: #EEF3FB; display: flex; align-items: center; justify-content: center; }
.gear-icon { font-size: 36rpx; }
.fam-body { flex: 1; padding: 32rpx; }
.sec-label { display: block; font-size: 22rpx; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 2rpx; margin: 40rpx 0 20rpx; }
.sec-label:first-child { margin-top: 0; }
.prof-top { display: flex; align-items: center; gap: 24rpx; margin-bottom: 28rpx; }
.prof-av { width: 104rpx; height: 104rpx; border-radius: 50%; background: linear-gradient(135deg,#3182F7,#1A5FCC); display: flex; align-items: center; justify-content: center; font-size: 36rpx; font-weight: 800; color: #fff; }
.prof-name { display: block; font-size: 34rpx; font-weight: 700; color: #0F172A; }
.prof-sub { display: block; font-size: 26rpx; color: #94A3B8; margin-top: 4rpx; }
.edit-btn { margin-left: auto; font-size: 26rpx; color: #3182F7; background: #EAF2FF; padding: 10rpx 20rpx; border-radius: 16rpx; }
.info-row { display: flex; justify-content: space-between; padding: 20rpx 0; border-top: 2rpx solid #EEF3FB; }
.il { font-size: 28rpx; color: #64748B; }
.iv { font-size: 28rpx; color: #0F172A; font-weight: 600; }
.mem-row { display: flex; white-space: nowrap; padding-bottom: 20rpx; }
.mc { display: inline-flex; flex-direction: column; align-items: center; gap: 10rpx; min-width: 108rpx; white-space: normal; }
.mav { width: 100rpx; height: 100rpx; border-radius: 50%; background: #EAF2FF; border: 4rpx solid rgba(49,130,247,0.18); display: flex; align-items: center; justify-content: center; font-size: 30rpx; font-weight: 700; color: #3182F7; }
.mav.admin { background: linear-gradient(135deg,#3182F7,#1A5FCC); color: #fff; border: none; }
.mav.invite { background: #F8FAFF; border: 4rpx dashed #CBD5E1; color: #94A3B8; font-size: 44rpx; font-weight: 300; }
.mn { font-size: 22rpx; color: #64748B; text-align: center; white-space: pre-line; }
.mem-hint { font-size: 24rpx; color: #94A3B8; }
.action-row { background: #fff; border-radius: 28rpx; padding: 28rpx 32rpx; display: flex; align-items: center; gap: 24rpx; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); margin-bottom: 20rpx; }
.action-row.disabled { opacity: 0.5; }
.aico { width: 76rpx; height: 76rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; font-size: 38rpx; }
.ai-b { background: #EAF2FF; }
.ai-o { background: #FFF7ED; }
.at { display: block; font-size: 30rpx; font-weight: 500; color: #0F172A; }
.ats { display: block; font-size: 24rpx; color: #94A3B8; margin-top: 4rpx; }
.aa { margin-left: auto; color: #CBD5E1; font-size: 34rpx; }
.soon { margin-left: auto; background: #F1F5F9; color: #94A3B8; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 99rpx; }
.empty-state { text-align: center; padding: 120rpx 0; }
.empty-text { display: block; font-size: 32rpx; color: #94A3B8; margin-bottom: 40rpx; }
.create-btn { background: #3182F7; color: #fff; border-radius: 28rpx; font-size: 30rpx; padding: 28rpx 60rpx; }
```

- [ ] **Step 5: Commit**

```bash
git add pages/family/
git commit -m "feat: family page with profile, members, and action buttons"
```

---

## Task 12: Settings Page

**Files:**
- Create: `pages/settings/settings.js`
- Create: `pages/settings/settings.wxml`
- Create: `pages/settings/settings.wxss`
- Create: `pages/settings/settings.json`

- [ ] **Step 1: Write `pages/settings/settings.json`**

```json
{
  "navigationBarTitleText": "设置",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 2: Write `pages/settings/settings.js`**

```js
Page({
  data: {
    settings: {
      alertSystolic: 160,
      alertDiastolic: 100,
      notifyAll: true,
      morningEveningLabel: false,
      splitLines: false,
      fontSize: 'normal'
    }
  },

  onLoad() { this.loadSettings() },

  async loadSettings() {
    const app = getApp()
    const db = wx.cloud.database()
    const res = await db.collection('families').doc(app.globalData.familyId).get()
    this.setData({ settings: res.data.settings })
    app.globalData.settings = res.data.settings
  },

  onToggle(e) {
    const key = e.currentTarget.dataset.key
    const val = !this.data.settings[key]
    this.setData({ [`settings.${key}`]: val })
    this.saveSettings()
  },

  changeThresh(e) {
    const { key, delta } = e.currentTarget.dataset
    const limits = { alertSystolic: [130, 200], alertDiastolic: [80, 120] }
    const [min, max] = limits[key]
    const current = this.data.settings[key]
    const next = Math.min(max, Math.max(min, current + delta))
    this.setData({ [`settings.${key}`]: next })
    this.saveSettings()
  },

  onFontSize(e) {
    const val = e.currentTarget.dataset.val
    this.setData({ 'settings.fontSize': val })
    this.saveSettings()
  },

  async saveSettings() {
    const app = getApp()
    await wx.cloud.callFunction({
      name: 'saveSettings',
      data: { familyId: app.globalData.familyId, settings: this.data.settings }
    })
    app.globalData.settings = this.data.settings
  }
})
```

- [ ] **Step 3: Write `pages/settings/settings.wxml`** (abridged — full content covers all toggle/threshold rows)

```xml
<scroll-view scroll-y class="container">

  <text class="sec-label">通知设置</text>
  <view class="set-card">
    <view class="set-row">
      <view><text class="set-lbl">异常血压通知</text><text class="set-sub">超过阈值时推送给家庭成员</text></view>
      <view class="tog {{settings.notifyAll ? 'on' : 'off'}}" bindtap="onToggle" data-key="notifyAll">
        <view class="tok"></view>
      </view>
    </view>
    <view class="set-row">
      <view><text class="set-lbl">高压告警阈值</text><text class="set-sub">收缩压超过此值时触发通知</text></view>
      <view class="stepper">
        <view class="step-btn" bindtap="changeThresh" data-key="alertSystolic" data-delta="{{-5}}">−</view>
        <text class="step-val">{{settings.alertSystolic}} mmHg</text>
        <view class="step-btn" bindtap="changeThresh" data-key="alertSystolic" data-delta="{{5}}">＋</view>
      </view>
    </view>
    <view class="set-row">
      <view><text class="set-lbl">低压告警阈值</text><text class="set-sub">舒张压超过此值时触发通知</text></view>
      <view class="stepper">
        <view class="step-btn" bindtap="changeThresh" data-key="alertDiastolic" data-delta="{{-5}}">−</view>
        <text class="step-val">{{settings.alertDiastolic}} mmHg</text>
        <view class="step-btn" bindtap="changeThresh" data-key="alertDiastolic" data-delta="{{5}}">＋</view>
      </view>
    </view>
  </view>

  <text class="sec-label">图表设置</text>
  <view class="set-card">
    <view class="set-row">
      <view><text class="set-lbl">晨/晚测标注</text><text class="set-sub">录入时选择测量时段</text></view>
      <view class="tog {{settings.morningEveningLabel ? 'on' : 'off'}}" bindtap="onToggle" data-key="morningEveningLabel">
        <view class="tok"></view>
      </view>
    </view>
    <view class="set-row">
      <view><text class="set-lbl">早晚分线显示</text><text class="set-sub">图表中晨/晚测分两条线</text></view>
      <view class="tog {{settings.splitLines ? 'on' : 'off'}}" bindtap="onToggle" data-key="splitLines">
        <view class="tok"></view>
      </view>
    </view>
  </view>

  <text class="sec-label">显示设置</text>
  <view class="set-card">
    <view class="set-row">
      <text class="set-lbl">字体大小</text>
      <view class="fs-sel">
        <view class="fs-opt {{settings.fontSize==='normal'?'active':''}}" bindtap="onFontSize" data-val="normal">标准</view>
        <view class="fs-opt {{settings.fontSize==='large'?'active':''}}" bindtap="onFontSize" data-val="large">大</view>
        <view class="fs-opt {{settings.fontSize==='xlarge'?'active':''}}" bindtap="onFontSize" data-val="xlarge">超大</view>
      </view>
    </view>
  </view>

</scroll-view>
```

- [ ] **Step 4: Write `cloudfunctions/saveSettings/index.js`**

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { familyId, settings } = event
  await db.collection('families').doc(familyId).update({ data: { settings } })
  return { success: true }
}
```

- [ ] **Step 5: Deploy `saveSettings` cloud function**

- [ ] **Step 6: Write `pages/settings/settings.wxss`** (toggle + stepper styles)

```css
.container { padding: 32rpx; background: #EEF3FB; min-height: 100vh; }
.sec-label { display: block; font-size: 22rpx; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 2rpx; margin: 40rpx 0 20rpx; }
.set-card { background: #fff; border-radius: 32rpx; overflow: hidden; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.set-row { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 36rpx; border-bottom: 2rpx solid #EEF3FB; }
.set-lbl { display: block; font-size: 30rpx; font-weight: 500; color: #0F172A; }
.set-sub { display: block; font-size: 24rpx; color: #94A3B8; margin-top: 4rpx; }
.tog { width: 88rpx; height: 52rpx; border-radius: 26rpx; position: relative; transition: background 0.2s; }
.tog.on { background: #3182F7; }
.tog.off { background: #CBD5E1; }
.tok { width: 40rpx; height: 40rpx; background: #fff; border-radius: 50%; position: absolute; top: 6rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.18); transition: left 0.18s; }
.tog.on .tok { left: 42rpx; }
.tog.off .tok { left: 6rpx; }
.stepper { display: flex; align-items: center; gap: 16rpx; }
.step-btn { width: 56rpx; height: 56rpx; border-radius: 16rpx; background: #EAF2FF; color: #3182F7; display: flex; align-items: center; justify-content: center; font-size: 36rpx; }
.step-val { font-size: 28rpx; font-weight: 700; color: #0F172A; min-width: 120rpx; text-align: center; }
.fs-sel { display: flex; gap: 12rpx; }
.fs-opt { padding: 10rpx 24rpx; border-radius: 20rpx; font-size: 26rpx; border: 3rpx solid #DDE6F5; background: #F8FAFF; color: #64748B; }
.fs-opt.active { background: #3182F7; color: #fff; border-color: #3182F7; font-weight: 600; }
```

- [ ] **Step 7: Commit**

```bash
git add pages/settings/ cloudfunctions/saveSettings/
git commit -m "feat: settings page with threshold stepper, toggles, and font size"
```

---

## Task 13: BP & HR Chart Components (Canvas)

**Files:**
- Create: `components/bp-chart/bp-chart.js`
- Create: `components/bp-chart/bp-chart.wxml`
- Create: `components/bp-chart/bp-chart.wxss`
- Create: `components/bp-chart/bp-chart.json`
- Create: `components/hr-chart/hr-chart.js`
- Create: `components/hr-chart/hr-chart.wxml`
- Create: `components/hr-chart/hr-chart.wxss`
- Create: `components/hr-chart/hr-chart.json`
- Create: `utils/chart.js`

- [ ] **Step 1: Write `utils/chart.js`**

```js
const { daysAgo, formatMonthDay } = require('./date')

// Build daily aggregated data points for N days
// Returns: [{ label: '4/6', avgSys, avgDia, avgHR, isHigh }]
function buildChartData(records, days) {
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const key = day.toISOString().slice(0, 10)
    const dayRecords = records.filter(r => new Date(r.measuredAt).toISOString().slice(0, 10) === key)

    if (!dayRecords.length) {
      result.push({ label: formatMonthDay(day), avgSys: null, avgDia: null, avgHR: null, isHigh: false })
      continue
    }
    const avg = arr => Math.round(arr.reduce((s,v) => s+v, 0) / arr.length)
    const avgSys = avg(dayRecords.map(r => r.systolic))
    const avgDia = avg(dayRecords.map(r => r.diastolic))
    const avgHR  = avg(dayRecords.map(r => r.heartRate))
    result.push({ label: formatMonthDay(day), avgSys, avgDia, avgHR, isHigh: avgSys >= 140 || avgDia >= 90 })
  }
  return result
}

module.exports = { buildChartData }
```

- [ ] **Step 2: Write `components/bp-chart/bp-chart.json`**

```json
{ "component": true, "usingComponents": {} }
```

- [ ] **Step 3: Write `components/bp-chart/bp-chart.wxml`**

```xml
<canvas type="2d" id="bp-canvas" class="chart-canvas" />
<view class="legend">
  <view class="leg"><view class="ld" style="background:#FF3B30"></view><text>血压偏高</text></view>
  <view class="leg"><view class="ld" style="background:#3182F7"></view><text>血压正常</text></view>
  <view class="leg"><view class="leg-dash"></view><text>舒张压</text></view>
</view>
```

- [ ] **Step 4: Write `components/bp-chart/bp-chart.js`**

```js
const { buildChartData } = require('../../utils/chart')
const DAYS_MAP = { '7天': 7, '30天': 30, '90天': 90 }

Component({
  properties: {
    records: { type: Array, value: [] },
    period:  { type: String, value: '7天' }
  },
  observers: {
    'records, period': function() { this.drawChart() }
  },
  methods: {
    drawChart() {
      const days = DAYS_MAP[this.data.period] || 7
      const data = buildChartData(this.data.records, days)

      const query = this.createSelectorQuery()
      query.select('#bp-canvas').fields({ node: true, size: true }).exec(res => {
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const { width, height } = res[0]
        canvas.width  = width  * wx.getSystemInfoSync().pixelRatio
        canvas.height = height * wx.getSystemInfoSync().pixelRatio
        ctx.scale(wx.getSystemInfoSync().pixelRatio, wx.getSystemInfoSync().pixelRatio)

        this.render(ctx, width, height, data)
      })
    },

    render(ctx, W, H, data) {
      ctx.clearRect(0, 0, W, H)

      const PAD_L = 36, PAD_R = 12, PAD_T = 10, PAD_B = 24
      const chartW = W - PAD_L - PAD_R
      const chartH = H - PAD_T - PAD_B
      const MIN_VAL = 60, MAX_VAL = 200

      const toY = val => PAD_T + chartH - ((val - MIN_VAL) / (MAX_VAL - MIN_VAL)) * chartH
      const toX = i  => PAD_L + (i / (data.length - 1)) * chartW

      // Grid lines
      ctx.strokeStyle = '#EEF3FB'; ctx.lineWidth = 1
      ;[100, 120, 140, 160, 180].forEach(v => {
        ctx.beginPath(); ctx.moveTo(PAD_L, toY(v)); ctx.lineTo(W - PAD_R, toY(v)); ctx.stroke()
      })

      // Reference line at 140
      ctx.strokeStyle = '#FED7AA'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
      ctx.beginPath(); ctx.moveTo(PAD_L, toY(140)); ctx.lineTo(W - PAD_R, toY(140)); ctx.stroke()
      ctx.setLineDash([])

      // Y-axis labels
      ctx.fillStyle = '#CBD5E1'; ctx.font = '10px PingFang SC'; ctx.textAlign = 'right'
      ;[100, 140, 180].forEach(v => { ctx.fillText(String(v), PAD_L - 4, toY(v) + 3) })
      ctx.fillStyle = '#FF9500'; ctx.fillText('140', PAD_L - 4, toY(140) + 3)

      // Systolic line
      const sysPoints = data.filter(d => d.avgSys !== null)
      if (sysPoints.length > 1) {
        ctx.beginPath(); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'
        sysPoints.forEach((d, i) => {
          const xi = data.indexOf(d)
          i === 0 ? ctx.moveTo(toX(xi), toY(d.avgSys)) : ctx.lineTo(toX(xi), toY(d.avgSys))
        })
        ctx.strokeStyle = '#3182F7'; ctx.stroke()
      }

      // Diastolic dashed
      const diaPoints = data.filter(d => d.avgDia !== null)
      if (diaPoints.length > 1) {
        ctx.beginPath(); ctx.lineWidth = 2; ctx.setLineDash([5, 3])
        diaPoints.forEach((d, i) => {
          const xi = data.indexOf(d)
          i === 0 ? ctx.moveTo(toX(xi), toY(d.avgDia)) : ctx.lineTo(toX(xi), toY(d.avgDia))
        })
        ctx.strokeStyle = '#3182F7'; ctx.globalAlpha = 0.5; ctx.stroke()
        ctx.globalAlpha = 1; ctx.setLineDash([])
      }

      // Dots
      data.forEach((d, i) => {
        if (d.avgSys === null) return
        ctx.beginPath()
        ctx.arc(toX(i), toY(d.avgSys), 5, 0, Math.PI * 2)
        ctx.fillStyle = d.isHigh ? '#FF3B30' : '#3182F7'; ctx.fill()
      })

      // X labels
      ctx.fillStyle = '#94A3B8'; ctx.font = '10px PingFang SC'; ctx.textAlign = 'center'
      const step = Math.ceil(data.length / 7)
      data.forEach((d, i) => {
        if (i % step === 0 || i === data.length - 1) {
          ctx.fillText(d.label, toX(i), H - 4)
        }
      })
    }
  }
})
```

- [ ] **Step 5: Write `components/bp-chart/bp-chart.wxss`**

```css
.chart-canvas { width: 100%; height: 300rpx; display: block; }
.legend { display: flex; justify-content: center; gap: 32rpx; margin-top: 16rpx; }
.leg { display: flex; align-items: center; gap: 10rpx; font-size: 24rpx; color: #64748B; }
.ld { width: 16rpx; height: 16rpx; border-radius: 50%; }
.leg-dash { width: 36rpx; border-bottom: 4rpx dashed #3182F7; opacity: 0.5; }
```

- [ ] **Step 6: Write `hr-chart` component** (same pattern, only bars instead of lines)

  `components/hr-chart/hr-chart.wxml`:
```xml
<canvas type="2d" id="hr-canvas" class="chart-canvas" />
<view class="legend">
  <view class="leg"><view class="ld" style="background:#FF3B30"></view><text>心率偏高</text></view>
  <view class="leg"><view class="ld" style="background:#3182F7"></view><text>正常心率</text></view>
</view>
```

  `components/hr-chart/hr-chart.js` — same structure as bp-chart but `render()` draws vertical bars:
```js
render(ctx, W, H, data) {
  ctx.clearRect(0, 0, W, H)
  const PAD_L = 36, PAD_R = 12, PAD_T = 10, PAD_B = 24
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const MAX_HR = 130

  const toY = val => PAD_T + chartH - (val / MAX_HR) * chartH
  const barW = Math.max(8, (chartW / data.length) * 0.55)

  ;[30, 60, 90, 120].forEach(v => {
    ctx.strokeStyle = '#EEF3FB'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(PAD_L, toY(v)); ctx.lineTo(W - PAD_R, toY(v)); ctx.stroke()
    ctx.fillStyle = '#CBD5E1'; ctx.font = '10px PingFang SC'; ctx.textAlign = 'right'
    ctx.fillText(String(v), PAD_L - 4, toY(v) + 3)
  })

  data.forEach((d, i) => {
    if (d.avgHR === null) return
    const x = PAD_L + (i / (data.length - 1)) * chartW - barW / 2
    const y = toY(d.avgHR)
    const isHigh = d.avgHR > 100 || d.avgHR < 60
    ctx.fillStyle = isHigh ? '#FF3B30' : '#3182F7'
    // Rounded rect approximation
    ctx.beginPath()
    ctx.roundRect(x, y, barW, H - PAD_B - y, 4)
    ctx.fill()
  })

  ctx.fillStyle = '#94A3B8'; ctx.font = '10px PingFang SC'; ctx.textAlign = 'center'
  const step = Math.ceil(data.length / 7)
  data.forEach((d, i) => {
    if (i % step === 0 || i === data.length - 1) {
      ctx.fillText(d.label, PAD_L + (i / (data.length - 1)) * chartW, H - 4)
    }
  })
}
```

- [ ] **Step 7: Commit**

```bash
git add components/ utils/chart.js
git commit -m "feat: bp and hr canvas chart components with daily aggregation"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| Blood pressure record (sys/dia/HR) | Task 6, 9 |
| Multiple records per day | Task 6 (no limit) |
| Morning/evening labels (toggle) | Task 12 (settings), Task 9 (form) |
| 7/30/90 day period switcher | Task 7 |
| BP line chart with reference line | Task 13 |
| HR bar chart | Task 13 |
| Color-coded BP values | Task 5, 8 |
| Stats: on-target / off-target / average | Task 7 |
| All records list (grouped, expand/collapse) | Task 10 |
| Edit / delete records | Task 10 |
| Family group (max 10 members) | Task 5 |
| Invite via code | Task 5, 11 |
| Member permissions (admin/member) | Task 4, 5 |
| Notification threshold settings | Task 12 |
| Font size setting | Task 12 |
| Monitored person profile | Task 11 |
| Generate report (export image) | Not yet — **add Task 14** |
| WeChat login | Task 4 |
| CloudBase data storage | Task 3, 6 |

---

## Task 14: Report Generation (Export as Image)

**Files:**
- Modify: `pages/records/records.js`
- Modify: `pages/records/records.wxml`

- [ ] **Step 1: Add report canvas to `records.wxml`**

```xml
<!-- Hidden canvas used only for image export -->
<canvas type="2d" id="report-canvas" style="position:fixed;top:-9999rpx;width:750rpx;height:1200rpx;"/>
<button class="export-btn" bindtap="onExport">⬇ 导出图片报告</button>
```

- [ ] **Step 2: Add `onExport` to `records.js`**

```js
onExport() {
  const query = this.createSelectorQuery()
  query.select('#report-canvas').fields({ node: true, size: true }).exec(res => {
    const canvas = res[0].node
    const ctx = canvas.getContext('2d')
    const W = 750, H = 1200
    canvas.width = W; canvas.height = H

    // White background
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H)

    // Title
    ctx.fillStyle = '#0F172A'; ctx.font = 'bold 36px PingFang SC'; ctx.textAlign = 'center'
    ctx.fillText('血压记录报告', W/2, 60)
    ctx.font = '24px PingFang SC'; ctx.fillStyle = '#64748B'
    ctx.fillText(`导出时间：${new Date().toLocaleDateString('zh-CN')}`, W/2, 100)

    // List records (latest 20)
    const records = this.data.groups.flatMap(g => g.items).slice(0, 20)
    ctx.textAlign = 'left'; ctx.font = '22px PingFang SC'; ctx.fillStyle = '#0F172A'
    records.forEach((r, i) => {
      const y = 150 + i * 50
      ctx.fillText(`${r.timeStr}   ${r.systolic}/${r.diastolic} mmHg   心率 ${r.heartRate} bpm   ${r.bpStatus.label}`, 40, y)
    })

    // Save to album
    wx.canvasToTempFilePath({ canvas, success(fileRes) {
      wx.saveImageToPhotosAlbum({
        filePath: fileRes.tempFilePath,
        success() { wx.showToast({ title: '已保存到相册', icon: 'success' }) },
        fail()    { wx.showToast({ title: '需要相册权限', icon: 'none' }) }
      })
    }})
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add pages/records/
git commit -m "feat: export records as image to photo album"
```

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-12-blood-pressure-miniprogram.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
