const { groupByDate, formatTime } = require('../../utils/date')
const { getBPStatus } = require('../../utils/health-rules')

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
    loading: true,
    fontSizeClass: 'standard',
    fontSizeStyle: makeFontSizeStyle('standard'),
    navStyle: '',
    navTitleStyle: '',
    navBackStyle: '',
    contentStyle: '',
  },

  onLoad() {
    this.setData(buildNavMetrics())
  },

  onShow() {
    const cls = getApp().globalData.fontSizeClass || 'standard'
    this.setData({ fontSizeClass: cls, fontSizeStyle: makeFontSizeStyle(cls) })
    this.loadRecords()
  },

  async loadRecords() {
    const app = getApp()
    await app.loginReady
    if (!app.globalData.familyId) {
      this.setData({ groups: [], loading: false })
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
      this.setData({ groups })
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

  onBackTap() {
    wx.navigateBack({ delta: 1 })
  },
})
