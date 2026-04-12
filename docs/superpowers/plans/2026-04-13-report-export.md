# Report Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a family-page report entry, report preview page, and save-to-album image export for blood pressure and heart rate reports.

**Architecture:** Reuse existing `getFamily` and `getRecords` cloud functions; do not add backend work. Keep report data preparation in a pure utility module and report Canvas drawing in a separate utility module so the page handles loading, period switching, and user actions only. Reuse `utils/chart-data.js`, `utils/canvas-charts.js`, and `utils/health-rules.js` for consistent statistics and chart rules.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JS, Canvas 2D API, CloudBase cloud function calls, Node smoke checks.

---

## Source Spec

Use `docs/superpowers/specs/2026-04-13-report-export-design.md` as the source of truth.

## File Structure

- `utils/report-data.js`: pure helpers for report summary, profile display, latest record rows, and period labels.
- `utils/report-canvas.js`: Canvas drawing for the full report image and preview-friendly report blocks.
- `scripts/verify-report-data.js`: Node smoke checks for report data helpers.
- `pages/report/report.js`: load family/records, period switching, preview data, save report image.
- `pages/report/report.wxml`: report preview UI and hidden export canvas.
- `pages/report/report.wxss`: report preview layout.
- `pages/report/report.json`: navigation title.
- `app.json`: register `pages/report/report`.
- `pages/family/family.js`: navigate to report page.
- `pages/family/family.wxml`: bind the existing report card to navigation.

## Task 1: Report Data Helpers

**Files:**
- Create: `utils/report-data.js`
- Create: `scripts/verify-report-data.js`

- [ ] **Step 1: Write failing smoke check in `scripts/verify-report-data.js`**

Create the file:

```js
const assert = require('assert')
const { buildReportData, periodTitle } = require('../utils/report-data')

const family = {
  displayName: '家庭健康记录',
  profile: { name: '妈妈' },
}

const records = [
  { _id: 'r3', systolic: 150, diastolic: 92, heartRate: 86, measuredAt: '2026-04-13T20:00:00+08:00' },
  { _id: 'r1', systolic: 122, diastolic: 78, heartRate: 72, measuredAt: '2026-04-11T08:00:00+08:00' },
  { _id: 'r2', systolic: 132, diastolic: 82, heartRate: 76, measuredAt: '2026-04-12T08:00:00+08:00' },
]

assert.strictEqual(periodTitle('7天'), '近7天')
assert.strictEqual(periodTitle('30天'), '近30天')

const report = buildReportData({ family, records, period: '30天', generatedAt: new Date('2026-04-13T21:00:00+08:00') })

assert.strictEqual(report.title, '血压心率就诊报告')
assert.strictEqual(report.familyName, '家庭健康记录')
assert.strictEqual(report.profileName, '妈妈')
assert.strictEqual(report.periodTitle, '近30天')
assert.strictEqual(report.totalCount, 3)
assert.deepStrictEqual(report.avg, { systolic: 135, diastolic: 84, heartRate: 78 })
assert.strictEqual(report.stats.bp.attention, 1)
assert.strictEqual(report.stats.hr.attention, 1)
assert.strictEqual(report.recentRecords.length, 3)
assert.strictEqual(report.recentRecords[0].id, 'r3')
assert.strictEqual(report.recentRecords[0].bpText, '150/92 mmHg')
assert.strictEqual(report.recentRecords[0].heartRateText, '86 bpm')
assert.strictEqual(report.bpChart.records.length, 3)
assert.strictEqual(report.hrChart.records.length, 3)

const empty = buildReportData({ family: {}, records: [], period: '90天', generatedAt: new Date('2026-04-13T21:00:00+08:00') })
assert.strictEqual(empty.familyName, '家庭健康记录')
assert.strictEqual(empty.profileName, '未设置')
assert.strictEqual(empty.totalCount, 0)
assert.strictEqual(empty.recentRecords.length, 0)

console.log('report data checks passed')
```

- [ ] **Step 2: Run smoke check and confirm RED**

Run:

