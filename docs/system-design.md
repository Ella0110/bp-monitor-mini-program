# 血压心率监测小程序 — 系统设计文档

> 版本：v1.0 | 日期：2026-04-12

---

## 一、项目概述

### 1.1 目标
为家庭用户提供一个微信小程序，用于记录老人的每日血压与心率，支持多名家庭成员共同查看数据，并生成就诊报告。

### 1.2 核心用户
| 角色 | 描述 |
|---|---|
| 管理员（admin） | 创建家庭组的人，通常是子女。可录入、修改、删除记录，管理家庭成员权限。 |
| 普通成员（member） | 受邀加入的家庭成员。可查看数据，是否可录入由管理员设置。 |
| 被监护人 | 老人本人。可在自己手机上查看数据，是否录入取决于其微信账号的角色。 |

### 1.3 核心功能（v1）
- 录入血压（高压/低压）+ 心率，可选晨/晚测标注
- 7/30/90 天趋势图（折线图：血压；柱状图：心率）
- 达标统计 + 均值统计
- 全部记录列表，按日期分组，支持编辑/删除
- 家庭组管理：邀请码加入（最多 10 人）
- 被监护人档案（姓名、生年、目标血压、用药、紧急联系人）
- 异常血压通知设置（阈值 + 通知对象）
- 就诊报告导出为图片（保存到相册）
- 字体大小三档可调（适老化）

### 1.4 延后功能（v2）
- 药物管理（拍照/扫码录入药品）
- 用药每日提醒（微信订阅消息）
- PDF 导出
- 公开上架（目前仅内部二维码使用）

---

## 二、技术选型

| 模块 | 选型 | 理由 |
|---|---|---|
| 前端框架 | 原生微信小程序（WXML/WXSS/JS） | 无需引入第三方框架，CloudBase 集成最顺滑，体积最小 |
| 后端 | 微信云开发 CloudBase | 无服务器，与微信登录深度集成，免费额度够内部使用，无需自建服务器 |
| 数据库 | CloudBase 文档数据库 | JSON 文档模型适合灵活的家庭配置数据 |
| 身份认证 | 微信登录（wx.cloud.callFunction → openid） | 无需注册/密码，老人友好 |
| 图表渲染 | Canvas 2D API（自写） | 无需引入第三方库，体积小，可完全控制样式 |
| 图片导出 | `wx.canvasToTempFilePath` + `wx.saveImageToPhotosAlbum` | 原生 API，老人操作最简单 |

---

## 三、系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    微信小程序客户端                        │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 数据页    │  │ 家庭页   │  │ 设置页   │  (其他页面)  │
│  │ Tab 1    │  │ Tab 2    │  │ navigate │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │              │                   │
│  ┌────▼──────────────▼──────────────▼────┐             │
│  │              app.js globalData         │             │
│  │   openid · familyId · role · settings  │             │
│  └────────────────────┬───────────────────┘             │
│                        │ wx.cloud.callFunction()         │
└────────────────────────┼────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────┐
│                    CloudBase 云函数层                     │
│                                                         │
│  login  │  createFamily  │  joinFamily  │  saveSettings │
│  getRecords  │  saveRecord  │  deleteRecord             │
└────────────────────────┬────────────────────────────────┘
                         │ wx-server-sdk
