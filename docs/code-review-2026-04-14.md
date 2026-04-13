# 血压心率小程序 — 全面 Code Review

> 作者：Claude Code（以资深工程师视角）
> 日期：2026-04-14
> 参考：`mockup.html` 为目标 UI 标准，`docs/system-design.md` 为设计文档

---

## 总体印象

这个项目的**方向是对的**：技术栈选择合理（原生微信小程序 + CloudBase），系统设计文档写得认真，功能边界清晰，工具层拆分也有自己的逻辑。代码风格整洁，命名基本可读，没有出现明显的屎山。

但问题也是真实存在的：**有几个 bug 会在真实使用中稳定复现**，**UI 和 mockup 的差距很大**，**字体大小等核心适老化功能根本没生效**。以下逐一展开。

---

## 一、项目结构

### 整体评价：合理，但文档与代码脱节

```
bp-monitor-mini-program-chatgpt/
├── app.js / app.json / app.wxss
├── pages/          ✅ 按功能分页，结构清晰
├── utils/          ✅ 工具层有分工
├── cloudfunctions/ ✅ 按职责拆分云函数
├── assets/icons/   ✅
└── docs/           ✅ 有设计文档
```

**具体问题：**

**1. 设计文档里的模块名和实际文件名对不上**
`docs/system-design.md` 第 4.3 节写的工具文件：

| 文档里写的 | 实际文件 |
|---|---|
| `bp.js` | `health-rules.js` |
| `chart.js` | `chart-data.js` |

这说明文档是早期版本，没有随代码迭代更新。时间长了文档就成了误导。

**2. 设计文档提到的 `components/` 目录不存在**
第 4.2 节写了 `bp-card`、`bp-chart`、`hr-chart` 三个组件，但代码里没有 `components/` 目录。所有逻辑都塞在了 `pages/data/data.wxml`（119行）和 `data.js`（376行）里。这不是致命问题，但后期维护会越来越痛。

**3. `app.globalData.settings` 是僵尸字段**
`app.js` 声明了 `globalData.settings: {}`，但整个项目里没有任何地方往里写，也没有任何地方读它。这是一个死代码，会让后来读代码的人困惑。

**4. `createDefaultProfile` / `createDefaultSettings` 重复定义**
- `utils/family-settings.js` 里定义了一份
- `cloudfunctions/saveRecord/index.js` 里又定义了一份（基本相同）
- `cloudfunctions/_shared/auth.js` 里也有一份（explorer agent 提到了这点）

云函数之间没有复用一套，如果以后要加字段，需要改多处。

**5. 无 `.gitignore` 内容**
`project.config.json` 里的 appid 是 `"__WECHAT_APPID__"`（占位符），但如果真实 appid 被提交进去过，git 历史里会有。建议确认。

---

## 二、代码质量

### 严重 Bug（会在真实使用中复现）

**Bug 1：登录时序竞态 — 概率最高，影响最大**

`app.js`:
```js
onLaunch() {
  wx.cloud.init(...)
  this.doLogin()  // ← 异步，但没有 await，也没有回调
},
async doLogin() {
  const res = await wx.cloud.callFunction({ name: 'login' })
  this.globalData.familyId = result.familyId || ''
  ...
}
```

`data/data.js`:
```js
onShow() {
  this.loadRecords()  // ← 立即执行，此时 familyId 可能还是 ''
},
async loadRecords() {
  const app = getApp()
  if (!app.globalData.familyId) {  // ← 如果 login 还没回来，这里就是空
    // 直接 return，显示空状态
    return
  }
```

**结果**：在网络稍慢的情况下，用户打开小程序会看到数据页完全空白（没有记录、没有图表），刷新后才有数据。老人用户不会知道要刷新，会以为数据丢了。

**修复方向**：在 `app.js` 里用回调模式或者 Promise 暴露 login 结果，页面等待 login 完成再拉数据。常见做法是 `app.loginPromise`，页面 onShow 里 `await app.loginPromise`。

