# V1 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 逐步完成 v1 所有 P0/P1 功能闭环，让真实家庭可以顺利使用这个小程序。

**Architecture:** 原生微信小程序 + CloudBase 云函数 + Canvas 图片导出。各任务独立可提交，每个任务完成后即可在微信开发者工具或真机验证。

**Tech Stack:** 微信小程序原生框架、CloudBase wx-server-sdk、Canvas API、CSS 自定义属性

---

## 任务序列总览

| # | 任务 | 类型 | 规模 |
|---|------|------|------|
| 1 | 加入家庭后跳转数据页 | 前端 1 行 | XS |
| 2 | 只读成员快捷录入 UX | 前端 | S |
| 3 | removeMember 云函数 | 后端 | M |
| 4 | 家庭页移除成员 UI | 前端 | M |
| 5 | 设置页新增图表参考线区块 + 云函数保存 | 前端 + 后端 | M |
| 6 | 数据页统计和图表使用家庭参考线 | 前端 | M |
| 7 | 报告使用家庭参考线 + 常驻展示参考线 | 前端 | M |
| 8 | 全部记录纯数据图片下载 | 前端 | L |
| 9 | 报告隐私隐藏 | 前端 | S |
| 10 | 家庭页无记录空状态 | 前端 | S |
| 11 | 设置页假功能文案标注 | 前端 | XS |
| 12 | 真机验收 | 测试 | — |

---

## Task 1: 加入家庭后跳转数据页

**Files:**
- Modify: `pages/join-family/join-family.js:41`

### 背景

当前加入成功后执行 `wx.switchTab({ url: '/pages/family/family' })`，用户看到的是空的家庭页，而不是有数据价值的数据页。改为跳转数据页，让被邀请人立即看到家人的记录。

- [ ] **Step 1: 修改跳转目标**

打开 `pages/join-family/join-family.js`，找到加入成功后的跳转代码（约第 41 行）：

```js
wx.switchTab({ url: '/pages/family/family' })
```

改为：

```js
wx.switchTab({ url: '/pages/data/data' })
```

- [ ] **Step 2: 在开发者工具中验证**

在 join-family 页面模拟加入成功流程，确认跳转到数据页而不是家庭页。

- [ ] **Step 3: Commit**

```bash
git add pages/join-family/join-family.js
git commit -m "fix: redirect to data page after joining family"
```

---

## Task 2: 只读成员快捷录入 UX

**Files:**
- Modify: `pages/data/data.js`
- Modify: `pages/data/data.wxml`

### 背景

`canWrite: false` 的只读成员当前能看到完整快捷录入区，填完数据后才被服务端拒绝。需要在 `loginReady` 完成后，根据 `canWrite` 状态决定是否显示快捷录入区，权限不足时展示说明文字。

- [ ] **Step 1: 在 data.js 的 onLoad 中设置 canWrite 状态**

在 `pages/data/data.js` 的 `onLoad` 或 `onShow` 中，等 `app.loginReady` 完成后，将权限状态写入 `data`：

```js
// 在 onShow 里 await app.loginReady 之后添加：
this.setData({
  canWrite: app.globalData.memberPermissions.canWrite !== false
    || app.globalData.role === 'admin'
    || app.globalData.role === '',  // 尚未加入家庭时默认允许（首次记录场景）
})
```

注意：`role === ''` 是还没有家庭的用户（首次使用），此时应该允许录入，`saveRecord` 会自动创建家庭。

- [ ] **Step 2: 在 data.wxml 中根据 canWrite 控制快捷录入区显示**

找到快捷录入区的根节点（class 含 `quick-entry` 或类似的容器），用 `wx:if` 控制：

```xml
<!-- 有录入权限：显示快捷录入 -->
<view wx:if="{{canWrite}}" class="quick-entry-section">
  <!-- 原有快捷录入内容不变 -->
</view>

<!-- 无录入权限：显示说明 -->
<view wx:else class="no-write-tip">
  <text class="no-write-tip__text">你目前没有录入权限</text>
  <text class="no-write-tip__sub">可联系管理员在「家庭」页开启</text>
</view>
```

- [ ] **Step 3: 在 data.wxss 中添加样式**

```css
.no-write-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 32rpx;
  gap: 12rpx;
}

.no-write-tip__text {
  font-size: var(--font-size-body, 28rpx);
  color: var(--color-text-secondary, #64748B);
}

.no-write-tip__sub {
  font-size: var(--font-size-small, 24rpx);
  color: var(--color-text-tertiary, #94A3B8);
}
```

- [ ] **Step 4: 在开发者工具中验证**

将 `app.globalData.memberPermissions` 临时设为 `{ canWrite: false, canEdit: false }`，刷新数据页，确认快捷录入区被说明文字替换。恢复后确认录入区正常显示。

- [ ] **Step 5: Commit**

```bash
git add pages/data/data.js pages/data/data.wxml pages/data/data.wxss
git commit -m "fix: hide quick entry for read-only members with clear explanation"
```

---

## Task 3: removeMember 云函数

**Files:**
- Create: `cloudfunctions/removeMember/index.js`
- Create: `cloudfunctions/removeMember/package.json`
- Modify: `cloudfunctions/removeMember/_shared/` → 复用已有 `_shared/auth.js`

