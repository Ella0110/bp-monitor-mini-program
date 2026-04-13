# Zero-Friction Recording MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户第一次打开小程序就能保存血压/心率记录，并在保存第一条记录时静默创建默认记录空间，同时保持现有“数据 / 家庭”两 tab 和家庭页视觉骨架。

**Architecture:** 本阶段采用兼容式改造：继续复用现有 `families` 集合作为“记录空间”的后端容器，只在前台文案上弱化“家庭组”，避免一次性迁移到完整 `recordBooks` 模型。首次保存无 `familyId` 的记录时，由 `saveRecord` 云函数创建默认 `我的记录` 容器并返回 `familyId`，前端写回 `app.globalData.familyId` 后刷新数据页。

**Tech Stack:** 微信小程序原生 WXML/WXSS/JS、微信云开发云函数、CloudBase 数据库集合 `users` / `families` / `records`。

---

## Scope

本计划只做“初心层 MVP”：

- 数据页没有家庭/档案时也能保存第一条记录。
- 档案、紧急联系人、用药、邀请家人都变成保存记录后的可选增强。
- 家庭页保留现有布局，把“创建家庭组 / 加入家庭组”文案改成“创建我的记录 / 查看家人的记录”。
- 设置页入口放在家庭页右上角，不新增底部 tab。
- 不在本阶段实现完整多记录本 Switcher、自动合并、离线队列、邀请码 hash、服务端限流、记录本迁移 UI。相关边界已经写入 `docs/superpowers/specs/2026-04-13-recordbook-zero-friction-design.md`，后续作为独立计划拆分。

## File Structure

- Modify `cloudfunctions/saveRecord/index.js`
  - 在没有 `familyId` 且新增记录时，静默创建默认记录空间。
  - 返回 `{ success, id, familyId }`，让前端能同步全局状态。
- Modify `pages/data/data.js`
  - 增加数据页首屏快速录入表单状态与保存方法。
  - 无 `familyId` 时不再只展示“还没有记录”，而是展示可直接填写的表单。
- Modify `pages/data/data.wxml`
  - 在空状态卡片中加入高压、低压、心率输入框和“保存记录”按钮。
  - 增加轻入口文案：“查看家人的记录？输入邀请码”。
- Modify `pages/data/data.wxss`
  - 增加快速录入表单样式，保持现有蓝色医疗健康风格。
- Modify `pages/add-record/add-record.js`
  - 取消“请先创建或加入家庭组”的硬拦截。
  - 保存成功后接收 `familyId` 并写入 `app.globalData.familyId`。
- Modify `pages/family/family.js`
  - 新增设置入口跳转方法。
  - 调整创建和加入文案相关逻辑，继续调用现有云函数。
- Modify `pages/family/family.wxml`
  - 右上角添加设置图标入口。
  - 空状态从“加入家庭组”调整为“开始自己的记录 / 查看家人的记录”。
  - 档案卡增加“仅用于报告展示，可填写昵称或简称”的信任提示。
- Modify `pages/family/family.wxss`
  - 添加设置图标和提示文案样式。
- Create `scripts/verify-zero-friction-mvp.js`
  - 静态检查关键文件中不再存在阻断首条记录的旧文案，并确认 `saveRecord` 返回 `familyId`。

---

### Task 1: Make `saveRecord` Auto-Provision a Default Record Space

**Files:**
- Modify: `cloudfunctions/saveRecord/index.js`

- [ ] **Step 1: Add default family helpers near the top of `cloudfunctions/saveRecord/index.js` after `const db = cloud.database()`**