┌────────────────────────▼────────────────────────────────┐
│                    CloudBase 数据库                       │
│                                                         │
│   users 集合   │   families 集合   │   records 集合      │
└─────────────────────────────────────────────────────────┘
```

---

## 四、模块职责

### 4.1 页面层（`pages/`）

| 页面 | 路径 | 职责 |
|---|---|---|
| 数据页 | `pages/data/` | Tab 1。展示最新记录、血压/心率趋势图、统计数据。入口：添加记录、全部记录。 |
| 全部记录 | `pages/records/` | 按日期分组的完整记录列表，支持折叠展开、编辑、删除、导出报告。 |
| 添加/编辑记录 | `pages/add-record/` | 录入或修改一条血压+心率记录，带实时状态反馈。 |
| 家庭页 | `pages/family/` | Tab 2。被监护人档案、家庭成员列表（邀请/展示）、功能入口。 |
| 设置页 | `pages/settings/` | 通知阈值、图表开关、字体大小。从家庭页齿轮图标进入。 |

### 4.2 组件层（`components/`）

| 组件 | 职责 |
|---|---|
| `bp-card` | 最近一次血压展示卡：大字体值 + 颜色编码 + 三段状态条 |
| `bp-chart` | 血压折线图（Canvas 2D）：日均值聚合，参考线 140，异常点红色 |
| `hr-chart` | 心率柱状图（Canvas 2D）：日均值，异常柱红色 |

### 4.3 工具层（`utils/`）

| 文件 | 职责 |
|---|---|
| `bp.js` | BP 状态判断（正常/注意/危险）+ 颜色映射，达标统计，均值计算 |
| `date.js` | 日期格式化，daysAgo()，groupByDate() |
| `chart.js` | buildChartData()：将原始记录聚合为图表数据点 |

### 4.4 云函数层（`cloudfunctions/`）

| 函数 | 触发时机 |
|---|---|
| `login` | App 启动时调用一次。upsert user 文档，返回 openid + familyId + role |
| `createFamily` | 用户首次使用，创建家庭组，生成邀请码，将自己设为 admin |
| `joinFamily` | 输入邀请码加入已有家庭组 |
| `getRecords` | 切换时段 / 页面 onShow 时调用。按 familyId + since 查询 |
| `saveRecord` | 保存/更新一条记录 |
| `deleteRecord` | 删除一条记录 |
| `saveSettings` | 设置页改动后立即调用，更新 families 文档的 settings 字段 |

---

## 五、数据模型

### 5.1 `users` 集合

```
_id          String   openid（微信用户唯一ID，作为文档 _id）
nickname     String   昵称
avatarUrl    String   头像 URL
familyId     String   所属家庭组 ID（为空表示尚未加入家庭）
role         String   "admin" | "member" | ""
createdAt    Date
```

### 5.2 `families` 集合

```
_id          String   CloudBase 自动生成
inviteCode   String   6位大写字母+数字邀请码（唯一）
createdBy    String   管理员 openid
members      Array    [{ openid, role, nickname, joinedAt }]  最多10条
profile      Object   被监护人档案（见下）
settings     Object   家庭级设置（见下）
createdAt    Date
```

**profile 结构：**
```
name             String   被监护人姓名
birthYear        Number   出生年份（用于计算年龄）
targetSystolic   Number   目标高压（默认 140）
targetDiastolic  Number   目标低压（默认 90）
targetHRMin      Number   目标心率下限（默认 60）
targetHRMax      Number   目标心率上限（默认 100）
medications      String   长期用药名称
emergencyContact String   紧急联系人
```

**settings 结构：**
```
alertSystolic       Number   高压告警阈值（默认 160）
alertDiastolic      Number   低压告警阈值（默认 100）
notifyAll           Boolean  异常时通知所有成员（默认 true）
morningEveningLabel Boolean  是否启用晨/晚测标注（默认 false）
splitLines          Boolean  图表中晨/晚测分两条线（默认 false）
fontSize            String   "normal" | "large" | "xlarge"
```

### 5.3 `records` 集合

```
_id          String   CloudBase 自动生成
familyId     String   所属家庭组 ID（查询主键）
systolic     Number   高压（mmHg）
diastolic    Number   低压（mmHg）
heartRate    Number   心率（bpm）
measuredAt   Date     实际测量时间（用户可修改）
period       String   "morning" | "evening" | null（晨/晚测标注，可选）
recordedBy   String   录入者 openid
createdAt    Date
updatedAt    Date
```

**索引：**
- 单字段索引：`familyId`（升序）
- 复合索引：`familyId + measuredAt`（均升序）

---

## 六、数据流

### 6.1 首次启动流程

```
用户打开小程序
  → app.js onLaunch
  → wx.cloud.init(envId)
  → callFunction('login')
      → 云函数 login: getWXContext() 获取 openid
      → DB: upsert users/{openid}
      → 返回 { openid, familyId, role }
  → app.globalData 写入 openid / familyId / role
  → 跳转到数据页 (Tab 1)
        ↓
  如果 familyId 为空
  → 数据页显示「尚未加入家庭组」
  → 引导到家庭页 → 创建或加入家庭组
```

### 6.2 查看血压数据流程

```
数据页 onShow
  → 读取 globalData.familyId
  → callFunction('getRecords', { familyId, since: daysAgo(N) })
      → 云函数: DB 查询 records where familyId + measuredAt >= since
      → 返回 records[]
  → 客户端计算:
      latestRecord = sorted[0]
      bpStats = countOnTarget() + calcAverage()
      hrStats = HR 达标统计 + 均值
  → setData → 触发 bp-card / bp-chart / hr-chart 组件重绘