### 背景

当前没有移除成员的后端实现。需要新建云函数，逻辑：
1. 仅管理员可调用
2. 不能移除自己（管理员不能自我移除）
3. 从 `families.members` 数组中删除目标成员
4. 将目标成员的 `users` 文档中的 `familyId` 清空、`role` 清空

注意：`_shared/auth.js` 在各云函数中是各自复制一份（不是 npm 包），新建云函数需要复制一份。

- [ ] **Step 1: 创建云函数目录和 package.json**

创建 `cloudfunctions/removeMember/package.json`：

```json
{
  "name": "removemember",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: 复制 _shared/auth.js**

将 `cloudfunctions/updateMemberPermission/_shared/auth.js` 的内容完整复制到
`cloudfunctions/removeMember/_shared/auth.js`，内容不变。

- [ ] **Step 3: 编写 index.js**

创建 `cloudfunctions/removeMember/index.js`：

```js
const cloud = require('wx-server-sdk')
const { requireAdmin } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, targetOpenid } = event

  if (!familyId || !targetOpenid) {
    return { success: false, error: 'MISSING_PARAMS' }
  }

  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  if (targetOpenid === OPENID) {
    const err = new Error('管理员不能移除自己')
    err.code = 'CANNOT_REMOVE_SELF'
    throw err
  }

  const members = (family.members || []).filter(
    member => member.openid !== targetOpenid
  )

  // 1. 从家庭成员列表中移除
  await familyRef.update({ data: { members } })

  // 2. 清空该用户的 familyId 和 role
  const userQuery = await db.collection('users')
    .where({ _openid: targetOpenid })
    .get()

  if (userQuery.data.length > 0) {
    const userId = userQuery.data[0]._id
    await db.collection('users').doc(userId).update({
      data: { familyId: '', role: '' },
    })
  }

  return { success: true }
}
```

- [ ] **Step 4: 在微信开发者工具中部署云函数**

右键点击 `cloudfunctions/removeMember` → 上传并部署（云端安装依赖）。

- [ ] **Step 5: 在开发者工具云函数控制台测试**

在「云开发控制台 → 云函数 → removeMember → 测试」中，填入：

```json
{
  "familyId": "<真实的familyId>",
  "targetOpenid": "<要移除成员的openid>"
}
```

预期返回：`{ "success": true }`

验证数据库：families 文档的 members 数组已移除该成员，该用户的 users 文档 familyId 已清空。

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/removeMember/
git commit -m "feat: add removeMember cloud function"
```

---

## Task 4: 家庭页移除成员 UI

**Files:**
- Modify: `pages/family/family.js`
- Modify: `pages/family/family.wxml`

### 背景

管理员点击成员卡片时，当前只弹出权限修改弹窗。需要在权限弹窗中增加"移除成员"按钮，点击后二次确认，确认后调用 `removeMember` 云函数并刷新成员列表。

- [ ] **Step 1: 在权限弹窗中增加移除按钮**

在 `pages/family/family.wxml` 里找到权限弹窗（modal 或 view 弹窗）的底部，增加移除按钮：

```xml
<view class="permission-modal__remove">
  <button
    class="btn-remove-member"
    bind:tap="onRemoveMember"
  >移除成员</button>
</view>
```

样式建议（在 `family.wxss` 中添加）：

```css
.permission-modal__remove {
  margin-top: 32rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #F1F5F9;
}

.btn-remove-member {
  width: 100%;
  background: none;
  color: #EF4444;
  font-size: var(--font-size-body, 28rpx);
  border: 1rpx solid #FCA5A5;
  border-radius: 12rpx;
  padding: 20rpx 0;
}
```

- [ ] **Step 2: 在 family.js 中实现 onRemoveMember**

在 `pages/family/family.js` 中增加方法：

```js
async onRemoveMember() {
  const { selectedMember } = this.data  // 当前弹窗对应的成员对象
  if (!selectedMember) return

  const confirmed = await new Promise(resolve => {
    wx.showModal({
      title: '移除成员',
      content: `确定要将「${selectedMember.nickname || '该成员'}」从家庭记录本中移除吗？移除后他将无法查看和录入数据。`,
      confirmText: '确认移除',
      confirmColor: '#EF4444',
      cancelText: '取消',
      success: res => resolve(res.confirm),
    })
  })

  if (!confirmed) return

  const app = getApp()
  try {
    wx.showLoading({ title: '处理中' })
    await wx.cloud.callFunction({
      name: 'removeMember',
      data: {
        familyId: app.globalData.familyId,
        targetOpenid: selectedMember.openid,
      },
    })
    wx.hideLoading()
    wx.showToast({ title: '已移除', icon: 'success' })
    this.setData({ showPermissionModal: false, selectedMember: null })
    this.loadFamily()  // 刷新家庭数据，方法名以实际代码为准
  } catch (err) {
    wx.hideLoading()
    wx.showToast({ title: err.message || '移除失败', icon: 'none' })
  }
},
```

注意：`selectedMember`、`showPermissionModal`、`loadFamily()` 的实际名称以 `family.js` 现有代码为准，保持命名一致。

- [ ] **Step 3: 只对非管理员成员显示移除按钮**

管理员成员卡片不应显示移除按钮（不能移除自己，也不应显示移除其他管理员的选项）：