```js
function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toUpperCase()
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

async function createDefaultFamily(openid) {
  const familyRes = await db.collection('families').add({
    data: {
      displayName: '我的记录',
      inviteCode: randomCode(),
      inviteToken: randomToken(),
      createdBy: openid,
      members: [{
        openid,
        role: 'admin',
        nickname: '我',
        avatarUrl: '',
        canWrite: true,
        canEdit: true,
        joinedAt: db.serverDate(),
      }],
      profile: createDefaultProfile(),
      settings: createDefaultSettings(),
      createdAt: db.serverDate(),
    },
  })

  const userRef = db.collection('users').doc(openid)
  await userRef.update({
    data: { familyId: familyRes._id, role: 'admin' },
  }).catch(() => userRef.set({
    data: {
      nickname: '',
      avatarUrl: '',
      familyId: familyRes._id,
      role: 'admin',
      preferences: {},
      createdAt: db.serverDate(),
    },
  }))

  return familyRes._id
}
```

- [ ] **Step 2: Change `normalizeRecord` to receive the resolved family id**

Replace:

```js
function normalizeRecord(event, openid) {
```

with:

```js
function normalizeRecord(event, openid, familyId) {
```

Then replace this property:

```js
familyId: event.familyId,
```

with:

```js
familyId,
```

- [ ] **Step 3: Add a helper that resolves write access**

Add this function below `normalizeRecord`:

```js
async function resolveWritableFamily(event, openid) {
  if (!event.familyId) {
    if (event.id) {
      return { success: false, error: '缺少记录所属空间' }
    }
    const familyId = await createDefaultFamily(openid)
    const family = (await db.collection('families').doc(familyId).get()).data
    const member = requireMember(family, openid)
    return { success: true, familyId, family, member }
  }

  const family = (await db.collection('families').doc(event.familyId).get()).data
  const member = requireMember(family, openid)
  return { success: true, familyId: event.familyId, family, member }
}
```

- [ ] **Step 4: Replace the start of `exports.main`**

Replace:

```js
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const family = (await db.collection('families').doc(event.familyId).get()).data
  const member = requireMember(family, OPENID)
  const data = normalizeRecord(event, OPENID)
```

with:

```js
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const resolved = await resolveWritableFamily(event, OPENID)
  if (!resolved.success) return resolved

  const { familyId, member } = resolved
  const data = normalizeRecord(event, OPENID, familyId)
```

- [ ] **Step 5: Update ownership validation and return values**

Replace:

```js
if (existing.familyId !== event.familyId) return { success: false, error: '记录不属于当前家庭组' }
```

with:

```js
if (existing.familyId !== familyId) return { success: false, error: '记录不属于当前记录' }
```

Replace:

```js
return { success: true, id: event.id }
```

with:

```js
return { success: true, id: event.id, familyId }
```

Replace:

```js
return { success: true, id: res._id }
```

with:

```js
return { success: true, id: res._id, familyId }
```

- [ ] **Step 6: Manual cloud verification**

Deploy `saveRecord` in WeChat DevTools. With a fresh user that has no `familyId`, call the add-record flow and save `130 / 80 / 72`.

Expected:

```text
保存成功
users 当前 openid 有 familyId
families 出现 displayName = 我的记录
records 第一条记录 familyId = 新创建的 familyId
```

---

### Task 2: Add First-Screen Quick Recording on the Data Tab

**Files:**
- Modify: `pages/data/data.js`
- Modify: `pages/data/data.wxml`
- Modify: `pages/data/data.wxss`

- [ ] **Step 1: Add quick form state to `pages/data/data.js`**

Inside `data`, add these fields after `loading: false,`:

```js
quickForm: {
  systolic: '',
  diastolic: '',
  heartRate: '',
},
quickSaving: false,
```

- [ ] **Step 2: Add quick form methods to `pages/data/data.js` before `onAddRecord()`**