---

**Bug 2：达标统计完全不用用户的目标血压值**

`data/data.js`，第 86 行：
```js
stats: {
  ...countReferenceStats(records, {}),  // ← 传了空对象
  avg: calcAverage(records),
},
```

`utils/health-rules.js`，`countReferenceStats` 的签名是：
```js
function countReferenceStats(records, profile) {
  const bpTarget = {
    systolic: profile && profile.targetSystolic,  // ← undefined
    diastolic: profile && profile.targetDiastolic, // ← undefined
  }
```

然后 `getBPStatus` 里：
```js
const tSys = Number(target && target.systolic) || 135
const tDia = Number(target && target.diastolic) || 85
```

**结果**：统计达标次数时，用的是硬编码的 135/85，而不是用户在档案里设置的目标血压值（比如医生建议某个老人控制在 130/80）。家庭页存了 `targetSystolic` 和 `targetDiastolic`，但数据页统计时完全忽略了。

---

**Bug 3：字体大小设置保存了但完全没有生效**

`settings.js` 里可以修改 `fontSize`（standard/large/xlarge），代码正确地调云函数保存了。

但是——整个前端代码里，**没有任何地方读取 `family.settings.fontSize` 并应用到 CSS**。

`mockup.html` 里通过 `--fs` CSS 变量控制字号：
```js
document.documentElement.style.setProperty('--fs', scale);
```
而 `app.wxss` 甚至都没有声明 `--fs` 变量，更没有用它。

**结果**：老人调了字体大小，什么都没发生。这是对用户的欺骗，也是最影响适老化的缺失功能。

---

**Bug 4：`add-record` 页面的数据传递方式脆弱**

`records.js`，`onEdit` 方法：
```js
wx.navigateTo({
  url: `/pages/add-record/add-record?record=${encodeURIComponent(JSON.stringify(record))}`,
})
```

把整个 record 对象序列化塞进 URL 参数。微信小程序 URL 长度有限制，而且 `record` 里有 `bpStatus` 这个动态计算的字段也被塞进去了（在 `loadRecords` 里 map 时加的），虽然目前不大，但这是不稳定的设计。

正确做法是只传 `_id`，在 `add-record` 的 `onLoad` 里根据 id 调云函数获取数据。

---

**Bug 5：`data/data.js` 的 `loadRecords` 没有错误处理**

`family.js` 有 try/catch，`records.js` 有 try/catch，但 `data/data.js` 的 `loadRecords` 没有：

```js
async loadRecords() {
  ...
  const res = await wx.cloud.callFunction(...)  // ← 如果抛异常，loading 永远 true
  ...
  this.setData({ loading: false })
```

网络超时或云函数报错时，页面会卡在 loading 状态，用户没有任何反馈。

---

### 中等问题

**问题 6：`family.js` 每次进入页面都串行调两个云函数**

```js
async loadFamily() {
  const res = await wx.cloud.callFunction({ name: 'getFamily', ... })   // 第一次等待
  const recordRes = await wx.cloud.callFunction({ name: 'getRecords', ... })  // 第二次等待
```

两个请求完全独立，却串行执行，导致加载时间是两倍。改成 `Promise.all` 可以减少一半等待时间。

---

**问题 7：`settings.js` 通知对象选择逻辑错误**

`onNotifyMembersTap` 用 `wx.showActionSheet` 实现多人选择：
```js
wx.showActionSheet({
  itemList: this.data.members.map(member => member.nickname || '家人'),
  success: (res) => {
    const member = this.data.members[res.tapIndex]
    const current = this.data.settings.notifyMemberIds || []
    const exists = current.includes(member.openid)
    const notifyMemberIds = exists ? current.filter(...) : current.concat(...)
    this.updateSettings({ notifyMemberIds })
  },
})
```

