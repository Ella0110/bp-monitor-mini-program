# Chart Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data-page Canvas charts for blood pressure and heart rate, with current-period chart image download.

**Architecture:** Keep chart preparation and drawing in focused utility modules so `pages/data/data.js` remains responsible for page state and user actions. Use native Mini Program Canvas 2D APIs for on-page charts and a hidden export canvas for saved images. No new cloud functions are needed; use records already loaded through `getRecords`.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JS, Canvas 2D API, existing `utils/health-rules.js`, Node smoke checks.

---

## Source Spec

Use `docs/superpowers/specs/2026-04-12-chart-download-design.md` as the source of truth.

## File Structure

- `utils/chart-data.js`: pure record-to-chart helpers, date labels, axis ranges, abnormal flags.
- `utils/canvas-charts.js`: Mini Program Canvas drawing functions for blood pressure, heart rate, and export layout.
- `scripts/verify-chart-data.js`: Node smoke checks for chart data helpers.
- `pages/data/data.js`: lifecycle hooks, chart drawing calls, download handlers.
- `pages/data/data.wxml`: visible chart canvas nodes, download buttons, hidden export canvas.
- `pages/data/data.wxss`: chart container, empty state, download button, hidden canvas styles.

## Task 1: Chart Data Helpers

**Files:**
- Create: `utils/chart-data.js`
- Create: `scripts/verify-chart-data.js`

- [ ] **Step 1: Create `utils/chart-data.js` with pure helper APIs**

Implement:

```js
const { getBPStatus, getHRStatus } = require('./health-rules')

function toDate(value) {
  return value instanceof Date ? value : new Date(value)
}

function labelDate(value) {
  const date = toDate(value)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function sortRecords(records) {
  return [...records].sort((a, b) => toDate(a.measuredAt) - toDate(b.measuredAt))
}

function roundRange(min, max, step) {
  return {
    min: Math.floor(min / step) * step,
    max: Math.ceil(max / step) * step,
  }
}

function buildBloodPressureChart(records) {
  const sorted = sortRecords(records)
  const values = sorted.flatMap(record => [Number(record.systolic), Number(record.diastolic), 135, 85])
  const range = values.length ? roundRange(Math.min(...values) - 8, Math.max(...values) + 8, 10) : { min: 60, max: 170 }
  return {
    records: sorted.map(record => {
      const bpStatus = getBPStatus(record.systolic, record.diastolic)
      return {
        id: record._id,
        label: labelDate(record.measuredAt),
        systolic: Number(record.systolic),
        diastolic: Number(record.diastolic),
        abnormal: Boolean(bpStatus.attention),
      }
    }),
    range,
    refs: [135, 85],
  }
}

function buildHeartRateChart(records) {
  const sorted = sortRecords(records)
  const values = sorted.map(record => Number(record.heartRate)).concat([60, 80])
  const range = values.length ? roundRange(Math.min(...values) - 8, Math.max(...values) + 8, 10) : { min: 40, max: 110 }
  return {
    records: sorted.map(record => {
      const hrStatus = getHRStatus(record.heartRate)
      return {
        id: record._id,
        label: labelDate(record.measuredAt),
        heartRate: Number(record.heartRate),
        abnormal: Boolean(hrStatus.attention),
      }
    }),
    range,
    refs: [60, 80],
  }
}

module.exports = {
  buildBloodPressureChart,
  buildHeartRateChart,
  labelDate,
  sortRecords,
}
```

- [ ] **Step 2: Create `scripts/verify-chart-data.js`**

Use:

```js
const assert = require('assert')
const { buildBloodPressureChart, buildHeartRateChart, labelDate } = require('../utils/chart-data')

const records = [
  { _id: 'r2', systolic: 148, diastolic: 92, heartRate: 86, measuredAt: '2026-04-12T20:00:00+08:00' },
  { _id: 'r1', systolic: 122, diastolic: 78, heartRate: 72, measuredAt: '2026-04-11T08:00:00+08:00' },
]

assert.strictEqual(labelDate('2026-04-12T20:00:00+08:00'), '4/12')

const bp = buildBloodPressureChart(records)
assert.deepStrictEqual(bp.refs, [135, 85])
assert.strictEqual(bp.records[0].id, 'r1')
assert.strictEqual(bp.records[1].abnormal, true)
assert.strictEqual(bp.range.min <= 85, true)
assert.strictEqual(bp.range.max >= 148, true)

const hr = buildHeartRateChart(records)
assert.deepStrictEqual(hr.refs, [60, 80])
assert.strictEqual(hr.records[0].abnormal, false)
assert.strictEqual(hr.records[1].abnormal, true)
assert.strictEqual(hr.range.min <= 60, true)
assert.strictEqual(hr.range.max >= 86, true)

console.log('chart data checks passed')
```