```xml
<view
  class="permission-modal__remove"
  wx:if="{{selectedMember && selectedMember.role !== 'admin'}}"
>
  <button class="btn-remove-member" bind:tap="onRemoveMember">移除成员</button>
</view>
```

- [ ] **Step 4: 在开发者工具中验证**

1. 进入家庭页，点击一个普通成员，确认弹窗底部出现"移除成员"红色按钮。
2. 点击移除，确认出现二次确认弹窗，文案正确。
3. 确认后验证成员从列表中消失。
4. 点击管理员成员，确认没有"移除成员"按钮。

- [ ] **Step 5: Commit**

```bash
git add pages/family/family.js pages/family/family.wxml pages/family/family.wxss
git commit -m "feat: add remove member UI with confirmation to family page"
```

---

## Task 5: 设置页新增图表参考线区块 + 云函数保存

**Files:**
- Modify: `pages/settings/settings.js`
- Modify: `pages/settings/settings.wxml`
- Modify: `pages/settings/settings.wxss`
- Modify: `cloudfunctions/updateFamilySettings/index.js`
- Modify: `cloudfunctions/updateFamilySettings/_shared/auth.js`（同步添加 normalizeProfile 字段）

### 背景

家庭档案的 `profile` 中已有 `targetSystolic`、`targetDiastolic`、`targetHRMin`、`targetHRMax` 四个字段（默认 135/85/60/80），`health-rules.js` 的 `getBPStatus` 和 `getHRStatus` 也已支持传入 target。

问题：`updateFamilySettings` 云函数的 `normalizeProfile` 函数在映射字段时没有包含这四个字段，导致前端发来的参考线值被丢弃（被默认值覆盖）。

**本 Task 要做两件事：**
1. 修复云函数，让参考线字段能被正确保存
2. 设置页新增"图表参考线"UI 区块

- [ ] **Step 1: 修复 normalizeProfile 函数**

打开 `cloudfunctions/updateFamilySettings/index.js`，在 `normalizeProfile` 函数中补充参考线字段：

```js
function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
    // 图表参考线字段
    targetSystolic: toNumberOrDefault(profile.targetSystolic, defaults.targetSystolic),
    targetDiastolic: toNumberOrDefault(profile.targetDiastolic, defaults.targetDiastolic),
    targetHRMin: toNumberOrDefault(profile.targetHRMin, defaults.targetHRMin),
    targetHRMax: toNumberOrDefault(profile.targetHRMax, defaults.targetHRMax),
  }
}
```

`toNumberOrDefault` 函数已在该文件中存在，直接使用。

- [ ] **Step 2: 部署更新后的 updateFamilySettings**

右键 `cloudfunctions/updateFamilySettings` → 上传并部署。

- [ ] **Step 3: 在设置页 data 中增加参考线字段**

在 `pages/settings/settings.js` 的 `data` 中，补充参考线初始值（从家庭 profile 加载后会覆盖）：

```js
data: {
  // ...原有字段不变...
  refLines: {
    systolic: 135,
    diastolic: 85,
    hrMin: 60,
    hrMax: 80,
  },
  refLinesSource: 'default',  // 'default' | 'custom'
}
```

- [ ] **Step 4: 在 onLoad/onShow 中加载参考线值**

在设置页加载家庭数据的地方，把 profile 中的参考线值读出来：

```js
// 加载到 profile 后：
const profile = familyData.profile || {}
this.setData({
  refLines: {
    systolic: profile.targetSystolic || 135,
    diastolic: profile.targetDiastolic || 85,
    hrMin: profile.targetHRMin || 60,
    hrMax: profile.targetHRMax || 80,
  },
  refLinesSource: this.isDefaultRefLines(profile) ? 'default' : 'custom',
})
```

在 `settings.js` 中添加辅助方法：

```js
isDefaultRefLines(profile) {
  return (
    (!profile.targetSystolic || profile.targetSystolic === 135) &&
    (!profile.targetDiastolic || profile.targetDiastolic === 85) &&
    (!profile.targetHRMin || profile.targetHRMin === 60) &&
    (!profile.targetHRMax || profile.targetHRMax === 80)
  )
},
```

- [ ] **Step 5: 在 settings.wxml 中添加参考线区块**

在适当位置（建议放在告警阈值区块之后）添加：

```xml
<view class="settings-section">
  <text class="settings-section__title">图表参考线</text>
  <text class="settings-section__desc">用于图表虚线、达标统计和就诊报告。请按医生建议调整。</text>

  <view class="settings-row">
    <text class="settings-row__label">高压参考线</text>
    <view class="stepper">
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="systolic" data-delta="-5">－</button>
      <text class="stepper__value">{{refLines.systolic}} mmHg</text>
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="systolic" data-delta="5">＋</button>
    </view>
  </view>

  <view class="settings-row">
    <text class="settings-row__label">低压参考线</text>
    <view class="stepper">
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="diastolic" data-delta="-5">－</button>
      <text class="stepper__value">{{refLines.diastolic}} mmHg</text>
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="diastolic" data-delta="5">＋</button>
    </view>
  </view>

  <view class="settings-row">
    <text class="settings-row__label">心率下限</text>
    <view class="stepper">
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="hrMin" data-delta="-5">－</button>
      <text class="stepper__value">{{refLines.hrMin}} 次/分</text>
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="hrMin" data-delta="5">＋</button>
    </view>
  </view>

  <view class="settings-row">
    <text class="settings-row__label">心率上限</text>
    <view class="stepper">
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="hrMax" data-delta="-5">－</button>
      <text class="stepper__value">{{refLines.hrMax}} 次/分</text>
      <button class="stepper__btn" bind:tap="onRefLineStep" data-field="hrMax" data-delta="5">＋</button>
    </view>
  </view>

  <button
    class="btn-reset-reflines"
    wx:if="{{refLinesSource === 'custom'}}"
    bind:tap="onResetRefLines"
  >恢复默认参考线（135/85 mmHg，60-80 次/分）</button>
</view>
```