```bash
node scripts/verify-report-data.js
```

Expected failure:

```text
Error: Cannot find module '../utils/report-data'
```

- [ ] **Step 3: Implement `utils/report-data.js`**

Create:

```js
const { calcAverage, countReferenceStats, getBPStatus, getHRStatus } = require('./health-rules')
const { formatDateTime } = require('./date')
const { buildBloodPressureChart, buildHeartRateChart } = require('./chart-data')

const REPORT_TITLE = '血压心率就诊报告'
const DISCLAIMER = '本报告仅供健康记录与就诊沟通参考，不作为诊断、治疗或用药依据。个体情况存在差异，请以医生诊疗结果及医嘱为准。'

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

function periodTitle(period) {
  return `近${String(period || '30天').replace('天', '')}天`
}

function sortDesc(records) {
  return [...records].sort((a, b) => toDate(b.measuredAt) - toDate(a.measuredAt))
}

function buildRecentRecords(records) {
  return sortDesc(records).slice(0, 10).map(record => {
    const bpStatus = getBPStatus(record.systolic, record.diastolic)
    const hrStatus = getHRStatus(record.heartRate)
    return {
      id: record._id,
      time: formatDateTime(record.measuredAt),
      bpText: `${record.systolic}/${record.diastolic} mmHg`,
      heartRateText: `${record.heartRate} bpm`,
      bpStatus: bpStatus.label,
      hrStatus: hrStatus.label,
    }
  })
}

function buildReportData({ family = {}, records = [], period = '30天', generatedAt = new Date() }) {
  const safeRecords = records || []
  const profile = family.profile || {}
  return {
    title: REPORT_TITLE,
    familyName: family.displayName || '家庭健康记录',
    profileName: profile.name || '未设置',
    period,
    periodTitle: periodTitle(period),
    generatedAt: formatDateTime(generatedAt),
    totalCount: safeRecords.length,
    stats: countReferenceStats(safeRecords, {}),
    avg: calcAverage(safeRecords),
    bpChart: buildBloodPressureChart(safeRecords),
    hrChart: buildHeartRateChart(safeRecords),
    recentRecords: buildRecentRecords(safeRecords),
    disclaimer: DISCLAIMER,
  }
}

module.exports = {
  DISCLAIMER,
  REPORT_TITLE,
  buildRecentRecords,
  buildReportData,
  periodTitle,
}
```

- [ ] **Step 4: Run smoke check and syntax check**

Run:

```bash
node scripts/verify-report-data.js
node --check utils/report-data.js
node --check scripts/verify-report-data.js
```

Expected:

```text
report data checks passed
```

- [ ] **Step 5: Commit**

```bash
git add utils/report-data.js scripts/verify-report-data.js
git commit -m "feat: add report data helpers"
```

## Task 2: Report Canvas Utility

**Files:**
- Modify: `utils/canvas-charts.js`
- Create: `utils/report-canvas.js`

- [ ] **Step 1: Update `utils/canvas-charts.js` to support embedded chart drawing**

The existing `drawBloodPressureChart` and `drawHeartRateChart` clear the whole canvas. Reports need to draw charts inside a larger report image, so add this helper after `clear()`:

```js
function drawChartArea(ctx, width, height, options, draw) {
  const x = options.x || 0
  const y = options.y || 0
  ctx.clearRect(x, y, width, height)
  setFill(ctx, COLORS.background)
  ctx.fillRect(x, y, width, height)
  if (ctx.save) ctx.save()
  if (x || y) ctx.translate(x, y)
  draw()
  if (ctx.restore) ctx.restore()
}
```

Then replace `drawBloodPressureChart` with:

```js
function drawBloodPressureChart(ctx, chart, width, height, options = {}) {
  drawChartArea(ctx, width, height, options, () => {
    if (!chart || !chart.records.length) return

    const plot = { left: 32, right: width - 16, top: options.title ? 42 : 16, bottom: height - 36 }
    drawTitle(ctx, options.title)
    drawGrid(ctx, chart, plot)
    drawLine(ctx, chart.records, 'systolic', chart, plot, COLORS.systolic)
    drawLine(ctx, chart.records, 'diastolic', chart, plot, COLORS.diastolic)
    drawLabels(ctx, chart.records, plot)
    drawLegend(ctx, [
      { label: '高压', color: COLORS.systolic, width: 58 },
      { label: '低压', color: COLORS.diastolic, width: 58 },
      { label: '异常点', color: COLORS.abnormal, width: 72 },
    ], 16, height - 8)
  })
}
```

Replace `drawHeartRateChart` with:

```js
function drawHeartRateChart(ctx, chart, width, height, options = {}) {
  drawChartArea(ctx, width, height, options, () => {
    if (!chart || !chart.records.length) return

    const plot = { left: 32, right: width - 16, top: options.title ? 42 : 16, bottom: height - 36 }
    drawTitle(ctx, options.title)
    drawGrid(ctx, chart, plot)
    const barWidth = Math.max(6, Math.min(18, (plot.right - plot.left) / Math.max(chart.records.length * 1.8, 1)))
    chart.records.forEach((record, index) => {
      const x = pointX(index, chart.records.length, plot) - barWidth / 2
      const y = valueToY(record.heartRate, chart.range, plot)
      setFill(ctx, record.abnormal ? COLORS.abnormal : COLORS.heartRate)
      ctx.fillRect(x, y, barWidth, plot.bottom - y)
    })
    drawLabels(ctx, chart.records, plot)
    drawLegend(ctx, [
      { label: '心率', color: COLORS.heartRate, width: 58 },
      { label: '异常', color: COLORS.abnormal, width: 58 },
    ], 16, height - 8)
  })
}
```

This keeps the existing page chart API unchanged while allowing report rendering to pass `x` and `y`.

- [ ] **Step 2: Create `utils/report-canvas.js`**

Create:

```js
const { drawBloodPressureChart, drawHeartRateChart } = require('./canvas-charts')

const COLORS = {
  background: '#FFFFFF',
  title: '#0F172A',
  text: '#334155',
  muted: '#64748B',
  line: '#E2E8F0',
  primary: '#3182F7',
  warning: '#E53935',
}

function setFill(ctx, color) {
  if (ctx.setFillStyle) ctx.setFillStyle(color)
  else ctx.fillStyle = color
}

function setStroke(ctx, color) {
  if (ctx.setStrokeStyle) ctx.setStrokeStyle(color)
  else ctx.strokeStyle = color
}

function setFont(ctx, size, weight = '400') {
  if (ctx.setFontSize) ctx.setFontSize(size)
  else ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, sans-serif`
}

function text(ctx, value, x, y, size = 24, color = COLORS.text, weight = '400') {
  setFill(ctx, color)
  setFont(ctx, size, weight)
  ctx.fillText(String(value), x, y)
}