```

### 6.3 添加记录流程

```
点击「添加记录」
  → navigateTo add-record 页
  → 用户输入高压/低压/心率/时间
  → 实时调用 getBPStatus() 显示状态颜色
  → 点击「保存记录」
      → validate()（范围校验）
      → callFunction('saveRecord', { familyId, systolic, diastolic, heartRate, measuredAt, period })
      → 云函数: DB insert records
      → 返回 navigateBack()
  → 数据页 onShow 重新拉取数据
```

### 6.4 加入家庭组流程

```
家庭页 → 输入邀请码 → 点击加入
  → callFunction('joinFamily', { inviteCode, nickname })
      → 云函数: 查询 families where inviteCode == xxx
      → 校验：存在 / 未加入 / 人数 < 10
      → 失败 → 返回 { success: false, error: '...' }
      → 成功 → push member 到 families.members[]
              → update users/{openid}.familyId + role
              → 返回 { success: true, familyId }
  → app.globalData.familyId 更新
  → 刷新家庭页
```

---

## 七、权限模型

### 7.1 数据库安全规则

| 集合 | 读 | 写 |
|---|---|---|
| `users` | 只能读自己（`doc._id == auth.openid`） | 只能写自己 |
| `families` | 必须是该家庭成员（openid 在 members[] 中） | 只有 createdBy（admin）可写 |
| `records` | 必须是该家庭成员（通过 families 联查） | 必须是该家庭成员 |

### 7.2 客户端权限判断

| 操作 | 条件 |
|---|---|
| 添加记录 | `role === 'admin'` 或（`role === 'member'` 且管理员已授权） |
| 编辑/删除记录 | 同上，或仅限自己录入的记录（`recordedBy === openid`） |
| 修改被监护人档案 | `role === 'admin'` |
| 修改设置 | `role === 'admin'` |
| 查看数据/图表 | 所有家庭成员 |

> **注：** v1 简化实现——member 默认只读，admin 全权。member 写入权限由管理员在设置页手动开关（后续迭代）。

---

## 八、云函数 API 设计

### `login`
- 入参：无（openid 由云函数上下文自动获取）
- 出参：`{ openid: string, familyId: string, role: string }`

### `createFamily`
- 入参：`{ nickname: string, profile?: object }`
- 出参：`{ familyId: string, inviteCode: string }`

### `joinFamily`
- 入参：`{ inviteCode: string, nickname: string }`
- 出参：`{ success: boolean, familyId?: string, error?: string }`

### `getRecords`
- 入参：`{ familyId: string, since: string }` （since 为 ISO 日期字符串）
- 出参：`{ records: Record[] }`
- 限制：单次最多返回 200 条（约 6.5 个月的每日 1 次数据）

### `saveRecord`
- 入参：`{ id?: string, familyId, systolic, diastolic, heartRate, measuredAt, period? }`
- 出参：`{ success: boolean, id: string }`
- 逻辑：有 id → update；无 id → insert

### `deleteRecord`
- 入参：`{ id: string }`
- 出参：`{ success: boolean }`

### `saveSettings`
- 入参：`{ familyId: string, settings: object }`
- 出参：`{ success: boolean }`

---

## 九、错误处理策略

| 场景 | 处理方式 |
|---|---|
| 网络请求失败 | `try/catch` 捕获，`wx.showToast({ title: '网络错误', icon: 'none' })`，不崩溃 |
| 登录失败 | `console.error` 记录，页面显示「加载中」或空状态，用户可手动刷新 |
| 录入数据校验失败 | 在 `validate()` 中检查范围，弹出具体提示（如「高压值需在 60-300 之间」） |
| 邀请码无效 | 云函数返回 `{ success: false, error: '邀请码无效' }`，前端显示 Toast |
| 家庭成员已满 | 同上，返回「家庭成员已达上限（10人）」 |
| 导出图片权限不足 | `saveImageToPhotosAlbum` fail 回调，提示「需要相册权限，请在设置中开启」 |

---

## 十、性能边界

| 指标 | 限制 | 说明 |
|---|---|---|
| 单次查询记录数 | ≤ 200 条 | CloudBase 单次 get 上限 1000，取 200 保证性能 |
| 家庭成员数 | ≤ 10 人 | families.members 数组长度硬限制 |
| 90 天数据量 | ~90 条（每天1次）/ ~180 条（每天2次） | 远低于 200 条上限，无需分页 |
| 全部记录页 | 不分页，全量拉取 | 用户预期单个家庭记录量 < 1000 条，几年内无问题 |
| 图表渲染 | Canvas 2D，同步绘制 | 数据点 ≤ 90，渲染时间 < 100ms |
| CloudBase 免费额度 | 数据库读 5万次/天，存储 5GB | 家庭内部使用远不会触及上限 |

---

## 十一、页面导航关系

```
                   ┌─────────────┐
                   │  App 启动    │
                   │  (login)    │
                   └──────┬──────┘
                          │
              ┌───────────┴────────────┐
              │                        │
     ┌────────▼────────┐    ┌──────────▼────────┐
     │  Tab 1: 数据页   │    │  Tab 2: 家庭页     │
     │  pages/data     │    │  pages/family      │
     └────────┬────────┘    └──────────┬─────────┘
              │                        │
     ┌────────┴───────┐        ┌───────┴──────┐
     │                │        │               │