```js
onQuickInput(e) {
  const field = e.currentTarget.dataset.field
  this.setData({ [`quickForm.${field}`]: e.detail.value })
},

validateQuickForm() {
  const sys = Number(this.data.quickForm.systolic)
  const dia = Number(this.data.quickForm.diastolic)
  const hr = Number(this.data.quickForm.heartRate)
  if (!sys || sys < 60 || sys > 300) {
    wx.showToast({ title: '高压值不正确', icon: 'none' })
    return false
  }
  if (!dia || dia < 40 || dia > 200) {
    wx.showToast({ title: '低压值不正确', icon: 'none' })
    return false
  }
  if (!hr || hr < 30 || hr > 250) {
    wx.showToast({ title: '心率不正确', icon: 'none' })
    return false
  }
  return true
},

async onQuickSave() {
  if (!this.validateQuickForm()) return
  const app = getApp()
  this.setData({ quickSaving: true })
  try {
    const res = await wx.cloud.callFunction({
      name: 'saveRecord',
      data: {
        familyId: app.globalData.familyId || undefined,
        systolic: Number(this.data.quickForm.systolic),
        diastolic: Number(this.data.quickForm.diastolic),
        heartRate: Number(this.data.quickForm.heartRate),
        measuredAt: new Date().toISOString(),
        period: null,
      },
    })
    if (!res.result.success) {
      wx.showToast({ title: res.result.error || '保存失败', icon: 'none' })
      return
    }
    if (res.result.familyId) app.globalData.familyId = res.result.familyId
    this.setData({
      quickForm: { systolic: '', diastolic: '', heartRate: '' },
    })
    wx.showToast({ title: '保存成功', icon: 'success' })
    await this.loadRecords()
  } finally {
    this.setData({ quickSaving: false })
  }
},

onJoinByCodeTap() {
  wx.showModal({
    title: '输入邀请码',
    editable: true,
    placeholderText: '请输入邀请码',
    content: '如果家人发给你的是微信邀请卡片，直接点开卡片即可查看记录。',
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
  const app = getApp()
  app.globalData.familyId = res.result.familyId
  wx.showToast({ title: '加入成功', icon: 'success' })
  await this.loadRecords()
},
```

- [ ] **Step 3: Replace the empty latest card in `pages/data/data.wxml`**

Replace:

```xml
<view wx:else class="latest-card empty-card">
  <text>还没有记录</text>
</view>
```

with:

```xml
<view wx:else class="latest-card empty-card">
  <text class="empty-title">还没有记录</text>
  <text class="empty-sub">先记一条血压心率，图表会自动生成</text>
  <view class="quick-grid">
    <input class="quick-input" type="number" value="{{quickForm.systolic}}" data-field="systolic" bindinput="onQuickInput" placeholder="高压" />
    <input class="quick-input" type="number" value="{{quickForm.diastolic}}" data-field="diastolic" bindinput="onQuickInput" placeholder="低压" />
    <input class="quick-input" type="number" value="{{quickForm.heartRate}}" data-field="heartRate" bindinput="onQuickInput" placeholder="心率" />
  </view>
  <button class="quick-save" loading="{{quickSaving}}" bindtap="onQuickSave">保存记录</button>
  <text class="join-link" bindtap="onJoinByCodeTap">查看家人的记录？输入邀请码</text>
</view>
```

- [ ] **Step 4: Hide the duplicate add button when there is no record**

Replace:

```xml
<button class="add" bindtap="onAddRecord">＋ 添加记录</button>
```

with:

```xml
<button wx:if="{{latestRecord}}" class="add" bindtap="onAddRecord">＋ 添加记录</button>
```

- [ ] **Step 5: Add styles to `pages/data/data.wxss`**

Append:

```css
.empty-title { display: block; color: #0F172A; font-size: 34rpx; font-weight: 800; margin-bottom: 10rpx; }
.empty-sub { display: block; color: #64748B; font-size: 26rpx; margin-bottom: 24rpx; }
.quick-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14rpx; margin-bottom: 20rpx; }
.quick-input { min-height: 84rpx; background: #F8FBFF; border-radius: 18rpx; text-align: center; color: #0F172A; font-size: 30rpx; font-weight: 800; }
.quick-save { min-height: 88rpx; background: #3182F7; color: #fff; border-radius: 22rpx; font-size: 32rpx; font-weight: 800; margin: 8rpx 0 18rpx; }
.join-link { color: #3182F7; font-size: 26rpx; font-weight: 700; }
```

- [ ] **Step 6: Manual UI verification**

Open WeChat DevTools with a user that has no `familyId`.

Expected:

```text
数据 tab 首屏显示高压 / 低压 / 心率输入框
点击保存记录后显示保存成功
最近一次卡片出现刚才保存的数据
血压图表和心率图表从空状态进入有数据状态
```

---

### Task 3: Keep the Existing Add Record Page Compatible With Zero-Friction Save

**Files:**
- Modify: `pages/add-record/add-record.js`

- [ ] **Step 1: Remove the hard block in `onSave()`**

Delete this block:

```js
if (!app.globalData.familyId) {
  wx.showToast({ title: '请先创建或加入家庭组', icon: 'none' })
  return
}
```

- [ ] **Step 2: Make `familyId` optional in the save payload**

Replace:

```js
familyId: app.globalData.familyId,
```

with:

```js
familyId: app.globalData.familyId || undefined,
```

- [ ] **Step 3: Store returned `familyId` after a successful save**

Insert after the `if (!res.result.success) { ... }` block:

```js
if (res.result.familyId) app.globalData.familyId = res.result.familyId
```

- [ ] **Step 4: Manual verification**

From the data tab, use `＋ 添加记录` after deleting local user/family test state or with a new test openid.

Expected:

```text
没有 familyId 时也能保存成功
保存后返回数据 tab
再次进入添加记录页不再提示“请先创建或加入家庭组”
```

---

### Task 4: Adjust Family Tab Copy and Add Settings Entry

**Files:**
- Modify: `pages/family/family.js`
- Modify: `pages/family/family.wxml`
- Modify: `pages/family/family.wxss`

- [ ] **Step 1: Add settings navigation method to `pages/family/family.js`**

Add before `onCreateFamily()`:

```js
onSettingsTap() {
  wx.navigateTo({ url: '/pages/settings/settings' })
},
```

- [ ] **Step 2: Update join modal wording in `pages/family/family.js`**

Replace:

```js
placeholderText: '6位邀请码',
content: '如果家人发给你的是微信邀请卡片，直接点开卡片即可加入。',
```

with:

```js
placeholderText: '请输入邀请码',
content: '如果家人发给你的是微信邀请卡片，直接点开卡片即可查看记录。',
```

- [ ] **Step 3: Update share title in `pages/family/family.js`**

Replace:

```js
title: `邀请你加入「${family.displayName || '家庭健康记录'}」`,
```

with:

```js
title: `邀请你查看「${family.displayName || '健康记录'}」`,
```

- [ ] **Step 4: Add a settings icon in `pages/family/family.wxml` header**

Replace:

```xml
<view class="fam-header">
  <text class="fam-title">家庭</text>
</view>
```

with:

```xml
<view class="fam-header">
  <text class="fam-title">家庭</text>
  <view class="settings-entry" bindtap="onSettingsTap">⚙</view>
</view>
```

- [ ] **Step 5: Update empty state wording in `pages/family/family.wxml`**

Replace:

```xml
<text class="empty-title">你还没有加入家庭组</text>
<button class="primary" bindtap="onCreateFamily">创建家庭组</button>
<button class="secondary" bindtap="onJoinFamilyTap">加入家人的家庭组</button>
<text class="empty-hint">如果家人发给你的是微信邀请卡片，直接点开卡片即可加入。</text>
```

with:

```xml
<text class="empty-title">还没有健康记录</text>
<button class="primary" bindtap="onCreateFamily">创建我的记录</button>
<button class="secondary" bindtap="onJoinFamilyTap">查看家人的记录</button>
<text class="empty-hint">有家人发来的微信邀请卡片时，直接点开卡片即可查看。</text>
```

- [ ] **Step 6: Add optional-profile trust hint in `pages/family/family.wxml`**

Add this line inside the profile card after `</view>` of `.profile-grid`:

```xml
<text class="trust-hint">仅用于报告展示，您可以填写昵称或简称。</text>
```

- [ ] **Step 7: Add header and trust hint styles to `pages/family/family.wxss`**

Append:

```css
.fam-header { display: flex; align-items: center; justify-content: space-between; }
.settings-entry { width: 64rpx; height: 64rpx; border-radius: 50%; background: #EAF2FF; color: #64748B; display: flex; align-items: center; justify-content: center; font-size: 34rpx; font-weight: 800; }
.trust-hint { display: block; color: #94A3B8; font-size: 24rpx; line-height: 1.5; margin-top: 20rpx; }
```

- [ ] **Step 8: Manual verification**

Open the family tab in three states.

Expected:

```text
无 familyId：按钮显示“创建我的记录”和“查看家人的记录”
有 familyId：右上角有设置图标，点击进入设置页
档案卡：显示“仅用于报告展示，您可以填写昵称或简称。”
邀请面板：微信分享标题为“邀请你查看「健康记录」”
```

---

### Task 5: Add Static Verification Script

**Files:**
- Create: `scripts/verify-zero-friction-mvp.js`

- [ ] **Step 1: Create the verification script**

```js
const fs = require('fs')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assertIncludes(path, text) {
  const content = read(path)
  if (!content.includes(text)) {
    throw new Error(`${path} should include: ${text}`)
  }
}

function assertNotIncludes(path, text) {
  const content = read(path)
  if (content.includes(text)) {
    throw new Error(`${path} should not include: ${text}`)
  }
}

assertIncludes('cloudfunctions/saveRecord/index.js', 'async function createDefaultFamily')
assertIncludes('cloudfunctions/saveRecord/index.js', 'return { success: true, id: res._id, familyId }')
assertIncludes('pages/data/data.js', 'async onQuickSave()')
assertIncludes('pages/data/data.wxml', '查看家人的记录？输入邀请码')
assertIncludes('pages/family/family.wxml', '创建我的记录')
assertIncludes('pages/family/family.wxml', '查看家人的记录')
assertIncludes('pages/family/family.wxml', '仅用于报告展示，您可以填写昵称或简称。')
assertNotIncludes('pages/add-record/add-record.js', '请先创建或加入家庭组')

console.log('zero-friction MVP static checks passed')
```

- [ ] **Step 2: Run the script**

Run:

```bash
node scripts/verify-zero-friction-mvp.js
```

Expected:

```text
zero-friction MVP static checks passed
```

- [ ] **Step 3: Commit verification script with implementation changes**

```bash
git add cloudfunctions/saveRecord/index.js pages/data/data.js pages/data/data.wxml pages/data/data.wxss pages/add-record/add-record.js pages/family/family.js pages/family/family.wxml pages/family/family.wxss scripts/verify-zero-friction-mvp.js
git commit -m "feat: allow first record without setup"
```

---

## End-to-End Manual Verification

Run these checks in WeChat DevTools after deploying `saveRecord`.

### Fresh User

```text
1. 清理或切换到没有 familyId 的测试用户。
2. 打开小程序，默认落在数据 tab。
3. 输入 130 / 80 / 72。
4. 点击保存记录。
5. 看到保存成功。
6. 看到最近一次记录、统计卡片、血压图表、心率图表。
7. 进入家庭 tab，看到当前记录的档案卡，可选编辑。
```

### Existing User

```text
1. 使用已有 familyId 的测试用户。
2. 数据 tab 能正常加载历史记录。
3. 点击添加记录进入原添加页。
4. 保存一条新记录。
5. 数据 tab 刷新后显示最新记录。
```

### Join Copy

```text
1. 家庭 tab 无记录状态显示“查看家人的记录”。
2. 点击后弹出输入邀请码弹窗。
3. 弹窗说明微信邀请卡片是主路径，邀请码是兜底路径。
```

---

## Review Notes

- 本计划故意不改数据库集合名，避免现在引入 `recordBooks` 数据迁移风险。
- `families` 在本阶段承担“记录空间”职责，前台文案先改为“记录 / 家人的记录”。
- 多记录本 Switcher、邀请码 hash、限流、离线队列、合并迁移是独立功能，不和首屏记录体验绑在同一个实现里。
- 2026-04-13 追加决策：MVP 前端隐藏手动邀请码入口，只保留微信分享卡片；后端 `inviteCode` 兼容先保留，后续需要时再上线。
- 如果实现时发现 `createFamily` 和 `saveRecord` 的默认 profile/settings 字段不一致，优先按 `utils/family-settings.js` 的 `createDefaultProfile()` 和 `createDefaultSettings()` 对齐。

