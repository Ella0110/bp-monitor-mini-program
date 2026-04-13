# 血压心率小程序 — 实施计划

> 版本：v1.0 | 日期：2026-04-14
> 前置阅读：`docs/code-review-2026-04-14.md`
> 参考 UI：`mockup.html`

---

## 总览

共 5 个阶段，建议按顺序执行。前两个阶段解决"用了会出 bug"的问题，后三个阶段让界面达到 mockup 水准。

| 阶段 | 内容 | 预估时间 | 优先级 |
|------|------|----------|--------|
| 一 | P0 Bug 修复（基础稳定） | 半天 | 🔴 最高 |
| 二 | Profile 功能补全（目标血压） | 半天 | 🔴 最高 |
| 三 | 数据页 UI 重建 | 1.5 天 | 🟠 高 |
| 四 | 家庭页 UI 重建 | 1 天 | 🟠 高 |
| 五 | 记录页 + 设置页 UI 完善 | 1 天 | 🟡 中 |

**不需要动的文件（已经足够好）：**
- `utils/health-rules.js`（只需修一个默认值）
- `utils/chart-data.js`
- `utils/canvas-charts.js`
- `utils/date.js`
- `utils/report-data.js`
- `utils/report-canvas.js`
- 所有云函数（除了 `cloudfunctions/_shared/auth.js` 小修）
- `pages/report/report.js`（完整保留）
- `pages/join-family/` 全部保留

---

## 阶段一：P0 Bug 修复

> 目标：消除会让真实用户困惑的 bug。不涉及 UI，纯逻辑修复。

---

### Task 1.1 — 修复登录时序竞态

**问题**：`app.js` 的 `doLogin()` 是异步的，但 `onLaunch` 没有等它完成。数据页 `onShow` 立即读 `globalData.familyId`，网络慢时读到的是空字符串，页面显示空状态。

**改动文件**：`app.js`

**改法**：

```js
App({
  onLaunch() {
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true })
    // 暴露一个 Promise，让页面可以等待 login 完成
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
        canWrite: false, canEdit: false,
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

**改动文件**：`pages/data/data.js`（`loadRecords` 函数开头加等待）

```js
async loadRecords() {
  const app = getApp()
  await app.loginReady   // ← 加这一行，等 login 完成再读 familyId
  if (!app.globalData.familyId) {
    // ...原有逻辑
  }
```

**同样修改**：`pages/family/family.js`、`pages/report/report.js`、`pages/records/records.js`、`pages/settings/settings.js` 的 `loadFamily()`/`loadRecords()` 开头都加 `await getApp().loginReady`。

**验证方式**：关闭小程序，打开，立即看数据页，应该有短暂 loading 后显示数据，而不是空白。

---

### Task 1.2 — `loadRecords`（data.js）加 try/catch

**问题**：网络错误或云函数异常会导致 loading 永久卡住，没有任何错误提示。

**改动文件**：`pages/data/data.js`

**改法**：把 `loadRecords` 里的云函数调用包裹：

```js
async loadRecords() {
  const app = getApp()
  await app.loginReady
  if (!app.globalData.familyId) {
    this.setData({ records: [], latestRecord: null, /* ...其他清空 */ loading: false })
    return
  }
  this.setData({ loading: true })
  try {
    const days = PERIODS[this.data.period] || 7
    const res = await wx.cloud.callFunction({
      name: 'getRecords',
      data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
    })
    // ...原有的数据处理逻辑...
  } catch (err) {
    console.error('loadRecords failed', err)
    wx.showToast({ title: '数据加载失败，请重试', icon: 'none' })
  } finally {
    this.setData({ loading: false })
  }
}
```

---

### Task 1.3 — 修复 `getHRStatus` 心率默认上限

**问题**：`utils/health-rules.js` 里心率目标上限默认值是 80，导致心率 85 bpm 被判为"偏快（注意）"，但 85 完全正常。文档说默认 100，`family-settings.js` 实际也是 60-100 范围。

**改动文件**：`utils/health-rules.js` 第 36 行

```js
// 修改前
const max = Number(target && target.max) || 80

// 修改后
const max = Number(target && target.max) || 100
```

**验证**：心率 85 bpm 应显示"参考范围内"。

---

### Task 1.4 — 修复设置页并发写入问题

**问题**：`settings.js` 每次 toggle 立即调云函数，快速连续操作会产生并发写入，后者覆盖前者。

**改动文件**：`pages/settings/settings.js`

**改法**：加一个 `saving` 标志，写入中屏蔽重复调用：

```js
async updateSettings(patch) {
  if (this.savingSettings) return   // ← 加这一行
  this.savingSettings = true
  const settings = normalizeSettings({ ...this.data.settings, ...patch })
  try {
    const res = await wx.cloud.callFunction({
      name: 'updateFamilySettings',
      data: { familyId: this.data.family._id, profile: this.data.family.profile, settings },
    })
    if (!res.result.success) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      return
    }
    this.setData({ settings, notifyMemberText: notifyMemberText(settings.notifyMemberIds) })
  } finally {
    this.savingSettings = false    // ← 加这一行
  }
}
```

---

## 阶段二：Profile 功能补全（目标血压）

> 目标：把设计文档里的目标血压/心率字段真正打通——存储、编辑、展示、计算达标率，四个环节全部连上。

---

### Task 2.1 — `createDefaultProfile` 补充目标值字段

**问题**：`utils/family-settings.js` 里的 profile 没有目标血压/心率字段，导致达标统计永远用硬编码默认值。

**改动文件**：`utils/family-settings.js`

```js
function createDefaultProfile() {
  return {
    name: '',
    birthYear: null,
    targetSystolic: 135,      // ← 新增，家庭血压标准（比诊室低 5）
    targetDiastolic: 85,      // ← 新增
    targetHRMin: 60,          // ← 新增
    targetHRMax: 100,         // ← 新增
    medicationsText: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}

function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    targetSystolic: toNumberOrDefault(profile.targetSystolic, defaults.targetSystolic),   // ← 新增
    targetDiastolic: toNumberOrDefault(profile.targetDiastolic, defaults.targetDiastolic), // ← 新增
    targetHRMin: toNumberOrDefault(profile.targetHRMin, defaults.targetHRMin),            // ← 新增
    targetHRMax: toNumberOrDefault(profile.targetHRMax, defaults.targetHRMax),            // ← 新增
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
  }
}
```

**同步修改**：`cloudfunctions/saveRecord/index.js` 里的 `createDefaultProfile` 也加同样的四个字段（保持一致）。

---

### Task 2.2 — 数据页达标统计使用真实目标值

**问题**：`data.js` 调 `countReferenceStats(records, {})` 传空对象，目标值从没被用上。

**改动文件**：`pages/data/data.js`

数据页需要知道家庭 profile，两种方案选一：

**方案 A（简单）**：登录后把 profile 存到 globalData
- `app.js` 的 `doLogin` 成功后额外调一次 `getFamily`，把 profile 存到 `globalData.profile`
- 缺点：多一次云函数调用

**方案 B（推荐）**：数据页自己加载家庭 profile，缓存到 `this.data.profile`

```js
// data.js 新增字段
data: {
  // ...现有字段...
  profile: null,   // ← 新增
},