`showActionSheet` 每次只能选一个，但通知对象需要选多个。而且没有任何 UI 显示哪些人已经被选上了。用户根本无法知道当前的通知对象是谁。

Mockup 里展示的是 "全部成员 ›"，当前代码是 "X人 ›"，都没有解决真正的多选 UI 问题。

---

**问题 8：心率目标上限默认值前后不一致**

`utils/health-rules.js`：
```js
function getHRStatus(heartRate, target) {
  const max = Number(target && target.max) || 80  // ← 默认 80
```

`utils/family-settings.js`：
```js
// createDefaultProfile 里没有 targetHRMax
// normalizeSettings 里也没有
```

`docs/system-design.md`（数据模型）：
```
targetHRMax  Number   目标心率上限（默认 100）
```

一个地方默认 80，文档说默认 100。结果是：心率 85 bpm 会被判为"偏快（注意）"，但这在正常范围内。对一个监测老人健康的应用来说，这会产生不必要的焦虑。

另外，`createDefaultProfile` 里根本没有 `targetHRMin` 和 `targetHRMax` 字段，`countReferenceStats` 传 profile 给 `getHRStatus` 时，target 会是 `{ min: undefined, max: undefined }`，最终还是用默认值 80。

---

**问题 9：`settings.js` 并发写入问题**

`onToggle`、`onThresholdChange`、`onTimeChange` 都直接调 `updateSettings`，没有防抖（debounce）也没有队列。如果用户快速连续操作（比如连续点两个 toggle），会触发两个并发的 `updateFamilySettings` 云函数调用，后者可能覆盖前者的修改，导致数据丢失。

阈值输入用了 `bindblur`（失焦触发），这相对合理，但如果用户同时改多个字段再快速切出，还是有问题。

---

**问题 10：`getBPStatus` 的默认目标值是 135 而不是 140**

```js
const tSys = Number(target && target.systolic) || 135  // ← 为什么是 135
const tDia = Number(target && target.diastolic) || 85
```

中国高血压指南家庭血压标准是 **135/85**（这个是对的，家庭血压比诊室低5mmHg），但 `docs/system-design.md` 里写的是：

```
targetSystolic   Number   目标高压（默认 140）
```

文档和代码不一致。135/85 其实是正确的医学标准（家庭血压），但文档说 140 会让维护者困惑。需要统一并加注释说明来源。

---

**问题 11：`canvas-charts.js` 的 Canvas API 混用**

```js
function setLineDash(ctx, dash) {
  if (ctx.setLineDash) ctx.setLineDash(dash, 0)
}
```

Canvas 2D API（type="2d"，新版）的 `setLineDash` 签名是 `ctx.setLineDash(segments)`，不需要第二个参数。旧版 1D context 的 `setLineDash(pattern, offset)` 才有两个参数。但代码里已经是 type="2d" 的新 Canvas，多传的 `0` 可能在某些设备上被当成 `segments` 的第二个参数忽略，也可能在某些版本的基础库里触发警告。

---

**问题 12：`randomCode` 碰撞风险**

```js
function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}
```

生成 6 位邀请码，字符集是 0-9 + a-z = 36 个字符，总空间 36^6 ≈ 2.17 亿。对于家庭内部使用够了，但没有碰撞检测——如果生成了一个已存在的邀请码，`joinFamily` 会让用户加入错误的家庭。正确做法是生成后检查是否已存在，若存在则重新生成。

---

### 轻微问题

- `family.js` 里 `onMemberPermissionToggle` 更新成功后只 setData 了 `selectedMember`，没有同步更新 `family.members` 数组，然后调 `loadFamily()` 刷新，有短暂的不一致
- `records.js` 的删除成功后重新拉取全部记录，更好的做法是本地过滤
- `data.js` 快速切换周期（7天/30天/90天）会触发多个并发请求，没有取消旧请求的机制
- `family.js` 里 `onShareAppMessage` 路径里用的是 `inviteToken`，但 `joinFamily` 的实现是通过 `inviteCode`，两套系统（token vs code）存在但各自独立，没有形成闭环文档