function line(ctx, x1, y1, x2, y2) {
  setStroke(ctx, COLORS.line)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawWrappedText(ctx, value, x, y, maxWidth, lineHeight, size, color) {
  const chars = String(value).split('')
  let lineText = ''
  chars.forEach(char => {
    const next = lineText + char
    if (ctx.measureText(next).width > maxWidth && lineText) {
      text(ctx, lineText, x, y, size, color)
      y += lineHeight
      lineText = char
    } else {
      lineText = next
    }
  })
  if (lineText) text(ctx, lineText, x, y, size, color)
  return y + lineHeight
}

function drawEmptyChart(ctx, label, x, y, width, height) {
  setStroke(ctx, COLORS.line)
  ctx.strokeRect(x, y, width, height)
  text(ctx, label, x + width / 2 - 84, y + height / 2, 24, COLORS.muted)
}

function reportImageHeight(report) {
  const recordHeight = report.recentRecords.length ? report.recentRecords.length * 44 : 44
  return 1120 + recordHeight
}

function drawSummary(ctx, report, x, y) {
  const avgBp = report.avg.systolic === '--' ? '--' : `${report.avg.systolic}/${report.avg.diastolic}`
  const items = [
    ['记录次数', `${report.totalCount}`],
    ['血压均值', avgBp],
    ['心率均值', `${report.avg.heartRate}`],
    ['血压需关注', `${report.stats.bp.attention}`],
    ['心率需关注', `${report.stats.hr.attention}`],
  ]
  items.forEach((item, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const left = x + col * 330
    const top = y + row * 72
    text(ctx, item[1], left, top, 32, index >= 3 && Number(item[1]) > 0 ? COLORS.warning : COLORS.title, '700')
    text(ctx, item[0], left, top + 30, 20, COLORS.muted)
  })
}

function drawReportImage(ctx, report, width, height) {
  setFill(ctx, COLORS.background)
  ctx.fillRect(0, 0, width, height)

  let y = 48
  text(ctx, report.title, 32, y, 36, COLORS.title, '700')
  y += 46
  text(ctx, `${report.familyName} · ${report.profileName}`, 32, y, 24, COLORS.text)
  y += 34
  text(ctx, `${report.periodTitle} · 生成时间 ${report.generatedAt}`, 32, y, 22, COLORS.muted)
  y += 38
  line(ctx, 32, y, width - 32, y)
  y += 56

  text(ctx, '摘要', 32, y, 28, COLORS.title, '700')
  y += 48
  drawSummary(ctx, report, 32, y)
  y += 240

  text(ctx, '血压趋势', 32, y, 28, COLORS.title, '700')
  y += 18
  if (report.bpChart.records.length) drawBloodPressureChart(ctx, report.bpChart, width - 64, 260, { title: '', x: 32, y })
  else drawEmptyChart(ctx, '当前周期暂无记录', 32, y, width - 64, 220)
  y += 288

  text(ctx, '心率趋势', 32, y, 28, COLORS.title, '700')
  y += 18
  if (report.hrChart.records.length) drawHeartRateChart(ctx, report.hrChart, width - 64, 260, { title: '', x: 32, y })
  else drawEmptyChart(ctx, '当前周期暂无记录', 32, y, width - 64, 220)
  y += 288

  text(ctx, '最近记录', 32, y, 28, COLORS.title, '700')
  y += 42
  if (!report.recentRecords.length) {
    text(ctx, '当前周期暂无记录', 32, y, 22, COLORS.muted)
    y += 48
  } else {
    report.recentRecords.forEach(record => {
      text(ctx, record.time, 32, y, 20, COLORS.muted)
      text(ctx, `${record.bpText} · ${record.heartRateText}`, 260, y, 22, COLORS.text, '700')
      y += 26
      text(ctx, `血压${record.bpStatus} · 心率${record.hrStatus}`, 260, y, 20, COLORS.muted)
      y += 26
    })
  }

  line(ctx, 32, y, width - 32, y)
  y += 40
  drawWrappedText(ctx, report.disclaimer, 32, y, width - 64, 30, 20, COLORS.muted)
}

module.exports = {
  drawReportImage,
  reportImageHeight,
}
```

- [ ] **Step 3: Run syntax check**

Run:

```bash
node --check utils/canvas-charts.js
node --check utils/report-canvas.js
```

Expected: exit code 0 and no output.

- [ ] **Step 4: Commit**

```bash
git add utils/canvas-charts.js utils/report-canvas.js
git commit -m "feat: add report canvas renderer"
```

## Task 3: Report Page Skeleton and Data Loading

**Files:**
- Create: `pages/report/report.js`
- Create: `pages/report/report.wxml`
- Create: `pages/report/report.wxss`
- Create: `pages/report/report.json`
- Modify: `app.json`

- [ ] **Step 1: Register report page in `app.json`**

Add `pages/report/report` after `pages/records/records`:

```json
{
  "pages": [
    "pages/data/data",
    "pages/records/records",
    "pages/report/report",
    "pages/add-record/add-record",
    "pages/family/family",
    "pages/join-family/join-family",
    "pages/settings/settings"
  ]
}
```

Keep the existing `tabBar`, `window`, and `usingComponents` unchanged.

- [ ] **Step 2: Create `pages/report/report.json`**

```json
{
  "navigationBarTitleText": "就诊报告"
}
```

- [ ] **Step 3: Create `pages/report/report.js`**

```js
const { daysAgo } = require('../../utils/date')
const { buildReportData } = require('../../utils/report-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')
const { drawReportImage, reportImageHeight } = require('../../utils/report-canvas')

const PERIODS = { '7天': 7, '30天': 30, '90天': 90 }

Page({
  data: {
    period: '30天',
    periods: ['7天', '30天', '90天'],
    family: null,
    records: [],
    report: null,
    loading: true,
    error: '',
  },

  onLoad() {
    this.loadReport()
  },

  async loadReport() {
    const app = getApp()
    if (!app.globalData.familyId) {
      this.setData({ loading: false, error: '请先创建或加入家庭组' })
      return
    }

    this.setData({ loading: true, error: '' })
    try {
      const days = PERIODS[this.data.period] || 30
      const familyRes = await wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      })
      const recordsRes = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
      })
      const family = familyRes.result.family || {}
      const records = recordsRes.result.records || []
      const report = buildReportData({ family, records, period: this.data.period })
      this.setData({ family, records, report, loading: false })
      this.drawPreviewCharts()
    } catch (err) {
      console.error('Load report failed', err)
      wx.showToast({ title: '报告加载失败', icon: 'none' })
      this.setData({ loading: false, error: '报告加载失败' })
    }
  },

  onPeriodChange(e) {
    this.setData({ period: e.currentTarget.dataset.period })
    this.loadReport()
  },

  drawPreviewCharts() {
    if (!this.data.report) return
    wx.nextTick(() => {
      this.drawPreviewChart('#reportBPChart', 'bp')
      this.drawPreviewChart('#reportHRChart', 'hr')
    })
  },

  drawPreviewChart(selector, type) {
    const query = wx.createSelectorQuery()
    query.select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas || !this.data.report) return
        const width = result.width
        const height = result.height
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        if (type === 'bp') drawBloodPressureChart(ctx, this.data.report.bpChart, width, height)
        if (type === 'hr') drawHeartRateChart(ctx, this.data.report.hrChart, width, height)
      })
  },

  onSaveReport() {
    wx.showToast({ title: '报告保存建设中', icon: 'none' })
  },
})
```

- [ ] **Step 4: Create `pages/report/report.wxml`**

```xml
<scroll-view scroll-y class="container">
  <view class="periods">
    <view wx:for="{{periods}}" wx:key="*this" class="period {{period===item?'active':''}}" bindtap="onPeriodChange" data-period="{{item}}">{{item}}</view>
  </view>

  <view wx:if="{{error}}" class="empty">{{error}}</view>

  <view wx:if="{{report}}" class="report-card">
    <text class="title">{{report.title}}</text>
    <text class="meta">{{report.familyName}} · {{report.profileName}}</text>
    <text class="meta">{{report.periodTitle}} · 生成时间 {{report.generatedAt}}</text>

    <view class="section">
      <text class="section-title">摘要</text>
      <view class="summary-grid">
        <view class="summary-item"><text class="summary-value">{{report.totalCount}}</text><text class="summary-label">记录次数</text></view>
        <view class="summary-item"><text class="summary-value">{{report.avg.systolic}}/{{report.avg.diastolic}}</text><text class="summary-label">血压均值</text></view>
        <view class="summary-item"><text class="summary-value">{{report.avg.heartRate}}</text><text class="summary-label">心率均值</text></view>
        <view class="summary-item"><text class="summary-value warn">{{report.stats.bp.attention}}</text><text class="summary-label">血压需关注</text></view>
        <view class="summary-item"><text class="summary-value warn">{{report.stats.hr.attention}}</text><text class="summary-label">心率需关注</text></view>
      </view>
    </view>

    <view class="section">
      <text class="section-title">血压趋势</text>
      <canvas wx:if="{{report.bpChart.records.length}}" id="reportBPChart" type="2d" class="chart"></canvas>
      <view wx:else class="chart-empty">当前周期暂无记录</view>
    </view>

    <view class="section">
      <text class="section-title">心率趋势</text>
      <canvas wx:if="{{report.hrChart.records.length}}" id="reportHRChart" type="2d" class="chart"></canvas>
      <view wx:else class="chart-empty">当前周期暂无记录</view>
    </view>

    <view class="section">
      <text class="section-title">最近记录</text>
      <view wx:if="{{!report.recentRecords.length}}" class="record-empty">当前周期暂无记录</view>
      <view wx:for="{{report.recentRecords}}" wx:key="id" class="record-row">
        <text class="record-time">{{item.time}}</text>
        <text class="record-main">{{item.bpText}} · {{item.heartRateText}}</text>
        <text class="record-status">血压{{item.bpStatus}} · 心率{{item.hrStatus}}</text>
      </view>
    </view>

    <view class="disclaimer">{{report.disclaimer}}</view>
  </view>

  <button wx:if="{{report}}" class="save" bindtap="onSaveReport">保存报告图片</button>
  <canvas id="reportExportCanvas" type="2d" class="export-canvas"></canvas>