async loadRecords() {
  const app = getApp()
  await app.loginReady
  if (!app.globalData.familyId) { /* ...清空... */ return }

  this.setData({ loading: true })
  try {
    // 并行拉取记录和家庭信息
    const [recordsRes, familyRes] = await Promise.all([
      wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId: app.globalData.familyId, since: daysAgo(days).toISOString() },
      }),
      wx.cloud.callFunction({
        name: 'getFamily',
        data: { familyId: app.globalData.familyId },
      }),
    ])
    const records = recordsRes.result.records || []
    const profile = (familyRes.result.family || {}).profile || {}

    // ...计算 latestRecord, bpChart, hrChart...

    this.setData({
      profile,
      stats: {
        ...countReferenceStats(records, profile),  // ← 传真实 profile
        avg: calcAverage(records),
      },
      // ...其他字段...
    })
  } catch (err) {
    // ...
  }
}
```

---

### Task 2.3 — Profile 编辑表单加目标值输入

**改动文件**：`pages/family/family.wxml`（模态框部分）

在现有输入项后追加：

```xml
<view wx:if="{{profileFormOpen}}" class="modal">
  <text class="modal-title">编辑档案</text>
  <input value="{{profileForm.name}}" data-field="name" bindinput="onProfileInput" placeholder="姓名" />
  <input value="{{profileForm.birthYear}}" data-field="birthYear" bindinput="onProfileInput" type="number" placeholder="出生年（如 1952）" />
  <input value="{{profileForm.medicationsText}}" data-field="medicationsText" bindinput="onProfileInput" placeholder="长期用药（可空）" />
  <input value="{{profileForm.emergencyContactName}}" data-field="emergencyContactName" bindinput="onProfileInput" placeholder="紧急联系人姓名" />
  <input value="{{profileForm.emergencyContactPhone}}" data-field="emergencyContactPhone" bindinput="onProfileInput" type="number" placeholder="紧急联系人电话" />
  <!-- 新增目标值 -->
  <text class="modal-section">目标血压（mmHg）</text>
  <view class="modal-row">
    <input class="modal-input-half" value="{{profileForm.targetSystolic}}" data-field="targetSystolic" bindinput="onProfileInput" type="number" placeholder="高压 如 135" />
    <input class="modal-input-half" value="{{profileForm.targetDiastolic}}" data-field="targetDiastolic" bindinput="onProfileInput" type="number" placeholder="低压 如 85" />
  </view>
  <text class="modal-section">目标心率（bpm）</text>
  <view class="modal-row">
    <input class="modal-input-half" value="{{profileForm.targetHRMin}}" data-field="targetHRMin" bindinput="onProfileInput" type="number" placeholder="下限 如 60" />
    <input class="modal-input-half" value="{{profileForm.targetHRMax}}" data-field="targetHRMax" bindinput="onProfileInput" type="number" placeholder="上限 如 100" />
  </view>
  <button class="primary" bindtap="onSaveProfile">保存</button>