- [ ] **Step 6: 在 settings.js 中实现步进和重置方法**

```js
onRefLineStep(e) {
  const { field, delta } = e.currentTarget.dataset
  const current = this.data.refLines[field]
  const limits = {
    systolic:  { min: 100, max: 180 },
    diastolic: { min: 60,  max: 120 },
    hrMin:     { min: 40,  max: 80  },
    hrMax:     { min: 60,  max: 120 },
  }
  const next = Math.min(limits[field].max, Math.max(limits[field].min, current + delta))
  const refLines = { ...this.data.refLines, [field]: next }
  const isDefault = (
    refLines.systolic === 135 && refLines.diastolic === 85 &&
    refLines.hrMin === 60 && refLines.hrMax === 80
  )
  this.setData({ refLines, refLinesSource: isDefault ? 'default' : 'custom' })
  this.saveRefLines(refLines)
},

onResetRefLines() {
  const refLines = { systolic: 135, diastolic: 85, hrMin: 60, hrMax: 80 }
  this.setData({ refLines, refLinesSource: 'default' })
  this.saveRefLines(refLines)
},

async saveRefLines(refLines) {
  const app = getApp()
  try {
    await wx.cloud.callFunction({
      name: 'updateFamilySettings',
      data: {
        familyId: app.globalData.familyId,
        profile: {
          targetSystolic: refLines.systolic,
          targetDiastolic: refLines.diastolic,
          targetHRMin: refLines.hrMin,
          targetHRMax: refLines.hrMax,
        },
      },
    })
    // 同步到 globalData，让其他页面可读取
    if (!app.globalData.familyProfile) app.globalData.familyProfile = {}
    Object.assign(app.globalData.familyProfile, {
      targetSystolic: refLines.systolic,
      targetDiastolic: refLines.diastolic,
      targetHRMin: refLines.hrMin,
      targetHRMax: refLines.hrMax,
    })
  } catch (err) {
    wx.showToast({ title: '保存失败', icon: 'none' })
  }
},
```

- [ ] **Step 7: 在开发者工具中验证**

1. 进入设置页，确认"图表参考线"区块正确显示默认值 135/85/60/80。
2. 调整高压参考线，确认数值变化，确认"恢复默认"按钮出现。
3. 重启小程序，进入设置页，确认参考线值与保存前一致（说明云函数保存成功且前端正确读取）。
4. 打开 CloudBase 控制台，查看对应 families 文档，确认 `profile.targetSystolic` 值已更新。

- [ ] **Step 8: Commit**

```bash
git add pages/settings/settings.js pages/settings/settings.wxml pages/settings/settings.wxss
git add cloudfunctions/updateFamilySettings/
git commit -m "feat: add chart reference line settings with stepper controls"
```

---

## Task 6: 数据页统计和图表使用家庭参考线

**Files:**
- Modify: `pages/data/data.js`
- Modify: `utils/chart-data.js`（或 `utils/canvas-charts.js`，确认图表虚线的绘制位置）

### 背景

`health-rules.js` 的 `getBPStatus`、`getHRStatus`、`countReferenceStats` 已支持传入 target 参数。数据页需要在加载 family profile 后，将参考线值传给这些函数，而不是让它们使用默认值。同理，Canvas 图表绘制时虚线的位置也应使用家庭参考线。

- [ ] **Step 1: 确认 data.js 加载 family profile 的位置**

阅读 `pages/data/data.js`，找到以下内容：
- family profile 是在哪里加载的（`getFamily` 云函数调用的位置）
- `countReferenceStats` 在哪里被调用，当前传入了什么参数
- 图表绘制函数（来自 `utils/chart-data.js` 或 `utils/canvas-charts.js`）在哪里被调用

- [ ] **Step 2: 确保 data.js 将 profile 存入 data**

```js
// 加载 family 数据后，将 profile 存入 data：
this.setData({ familyProfile: family.profile || {} })
```

- [ ] **Step 3: 将 familyProfile 传给 countReferenceStats**

找到 `countReferenceStats` 的调用，确认传入了 `this.data.familyProfile`：

```js
const stats = countReferenceStats(records, this.data.familyProfile)
```

（如果已经传了，则此步骤确认即可，无需修改。）

- [ ] **Step 4: 确认图表虚线使用家庭参考线**

查看 `utils/chart-data.js` 或 `utils/canvas-charts.js` 中绘制血压/心率虚线参考线的逻辑。找到类似 `refSys = 135` 的硬编码，改为从传入参数读取：