- [ ] **Step 3: Run the new smoke check**

Run:

```bash
node scripts/verify-chart-data.js
```

Expected:

```text
chart data checks passed
```

- [ ] **Step 4: Commit**

```bash
git add utils/chart-data.js scripts/verify-chart-data.js
git commit -m "feat: add chart data helpers"
```

## Task 2: Canvas Drawing Utilities

**Files:**
- Create: `utils/canvas-charts.js`

- [ ] **Step 1: Create `utils/canvas-charts.js`**

Implement exported functions:

```js
const COLORS = {
  systolic: '#3182F7',
  diastolic: '#2FB67C',
  heartRate: '#FF9500',
  abnormal: '#E53935',
  grid: '#E2E8F0',
  text: '#64748B',
  title: '#0F172A',
  ref: '#94A3B8',
}

function clear(ctx, width, height) {
  ctx.clearRect(0, 0, width, height)
  ctx.setFillStyle('#FFFFFF')
  ctx.fillRect(0, 0, width, height)
}

function valueToY(value, range, plot) {
  const span = range.max - range.min || 1
  return plot.bottom - ((value - range.min) / span) * (plot.bottom - plot.top)
}

function pointX(index, total, plot) {
  if (total <= 1) return (plot.left + plot.right) / 2
  return plot.left + (index / (total - 1)) * (plot.right - plot.left)
}

function drawGrid(ctx, chart, plot) {
  ctx.setStrokeStyle(COLORS.grid)
  ctx.setLineWidth(1)
  ;[0, 0.25, 0.5, 0.75, 1].forEach(ratio => {
    const y = plot.top + ratio * (plot.bottom - plot.top)
    ctx.beginPath()
    ctx.moveTo(plot.left, y)
    ctx.lineTo(plot.right, y)
    ctx.stroke()
  })
  ctx.setFillStyle(COLORS.text)
  ctx.setFontSize(10)
  chart.refs.forEach(ref => {
    const y = valueToY(ref, chart.range, plot)
    ctx.setLineDash([6, 4], 0)
    ctx.setStrokeStyle(COLORS.ref)
    ctx.beginPath()
    ctx.moveTo(plot.left, y)
    ctx.lineTo(plot.right, y)
    ctx.stroke()
    ctx.setLineDash([], 0)
    ctx.fillText(String(ref), 4, y + 3)
  })
}

function drawLabels(ctx, records, plot) {
  ctx.setFillStyle(COLORS.text)
  ctx.setFontSize(10)
  const step = records.length > 10 ? Math.ceil(records.length / 6) : 1
  records.forEach((record, index) => {
    if (index % step !== 0 && index !== records.length - 1) return
    ctx.fillText(record.label, pointX(index, records.length, plot) - 10, plot.bottom + 18)
  })
}

function drawLegend(ctx, items, x, y) {
  ctx.setFontSize(11)
  items.forEach(item => {
    ctx.setFillStyle(item.color)
    ctx.fillRect(x, y - 8, 12, 3)
    ctx.setFillStyle(COLORS.text)
    ctx.fillText(item.label, x + 18, y)
    x += item.width
  })
}

function drawLine(ctx, records, key, chart, plot, color) {
  if (!records.length) return
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(3)
  ctx.beginPath()
  records.forEach((record, index) => {
    const x = pointX(index, records.length, plot)
    const y = valueToY(record[key], chart.range, plot)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
  records.forEach((record, index) => {
    const x = pointX(index, records.length, plot)
    const y = valueToY(record[key], chart.range, plot)
    ctx.setFillStyle(record.abnormal ? COLORS.abnormal : color)
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()
  })
}

function drawBloodPressureChart(ctx, chart, width, height, options = {}) {
  clear(ctx, width, height)
  if (!chart.records.length) return
  const plot = { left: 32, right: width - 16, top: options.title ? 42 : 16, bottom: height - 36 }
  if (options.title) {
    ctx.setFillStyle(COLORS.title)
    ctx.setFontSize(18)
    ctx.fillText(options.title, 16, 24)
  }
  drawGrid(ctx, chart, plot)
  drawLine(ctx, chart.records, 'systolic', chart, plot, COLORS.systolic)
  drawLine(ctx, chart.records, 'diastolic', chart, plot, COLORS.diastolic)
  drawLabels(ctx, chart.records, plot)
  drawLegend(ctx, [
    { label: '高压', color: COLORS.systolic, width: 58 },
    { label: '低压', color: COLORS.diastolic, width: 58 },
    { label: '异常点', color: COLORS.abnormal, width: 72 },
  ], 16, height - 8)
}

function drawHeartRateChart(ctx, chart, width, height, options = {}) {
  clear(ctx, width, height)
  if (!chart.records.length) return
  const plot = { left: 32, right: width - 16, top: options.title ? 42 : 16, bottom: height - 36 }
  if (options.title) {
    ctx.setFillStyle(COLORS.title)
    ctx.setFontSize(18)
    ctx.fillText(options.title, 16, 24)
  }
  drawGrid(ctx, chart, plot)
  const barWidth = Math.max(6, Math.min(18, (plot.right - plot.left) / Math.max(chart.records.length * 1.8, 1)))
  chart.records.forEach((record, index) => {
    const x = pointX(index, chart.records.length, plot) - barWidth / 2
    const y = valueToY(record.heartRate, chart.range, plot)
    ctx.setFillStyle(record.abnormal ? COLORS.abnormal : COLORS.heartRate)
    ctx.fillRect(x, y, barWidth, plot.bottom - y)
  })
  drawLabels(ctx, chart.records, plot)
  drawLegend(ctx, [
    { label: '心率', color: COLORS.heartRate, width: 58 },
    { label: '异常', color: COLORS.abnormal, width: 58 },
  ], 16, height - 8)
}

module.exports = {
  drawBloodPressureChart,
  drawHeartRateChart,
}
```