</view>
```

**改动文件**：`pages/family/family.wxss`（补充两个新 class）

```css
.modal-section { display: block; font-size: 26rpx; color: #64748B; margin: 16rpx 0 8rpx; }
.modal-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.modal-input-half { flex: 1; min-height: 88rpx; border-radius: 20rpx; background: #F8FAFF; padding: 0 24rpx; font-size: 30rpx; }
```

---

### Task 2.4 — 实现字体大小真正生效

**问题**：fontSize 设置存了但没有应用到任何样式。

**改动文件**：`app.wxss`（加 CSS 变量）

```css
/* 字号比例变量，由 JS 动态修改 */
page {
  --fs: 1;
}

/* 在需要响应字号的地方使用，例如 */
/* font-size: calc(32rpx * var(--fs)); */
```

**改动文件**：`app.js`（login 后应用 fontSize）

```js
async doLogin() {
  try {
    const res = await wx.cloud.callFunction({ name: 'login' })
    const result = res.result || {}
    this.globalData.familyId = result.familyId || ''
    // ...其他赋值...

    // 如果有 familyId，加载设置并应用字体
    if (result.familyId) {
      this.applyFontSize()
    }
  } catch (e) {
    console.error('Login failed', e)
  }
},

async applyFontSize() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'getFamily',
      data: { familyId: this.globalData.familyId },
    })
    const fontSize = ((res.result.family || {}).settings || {}).fontSize || 'standard'
    const scaleMap = { standard: 1, large: 1.15, xlarge: 1.3 }
    const scale = scaleMap[fontSize] || 1
    // 微信小程序通过 wx.setPageStyle 或 rpx 动态赋值
    // 实际做法：存到 globalData，各页面 onShow 时读取并设置根节点 class
    this.globalData.fontSizeScale = scale
    this.globalData.fontSizeClass = fontSize   // 'standard' | 'large' | 'xlarge'
  } catch (e) {
    // 静默失败，用默认字号
  }
},
```

**每个页面 onShow 时应用**：

在 `data/data.js`、`family/family.js`、`records/records.js`、`settings/settings.js` 的 `onShow` 里：

```js
onShow() {
  const app = getApp()
  const cls = app.globalData.fontSizeClass || 'standard'
  this.setData({ fontSizeClass: cls })
  this.loadRecords()  // or loadFamily etc.
},
```

WXML 根节点加 class：

```xml
<scroll-view class="container fs-{{fontSizeClass}}">
```

WXSS 里（data.wxss 等）：

```css
/* 标准：不变 */
/* 大字：核心数值放大 */
.fs-large .metric-value { font-size: 96rpx; }
.fs-large .stat-num { font-size: 56rpx; }
/* 超大：更大 */
.fs-xlarge .metric-value { font-size: 112rpx; }
.fs-xlarge .stat-num { font-size: 64rpx; }
```

> **说明**：这比 CSS 变量方案更简单可靠。针对老人最需要看大的元素（主卡片数值、统计数字）精准放大，而不是全局缩放（全局缩放反而会破坏布局）。

---

## 阶段三：数据页 UI 重建

> 目标：让数据页主卡片和图表区域达到 mockup 设计水准。WXML/WXSS 为主，JS 基本不动。

---

### Task 3.1 — 重建主记录卡（最重要的 UI 改动）

**当前问题**：
- 三个数值用 `position: absolute` 定位，布局脆弱
- 只有一层卡片，没有 mockup 里的"外层毛玻璃 + 内层白卡"结构
- 没有 BP 状态条（右侧三段彩色竖条）
- 没有 ECG 图标

**改动文件**：`pages/data/data.wxml`（`.device-card` 及内部全部重写）

目标结构（对照 mockup 的 `.rec-card`）：

```xml
<!-- 主记录卡 -->
<view class="rec-card">
  <!-- 时间行 -->
  <text class="rec-time">
    {{latestRecord ? '最近记录：' + latestTime : '暂无记录'}}
  </text>

  <view class="rec-body">
    <!-- 内层白卡 -->
    <view class="rec-inner">
      <!-- ECG 装饰图标 -->
      <view class="rec-ecg-icon">
        <!-- 可以用一个简单的 view 或 image，mockup 用 SVG -->
      </view>

      <!-- 高压（大字，单独一行） -->
      <view class="rec-top">
        <text class="rec-label">高压值 (mmHg)</text>
        <text class="rec-value-lg {{quickEntryActive ? quickBpValueClass : bpValueClass}}">
          <block wx:if="{{quickEntryActive}}">
            <block wx:if="{{quickField==='systolic'}}">{{quickForm.systolic || '--'}}</block>
            <block wx:elif="{{quickForm.systolic}}">{{quickForm.systolic}}</block>
            <block wx:else>--</block>
          </block>
          <block wx:elif="{{latestRecord}}">{{latestRecord.systolic}}</block>
          <block wx:else>--</block>
        </text>
      </view>

      <!-- 低压 + 心率（并排一行） -->
      <view class="rec-bottom">
        <view class="rec-field">
          <text class="rec-label">低压值 (mmHg)</text>
          <text class="rec-value-md {{quickEntryActive ? quickBpValueClass : bpValueClass}}">
            <block wx:if="{{quickEntryActive}}">
              <block wx:if="{{quickField==='diastolic'}}">{{quickForm.diastolic || '--'}}</block>
              <block wx:elif="{{quickForm.diastolic}}">{{quickForm.diastolic}}</block>
              <block wx:else>--</block>
            </block>
            <block wx:elif="{{latestRecord}}">{{latestRecord.diastolic}}</block>
            <block wx:else>--</block>
          </text>
        </view>
        <view class="rec-field">
          <text class="rec-label">心率 (bpm)</text>
          <text class="rec-value-md {{quickEntryActive ? quickHrValueClass : hrValueClass}}">
            <block wx:if="{{quickEntryActive}}">
              <block wx:if="{{quickField==='heartRate'}}">{{quickForm.heartRate || '--'}}</block>
              <block wx:elif="{{quickForm.heartRate}}">{{quickForm.heartRate}}</block>
              <block wx:else>--</block>
            </block>
            <block wx:elif="{{latestRecord}}">{{latestRecord.heartRate}}</block>
            <block wx:else>--</block>
          </text>
        </view>
      </view>
    </view>

    <!-- 右侧 BP 状态条（三段：红/橙/绿，当前段高亮） -->
    <view class="bp-bar">
      <view class="bp-bar-seg {{bpBarTop}}"></view>
      <view class="bp-bar-seg {{bpBarMid}}"></view>
      <view class="bp-bar-seg {{bpBarBot}}"></view>
    </view>
  </view>