</scroll-view>
```

- [ ] **Step 5: Create `pages/report/report.wxss`**

```css
.container { min-height: 100vh; background: #EEF3FB; padding: 28rpx 32rpx 120rpx; box-sizing: border-box; }
.periods { display: flex; background: #EAF2FF; border-radius: 40rpx; padding: 6rpx; margin-bottom: 28rpx; }
.period { flex: 1; text-align: center; padding: 14rpx 0; color: #3182F7; border-radius: 34rpx; font-size: 28rpx; font-weight: 800; }
.period.active { background: #3182F7; color: #fff; }
.empty { margin-top: 160rpx; text-align: center; color: #64748B; font-size: 32rpx; }
.report-card { background: #fff; border-radius: 32rpx; padding: 32rpx; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.title { display: block; color: #0F172A; font-size: 40rpx; font-weight: 900; margin-bottom: 18rpx; }
.meta { display: block; color: #64748B; font-size: 26rpx; margin-top: 8rpx; }
.section { margin-top: 40rpx; }
.section-title { display: block; color: #0F172A; font-size: 32rpx; font-weight: 900; margin-bottom: 20rpx; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18rpx; }
.summary-item { background: #F8FAFC; border-radius: 20rpx; padding: 22rpx; }
.summary-value { display: block; color: #0F172A; font-size: 34rpx; font-weight: 900; }
.summary-value.warn { color: #E53935; }
.summary-label { display: block; color: #64748B; font-size: 24rpx; margin-top: 6rpx; }
.chart { width: 100%; height: 360rpx; display: block; }
.chart-empty { height: 220rpx; display: flex; align-items: center; justify-content: center; color: #64748B; font-size: 28rpx; background: #F8FAFC; border-radius: 20rpx; }
.record-empty { color: #64748B; font-size: 28rpx; padding: 20rpx 0; }
.record-row { border-top: 2rpx solid #EEF3FB; padding: 20rpx 0; }
.record-time { display: block; color: #64748B; font-size: 24rpx; }
.record-main { display: block; color: #0F172A; font-size: 30rpx; font-weight: 800; margin-top: 6rpx; }
.record-status { display: block; color: #64748B; font-size: 24rpx; margin-top: 6rpx; }
.disclaimer { margin-top: 40rpx; color: #64748B; font-size: 24rpx; line-height: 1.7; }
.save { min-height: 88rpx; margin-top: 28rpx; background: #3182F7; color: #fff; border-radius: 16rpx; font-size: 30rpx; font-weight: 900; }
.export-canvas { position: fixed; left: -9999px; top: -9999px; width: 750px; height: 1400px; }
```

- [ ] **Step 6: Run checks**

Run:

```bash
node --check pages/report/report.js
node -e "const fs=require('fs'); for (const f of ['app.json','pages/report/report.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('report page json ok')"
```

Expected:

```text
report page json ok
```

- [ ] **Step 7: Commit**

```bash
git add app.json pages/report
git commit -m "feat: add report preview page"
```

## Task 4: Family Entry

**Files:**
- Modify: `pages/family/family.js`
- Modify: `pages/family/family.wxml`

- [ ] **Step 1: Add navigation method to `pages/family/family.js`**

Add before `onShareAppMessage()`:

```js
onReportTap() {
  wx.navigateTo({ url: '/pages/report/report' })
},
```

- [ ] **Step 2: Bind existing report card in `pages/family/family.wxml`**

Change:

```xml
<view class="action-card">
```

to:

```xml
<view class="action-card" bindtap="onReportTap">
```

- [ ] **Step 3: Run syntax check**

Run:

```bash
node --check pages/family/family.js
```

Expected: exit code 0 and no output.

- [ ] **Step 4: Commit**

```bash
git add pages/family/family.js pages/family/family.wxml
git commit -m "feat: link family report entry"
```

## Task 5: Save Report Image

**Files:**
- Modify: `pages/report/report.js`

- [ ] **Step 1: Replace placeholder `onSaveReport` in `pages/report/report.js`**

Replace:

```js
onSaveReport() {
  wx.showToast({ title: '报告保存建设中', icon: 'none' })
},
```

with:

```js
onSaveReport() {
  if (!this.data.report) {
    wx.showToast({ title: '报告生成失败', icon: 'none' })
    return
  }

  const query = wx.createSelectorQuery()
  query.select('#reportExportCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      const result = res[0]
      const canvas = result && result.node
      if (!canvas) {
        wx.showToast({ title: '报告生成失败', icon: 'none' })
        return
      }

      const width = 750
      const height = reportImageHeight(this.data.report)
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      drawReportImage(ctx, this.data.report, width, height)

      wx.canvasToTempFilePath({
        canvas,
        destWidth: width * dpr,
        destHeight: height * dpr,
        success: file => this.saveReportImage(file.tempFilePath),
        fail: () => wx.showToast({ title: '报告生成失败', icon: 'none' }),
      })
    })
},

saveReportImage(filePath) {
  wx.saveImageToPhotosAlbum({
    filePath,
    success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
    fail: (err) => {
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请允许保存到相册后再保存报告图片。',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) wx.openSetting()
          },
        })
        return
      }
      wx.showToast({ title: '保存失败', icon: 'none' })
    },
  })
},
```

- [ ] **Step 2: Run syntax check**

Run:

```bash
node --check pages/report/report.js
```

Expected: exit code 0 and no output.

- [ ] **Step 3: Commit**

```bash
git add pages/report/report.js
git commit -m "feat: save report image"
```

## Task 6: Verification and Handoff

**Files:**
- Verify only.

- [ ] **Step 1: Run smoke checks**

Run:

```bash
node scripts/verify-health-rules.js
node scripts/verify-record-utils.js
node scripts/verify-chart-data.js
node scripts/verify-report-data.js
```

Expected:

```text
health rule checks passed
record utility checks passed
chart data checks passed
report data checks passed
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
node -e "const fs=require('fs'); for (const f of ['app.json','project.config.json','pages/data/data.json','pages/records/records.json','pages/report/report.json','pages/add-record/add-record.json','pages/family/family.json','pages/join-family/join-family.json','pages/settings/settings.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json checks passed')"
```

Expected:

```text
json checks passed
```

- [ ] **Step 4: WeChat DevTools manual checks**

After merge, ask the user to compile in WeChat DevTools and verify:

- 家庭页 `📄 生成就诊报告` 能进入报告预览页。
- 报告页默认选择 `30天`。
- 7/30/90 天切换后摘要、图表和最近记录刷新。
- 有记录时报告显示均值、需关注次数、血压图、心率图和最近记录。
- 无记录时报告页不报错，图表区域显示空状态。
- `保存报告图片` 能保存到相册，或在未授权时弹出设置引导。

- [ ] **Step 5: Use finishing branch workflow**

After all checks pass, use `finishing-a-development-branch` to choose merge/push/keep/discard.
