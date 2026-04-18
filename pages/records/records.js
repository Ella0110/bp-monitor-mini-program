const { groupByDate, formatTime } = require('../../utils/date')
const { getBPStatus } = require('../../utils/health-rules')
const {
  buildRecordsExportData,
  dedupeImportedRecords,
  parseRecordsDataText,
} = require('../../utils/record-data-transfer')
const {
  drawRecordsDataImage,
  recordsDataImageHeight,
} = require('../../utils/records-data-canvas')

function makeFontSizeStyle(cls) {
  if (cls === 'large')  return '--fs-date:32rpx;--fs-count:25rpx;--fs-time:28rpx;--fs-tag:21rpx;--fs-bp:34rpx;--fs-hr:25rpx;--fs-badge:21rpx;--gh-h:90rpx;--rec-py:24rpx'
  if (cls === 'xlarge') return '--fs-date:36rpx;--fs-count:28rpx;--fs-time:32rpx;--fs-tag:24rpx;--fs-bp:38rpx;--fs-hr:28rpx;--fs-badge:24rpx;--gh-h:100rpx;--rec-py:28rpx'
  return '--fs-date:28rpx;--fs-count:22rpx;--fs-time:24rpx;--fs-tag:18rpx;--fs-bp:30rpx;--fs-hr:22rpx;--fs-badge:18rpx;--gh-h:80rpx;--rec-py:20rpx'
}

function getBadge(bpStatus) {
  const level = bpStatus && bpStatus.level
  if (level === 'inRange') return { label: '正常', cls: 'normal' }
  if (level === 'veryHigh' || level === 'critical') return { label: '危险', cls: 'danger' }
  return { label: '注意', cls: 'warning' }
}

function buildNavMetrics() {
  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  const statusBarHeight = windowInfo.statusBarHeight || 0
  const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
  const navHeight = menuButton ? menuButton.bottom + menuButton.top - statusBarHeight : statusBarHeight + 44
  const titleTop = menuButton ? menuButton.top : statusBarHeight + 6
  const titleHeight = menuButton ? menuButton.height : 32

  return {
    navStyle: `height:${navHeight}px;`,
    navTitleStyle: `top:${titleTop}px;height:${titleHeight}px;line-height:${titleHeight}px;`,
    navBackStyle: `top:${titleTop}px;height:${titleHeight}px;`,
    contentStyle: `padding-top:${navHeight + 12}px;`,
  }
}