</view>
```

**改动文件**：`pages/data/data.js`（增加 BP 状态条计算）

```js
// 新增辅助函数：根据 BP status 计算三段条的高亮
getBPBarClasses(status) {
  if (!status) return { bpBarTop: 'seg-dim', bpBarMid: 'seg-dim', bpBarBot: 'seg-active-green' }
  const level = status.level
  if (level === 'critical' || level === 'veryHigh') {
    return { bpBarTop: 'seg-active-red', bpBarMid: 'seg-dim', bpBarBot: 'seg-dim' }
  }
  if (level === 'high') {
    return { bpBarTop: 'seg-dim', bpBarMid: 'seg-active-orange', bpBarBot: 'seg-dim' }
  }
  if (level === 'low') {
    return { bpBarTop: 'seg-dim', bpBarMid: 'seg-active-orange', bpBarBot: 'seg-dim' }
  }
  return { bpBarTop: 'seg-dim', bpBarMid: 'seg-dim', bpBarBot: 'seg-active-green' }
},
```

在 `loadRecords` 的 `setData` 里加：

```js
...this.getBPBarClasses(latestBPStatus),
```

**改动文件**：`pages/data/data.wxss`（全面更新主卡片样式）

删除现有的 `.device-card`、`.device-screen`、`.metric`、`.wave`、`.traffic` 等，新增：

```css
/* 主卡片 - 外层毛玻璃 */
.rec-card {
  background: rgba(255,255,255,0.16);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2rpx solid rgba(255,255,255,0.30);
  border-radius: 40rpx;
  padding: 28rpx 28rpx 28rpx 32rpx;
  margin-bottom: 28rpx;
}
.rec-time {
  display: block;
  font-size: 26rpx;
  color: rgba(255,255,255,0.85);
  text-align: center;
  margin-bottom: 24rpx;
  font-weight: 600;
}
.rec-body { display: flex; align-items: stretch; gap: 20rpx; }

/* 内层白卡 */
.rec-inner {
  flex: 1;
  background: rgba(255,255,255,0.90);
  border-radius: 28rpx;
  padding: 28rpx 28rpx 24rpx;
  position: relative;
}

/* ECG 装饰（简单实现，用文字符号或 image） */
.rec-ecg-icon {
  position: absolute;
  top: 20rpx;
  right: 24rpx;
  width: 60rpx;
  height: 60rpx;
  opacity: 0.15;
}

/* 上半部分：高压 */
.rec-top { margin-bottom: 24rpx; }

/* 下半部分：低压 + 心率 */
.rec-bottom { display: flex; gap: 0; }
.rec-field { flex: 1; }

/* 标签 */
.rec-label {
  display: block;
  font-size: 24rpx;
  color: #5F7188;
  font-weight: 700;
  margin-bottom: 6rpx;
  line-height: 1.3;
}

/* 大字：高压 */
.rec-value-lg {
  display: block;
  font-size: 104rpx;
  font-weight: 900;
  line-height: 1;
  color: #7B8FA4;
}

/* 中字：低压、心率 */
.rec-value-md {
  display: block;
  font-size: 76rpx;
  font-weight: 900;
  line-height: 1;
  color: #7B8FA4;
}