- [ ] **Step 2: Run syntax check**

Run:

```bash
node --check utils/canvas-charts.js
```

Expected: exit code 0 and no output.

- [ ] **Step 3: Commit**

```bash
git add utils/canvas-charts.js
git commit -m "feat: add canvas chart drawing helpers"
```

## Task 3: Data Page Chart Rendering

**Files:**
- Modify: `pages/data/data.js`
- Modify: `pages/data/data.wxml`
- Modify: `pages/data/data.wxss`

- [ ] **Step 1: Add chart state and imports in `pages/data/data.js`**

Add:

```js
const { buildBloodPressureChart, buildHeartRateChart } = require('../../utils/chart-data')
const { drawBloodPressureChart, drawHeartRateChart } = require('../../utils/canvas-charts')
```

Extend page data:

```js
bpChart: null,
hrChart: null,
hasChartRecords: false,
```

- [ ] **Step 2: Build chart data after records load**

After `const records = res.result.records || []`, add:

```js
const bpChart = buildBloodPressureChart(records)
const hrChart = buildHeartRateChart(records)
```

In `setData`, add:

```js
bpChart,
hrChart,
hasChartRecords: records.length > 0,
```

After `setData`, call:

```js
this.drawCharts()
```

When no family exists, set:

```js
bpChart: null,
hrChart: null,
hasChartRecords: false,
```

- [ ] **Step 3: Add draw helpers to `pages/data/data.js`**

Add methods:

```js
drawCharts() {
  if (!this.data.hasChartRecords) return
  wx.nextTick(() => {
    this.drawChart('#bpChart', 'bp')
    this.drawChart('#hrChart', 'hr')
  })
},

drawChart(selector, type) {
  const query = wx.createSelectorQuery()
  query.select(selector)
    .fields({ node: true, size: true })
    .exec((res) => {
      const canvas = res[0] && res[0].node
      if (!canvas) return
      const width = res[0].width
      const height = res[0].height
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      if (type === 'bp') drawBloodPressureChart(ctx, this.data.bpChart, width, height)
      if (type === 'hr') drawHeartRateChart(ctx, this.data.hrChart, width, height)
      ctx.draw && ctx.draw()
    })
},
```

- [ ] **Step 4: Add canvas nodes in `pages/data/data.wxml`**

Under the blood pressure stat card, add:

```xml
<view class="chart-card">
  <canvas wx:if="{{hasChartRecords}}" id="bpChart" type="2d" class="chart-canvas"></canvas>
  <view wx:else class="chart-empty">当前周期暂无记录</view>
  <button class="download" bindtap="onDownloadBPChart">下载图表</button>
</view>
```

Under the heart rate stat card, add:

```xml
<view class="chart-card bottom">
  <canvas wx:if="{{hasChartRecords}}" id="hrChart" type="2d" class="chart-canvas"></canvas>
  <view wx:else class="chart-empty">当前周期暂无记录</view>
  <button class="download" bindtap="onDownloadHRChart">下载图表</button>
</view>
<canvas id="exportChart" type="2d" class="export-canvas"></canvas>
```