```js
// 绘制血压图时，传入参考线值：
drawBPChart(canvas, records, {
  refSystolic: familyProfile.targetSystolic || 135,
  refDiastolic: familyProfile.targetDiastolic || 85,
})

// 绘制心率图时：
drawHRChart(canvas, records, {
  refMin: familyProfile.targetHRMin || 60,
  refMax: familyProfile.targetHRMax || 80,
})
```

图表绘制函数内部相应接收和使用这些参数绘制虚线。

- [ ] **Step 5: 在开发者工具中验证**

1. 将家庭参考线在设置页改为 130/80（完成 Task 5 后）。
2. 返回数据页，查看图表虚线位置是否对应 130 mmHg 而不是默认的 135。
3. 查看达标统计数字是否也随之变化（同一批记录，不同参考线，达标数可能不同）。

- [ ] **Step 6: Commit**

```bash
git add pages/data/data.js utils/chart-data.js utils/canvas-charts.js
git commit -m "feat: use family reference lines in data page stats and charts"
```

---

## Task 7: 报告使用家庭参考线 + 常驻展示参考线

**Files:**
- Modify: `pages/report/report.js`
- Modify: `utils/report-data.js`
- Modify: `utils/report-canvas.js`

### 背景

报告页的统计数据和图表当前使用 `health-rules.js` 的默认参考线（或家庭 profile，需确认）。需要：
1. 确保报告统计、图表均使用家庭 profile 的参考线
2. 报告图片中常驻显示当前参考线和来源，例：`参考线：血压 135/85 mmHg，心率 60-80 次/分（默认参考线）`

- [ ] **Step 1: 确认 report.js 加载 profile 并传给 report-data.js**

阅读 `pages/report/report.js`，找到构建报告数据的调用（`buildReportData` 或类似函数），确认 `familyProfile` 被传入。如未传入则补充：

```js
const reportData = buildReportData(records, this.data.familyData.profile || {})
```

- [ ] **Step 2: 确认 report-data.js 使用传入的 profile**

阅读 `utils/report-data.js`，找到调用 `countReferenceStats` 或 `getBPStatus` 的地方，确认传入了 profile 而不是硬编码。如未传入则修正。

- [ ] **Step 3: 在报告 Canvas 中绘制参考线说明文字**

在 `utils/report-canvas.js` 中，找到报告底部或摘要区域的绘制逻辑，增加参考线说明文字：

```js
// 在适当位置绘制参考线说明
const isDefault = (
  (!profile.targetSystolic || profile.targetSystolic === 135) &&
  (!profile.targetDiastolic || profile.targetDiastolic === 85) &&
  (!profile.targetHRMin || profile.targetHRMin === 60) &&
  (!profile.targetHRMax || profile.targetHRMax === 80)
)
const sys = profile.targetSystolic || 135
const dia = profile.targetDiastolic || 85
const hrMin = profile.targetHRMin || 60
const hrMax = profile.targetHRMax || 80
const sourceLabel = isDefault ? '默认参考线' : '家庭自定义'
const refLineText = `参考线：血压 ${sys}/${dia} mmHg，心率 ${hrMin}-${hrMax} 次/分（${sourceLabel}）`

// 绘制文字（坐标根据报告实际布局调整）
ctx.setFontSize(20)
ctx.setFillStyle('#64748B')
ctx.fillText(refLineText, x, y)
```

- [ ] **Step 4: 在开发者工具中验证**

1. 进入报告页，导出报告图片。
2. 查看图片底部（或摘要区域）是否包含参考线说明文字。
3. 将参考线改为自定义值后，重新导出，确认文字中显示"家庭自定义"和正确数值。

- [ ] **Step 5: Commit**

```bash
git add pages/report/report.js utils/report-data.js utils/report-canvas.js
git commit -m "feat: report uses family reference lines and shows reference line source"
```

---

## Task 8: 全部记录纯数据图片下载

**Files:**
- Modify: `pages/records/records.js`
- Modify: `pages/records/records.wxml`
- Modify: `pages/records/records.wxss`
- Create: `utils/records-canvas.js`

### 背景

用户明确需要：在全部记录页底部点击下载，选择 7/30/90 天，生成一张包含所有明细数据的纯文字图片并保存相册。图片不是趋势图，而是类似表格的每条记录列表。

图片内容：
- 标题（家庭记录本名称 + 日期范围 + 总记录数）
- 每条记录：日期、时间、晨/晚测、高压、低压、心率、状态
- 底部免责声明

- [ ] **Step 1: 创建 utils/records-canvas.js**