## Future Backlog

这些内容不进入本阶段实现，但不能丢。后续做独立 spec / plan 时，以 `docs/superpowers/specs/2026-04-13-recordbook-zero-friction-design.md` 为准。

### Backlog 1: 完整记录本模型

目标：

```text
把用户可见概念从“家庭组”正式升级为“健康记录本”
```

需要处理：

- 新增 `recordBooks` 集合，或把现有 `families` 平滑迁移为 `recordBooks`。
- 顶部标题变成全局 Switcher：`我的记录`、`爸爸的记录`、`妈妈的记录`、`+ 新增记录`、`输入邀请码`。
- 数据 tab、家庭 tab、报告页、全部记录页都跟随当前记录本切换。
- 家庭 tab 展示当前记录本的照护成员，不展示用户所有记录本的成员。

### Backlog 2: 记录本迁移与合并

目标：

```text
避免用户先用“我的记录”记了爸爸的数据，后来加入正式“爸爸的记录”后觉得数据丢失
```

需要处理：

- 接受邀请时，如果当前默认记录已有数据，不自动合并。
- 提供三个明确选项：`保留为我的记录`、`复制到爸爸的记录`、`移动到爸爸的记录`。
- 复制 / 移动时保留审计字段：`sourceRecordBookId`、`migratedFromRecordId`、`migratedAt`、`migratedBy`。
- V1 默认推荐 `保留为我的记录`，降低误操作风险。

### Backlog 3: 权限模型收敛

目标：

```text
把用户能理解的权限从 canWrite / canEdit 开关收敛成角色
```

建议角色：

- `观察者`：只能查看。
- `协作者`：可以新增记录，可以修改自己新增的记录。
- `管理员`：可以编辑档案、设置、邀请、成员权限和所有记录。

实现注意：

- 后端仍可保留 `canWrite` / `canEdit` 字段，但 UI 不直接暴露两个生硬开关。
- 如果协作者修改别人录入的数据，提示“你只能修改自己录入的记录，可向管理员申请权限”。

### Backlog 4: 邀请安全

目标：

```text
把邀请链接和邀请码绑定到单个记录本，并降低撞码风险
```

需要处理：

- 微信分享卡片是主路径，`inviteToken` 绑定单个记录本。
- 手动邀请码是兜底路径，至少 8 位，使用不易混淆字符集。
- 服务端只保存邀请码 hash，不保存明文码。
- 验证邀请码需要限流：按 `openid`、设备、IP 或云函数可获得的调用上下文做失败次数限制。
- 多次失败后短时间锁定。
- 邀请默认 24 小时有效；如果业务坚持 48 小时，邀请码长度和限流策略必须一起调整。

### Backlog 5: 离线与并发

目标：

```text
医院或家庭网络较差时，不让用户录入的数据丢失
```

需要处理：

- 新增记录可以离线暂存，标记 `syncStatus=pending`。
- 没有远程记录本时，先创建本地临时记录空间，联网后创建远程记录本并上传记录。
- 编辑 / 删除本阶段不支持离线，避免并发冲突。
- 记录增加 `version` 和 `updatedAt`。
- 修改记录时带版本号；如果版本不一致，提示“这条记录已被家人更新，请刷新后再修改”。

### Backlog 6: 隐私、注销与报告打码

目标：

```text
把健康数据的采集、使用、删除、分享边界说清楚，并给用户可执行的控制入口
```

需要处理：

- 隐私说明明确：数据用途、可见范围、保存位置、保存期限、删除方式。
- 档案页提示：“仅用于报告展示，您可以填写昵称或简称。”
- 支持删除单条记录。
- 支持删除整个记录本。
- 支持移除成员；成员被移除后不能再访问该记录本。
- 报告导出增加“隐藏姓名/电话”选项，只显示档案称呼或打码信息。