- [ ] **Step 5: Add styles in `pages/data/data.wxss`**

Add:

```css
.chart-card { margin: -12rpx 32rpx 32rpx; background: #fff; border-radius: 32rpx; padding: 24rpx; box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09); }
.chart-canvas { width: 100%; height: 360rpx; display: block; }
.chart-empty { height: 220rpx; display: flex; align-items: center; justify-content: center; color: #64748B; font-size: 28rpx; }
.download { min-height: 76rpx; margin-top: 18rpx; background: #3182F7; color: #fff; border-radius: 16rpx; font-size: 28rpx; font-weight: 800; }
.export-canvas { position: fixed; left: -9999px; top: -9999px; width: 750px; height: 900px; }
```

- [ ] **Step 6: Run checks**

Run:

```bash
node --check pages/data/data.js
node -e "JSON.parse(require('fs').readFileSync('pages/data/data.json','utf8')); console.log('data json ok')"
```

Expected:

```text
data json ok
```

- [ ] **Step 7: Commit**

```bash
git add pages/data/data.js pages/data/data.wxml pages/data/data.wxss
git commit -m "feat: render charts on data page"
```

## Task 4: Chart Download Handlers

**Files:**
- Modify: `pages/data/data.js`

- [ ] **Step 1: Add download handler methods**

Add:

```js
onDownloadBPChart() {
  this.downloadChart('bp')
},

onDownloadHRChart() {
  this.downloadChart('hr')
},
```

- [ ] **Step 2: Add `downloadChart` implementation**

Add:

```js
downloadChart(type) {
  if (!this.data.hasChartRecords) {
    wx.showToast({ title: '当前周期暂无可下载图表', icon: 'none' })
    return
  }
  const chart = type === 'bp' ? this.data.bpChart : this.data.hrChart
  const title = type === 'bp' ? '血压趋势图' : '心率趋势图'
  const query = wx.createSelectorQuery()
  query.select('#exportChart')
    .fields({ node: true, size: true })
    .exec((res) => {
      const canvas = res[0] && res[0].node
      if (!canvas) {
        wx.showToast({ title: '图表生成失败', icon: 'none' })
        return
      }
      const width = 750
      const height = 900
      const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      canvas.width = width * dpr
      canvas.height = height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      if (type === 'bp') drawBloodPressureChart(ctx, chart, width, height - 80, { title: `${title}（${this.data.period}）` })
      if (type === 'hr') drawHeartRateChart(ctx, chart, width, height - 80, { title: `${title}（${this.data.period}）` })
      ctx.setFillStyle('#64748B')
      ctx.setFontSize(22)
      ctx.fillText('仅供健康记录与就诊沟通参考', 24, height - 28)
      wx.canvasToTempFilePath({
        canvas,
        success: file => this.saveChartImage(file.tempFilePath),
        fail: () => wx.showToast({ title: '图表生成失败', icon: 'none' }),
      })
    })
},
```

- [ ] **Step 3: Add `saveChartImage` permission handling**

Add:

```js
saveChartImage(filePath) {
  wx.saveImageToPhotosAlbum({
    filePath,
    success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
    fail: (err) => {
      if (err.errMsg && err.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要相册权限',
          content: '请允许保存到相册后再下载图表。',
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

- [ ] **Step 4: Run checks**

Run:

```bash
node --check pages/data/data.js
```

Expected: exit code 0 and no output.

- [ ] **Step 5: Commit**

```bash
git add pages/data/data.js
git commit -m "feat: download chart images"
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
```

Expected:

```text
health rule checks passed
record utility checks passed
chart data checks passed
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
node -e "const fs=require('fs'); for (const f of ['app.json','project.config.json','pages/data/data.json','pages/records/records.json','pages/add-record/add-record.json','pages/family/family.json','pages/join-family/join-family.json','pages/settings/settings.json']) JSON.parse(fs.readFileSync(f,'utf8')); console.log('json checks passed')"
```

Expected:

```text
json checks passed
```

- [ ] **Step 4: WeChat DevTools manual checks**

After local merge, ask the user to compile in WeChat DevTools and verify:

- 7/30/90 天切换后血压和心率图表刷新。
- 血压图显示高压/低压两条线、135/85 参考线、异常红点。
- 心率图显示柱状图、60/80 参考线、异常红柱。
- 无记录时显示空状态且控制台不报错。
- 血压“下载图表”和心率“下载图表”能保存图片，或在未授权时弹出设置引导。

- [ ] **Step 5: Use finishing branch workflow**

After all checks pass, use `finishing-a-development-branch` to choose merge/push/keep/discard.