```js
/**
 * 生成全部记录纯数据图片
 * @param {object} canvas - wx.createOffscreenCanvas 返回的 canvas
 * @param {object} options
 * @param {Array}  options.records - 按时间倒序的记录数组（已经过滤好天数范围）
 * @param {string} options.familyName - 记录本名称
 * @param {string} options.dateRange - 例："2026-03-17 至 2026-04-16"
 * @param {object} options.profile - 家庭 profile（用于判断参考线）
 * @returns {string} 图片临时路径
 */

const { getBPStatus, getHRStatus } = require('./health-rules')

const LINE_HEIGHT = 52       // 每行数据高度 px
const HEADER_HEIGHT = 140    // 标题区高度
const PADDING = 32           // 左右 padding
const FOOTER_HEIGHT = 60     // 底部免责声明高度
const CANVAS_WIDTH = 750     // px，对应 750rpx

function getStatusLabel(record, profile) {
  const bpTarget = {
    systolic: profile && profile.targetSystolic,
    diastolic: profile && profile.targetDiastolic,
  }
  const bpStatus = getBPStatus(record.systolic, record.diastolic, bpTarget)
  if (bpStatus.level === 'critical' || bpStatus.level === 'veryHigh') return '危险'
  if (bpStatus.attention) return '注意'
  return '正常'
}

function formatDate(isoString) {
  const d = new Date(isoString)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function formatTime(isoString) {
  const d = new Date(isoString)
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${min}`
}

async function drawRecordsImage(canvas, { records, familyName, dateRange, profile }) {
  const totalHeight = HEADER_HEIGHT + records.length * LINE_HEIGHT + FOOTER_HEIGHT + 32
  canvas.width = CANVAS_WIDTH
  canvas.height = totalHeight

  const ctx = canvas.getContext('2d')

  // 背景
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight)

  // 标题
  ctx.fillStyle = '#1E293B'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText(familyName || '家庭血压心率记录', PADDING, 50)

  ctx.fillStyle = '#64748B'
  ctx.font = '24px sans-serif'
  ctx.fillText(dateRange, PADDING, 88)
  ctx.fillText(`共 ${records.length} 条记录`, PADDING, 120)

  // 分隔线
  ctx.strokeStyle = '#E2E8F0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, HEADER_HEIGHT - 8)
  ctx.lineTo(CANVAS_WIDTH - PADDING, HEADER_HEIGHT - 8)
  ctx.stroke()

  // 记录行
  const statusColors = { 正常: '#34C759', 注意: '#FF9500', 危险: '#EF4444' }
  records.forEach((record, i) => {
    const y = HEADER_HEIGHT + i * LINE_HEIGHT + 36
    const isEven = i % 2 === 0

    if (isEven) {
      ctx.fillStyle = '#F8FAFC'
      ctx.fillRect(0, y - 32, CANVAS_WIDTH, LINE_HEIGHT)
    }

    const status = getStatusLabel(record, profile)
    const period = record.period === 'morning' ? '晨' : record.period === 'evening' ? '晚' : ''

    ctx.fillStyle = '#334155'
    ctx.font = '24px sans-serif'
    ctx.fillText(`${formatDate(record.measuredAt)} ${formatTime(record.measuredAt)}`, PADDING, y)
    if (period) {
      ctx.fillStyle = '#94A3B8'
      ctx.font = '20px sans-serif'
      ctx.fillText(period, PADDING + 160, y)
    }
    ctx.fillStyle = '#1E293B'
    ctx.font = '26px sans-serif'
    ctx.fillText(`${record.systolic}/${record.diastolic}`, PADDING + 200, y)
    ctx.fillText(`${record.heartRate}`, PADDING + 380, y)

    ctx.fillStyle = statusColors[status] || '#64748B'
    ctx.font = '22px sans-serif'
    ctx.fillText(status, PADDING + 460, y)
  })

  // 底部免责声明
  const footerY = HEADER_HEIGHT + records.length * LINE_HEIGHT + 20
  ctx.strokeStyle = '#E2E8F0'
  ctx.beginPath()
  ctx.moveTo(PADDING, footerY)
  ctx.lineTo(CANVAS_WIDTH - PADDING, footerY)
  ctx.stroke()

  ctx.fillStyle = '#94A3B8'
  ctx.font = '20px sans-serif'
  ctx.fillText('本记录仅供参考，不作为诊断或治疗依据。', PADDING, footerY + 32)

  return canvas
}

module.exports = { drawRecordsImage }
```

- [ ] **Step 2: 在 records.wxml 底部添加下载按钮**

在全部记录列表的底部（滚动容器内，所有记录之后）添加：

```xml
<view class="records-download-bar">
  <button class="btn-download-records" bind:tap="onDownloadRecords">
    下载记录数据图片
  </button>
</view>
```

样式（`records.wxss`）：

```css
.records-download-bar {
  padding: 32rpx 32rpx 80rpx;
}

.btn-download-records {
  width: 100%;
  background: #3182F7;
  color: #FFFFFF;
  font-size: var(--font-size-body, 28rpx);
  border-radius: 16rpx;
  padding: 28rpx 0;
  border: none;
}
```

- [ ] **Step 3: 在 records.js 中实现 onDownloadRecords**

```js
const { drawRecordsImage } = require('../../utils/records-canvas')

// ...