---

## 三、UI 实现 vs mockup.html

**一句话总结**：当前 UI 和 mockup 的差距很大，主要体现在数据页主卡片、家庭页结构、全部记录页细节。总体观感是 mockup 精致，当前实现是"能用但不好看"。

---

### 数据页（Tab 1）

| 元素 | mockup.html | 当前实现 | 差距等级 |
|------|-------------|----------|----------|
| 最新记录卡结构 | 毛玻璃外卡 + 白色内卡（两层） | 只有一层毛玻璃卡（`.device-card`） | 🔴 大 |
| 高压字体 | 52px，单独一行，超大 | 88rpx ≈ 44px，结构用绝对定位 | 🟡 中 |
| 低压+心率布局 | 同行 flex 并排 | `position: absolute` 固定定位，位置生硬 | 🔴 大 |
| BP 状态条 | 右侧 8px 宽三段竖条（红/橙/绿，当前段高亮） | **不存在** | 🔴 大 |
| ECG 图标 | 右上角半透明心电图 SVG | **不存在**，用了 `⌁` 波形字符 | 🟡 中 |
| 流量灯（`.traffic`） | **不存在** | 自己加了三色竖条，mockup 里没有 | 🟡 多余 |
| 时间格式 | "最近一次记录时间：2026/4/12 08:30 晨测" | 基本一致，但没有晨/晚测标注 | 🟡 中 |
| 添加按钮 | 文字固定"＋ 添加记录" | 输入中变为"正在录入"（不同） | 🟢 小 |
| 图表统计数字字号 | 24px（`sn`）/ 18px（`sn.sm`） | 48rpx / 36rpx（基本一致） | 🟢 小 |
| 图表图例 | HTML 元素，在卡片外部 | Canvas 内部绘制，视觉效果弱 | 🟡 中 |
| "全部记录" 入口 | 点击后是 overlay（在页面内弹出） | navigate 到独立页面 | 🟡 中 |

**最大问题是主卡片**。mockup 里的设计很有层次感：外层是毛玻璃大卡，内层是白色小卡，右侧有彩色状态条，是一个信息密度高且视觉清晰的设计。当前实现用 `position: absolute` 把数字定位在一个浅灰色背景上，视觉单薄，三个数值的布局关系不清晰，老人看起来容易弄混哪个是高压哪个是低压。

---

### 全部记录页（records）

| 元素 | mockup.html | 当前实现 | 差距等级 |
|------|-------------|----------|----------|
| 整体进入方式 | overlay 覆盖在数据页上 | 独立导航页 | 🟡 中 |
| 页头 | 蓝色渐变 header | 默认白色导航栏 | 🟡 中 |
| 状态徽章 | 圆角标签（正常=绿、注意=橙、危险=红） | 无徽章，只在 BP 数值后跟文字 `· 参考范围内` | 🔴 大 |
| 晨/晚测标签 | 蓝色药丸小标签（`晨测`/`晚测`） | 有实现，但样式较简单 | 🟡 中 |
| 组头箭头 | `›` 旋转动画（展开时转 90°） | **没有箭头** | 🟡 中 |
| 操作按钮 | 小圆角按钮，删除是红色 | 小文字按钮（`修改`/`删除`），无视觉区分 | 🟡 中 |
| 下载按钮 | 右上角有一个 "⬇ 下载" | 不在此页，在数据页的图表头部 | 🟡 中 |

---

### 家庭页（Tab 2）

