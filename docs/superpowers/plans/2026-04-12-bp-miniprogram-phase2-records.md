# BP Mini-Program Phase 2 Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the blood-pressure/heart-rate record loop: save records, load records, show basic stats on the data page, and list/edit/delete records.

**Architecture:** Keep all record writes and reads behind CloudBase cloud functions with server-side family permission checks. Use the existing `utils/health-rules.js` for status and stats so page display and later chart/report features share the same reference rules. This phase intentionally keeps chart canvases and image export out of scope.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JS, CloudBase cloud functions with `wx-server-sdk`, Node smoke checks.

---

## Source Spec

Use `docs/superpowers/specs/2026-04-12-blood-pressure-miniprogram-mvp-design.md` as the source of truth.

## File Structure

- `utils/date.js`: date formatting, date input conversion, `daysAgo`, and group-by-date helpers.
- `scripts/verify-record-utils.js`: Node smoke checks for date helpers and record stats.
- `cloudfunctions/getRecords/*`: Family-member-only record query by `familyId` and `since`.
- `cloudfunctions/saveRecord/*`: `canWrite` create and `canEdit` update flow with validation.
- `cloudfunctions/deleteRecord/*`: `canEdit` delete flow.
- `pages/data/*`: Basic dashboard, latest record, stats, period switcher, no charts yet.
- `pages/add-record/*`: Add/edit record form.
- `pages/records/*`: Grouped record list, edit/delete actions.
- `pages/family/*`: Add settings navigation so admins can reach member permissions.

## Task 1: Date Utility and Record Smoke Checks

**Files:**
- Create: `utils/date.js`
- Create: `scripts/verify-record-utils.js`

- [ ] **Step 1: Create `utils/date.js`**

```js
function pad(n) {
  return String(n).padStart(2, '0')
}

function toDate(value) {
  if (value instanceof Date) return value
  return new Date(value)
}

function formatDateTime(value) {
  const date = toDate(value)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatTime(value) {
  const date = toDate(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatInputDateTime(value) {
  const date = value ? toDate(value) : new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseInputDateTime(value) {
  const normalized = String(value || '').replace(' ', 'T')
  return new Date(normalized)
}

function daysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days + 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function groupByDate(records) {
  const groups = {}
  records.forEach(record => {
    const date = toDate(record.measuredAt)
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  })
  return Object.keys(groups)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      items: groups[date].sort((a, b) => new Date(b.measuredAt) - new Date(a.measuredAt)),
      open: false,
    }))
}

module.exports = {
  formatDateTime,
  formatTime,
  formatInputDateTime,
  parseInputDateTime,
  daysAgo,
  groupByDate,
}
```

- [ ] **Step 2: Create `scripts/verify-record-utils.js`**

```js
const assert = require('assert')
const { calcAverage, countReferenceStats } = require('../utils/health-rules')
const { formatDateTime, groupByDate } = require('../utils/date')

const records = [
  { systolic: 120, diastolic: 80, heartRate: 72, measuredAt: '2026-04-12T08:30:00.000Z' },
  { systolic: 140, diastolic: 86, heartRate: 90, measuredAt: '2026-04-12T20:30:00.000Z' },
  { systolic: 160, diastolic: 90, heartRate: 78, measuredAt: '2026-04-11T08:30:00.000Z' },
]

assert.deepStrictEqual(calcAverage(records), { systolic: 140, diastolic: 85, heartRate: 80 })
assert.deepStrictEqual(countReferenceStats(records, {}), {
  bp: { inRange: 1, attention: 2 },
  hr: { inRange: 2, attention: 1 },
})
assert.strictEqual(formatDateTime('2026-04-12T08:30:00.000Z').includes('2026/4/12'), true)
const groups = groupByDate(records)
assert.strictEqual(groups.length, 2)
assert.strictEqual(groups[0].items.length, 2)

console.log('record utility checks passed')
```

- [ ] **Step 3: Run smoke checks**

```bash
node scripts/verify-health-rules.js
node scripts/verify-record-utils.js
```

Expected:

```text
health rule checks passed
record utility checks passed
```

- [ ] **Step 4: Commit**

```bash
git add utils/date.js scripts/verify-record-utils.js
git commit -m "feat: add record date utilities"
```

## Task 2: Record Cloud Functions

**Files:**
- Create: `cloudfunctions/getRecords/index.js`
- Create: `cloudfunctions/getRecords/package.json`
- Create: `cloudfunctions/getRecords/_shared/auth.js`
- Create: `cloudfunctions/saveRecord/index.js`
- Create: `cloudfunctions/saveRecord/package.json`
- Create: `cloudfunctions/saveRecord/_shared/auth.js`
- Create: `cloudfunctions/deleteRecord/index.js`
- Create: `cloudfunctions/deleteRecord/package.json`
- Create: `cloudfunctions/deleteRecord/_shared/auth.js`

- [ ] **Step 1: Create package files**

Use this package JSON for each function and set `"name"` to `getRecords`, `saveRecord`, or `deleteRecord`:

```json
{
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: Copy shared auth helper**

Copy `cloudfunctions/_shared/auth.js` to:

```text
cloudfunctions/getRecords/_shared/auth.js
cloudfunctions/saveRecord/_shared/auth.js
cloudfunctions/deleteRecord/_shared/auth.js
```

- [ ] **Step 3: Implement `cloudfunctions/getRecords/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireMember } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, since } = event
  const family = (await db.collection('families').doc(familyId).get()).data
  requireMember(family, OPENID)

  const where = { familyId }
  if (since) where.measuredAt = _.gte(new Date(since))

  const res = await db.collection('records')
    .where(where)
    .orderBy('measuredAt', 'desc')
    .limit(500)
    .get()

  return { success: true, records: res.data }
}
```

- [ ] **Step 4: Implement `cloudfunctions/saveRecord/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireMember, canWriteRecord, canEditRecord } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function normalizeRecord(event, openid) {
  const systolic = Number(event.systolic)
  const diastolic = Number(event.diastolic)
  const heartRate = Number(event.heartRate)
  if (!systolic || systolic < 60 || systolic > 300) throw new Error('高压值不正确')
  if (!diastolic || diastolic < 40 || diastolic > 200) throw new Error('低压值不正确')
  if (!heartRate || heartRate < 30 || heartRate > 250) throw new Error('心率不正确')
  return {
    familyId: event.familyId,
    systolic,
    diastolic,
    heartRate,
    measuredAt: new Date(event.measuredAt),
    period: event.period || null,
    recordedBy: openid,
    updatedAt: db.serverDate(),
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const family = (await db.collection('families').doc(event.familyId).get()).data
  const member = requireMember(family, OPENID)
  const data = normalizeRecord(event, OPENID)

  if (event.id) {
    if (!canEditRecord(member)) return { success: false, error: '没有编辑权限' }
    await db.collection('records').doc(event.id).update({ data })
    return { success: true, id: event.id }
  }

  if (!canWriteRecord(member)) return { success: false, error: '没有录入权限' }
  data.createdAt = db.serverDate()
  const res = await db.collection('records').add({ data })
  return { success: true, id: res._id }
}
```

- [ ] **Step 5: Implement `cloudfunctions/deleteRecord/index.js`**

```js
const cloud = require('wx-server-sdk')
const { requireMember, canEditRecord } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const record = (await db.collection('records').doc(event.id).get()).data
  const family = (await db.collection('families').doc(record.familyId).get()).data
  const member = requireMember(family, OPENID)
  if (!canEditRecord(member)) return { success: false, error: '没有删除权限' }
  await db.collection('records').doc(event.id).remove()
  return { success: true }
}
```

- [ ] **Step 6: Run syntax checks**

```bash
node --check cloudfunctions/getRecords/index.js
node --check cloudfunctions/saveRecord/index.js
node --check cloudfunctions/deleteRecord/index.js
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add cloudfunctions/getRecords cloudfunctions/saveRecord cloudfunctions/deleteRecord
git commit -m "feat: add record cloud functions"
```

## Task 3: Add/Edit Record Page

**Files:**
- Modify: `pages/add-record/add-record.js`
- Modify: `pages/add-record/add-record.wxml`
- Modify: `pages/add-record/add-record.wxss`
- Modify: `pages/add-record/add-record.json`

- [ ] **Step 1: Implement `pages/add-record/add-record.js`**

```js
const { getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { formatInputDateTime, parseInputDateTime } = require('../../utils/date')

Page({
  data: {
    id: '',
    systolic: '',
    diastolic: '',
    heartRate: '',
    measuredAt: '',
    period: '',
    statusText: '',
    statusColor: '#64748B',
    saving: false,
  },

  onLoad(options) {
    if (options.record) {
      const record = JSON.parse(decodeURIComponent(options.record))
      this.setData({
        id: record._id,
        systolic: String(record.systolic),
        diastolic: String(record.diastolic),
        heartRate: String(record.heartRate),
        measuredAt: formatInputDateTime(record.measuredAt),
        period: record.period || '',
      })
      this.updateStatus()
      return
    }
    this.setData({ measuredAt: formatInputDateTime(new Date()) })
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
    this.updateStatus()
  },

  onPeriodTap(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period: this.data.period === period ? '' : period })
  },

  updateStatus() {
    const { systolic, diastolic, heartRate } = this.data
    if (!systolic || !diastolic || !heartRate) return
    const bp = getBPStatus(systolic, diastolic)
    const hr = getHRStatus(heartRate)
    this.setData({
      statusText: `血压${bp.label}，心率${hr.label}`,
      statusColor: bp.attention ? bp.color : hr.color,
    })
  },

  validate() {
    const sys = Number(this.data.systolic)
    const dia = Number(this.data.diastolic)
    const hr = Number(this.data.heartRate)
    if (!sys || sys < 60 || sys > 300) { wx.showToast({ title: '高压值不正确', icon: 'none' }); return false }
    if (!dia || dia < 40 || dia > 200) { wx.showToast({ title: '低压值不正确', icon: 'none' }); return false }
    if (!hr || hr < 30 || hr > 250) { wx.showToast({ title: '心率不正确', icon: 'none' }); return false }
    return true
  },

  async onSave() {
    if (!this.validate()) return
    const app = getApp()
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先创建或加入家庭组', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'saveRecord',
        data: {
          id: this.data.id || undefined,
          familyId: app.globalData.familyId,
          systolic: Number(this.data.systolic),
          diastolic: Number(this.data.diastolic),
          heartRate: Number(this.data.heartRate),
          measuredAt: parseInputDateTime(this.data.measuredAt).toISOString(),
          period: this.data.period || null,
        },
      })
      if (!res.result.success) {
        wx.showToast({ title: res.result.error || '保存失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '保存成功', icon: 'success' })
      wx.navigateBack()
    } finally {
      this.setData({ saving: false })
    }
  },
})
```

- [ ] **Step 2: Implement `pages/add-record/add-record.wxml`**

```xml
<view class="container">
  <view class="form-card">
    <view class="form-row">
      <text class="label">高压（mmHg）</text>
      <input class="input" type="number" value="{{systolic}}" placeholder="如 130" bindinput="onInput" data-field="systolic" />
    </view>
    <view class="form-row">
      <text class="label">低压（mmHg）</text>
      <input class="input" type="number" value="{{diastolic}}" placeholder="如 80" bindinput="onInput" data-field="diastolic" />
    </view>
    <view class="form-row">
      <text class="label">心率（bpm）</text>
      <input class="input" type="number" value="{{heartRate}}" placeholder="如 72" bindinput="onInput" data-field="heartRate" />
    </view>
    <view class="form-row">
      <text class="label">测量时间</text>
      <input class="input time" value="{{measuredAt}}" placeholder="2026-04-12 08:30" bindinput="onInput" data-field="measuredAt" />
    </view>
    <view class="period-row">
      <view class="period {{period==='morning'?'active':''}}" bindtap="onPeriodTap" data-period="morning">晨测</view>
      <view class="period {{period==='evening'?'active':''}}" bindtap="onPeriodTap" data-period="evening">晚测</view>
    </view>
    <view wx:if="{{statusText}}" class="status" style="color:{{statusColor}}">{{statusText}}</view>
  </view>
  <button class="save" loading="{{saving}}" bindtap="onSave">保存记录</button>