async onDownloadRecords() {
  const app = getApp()
  await app.loginReady

  const choice = await new Promise(resolve => {
    wx.showActionSheet({
      itemList: ['最近 7 天', '最近 30 天', '最近 90 天'],
      success: res => resolve([7, 30, 90][res.tapIndex]),
      fail: () => resolve(null),
    })
  })
  if (!choice) return

  wx.showLoading({ title: '生成图片中' })
  try {
    const now = new Date()
    const since = new Date(now - choice * 24 * 60 * 60 * 1000)

    // 从已加载的记录中过滤（或重新请求）
    const allRecords = this.data.allRecords || []
    const filtered = allRecords.filter(r => new Date(r.measuredAt) >= since)

    const dateRange = `${since.toLocaleDateString('zh-CN')} 至 ${now.toLocaleDateString('zh-CN')}`
    const familyName = app.globalData.familyProfile && app.globalData.familyProfile.name
      ? `${app.globalData.familyProfile.name}的血压心率记录`
      : '家庭血压心率记录'

    const canvas = wx.createOffscreenCanvas({ type: '2d', width: 750, height: 100 })
    await drawRecordsImage(canvas, {
      records: filtered,
      familyName,
      dateRange,
      profile: app.globalData.familyProfile || {},
    })

    const tempFilePath = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        success: res => resolve(res.tempFilePath),
        fail: reject,
      })
    })

    wx.hideLoading()
    await this.saveImageToAlbum(tempFilePath)
  } catch (err) {
    wx.hideLoading()
    console.error('生成记录图片失败', err)
    wx.showToast({ title: '生成失败，请重试', icon: 'none' })
  }
},

async saveImageToAlbum(filePath) {
  try {
    await wx.saveImageToPhotosAlbum({ filePath })
    wx.showToast({ title: '已保存到相册', icon: 'success' })
  } catch (err) {
    if (err.errMsg && err.errMsg.includes('auth deny')) {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许访问相册',
        confirmText: '去设置',
        success: res => {
          if (res.confirm) wx.openSetting()
        },
      })
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  }
},
```

注意：`this.data.allRecords` 需要是全部记录的数组（不是分组后的结构）。检查 `records.js` 的数据结构，确保有一个平铺的记录数组可用；如没有，在加载完成后同时存储一份。

- [ ] **Step 4: 在开发者工具中验证**

1. 进入全部记录页，滚动到底部，确认"下载记录数据图片"按钮存在。
2. 点击按钮，选择"最近 30 天"，确认 loading 出现后图片保存成功。
3. 检查生成的图片内容：标题、日期范围、每条记录、底部免责声明。
4. 真机验证相册保存。

- [ ] **Step 5: Commit**

```bash
git add pages/records/records.js pages/records/records.wxml pages/records/records.wxss
git add utils/records-canvas.js
git commit -m "feat: add records data image export with day range selector"
```

---

## Task 9: 报告隐私隐藏

**Files:**
- Modify: `pages/report/report.js`
- Modify: `pages/report/report.wxml`
- Modify: `utils/report-canvas.js`

### 背景

报告会被截图发给医生，某些用户不想暴露真实姓名、电话、紧急联系人。需要在报告页增加"隐藏敏感信息"开关，开启后生成的报告图片中这些字段显示为 `***`。

- [ ] **Step 1: 在 report.js data 中增加隐私开关**

```js
data: {
  // ...原有字段...
  hidePrivacy: false,
}
```

- [ ] **Step 2: 在 report.wxml 顶部增加隐私开关**

```xml
<view class="report-privacy-toggle">
  <text class="report-privacy-toggle__label">隐藏姓名和联系人</text>
  <switch checked="{{hidePrivacy}}" bind:change="onTogglePrivacy" color="#3182F7" />
</view>
```

- [ ] **Step 3: 在 report.js 中实现 onTogglePrivacy**

```js
onTogglePrivacy(e) {
  this.setData({ hidePrivacy: e.detail.value })
},
```

修改生成报告图片的调用，将 `hidePrivacy` 传入：

```js
// 调用 drawReportImage 时加入 hidePrivacy 参数
await drawReportImage(canvas, { ...reportData, hidePrivacy: this.data.hidePrivacy })
```

- [ ] **Step 4: 在 report-canvas.js 中处理隐私隐藏**

在绘制姓名、电话、紧急联系人的地方，根据 `hidePrivacy` 决定显示内容：

```js
const displayName = hidePrivacy ? '***' : (profile.name || '未填写')
const displayPhone = hidePrivacy ? '***' : (profile.emergencyContactPhone || '未填写')
const displayContact = hidePrivacy ? '***' : (profile.emergencyContactName || '未填写')
```

- [ ] **Step 5: 在开发者工具中验证**

1. 进入报告页，开启"隐藏姓名和联系人"开关。
2. 导出报告图片，确认图片中姓名/联系人显示为 `***`。
3. 关闭开关，再次导出，确认显示真实信息。

- [ ] **Step 6: Commit**

```bash
git add pages/report/report.js pages/report/report.wxml utils/report-canvas.js
git commit -m "feat: add privacy toggle to hide name and contacts in report image"
```

---

## Task 10: 家庭页无记录空状态

**Files:**
- Modify: `pages/family/family.wxml`
- Modify: `pages/family/family.wxss`

### 背景

当家庭没有任何血压记录时，家庭页的档案信息区域无意义，新用户不知道下一步做什么。需要在记录数为 0 时显示引导文字。

- [ ] **Step 1: 确认 family.js 中有记录数量字段**

检查 `family.js` 的 data，确认是否有 `recordCount` 或类似字段。如没有，在加载家庭数据时顺便读一下 7 天记录数（可以用 getRecords 的返回）并存入 data。

- [ ] **Step 2: 在 family.wxml 中增加空状态提示**

在档案区域的合适位置用 `wx:if` 控制：

```xml
<view wx:if="{{recordCount === 0}}" class="family-empty-tip">
  <text class="family-empty-tip__title">还没有记录</text>
  <text class="family-empty-tip__desc">去「数据」页录入第一条血压心率数据，这里会显示统计和趋势。</text>
  <navigator url="/pages/data/data" open-type="switchTab" class="family-empty-tip__link">
    去录入数据 →
  </navigator>