| 元素 | mockup.html | 当前实现 | 差距等级 |
|------|-------------|----------|----------|
| 顶部标题区 | "家庭"（28px 800weight）+ 齿轮按钮（SVG图标） | 实现了，但齿轮是 `⚙` 文字符号，不是 SVG | 🟡 中 |
| 分区标签 | 小号灰色大写（"被监护人档案"/"家庭成员"/"功能"） | 没有，直接是卡片 | 🟡 中 |
| Profile 卡头像 | 圆形大字母头像（蓝色渐变） | 没有头像 | 🔴 大 |
| Profile 信息布局 | 标签行格式（`目标血压 ＜140/90 mmHg`） | 纯文字列表（`目标血压：未设置`） | 🔴 大 |
| 目标血压/心率 | Profile 卡里显示 | **不显示**，profile 里没有这些字段 | 🔴 大 |
| 成员 admin 样式 | 蓝色渐变背景 + "我（管理员）" | 所有成员头像一样，无区分 | 🟡 中 |
| 邀请成员按钮 | 虚线圆形，`＋` 号 | 蓝色矩形 button，视觉割裂 | 🟡 中 |
| 成员提示文字 | "成员可查看全部记录 · 最多10人" | **没有** | 🟡 中 |
| 功能卡片样式 | 图标卡片（有背景色图标块、标题、副标题、箭头） | 简单的文字卡 | 🔴 大 |
| 快捷设置 | 在设置页里，不在家庭页 | 放在家庭页的底部（与 mockup 不符） | 🟡 中 |

**家庭页 profile 最大的问题**：当前代码里，profile 里根本没有 `targetSystolic`、`targetDiastolic`、`targetHRMin`、`targetHRMax` 这几个字段。用户无法设置目标血压和心率，这些字段在设计文档里有，在 mockup 里显示，但在代码的 `createDefaultProfile`、`normalizeProfile`、profile 编辑表单里全部缺失。

---

### 设置页

| 元素 | mockup.html | 当前实现 | 差距等级 |
|------|-------------|----------|----------|
| 页头 | 蓝色渐变 | 通过 JSON 配置的蓝色导航栏 | 🟢 小 |
| 阈值输入 | `−` / 数值 / `＋` 三件套 stepper | `<input type="number">` 直接输入 | 🔴 大 |
| 字体大小选择 | 三个按钮并排（`标准`/`大`/`超大`） | 实现了，样式接近 | 🟢 小 |
| "关于"分区 | 有版本号 + 意见反馈 | **没有** | 🟡 中 |
| 通知对象 | 显示 "全部成员 ›" | 显示 "X人 ›" | 🟡 中 |

**阈值输入用数字键盘对老人来说很难用**。Mockup 里的 stepper 设计（点 + 或 − 每次调整 5）是明显更适合老人的交互。老人面对一个数字输入框，不知道要输什么，也不知道合理范围是多少。

---

## 四、架构设计

### 核心架构问题

**1. 登录与页面生命周期解耦不彻底**（见 Bug 1，最重要）

当前架构假设"login 比 onShow 快"，这在开发时可能成立，在真实网络环境下不稳定。需要一个明确的 login 完成信号机制。

**2. 设置存在两个入口**

- `family.js` 里有快捷设置（用药提醒、异常通知、字体大小）
- `settings.js` 里有完整设置

两处都能修改同样的字段，但：
- `family.js` 的快捷设置里没有阈值
- `settings.js` 里的字体大小和 `family.js` 里的字体大小是同一个字段
- 用户不知道该去哪里改设置

更好的设计是：家庭页只有一个入口按钮"设置"，所有设置都在 settings 页。家庭页不需要内嵌 switch。

**3. 字体大小的 CSS 变量机制没有实现**

这个功能的技术路径是对的（Mockup 用 `--fs` CSS 变量），但没有在小程序里实现。小程序里可以在 `app.js` 里通过 `wx.getStorageSync` 读取字体大小，然后在页面的 `onShow` 里动态修改根节点的 CSS 变量或者用 WXML 里的数据绑定切换 class。

**4. 没有组件化导致 WXML 重，逻辑散**