</view>
```

- [ ] **Step 3: Implement `pages/add-record/add-record.wxss`**

```css
.container { min-height: 100vh; background: #EEF3FB; padding: 32rpx; box-sizing: border-box; }
.form-card { background: #fff; border-radius: 32rpx; padding: 8rpx 0; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.form-row { min-height: 112rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 32rpx; border-bottom: 2rpx solid #EEF3FB; }
.label { font-size: 30rpx; color: #0F172A; font-weight: 600; }
.input { flex: 1; text-align: right; font-size: 36rpx; font-weight: 700; color: #3182F7; }
.input.time { font-size: 30rpx; }
.period-row { display: flex; gap: 20rpx; padding: 28rpx 32rpx 8rpx; }
.period { flex: 1; min-height: 80rpx; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; background: #EAF2FF; color: #3182F7; font-size: 30rpx; font-weight: 700; }
.period.active { background: #3182F7; color: #fff; }
.status { padding: 24rpx 32rpx; font-size: 30rpx; font-weight: 700; }
.save { min-height: 96rpx; margin-top: 32rpx; border-radius: 28rpx; background: #3182F7; color: #fff; font-size: 34rpx; font-weight: 800; }
```

- [ ] **Step 4: Update `pages/add-record/add-record.json`**

```json
{
  "navigationBarTitleText": "添加记录",
  "navigationBarBackgroundColor": "#3182F7",
  "navigationBarTextStyle": "white"
}
```

- [ ] **Step 5: Run syntax check**

```bash
node --check pages/add-record/add-record.js
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add pages/add-record
git commit -m "feat: add blood pressure record form"
```

## Task 4: Data Page Basic Dashboard

**Files:**
- Modify: `pages/data/data.js`
- Modify: `pages/data/data.wxml`
- Modify: `pages/data/data.wxss`
- Modify: `pages/data/data.json`

- [ ] **Step 1: Implement `pages/data/data.js`**

```js
const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('../../utils/health-rules')
const { daysAgo, formatDateTime } = require('../../utils/date')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

Page({
  data: {
    period: '7天',
    records: [],
    latestRecord: null,
    latestTime: '',
    latestBPStatus: null,
    latestHRStatus: null,
    stats: {
      bp: { inRange: 0, attention: 0 },
      hr: { inRange: 0, attention: 0 },
      avg: { systolic: '--', diastolic: '--', heartRate: '--' },
    },
    loading: false,
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ records: [], latestRecord: null, latestTime: '', loading: false })
      return
    }
    this.setData({ loading: true })
    const days = PERIODS[this.data.period] || 7
    const res = await wx.cloud.callFunction({
      name: 'getRecords',
      data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
    })
    const records = res.result.records || []
    const latestRecord = records[0] || null
    this.setData({
      records,
      latestRecord,
      latestTime: latestRecord ? formatDateTime(latestRecord.measuredAt) : '',
      latestBPStatus: latestRecord ? getBPStatus(latestRecord.systolic, latestRecord.diastolic) : null,
      latestHRStatus: latestRecord ? getHRStatus(latestRecord.heartRate) : null,
      stats: {
        ...countReferenceStats(records, {}),
        avg: calcAverage(records),
      },
      loading: false,
    })
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
  },

  onBPNotice() {
    wx.showModal({
      title: '血压数据须知',
      content: '血压参考范围和状态提示参考《中国高血压防治指南（2024年修订版）》及家庭血压管理常用标准。本小程序的状态提示和图表结果仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。',
      showCancel: false,
      confirmText: '我知道了',
    })
  },

  onHRNotice() {
    wx.showModal({
      title: '心率数据须知',
      content: '心率参考范围和状态提示参考《中国高血压患者心率管理多学科专家共识（2021年版）》及常用静息心率范围。本小程序的状态提示和图表结果仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。',
      showCancel: false,
      confirmText: '我知道了',
    })
  },
})
```

- [ ] **Step 2: Implement `pages/data/data.wxml`**

```xml
<scroll-view scroll-y class="container">
  <view class="hero">
    <text class="title">血压心率记录</text>
    <view wx:if="{{latestRecord}}" class="latest-card">
      <text class="time">最近一次：{{latestTime}}</text>
      <view class="values">
        <view><text class="num">{{latestRecord.systolic}}</text><text class="unit">高压</text></view>
        <view><text class="num">{{latestRecord.diastolic}}</text><text class="unit">低压</text></view>
        <view><text class="num">{{latestRecord.heartRate}}</text><text class="unit">心率</text></view>
      </view>
      <text class="status">血压{{latestBPStatus.label}} · 心率{{latestHRStatus.label}}</text>
    </view>
    <view wx:else class="latest-card empty-card">
      <text>还没有记录</text>
    </view>
    <button class="add" bindtap="onAddRecord">＋ 添加记录</button>
  </view>

  <view class="toolbar">
    <view class="periods">
      <view wx:for="{{['7天','30天','90天']}}" wx:key="*this" class="period {{period===item?'active':''}}" bindtap="onPeriodChange" data-period="{{item}}">{{item}}</view>
    </view>
    <text class="all" bindtap="onAllRecords">全部记录 ></text>
  </view>

  <view class="section-head">
    <text class="section-title">血压数据</text>
    <text class="notice" bindtap="onBPNotice">?</text>
  </view>
  <view class="stat-card">
    <view class="stat"><text class="stat-num">{{stats.bp.inRange}}</text><text>参考范围内</text></view>
    <view class="stat"><text class="stat-num attention">{{stats.bp.attention}}</text><text>需关注</text></view>
    <view class="stat"><text class="stat-num small">{{stats.avg.systolic}}/{{stats.avg.diastolic}}</text><text>均值</text></view>
  </view>

  <view class="section-head">
    <text class="section-title">心率数据</text>
    <text class="notice" bindtap="onHRNotice">?</text>
  </view>
  <view class="stat-card bottom">
    <view class="stat"><text class="stat-num">{{stats.hr.inRange}}</text><text>参考范围内</text></view>
    <view class="stat"><text class="stat-num attention">{{stats.hr.attention}}</text><text>需关注</text></view>
    <view class="stat"><text class="stat-num">{{stats.avg.heartRate}}</text><text>均值</text></view>
  </view>
</scroll-view>
```

- [ ] **Step 3: Implement `pages/data/data.wxss`**

```css
.container { min-height: 100vh; background: #EEF3FB; }
.hero { background: linear-gradient(170deg, #72BBFF 0%, #3182F7 45%, #1A5FCC 100%); padding: 88rpx 32rpx 40rpx; border-radius: 0 0 48rpx 48rpx; }
.title { display: block; text-align: center; color: #fff; font-size: 38rpx; font-weight: 800; margin-bottom: 28rpx; }
.latest-card { background: rgba(255,255,255,0.92); border-radius: 32rpx; padding: 32rpx; color: #0F172A; }
.empty-card { text-align: center; color: #64748B; font-size: 32rpx; }
.time { display: block; color: #64748B; font-size: 26rpx; text-align: center; margin-bottom: 24rpx; }
.values { display: flex; justify-content: space-around; text-align: center; }
.num { display: block; color: #3182F7; font-size: 64rpx; font-weight: 900; line-height: 1; }
.unit { display: block; color: #64748B; font-size: 24rpx; margin-top: 8rpx; }
.status { display: block; text-align: center; margin-top: 24rpx; font-size: 28rpx; color: #0F172A; font-weight: 700; }
.add { min-height: 96rpx; background: #fff; color: #3182F7; border-radius: 28rpx; margin-top: 24rpx; font-size: 34rpx; font-weight: 800; }
.toolbar { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx; }
.periods { display: flex; background: #EAF2FF; border-radius: 40rpx; padding: 6rpx; }
.period { padding: 12rpx 28rpx; color: #3182F7; border-radius: 34rpx; font-size: 26rpx; font-weight: 700; }
.period.active { background: #3182F7; color: #fff; }
.all { color: #3182F7; font-size: 28rpx; font-weight: 700; }
.section-head { display: flex; align-items: center; gap: 12rpx; padding: 12rpx 32rpx 18rpx; }
.section-title { font-size: 32rpx; color: #0F172A; font-weight: 800; }
.notice { width: 36rpx; height: 36rpx; border-radius: 50%; background: #EAF2FF; color: #3182F7; display: flex; align-items: center; justify-content: center; font-size: 24rpx; font-weight: 800; }
.stat-card { margin: 0 32rpx 32rpx; background: #fff; border-radius: 32rpx; padding: 32rpx; display: flex; justify-content: space-between; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.stat { flex: 1; text-align: center; color: #64748B; font-size: 24rpx; }
.stat-num { display: block; color: #0F172A; font-size: 48rpx; font-weight: 900; margin-bottom: 10rpx; }
.stat-num.attention { color: #FF9500; }
.stat-num.small { font-size: 36rpx; }
.bottom { margin-bottom: 120rpx; }
```

- [ ] **Step 4: Run syntax check**

```bash
node --check pages/data/data.js
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add pages/data
git commit -m "feat: show basic blood pressure dashboard"
```

## Task 5: Records List Page

**Files:**
- Modify: `pages/records/records.js`
- Modify: `pages/records/records.wxml`
- Modify: `pages/records/records.wxss`
- Modify: `pages/records/records.json`

- [ ] **Step 1: Implement `pages/records/records.js`**

```js
const { groupByDate, formatTime } = require('../../utils/date')
const { getBPStatus } = require('../../utils/health-rules')

Page({
  data: {
    groups: [],
    loading: true,
  },

  onShow() {
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ groups: [], loading: false })
      return
    }
    const res = await wx.cloud.callFunction({
      name: 'getRecords',
      data: { familyId: app.globalData.familyId },
    })
    const records = (res.result.records || []).map(record => ({
      ...record,
      timeStr: formatTime(record.measuredAt),
      bpStatus: getBPStatus(record.systolic, record.diastolic),
    }))
    const groups = groupByDate(records).map((group, index) => ({ ...group, open: index === 0 }))
    this.setData({ groups, loading: false })
  },

  toggleGroup(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`groups[${index}].open`]: !this.data.groups[index].open })
  },

  onEdit(e) {
    const record = e.currentTarget.dataset.record
    wx.navigateTo({
      url: `/pages/add-record/add-record?record=${encodeURIComponent(JSON.stringify(record))}`,
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        const del = await wx.cloud.callFunction({ name: 'deleteRecord', data: { id } })
        if (!del.result.success) {
          wx.showToast({ title: del.result.error || '删除失败', icon: 'none' })
          return
        }
        this.loadRecords()
      },
    })
  },
})
```

- [ ] **Step 2: Implement `pages/records/records.wxml`**

```xml
<scroll-view scroll-y class="container">
  <view wx:if="{{!groups.length && !loading}}" class="empty">暂无记录</view>
  <view wx:for="{{groups}}" wx:key="date" class="group">
    <view class="group-head" bindtap="toggleGroup" data-index="{{index}}">
      <text class="date">{{item.date}}</text>
      <text class="count">{{item.items.length}}条</text>
    </view>
    <view wx:if="{{item.open}}">
      <view wx:for="{{item.items}}" wx:for-item="record" wx:key="_id" class="record">
        <view class="left">
          <text class="time">{{record.timeStr}}</text>
          <text wx:if="{{record.period}}" class="tag">{{record.period === 'morning' ? '晨测' : '晚测'}}</text>
        </view>
        <view class="main">
          <text class="bp" style="color:{{record.bpStatus.color}}">{{record.systolic}} / {{record.diastolic}} mmHg</text>
          <text class="hr">心率 {{record.heartRate}} bpm · {{record.bpStatus.label}}</text>
        </view>
        <view class="actions">
          <text class="edit" bindtap="onEdit" data-record="{{record}}">修改</text>
          <text class="delete" bindtap="onDelete" data-id="{{record._id}}">删除</text>
        </view>
      </view>
    </view>
  </view>
</scroll-view>
```

- [ ] **Step 3: Implement `pages/records/records.wxss`**

```css
.container { min-height: 100vh; background: #EEF3FB; padding: 32rpx; box-sizing: border-box; }
.empty { text-align: center; color: #64748B; font-size: 32rpx; margin-top: 160rpx; }
.group { margin-bottom: 24rpx; }
.group-head { min-height: 88rpx; background: #fff; border-radius: 24rpx 24rpx 0 0; display: flex; align-items: center; padding: 0 28rpx; gap: 12rpx; }
.date { font-size: 30rpx; color: #0F172A; font-weight: 800; }
.count { color: #94A3B8; font-size: 24rpx; }
.record { background: #fff; border-top: 2rpx solid #EEF3FB; padding: 24rpx 28rpx; display: flex; align-items: center; gap: 18rpx; }
.record:last-child { border-radius: 0 0 24rpx 24rpx; }
.left { width: 88rpx; text-align: center; }
.time { display: block; color: #0F172A; font-size: 26rpx; font-weight: 700; }
.tag { display: block; margin-top: 6rpx; color: #3182F7; background: #EAF2FF; border-radius: 999rpx; font-size: 20rpx; padding: 2rpx 8rpx; }
.main { flex: 1; }
.bp { display: block; font-size: 32rpx; font-weight: 800; }
.hr { display: block; margin-top: 6rpx; color: #64748B; font-size: 24rpx; }
.actions { display: flex; flex-direction: column; gap: 14rpx; font-size: 24rpx; }
.edit { color: #3182F7; }
.delete { color: #FF3B30; }
```

- [ ] **Step 4: Run syntax check**

```bash
node --check pages/records/records.js
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add pages/records
git commit -m "feat: add grouped records list"
```

## Task 6: Verification and DevTools Handoff

**Files:**
- No new files.

- [ ] **Step 1: Run local checks**

```bash
node scripts/verify-health-rules.js
node scripts/verify-record-utils.js
find . -path './.git' -prune -o -path './.worktrees' -prune -o -name '*.js' -print -exec node --check {} \;
node -e "const fs=require('fs'); for (const f of ['app.json','project.config.json','pages/data/data.json','pages/records/records.json','pages/add-record/add-record.json','pages/family/family.json','pages/join-family/join-family.json','pages/settings/settings.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json checks passed')"
```

Expected:

```text
health rule checks passed
record utility checks passed
json checks passed
```

All `node --check` invocations exit 0.

- [ ] **Step 2: Deploy cloud functions in WeChat DevTools**

Upload and deploy:

```text
getRecords
saveRecord
deleteRecord
```

Expected: each deployment succeeds.

- [ ] **Step 3: Manual app verification**

In the simulator:

- Family tab still shows the existing family.
- Data tab shows “还没有记录”.
- Tap “添加记录”.
- Enter `138 / 85 / 76`.
- Save succeeds.
- Data tab shows latest record and non-empty stats.
- “全部记录” shows the grouped record.
- Edit the record to `128 / 82 / 72`, save, and confirm list updates.
- Delete the record, confirm list returns to empty state.

## Plan Self-Review

- Spec coverage: This plan implements add/edit/delete records, basic data-page stats, notices, and grouped all-records list. Canvas charts, chart image export, and full report image export remain separate later phases.
- Placeholder scan: No `TODO` or `TBD` placeholders. DevTools deployment remains manual because it requires GUI access.
- Type consistency: Record fields match the spec: `familyId`, `systolic`, `diastolic`, `heartRate`, `measuredAt`, `period`, `recordedBy`, `createdAt`, `updatedAt`.