</view>
```

- [ ] **Step 3: 添加样式**

```css
.family-empty-tip {
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.family-empty-tip__title {
  font-size: var(--font-size-body, 28rpx);
  color: #334155;
  font-weight: 500;
}

.family-empty-tip__desc {
  font-size: var(--font-size-small, 24rpx);
  color: #64748B;
  line-height: 1.6;
}

.family-empty-tip__link {
  font-size: var(--font-size-small, 24rpx);
  color: #3182F7;
}
```

- [ ] **Step 4: 验证**

在开发者工具中将 `recordCount` 临时设为 0，确认空状态提示显示。设为大于 0 时提示消失。

- [ ] **Step 5: Commit**

```bash
git add pages/family/family.wxml pages/family/family.wxss pages/family/family.js
git commit -m "feat: add empty state guidance on family page when no records exist"
```

---

## Task 11: 设置页假功能文案标注

**Files:**
- Modify: `pages/settings/settings.wxml`

### 背景

用药提醒开关、异常通知开关、晨/晚测开关、早晚分线开关当前没有真实生效。用户如果认真配置了，会误以为已开启。需要在每个未生效开关旁添加灰色说明文字，明确"配置已保存，功能即将支持"。

- [ ] **Step 1: 在相关开关下方添加说明文字**

在 `settings.wxml` 中，找到以下开关，逐一在其下方（或旁边）添加说明文字：

**用药提醒开关：**
```xml
<text class="settings-row__hint">配置已保存，提醒推送功能即将上线</text>
```

**异常通知开关：**
```xml
<text class="settings-row__hint">配置已保存，微信通知功能即将上线</text>
```

**晨/晚测标注开关：**
```xml
<text class="settings-row__hint">配置已保存，录入页标注控制即将支持</text>
```

**早晚分线显示开关：**
```xml
<text class="settings-row__hint">配置已保存，图表分线显示即将支持</text>
```

- [ ] **Step 2: 添加 hint 样式**

在 `settings.wxss` 中增加（如果还没有）：

```css
.settings-row__hint {
  font-size: 22rpx;
  color: #94A3B8;
  margin-top: 6rpx;
  display: block;
}
```

- [ ] **Step 3: 验证**

进入设置页，确认每个未生效开关下方都有灰色提示文字，措辞诚实但不让用户产生"功能坏了"的误解。

- [ ] **Step 4: Commit**

```bash
git add pages/settings/settings.wxml pages/settings/settings.wxss
git commit -m "fix: add honest status labels to settings items that are not yet functional"
```

---

## Task 12: 真机验收清单

> 这不是代码任务，是功能验收任务。以下步骤需要两个真实微信账号在真机上完成。

### 前提

- 所有云函数已在微信开发者工具中部署（包括新建的 `removeMember`）
- 小程序已在真机预览或体验版上运行

### 验收步骤

- [ ] **A. 单人录入链路**
  1. 账号 A 首次打开，录入一条血压记录
  2. 确认自动创建家庭记录本，数据页显示刚录入的记录
  3. 全部记录页显示该记录，可编辑、可删除

- [ ] **B. 家庭邀请链路**
  1. 账号 A 进入家庭页，发起分享邀请
  2. 账号 B 收到分享卡片，点击打开
  3. 账号 B 确认加入，确认跳转到数据页（Task 1 修复后）
  4. 账号 B 能看到账号 A 的所有记录

- [ ] **C. 权限链路**
  1. 账号 B 尝试快捷录入：应看到只读提示（Task 2 修复后），无法录入
  2. 账号 A 在家庭页给账号 B 开启录入权限
  3. 账号 B 刷新，可正常录入
  4. 账号 A 关闭账号 B 的编辑权限
  5. 账号 B 尝试编辑记录，后端应拒绝

- [ ] **D. 移除成员链路**
  1. 账号 A 进入家庭页，点击账号 B 的成员卡片
  2. 确认出现"移除成员"按钮
  3. 点击移除，确认二次确认弹窗
  4. 确认后账号 B 从成员列表消失
  5. 账号 B 重新打开小程序，确认无法访问原家庭数据

- [ ] **E. 参考线链路**
  1. 在设置页将高压参考线改为 130，保存
  2. 返回数据页，确认图表虚线位置对应 130
  3. 进入报告页，确认报告图片中参考线显示"130/85 mmHg（家庭自定义）"
  4. 恢复默认，确认恢复为 135/85

- [ ] **F. 图片导出链路**
  1. 数据页下载血压趋势图，确认保存到相册
  2. 全部记录页下载 30 天数据图片，确认保存到相册
  3. 报告页导出报告图片，确认可读性

- [ ] **G. 记录完整验收文档**

在 `mydoc/` 下创建 `real-device-test-YYYY-MM-DD.md`，记录：
- 测试日期
- 设备型号
- 通过的验收项
- 发现的问题列表
- 结论（是否达到 v1.0 标准）