`data/data.wxml` 里的 keypad 区域（21行），加上主卡片区（47行），加上图表区，总共 119 行，全是 wx:if 嵌套。这在小程序里可以用自定义组件（`usingComponents`）拆分，复用性也更好。例如：
- `components/record-card`：最新记录卡
- `components/stat-chart`：统计+图表卡片
- `components/keypad`：数字键盘

**5. 数据缓存缺失**

每次切 Tab 都重新拉数据，没有任何缓存。对于读多写少的家庭健康数据，可以在 `app.globalData` 或内存里缓存家庭信息，只在数据变更（写入新记录后）才刷新。

**6. `profile` 里缺少目标血压/心率字段**

这是设计文档、mockup、代码三者不一致最严重的地方：
- 设计文档（数据模型）：有 `targetSystolic`, `targetDiastolic`, `targetHRMin`, `targetHRMax`
- mockup.html：显示"目标血压 ＜ 140 / 90 mmHg"
- 实际代码 `createDefaultProfile`：没有这几个字段
- 实际代码 `countReferenceStats`：传空对象，用不上目标值

这不只是 UI 问题，是整个功能的闭环没有打通：用户的个性化目标血压值，从来没有被用来计算"达标次数"。

---

## 五、缺失功能（mockup 里有，代码里没有）

以下按影响用户的重要程度排列：

| # | 缺失功能 | 影响 | 位置参考 |
|---|----------|------|----------|
| 1 | **字体大小实际生效** | 适老化核心功能，设置了没效果 | mockup.html 用 `--fs` 变量 |
| 2 | **目标血压/心率字段** | profile 里缺字段，达标统计用默认值 | mockup 家庭页 Profile 卡 |
| 3 | **BP 状态条**（三段彩色竖条） | 最新记录卡视觉反馈缺失 | mockup 数据页主卡 `.bp-bar` |
| 4 | **设置页阈值 stepper** | 老人输入数字很困难 | mockup 设置页 `.thresh-val` |
| 5 | **全部记录的状态徽章** | 无法快速扫描哪条记录异常 | mockup 记录列表 `.ri-st` |
| 6 | **admin 成员头像视觉区分** | 无法直观看出谁是管理员 | mockup `.mav.admin` 蓝色渐变 |
| 7 | **记录列表组头箭头** | 展开/折叠没有方向指示 | mockup `.chev` 旋转动画 |
| 8 | **家庭页 Profile 头像** | 档案卡无头像，视觉信息密度低 | mockup `.prof-av` |
| 9 | **功能卡片图标** | 当前是纯文字，mockup 有图标 | mockup `.aico` |
| 10 | **设置页"关于"分区** | 无版本号和反馈入口 | mockup `.set-slbl` 关于 |
| 11 | **成员提示文字** | 用户不知道成员能做什么 | mockup "成员可查看全部记录 · 最多10人" |
| 12 | **个人目标血压编辑** | Profile 表单里没有这几个输入项 | 全缺 |
| 13 | **通知对象多选 UI** | 当前 ActionSheet 体验差 | mockup "全部成员 ›" |

---

## 六、改进建议（按优先级）

### P0 — 修复会真实影响用户的 Bug

**[P0-1] 解决登录时序竞态**
在 `app.js` 暴露一个 `loginReady` Promise，页面的 `loadRecords`/`loadFamily` 先 `await app.loginReady` 再读 `globalData.familyId`。这是最重要的一个修复，会让所有数据加载变稳定。

**[P0-2] 修复达标统计传空对象**
`data/data.js` 第 86 行改为传家庭 profile：
```js
stats: {
  ...countReferenceStats(records, this.data.family?.profile || {}),
  avg: calcAverage(records),
}
```
同时需要在数据页加载家庭信息（或从 globalData 缓存），并在 `createDefaultProfile` 里补充目标血压字段。