┌────▼─────┐  ┌───────▼──┐  ┌─▼───────┐  ┌───▼──────┐
│ 全部记录  │  │ 添加记录  │  │ 就诊报告│  │  设置页   │
│/records  │  │/add-record│  │(导出图片)│  │/settings │
└────┬─────┘  └──────────┘  └─────────┘  └──────────┘
     │
┌────▼─────┐
│ 编辑记录  │
│/add-record│
│?id=xxx   │
└──────────┘
```

---

## 十二、健康判断规则（`utils/health-rules.js`）

### 字段含义

| 字段 | 英文全称 | 中文 | 单位 |
|---|---|---|---|
| `systolic` | systolic blood pressure | 高压（收缩压）—— 心脏收缩时血管压力，数值较大 | mmHg |
| `diastolic` | diastolic blood pressure | 低压（舒张压）—— 心脏舒张时血管压力，数值较小 | mmHg |
| `heartRate` | heart rate | 心率 | bpm |

### 血压状态判断 `getBPStatus(systolic, diastolic, target?)`

目标值默认：`targetSystolic = 135`，`targetDiastolic = 85`（来自 `family-settings.js`）

| 条件 | level | 标签 | 颜色 |
|---|---|---|---|
| sys < 90 或 dia < 60 | `low` | 偏低 | 橙 #FF9500 |
| sys ≥ 180 或 dia ≥ 110 | `critical` | 很高 | 深红 #C81E1E |
| sys ≥ 160 或 dia ≥ 100 | `veryHigh` | 明显偏高 | 红 #FF3B30 |
| sys ≥ 目标值 | `high` | 偏高 | 橙 #FF9500 |
| 其余 | `inRange` | 参考范围内 | 绿 #34C759 |

### 心率状态判断 `getHRStatus(heartRate, target?)`

目标值默认：`targetHRMin = 60`，`targetHRMax = 80`

| 条件 | level | 标签 | 颜色 |
|---|---|---|---|
| hr < 50 | `verySlow` | 明显偏慢 | 深红 |
| hr < min（默认60） | `slow` | 偏慢 | 橙 |
| hr > 100 | `veryFast` | 明显偏快 | 红 |
| hr > max（默认80） | `fast` | 偏快 | 橙 |
| 其余 | `inRange` | 参考范围内 | 绿 |

### UI 颜色映射（`getStatusClass()`，`data.js`）

level → CSS class → 颜色：

```
inRange                          → normal  → #22C55E（绿）
critical / veryHigh / veryFast / verySlow → danger  → #FF3B30（红）
其余（low / high / slow / fast） → warning → #FF9500（橙）
```

### 数据页 BP 状态条（右侧三段竖条）

```
顶段（红）→ danger  （0）
中段（橙）→ warning （1）
底段（绿）→ normal  （2）
```

与数字颜色由同一个 `getStatusClass()` 结果驱动，始终保持一致。

---

## 十三、设计取舍说明

| 决策 | 选择 | 原因 |
|---|---|---|
| 图表库 | 自写 Canvas，不用 wx-charts | 避免外部依赖，图表需求简单，可完全控制样式 |
| 全部记录分页 | 不分页，全量拉取 | 家庭场景记录量小，分页增加复杂度无必要 |
| 备注字段 | 不加 | 老人嫌麻烦（见 Q&A Q5） |
| 晨/晚测标注 | 可选（设置开关） | 老人不需要时可关闭（见 Q&A Q4） |
| 数据导出格式 | 图片（PNG） | 老人最易操作，发给医生方便（见 Q&A Q9） |
| 发布方式 | 内部二维码 | CloudBase 永久免费（见 Q&A Q10） |
| 通知方式 | 设置项，v1 仅前端展示 | 微信订阅消息需用户主动授权，v1 暂不实现 |