Page({
  data: {
    groups: [],
    allRecords: [],
    loading: true,
    fontSizeClass: 'standard',
    fontSizeStyle: makeFontSizeStyle('standard'),
    navStyle: '',
    navTitleStyle: '',
    navBackStyle: '',
    contentStyle: '',
    canEdit: false,
    canWrite: false,
    importPanelOpen: false,
    importText: '',
    importing: false,
  },

  onLoad() {
    this.setData(buildNavMetrics())
  },

  onShow() {
    const cls = getApp().globalData.fontSizeClass || 'standard'
    this.setData({ fontSizeClass: cls, fontSizeStyle: makeFontSizeStyle(cls) })
    this.loadRecords()
  },

  async onPullDownRefresh() {
    const app = getApp()
    if (typeof app.refreshSession === 'function') await app.refreshSession()
    await this.loadRecords()
    wx.stopPullDownRefresh()
  },

  async loadRecords() {
    const app = getApp()
    await app.loginReady
    const role = app.globalData.role
    const perms = app.globalData.memberPermissions || {}
    const canEdit = role === 'admin' || perms.canEdit === true
    const canWrite = !app.globalData.familyId || role === 'admin' || perms.canWrite === true
    this.setData({ canEdit, canWrite })
    if (!app.globalData.familyId) {
      this.setData({ groups: [], allRecords: [], loading: false })
      return
    }
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getRecords',
        data: { familyId: app.globalData.familyId },
      })
      const records = (res.result.records || []).map(record => {
        const bpStatus = getBPStatus(record.systolic, record.diastolic)
        return {
          ...record,
          timeStr: formatTime(record.measuredAt),
          bpStatus,
          badge: getBadge(bpStatus),
        }
      })
      const groups = groupByDate(records).map((group, index) => ({ ...group, open: index === 0 }))
      this.setData({ groups, allRecords: records })
    } catch (err) {
      console.error('Load records failed', err)
      wx.showToast({ title: '记录加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  toggleGroup(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`groups[${index}].open`]: !this.data.groups[index].open })
  },

  onEdit(e) {
    const groupIndex = e.currentTarget.dataset.groupIndex
    const recordIndex = e.currentTarget.dataset.recordIndex
    const record = this.data.groups[groupIndex].items[recordIndex]
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

  onDownloadRecords() {
    const exportData = buildRecordsExportData(this.data.allRecords || [])
    if (!exportData.rows.length) {
      wx.showToast({ title: '暂无可导出的记录', icon: 'none' })
      return
    }

    const query = wx.createSelectorQuery()
    query.select('#recordsExportCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const result = res[0]
        const canvas = result && result.node
        if (!canvas) {
          wx.showToast({ title: '图片生成失败', icon: 'none' })
          return
        }

        const width = 750
        const height = recordsDataImageHeight(exportData.rows.length)
        const dpr = Math.min(wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2, 2)
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        drawRecordsDataImage(ctx, exportData, width, height)

        wx.canvasToTempFilePath({
          canvas,
          destWidth: width * dpr,
          destHeight: height * dpr,
          success: file => this.saveRecordsImage(file.tempFilePath),
          fail: () => wx.showToast({ title: '图片生成失败', icon: 'none' }),
        })
      })
  },

  saveRecordsImage(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '需要相册权限',
            content: '请允许保存到相册后再导出数据图片。',
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

  onImportRecordsTap() {
    if (!this.data.canWrite) {
      wx.showToast({ title: '你目前没有导入权限', icon: 'none' })
      return
    }
    this.setData({ importPanelOpen: true, importText: '' })
  },

  onCloseImportPanel() {
    if (this.data.importing) return
    this.setData({ importPanelOpen: false, importText: '' })
  },

  onImportTextInput(e) {
    this.setData({ importText: e.detail.value })
  },

  confirmImport(count, duplicateCount, invalidCount) {
    const skipped = []
    if (duplicateCount) skipped.push(`${duplicateCount} 条重复`)
    if (invalidCount) skipped.push(`${invalidCount} 行未识别`)
    const suffix = skipped.length ? `，跳过 ${skipped.join('、')}` : ''
    return new Promise(resolve => {
      wx.showModal({
        title: '导入记录',
        content: `将导入 ${count} 条记录${suffix}。`,
        confirmText: '导入',
        success: res => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
  },

  async onConfirmImportRecords() {
    if (this.data.importing) return
    const parsed = parseRecordsDataText(this.data.importText)
    if (!parsed.records.length) {
      wx.showToast({ title: '未识别到记录数据', icon: 'none' })
      return
    }

    const deduped = dedupeImportedRecords(parsed.records, this.data.allRecords || [])
    if (!deduped.newRecords.length) {
      wx.showToast({ title: '没有新的记录可导入', icon: 'none' })
      return
    }

    const confirmed = await this.confirmImport(
      deduped.newRecords.length,
      deduped.duplicateCount,
      parsed.invalidLines.length
    )
    if (!confirmed) return

    const app = getApp()
    await app.loginReady
    let familyId = app.globalData.familyId || undefined
    this.setData({ importing: true })
    wx.showLoading({ title: '导入中' })

    try {
      for (const record of deduped.newRecords) {
        const res = await wx.cloud.callFunction({
          name: 'saveRecord',
          data: {
            familyId,
            systolic: record.systolic,
            diastolic: record.diastolic,
            heartRate: record.heartRate,
            measuredAt: record.measuredAt,
            period: null,
          },
        })
        if (!res.result || !res.result.success) {
          throw new Error((res.result && res.result.error) || '导入失败')
        }
        if (!familyId && res.result.familyId) familyId = res.result.familyId
      }
      if (familyId && typeof app.refreshSession === 'function') await app.refreshSession()
      this.setData({ importPanelOpen: false, importText: '' })
      await this.loadRecords()
      wx.hideLoading()
      wx.showToast({ title: `已导入 ${deduped.newRecords.length} 条`, icon: 'success' })
    } catch (err) {
      console.error('Import records failed', err)
      wx.hideLoading()
      wx.showToast({ title: err.message || '导入失败', icon: 'none' })
    } finally {
      wx.hideLoading()
      this.setData({ importing: false })
    }
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 })
  },
})