**[P0-3] 实现字体大小真正生效**
需要在 App 级别读取并应用 `fontSize` 设置，修改根节点的 CSS 变量或切换 class。这是声称的核心适老化功能，不能只是存个值什么都不做。

**[P0-4] `loadRecords`（data.js）加 try/catch**
防止网络错误导致 loading 永久卡住。

---

### P1 — 影响用户体验的 UI 修复

**[P1-1] 重构数据页主卡片**
按 mockup 实现两层结构：外层毛玻璃 + 内层白色子卡。加入右侧 BP 状态条（三段式颜色条，当前段高亮）。这是整个界面最重要的信息展示区，值得花时间做对。

同时修正三个值的布局：高压大字单独一行，低压+心率并排一行，使用 flex 而不是 absolute 定位。

**[P1-2] 全部记录页加状态徽章**
在每条记录右侧加圆角徽章（正常/注意/危险），视觉区分比看颜色更直观，老人更容易理解。

**[P1-3] 设置页阈值改为 stepper**
把两个 `<input type="number">` 改成 `−值＋` 三件套，每次调整 5。这比让老人输入数字友好太多。

**[P1-4] 家庭页 Profile 卡补充信息**
- 加圆形字母头像
- 补充目标血压/心率显示行（需先在 profile 里加字段）
- Profile 编辑表单里加目标血压/心率输入

**[P1-5] 统一设置入口**
家庭页移除快捷设置卡片，只保留齿轮按钮进入 settings 页面。设置不应该分散在两个地方。

---

### P2 — 架构和代码质量优化

**[P2-1] 并行化 `family.js` 的两个云函数调用**
```js
const [familyRes, recordRes] = await Promise.all([
  wx.cloud.callFunction({ name: 'getFamily', data: { familyId } }),
  wx.cloud.callFunction({ name: 'getRecords', data: { familyId } }),
])
```
加载时间减半。

**[P2-2] `add-record` 传参改为只传 `_id`**
在 `add-record` 的 `onLoad` 里根据 id 查询记录，而不是把整个对象塞进 URL。

**[P2-3] Profile 补充目标血压字段**
`createDefaultProfile` 和 `normalizeProfile` 里加：
```js
targetSystolic: 135,
targetDiastolic: 85,
targetHRMin: 60,
targetHRMax: 100,
```
编辑表单里加对应输入项。这让个人化达标统计真正有意义。

**[P2-4] 统一 `createDefaultProfile` / `createDefaultSettings` 的来源**
云函数里不应该各自重新定义，应该只在 `_shared/auth.js` 里维护一份，各云函数引用。

**[P2-5] 修复心率默认目标上限**
`getHRStatus` 的 `max` 默认值改为 100（`|| 100`），和医学常规标准及文档一致。

**[P2-6] `randomCode` 加碰撞检测**
生成邀请码后查一下是否已存在，若存在则重新生成。

---

### P3 — 长期架构投资（不急，但值得）

**[P3-1] 组件化重构**
提取 `components/record-card`、`components/stat-chart`、`components/keypad`，减少页面复杂度。

**[P3-2] 全局数据缓存**
在 `app.globalData` 里缓存家庭信息和最近记录，切 Tab 时不需要每次重新拉取。

**[P3-3] 清理文档和代码的不一致**
更新 `docs/system-design.md` 里的工具文件名，对齐字段命名（`normal` vs `standard`，目标值默认是 140 还是 135）。

---

## 总结：如果只做三件事

如果精力有限，这三件事价值最大：

1. **修复登录时序竞态**（Bug 1）— 否则在网络慢时用户看到的永远是空状态
2. **让字体大小实际生效**（Bug 3）— 这是对老人用户承诺的功能，现在是空头支票
3. **重构数据页主卡片为 mockup 设计**（P1-1）— 这是用户每天打开都会看到的，视觉差距最大

---

*本文档基于 2026-04-14 代码快照。如有疑问欢迎讨论。*