/* 颜色状态 */
.rec-value-lg.empty,
.rec-value-md.empty  { color: #7B8FA4; }
.rec-value-lg.normal,
.rec-value-md.normal { color: #22C55E; }
.rec-value-lg.warning,
.rec-value-md.warning { color: #FF9500; }
.rec-value-lg.danger,
.rec-value-md.danger { color: #FF3B30; }

/* BP 状态条 */
.bp-bar {
  width: 16rpx;
  border-radius: 8rpx;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.bp-bar-seg { flex: 1; }
.seg-active-red    { background: #FF3B30; }
.seg-active-orange { background: #FF9500; }
.seg-active-green  { background: #34C759; }
.seg-dim           { background: rgba(255,255,255,0.30); }
```

---

### Task 3.2 — 移除多余的装饰元素

**改动文件**：`pages/data/data.wxml`

删除以下不在 mockup 中出现的元素：
- `.wave`（`⌁` 字符）
- `.traffic`（三色竖条）

---

### Task 3.3 — 优化添加按钮状态文案

**当前**：录入中按钮变为"正在录入"，视觉上看起来像 disabled
**Mockup**：按钮文字固定"＋ 添加记录"，keypad 弹出后按钮不变

**改动文件**：`pages/data/data.wxml`

```xml
<!-- 修改前 -->
<button class="add" bindtap="onAddRecord">{{quickEntryActive ? '正在录入' : '＋ 添加记录'}}</button>

<!-- 修改后 -->
<button class="add" bindtap="onAddRecord" wx:if="{{!quickEntryActive}}">＋ 添加记录</button>
<!-- keypad 激活时按钮消失，keypad 本身提供"取消"和"立即添加" -->
```

---

## 阶段四：家庭页 UI 重建

> 目标：让家庭页结构匹配 mockup，同时补充目标血压的展示。

---

### Task 4.1 — 家庭页整体结构重写

**改动文件**：`pages/family/family.wxml`（非模态框部分全部重写）

对照 mockup 的结构，目标布局：

```
家庭页
├── 白色顶栏（"家庭" 标题 + 齿轮按钮）
└── 滚动内容区
    ├── 分区标签："被监护人档案"
    ├── Profile 卡
    │   ├── 卡头：圆形字母头像 + 姓名 + 年份/年龄 + 编辑链接
    │   └── 信息行：目标血压 / 目标心率 / 长期用药 / 紧急联系人
    ├── 分区标签："家庭成员"
    ├── 成员卡
    │   ├── 横向滚动头像行（admin 蓝色，member 浅蓝，邀请虚线圆）
    │   └── 提示文字："成员可查看全部记录 · 最多10人"
    ├── 分区标签："功能"
    ├── 生成就诊报告 行（有图标）
    └── 药物管理 行（有图标，"即将上线"）
```

**改动文件**：`pages/family/family.wxml`

```xml
<view class="container">
  <!-- 顶栏 -->
  <view class="fam-header">
    <text class="fam-title">家庭</text>
    <view wx:if="{{family}}" class="gear-btn" bindtap="onSettingsTap">
      <!-- 用 SVG 替换 ⚙ 文字符号，对照 mockup -->
      <text class="gear-icon">⚙</text>
    </view>
  </view>

  <!-- 空状态 -->
  <view wx:if="{{!family && !loading}}" class="empty">
    <text class="empty-title">还没有健康记录</text>
    <text class="empty-hint">先去记录一条血压心率，记录后可在这里补充档案、邀请家人查看。</text>
    <button class="primary" bindtap="onGoRecordTap">去记录一条</button>
  </view>

  <scroll-view wx:if="{{family}}" scroll-y class="body">

    <!-- 被监护人档案 -->
    <text class="section-label">被监护人档案</text>
    <view class="prof-card">
      <view class="prof-head">
        <!-- 圆形字母头像 -->
        <view class="prof-avatar">{{family.profile.name ? family.profile.name[0] : '档'}}</view>
        <view class="prof-info">
          <text class="prof-name">{{family.profile.name || family.displayName || '我的记录'}}</text>
          <text class="prof-sub">
            {{family.profile.birthYear ? family.profile.birthYear + '年生' : ''}}
            {{profileView.age !== '--' ? ' · ' + profileView.age + '岁' : ''}}
          </text>
        </view>
        <text wx:if="{{canManage}}" class="edit-link" bindtap="onEditProfileTap">编辑 ›</text>
      </view>
      <!-- 信息行 -->
      <view class="info-row">
        <text class="info-label">目标血压</text>
        <text class="info-value">＜ {{family.profile.targetSystolic || 135}} / {{family.profile.targetDiastolic || 85}} mmHg</text>
      </view>
      <view class="info-row">
        <text class="info-label">目标心率</text>
        <text class="info-value">{{family.profile.targetHRMin || 60}} – {{family.profile.targetHRMax || 100}} bpm</text>
      </view>
      <view class="info-row" wx:if="{{family.profile.medicationsText}}">
        <text class="info-label">长期用药</text>
        <text class="info-value">{{family.profile.medicationsText}}</text>
      </view>
      <view class="info-row" wx:if="{{profileView.emergencyText !== '未设置'}}">
        <text class="info-label">紧急联系人</text>
        <text class="info-value">{{profileView.emergencyText}}</text>
      </view>
      <text wx:if="{{!hasProfileInfo}}" class="prof-empty-hint">档案信息可稍后补充</text>
      <text class="trust-hint">仅用于报告展示，可填昵称或简称。</text>
    </view>

    <!-- 家庭成员 -->
    <text class="section-label">家庭成员</text>
    <view class="mem-card">
      <scroll-view scroll-x class="mem-row">
        <view wx:for="{{family.members}}" wx:key="openid"
          class="mem-item" bindtap="onMemberTap" data-openid="{{item.openid}}">
          <view class="mem-avatar {{item.role === 'admin' ? 'admin' : ''}}">
            {{item.nickname ? item.nickname[0] : '家'}}
          </view>
          <text class="mem-name">{{item.nickname || '家人'}}{{item.role === 'admin' ? '\n(管理员)' : ''}}</text>
        </view>
        <!-- 邀请按钮 -->
        <view class="mem-item" bindtap="onInviteTap">
          <view class="mem-avatar invite">＋</view>
          <text class="mem-name">邀请</text>
        </view>
      </scroll-view>
      <text class="mem-hint">成员可查看全部记录 · 最多10人</text>
    </view>

    <!-- 功能 -->
    <text class="section-label">功能</text>
    <view class="action-row" bindtap="onReportTap">
      <view class="action-icon blue">📄</view>
      <view class="action-text">
        <text class="action-title">生成就诊报告</text>
        <text class="action-sub">选择时间段，导出图片</text>
      </view>
      <text class="action-arrow">›</text>
    </view>
    <view class="action-row disabled">
      <view class="action-icon orange">💊</view>
      <view class="action-text">
        <text class="action-title">药物管理</text>
        <text class="action-sub">拍照 / 扫码录入药品</text>
      </view>
      <text class="soon-badge">即将上线</text>
    </view>

  </scroll-view>

  <!-- 模态框（编辑档案 / 权限面板 / 分享）保持不变 -->
  <!-- ... -->
</view>
```

**改动文件**：`pages/family/family.wxss`（对照新结构全面更新）

关键新增样式：

```css
/* 分区标签 */
.section-label {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #94A3B8;
  letter-spacing: 1.5rpx;
  margin: 40rpx 0 20rpx;
}
.section-label:first-of-type { margin-top: 8rpx; }

/* Profile 卡 */
.prof-card {
  background: #fff;
  border-radius: 36rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09);
}
.prof-head {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 28rpx;
}
.prof-avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #3182F7, #1A5FCC);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.prof-name { display: block; font-size: 34rpx; font-weight: 700; color: #0F172A; }
.prof-sub  { display: block; font-size: 26rpx; color: #94A3B8; margin-top: 4rpx; }
.edit-link { margin-left: auto; font-size: 26rpx; color: #3182F7; background: #EAF2FF; padding: 10rpx 20rpx; border-radius: 16rpx; }

/* 信息行 */
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 20rpx 0;
  border-top: 2rpx solid #EEF3FB;
  font-size: 28rpx;
}
.info-label { color: #64748B; }
.info-value { color: #0F172A; font-weight: 600; }

/* 成员卡 */
.mem-card {
  background: #fff;
  border-radius: 36rpx;
  padding: 28rpx 32rpx;
  box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09);
}
.mem-row { display: flex; gap: 28rpx; white-space: nowrap; }
.mem-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  min-width: 100rpx;
}
.mem-avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #EAF2FF;
  border: 4rpx solid rgba(49,130,247,0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 700;
  color: #3182F7;
}
.mem-avatar.admin {
  background: linear-gradient(135deg, #3182F7, #1A5FCC);
  color: #fff;
  border: none;
}
.mem-avatar.invite {
  background: #F8FAFF;
  border: 4rpx dashed #CBD5E1;
  color: #94A3B8;
  font-size: 44rpx;
  font-weight: 300;
}
.mem-name {
  font-size: 22rpx;
  color: #64748B;
  text-align: center;
  white-space: normal;
  word-break: break-all;
  max-width: 100rpx;
}
.mem-hint { font-size: 24rpx; color: #94A3B8; margin-top: 20rpx; }

/* 功能行 */
.action-row {
  background: #fff;
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 32rpx rgba(49,130,247,0.09);
}
.action-row.disabled { opacity: 0.5; }
.action-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  flex-shrink: 0;
}
.action-icon.blue   { background: #EAF2FF; }
.action-icon.orange { background: #FFF7ED; }
.action-title { display: block; font-size: 30rpx; font-weight: 600; color: #0F172A; }
.action-sub   { display: block; font-size: 24rpx; color: #94A3B8; margin-top: 4rpx; }
.action-arrow { margin-left: auto; color: #CBD5E1; font-size: 34rpx; }
.soon-badge   { margin-left: auto; background: #F1F5F9; color: #94A3B8; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 999rpx; }
```

---

### Task 4.2 — 移除家庭页的快捷设置卡片

**问题**：设置功能散落在两处（家庭页 + 设置页），产生困惑。

**改动文件**：`pages/family/family.wxml`

删除：
```xml
<!-- 删除这整个 block -->
<view wx:if="{{canManage && latestRecord}}" class="card">
  <text class="section-title">快捷设置</text>
  ... (switch 行、字体大小选择)
</view>
```

**同步改动**：`pages/family/family.js` 可以删除 `onToggleMedicationReminder`、`onToggleAbnormalNotify`、`onFontSizeTap` 三个方法（它们仅在快捷设置里用）。设置页的对应功能保留。

---

### Task 4.3 — 家庭页并行加载数据

**改动文件**：`pages/family/family.js`，`loadFamily` 函数

```js
async loadFamily() {
  const app = getApp()
  await app.loginReady
  if (!app.globalData.familyId) {
    this.setData({ loading: false, family: null })
    return
  }

  try {
    // 串行改并行，加载时间减半
    const [familyRes, recordRes] = await Promise.all([
      wx.cloud.callFunction({ name: 'getFamily', data: { familyId: app.globalData.familyId } }),
      wx.cloud.callFunction({ name: 'getRecords', data: { familyId: app.globalData.familyId } }),
    ])
    // ... 剩余逻辑不变
  } catch (e) {
    wx.showToast({ title: '家庭信息加载失败', icon: 'none' })
    this.setData({ loading: false })
  }
}
```

---

## 阶段五：记录页 + 设置页 UI 完善

---

### Task 5.1 — 全部记录页添加状态徽章

**问题**：每条记录只有颜色编码的 BP 数值，没有"正常/注意/危险"徽章，扫描效率低。

**改动文件**：`pages/records/records.js`

在 `loadRecords` 的 map 里加 `statusLabel`：

```js
const records = (res.result.records || []).map(record => {
  const bpStatus = getBPStatus(record.systolic, record.diastolic)
  return {
    ...record,
    timeStr: formatTime(record.measuredAt),
    bpStatus,
    statusLabel: bpStatus.level === 'inRange' ? '正常' :
                 (bpStatus.level === 'critical' || bpStatus.level === 'veryHigh') ? '危险' : '注意',
    statusClass: bpStatus.level === 'inRange' ? 'badge-ok' :
                 (bpStatus.level === 'critical' || bpStatus.level === 'veryHigh') ? 'badge-hi' : 'badge-w',
  }
})
```

**改动文件**：`pages/records/records.wxml`（在每条记录里加徽章和箭头）

```xml
<view class="record">
  <view class="left">
    <text class="time">{{record.timeStr}}</text>
    <text wx:if="{{record.period}}" class="tag">{{record.period === 'morning' ? '晨测' : '晚测'}}</text>
  </view>
  <view class="main">
    <text class="bp" style="color:{{record.bpStatus.color}}">
      {{record.systolic}} / {{record.diastolic}} mmHg
    </text>
    <text class="hr">心率 {{record.heartRate}} bpm</text>
  </view>
  <!-- 新增：状态徽章 -->
  <text class="status-badge {{record.statusClass}}">{{record.statusLabel}}</text>
  <view class="actions">
    <text class="edit" bindtap="onEdit" data-group-index="{{groupIndex}}" data-record-index="{{recordIndex}}">修改</text>
    <text class="delete" bindtap="onDelete" data-id="{{record._id}}">删除</text>
  </view>
</view>
```

**改动文件**：`pages/records/records.wxml`（组头加箭头）

```xml
<view class="group-head" bindtap="toggleGroup" data-index="{{groupIndex}}">
  <text class="date">{{item.date}}</text>
  <text class="count">{{item.items.length}}条</text>
  <text class="chev {{item.open ? 'open' : ''}}">›</text>  <!-- 新增 -->
</view>
```

**改动文件**：`pages/records/records.wxss`（新增徽章和箭头样式）

```css
/* 状态徽章 */
.status-badge {
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}
.badge-ok { background: #F0FDF4; color: #16A34A; }
.badge-w  { background: #FFF7ED; color: #EA580C; }
.badge-hi { background: #FFF1F2; color: #E11D48; }

/* 组头箭头 */
.group-head { justify-content: flex-start; }  /* 调整布局 */
.count { flex: 1; }  /* 让 count 填充中间，把箭头推到右边 */
.chev { color: #94A3B8; font-size: 28rpx; transition: transform 0.2s; display: inline-block; }
.chev.open { transform: rotate(90deg); }
```

---

### Task 5.2 — 设置页阈值改为 stepper

**问题**：老人面对数字输入框不友好，stepper 更直观。

**改动文件**：`pages/settings/settings.wxml`（高压/低压阈值行）

```xml
<!-- 修改前：直接输入 -->
<input class="number-input" type="number" value="{{settings.alertSystolic}}" ... />

<!-- 修改后：stepper -->
<view class="stepper">
  <view class="stepper-btn" bindtap="onThresholdStep" data-key="alertSystolic" data-delta="-5">−</view>
  <text class="stepper-val">{{settings.alertSystolic}} mmHg</text>
  <view class="stepper-btn" bindtap="onThresholdStep" data-key="alertSystolic" data-delta="5">＋</view>
</view>
```

低压同样处理。

**改动文件**：`pages/settings/settings.js`（新增 `onThresholdStep` 方法）

```js
onThresholdStep(e) {
  const key = e.currentTarget.dataset.key
  const delta = Number(e.currentTarget.dataset.delta)
  const limits = {
    alertSystolic:  { min: 130, max: 200 },
    alertDiastolic: { min: 80,  max: 120 },
  }
  const current = this.data.settings[key]
  const limit = limits[key]
  const next = Math.min(limit.max, Math.max(limit.min, current + delta))
  if (next === current) return
  this.updateSettings({ [key]: next })
},
```

**改动文件**：`pages/settings/settings.wxss`（新增 stepper 样式）

```css
.stepper { display: flex; align-items: center; gap: 16rpx; flex-shrink: 0; }
.stepper-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: #EAF2FF;
  color: #3182F7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: 700;
}
.stepper-val {
  font-size: 30rpx;
  font-weight: 700;
  color: #0F172A;
  min-width: 120rpx;
  text-align: center;
}
```

---

### Task 5.3 — 设置页增加"关于"分区

**改动文件**：`pages/settings/settings.wxml`（末尾追加）

```xml
<text class="sec-label">关于</text>
<view class="settings-card">
  <view class="setting-row">
    <text class="setting-title">版本</text>
    <text class="value">v 1.0.0</text>
  </view>
  <view class="setting-row no-border" bindtap="onFeedbackTap">
    <text class="setting-title">意见反馈</text>
    <text class="value">›</text>
  </view>
</view>
```

**改动文件**：`pages/settings/settings.js`（新增方法）

```js
onFeedbackTap() {
  wx.showModal({
    title: '意见反馈',
    content: '如有使用问题或建议，请联系开发者。',
    showCancel: false,
    confirmText: '好的',
  })
},
```

---

## 附录 A：改动文件总清单

| 文件 | 操作 | 所属阶段 |
|------|------|----------|
| `app.js` | 加 `loginReady` Promise + `applyFontSize` | 一 |
| `app.wxss` | 加 `page { --fs: 1; }` | 一 |
| `utils/health-rules.js` | 心率默认上限 80→100 | 一 |
| `utils/family-settings.js` | `createDefaultProfile` / `normalizeProfile` 加目标血压字段 | 二 |
| `cloudfunctions/saveRecord/index.js` | `createDefaultProfile` 同步加目标血压字段 | 二 |
| `pages/data/data.js` | 加 `loginReady` + try/catch + `getBPBarClasses` + 并行拉 profile + 字体 class | 一/二 |
| `pages/data/data.wxml` | 主卡片结构重写（两层卡 + 状态条）；删 `.wave`/`.traffic` | 三 |
| `pages/data/data.wxss` | 全面更新主卡片样式；加字体 class | 三 |
| `pages/family/family.js` | 加 `loginReady`；改串行为并行；删快捷设置方法 | 一/四 |
| `pages/family/family.wxml` | 整体结构重写；加 profile 目标值；删快捷设置卡 | 二/四 |
| `pages/family/family.wxss` | 全面更新样式（头像、信息行、成员卡、功能行）| 四 |
| `pages/records/records.js` | 加 `loginReady` + `statusLabel`/`statusClass` | 一/五 |
| `pages/records/records.wxml` | 加状态徽章；加组头箭头 | 五 |
| `pages/records/records.wxss` | 加徽章/箭头样式 | 五 |
| `pages/settings/settings.js` | 加 `loginReady`；加防并发；加 `onThresholdStep`；加 `onFeedbackTap` | 一/五 |
| `pages/settings/settings.wxml` | 阈值改 stepper；加"关于"分区 | 五 |
| `pages/settings/settings.wxss` | 加 stepper 样式；删 `.number-input` | 五 |

**不需要改动的文件：**
- `pages/add-record/` 全部
- `pages/report/` 全部
- `pages/join-family/` 全部
- `utils/chart-data.js`
- `utils/canvas-charts.js`
- `utils/date.js`
- `utils/report-data.js`
- `utils/report-canvas.js`
- `cloudfunctions/` 除 `saveRecord/index.js` 的 `createDefaultProfile`，其余全不动
- `app.json`（路由已对）

---

## 附录 B：执行顺序建议

```
阶段一（先做，不涉及 UI，可以立即验证）
  1.1 → 1.2 → 1.3 → 1.4

阶段二（接着做，功能补全，和 UI 无关）
  2.1 → 2.2 → 2.3 → 2.4

阶段三（数据页 UI，改动最集中）
  3.1 → 3.2 → 3.3

阶段四（家庭页 UI）
  4.1 → 4.2 → 4.3

阶段五（细节完善）
  5.1 → 5.2 → 5.3
```

每完成一个 Task 都可以直接在手机预览验证，不需要等到全部完成。

---

## 附录 C：不在本计划内的事项（有意延后）

| 事项 | 原因 |
|------|------|
| `add-record` 传参改为只传 `_id` | 当前方式有风险但不影响功能，低优先级 |
| 组件化重构（`components/`） | 工程性改进，功能不影响，V2 再做 |
| `randomCode` 碰撞检测 | 内部使用，概率极低 |
| 全部记录页改为 overlay | 当前独立页面体验可接受 |
| 通知功能真实接入微信订阅消息 | 属于 V2 功能 |
| PDF 导出 | 属于 V2 功能 |

---

*本计划基于 2026-04-14 代码快照编写。如代码在执行期间有较大改动，请对照最新代码调整具体实现细节。*
