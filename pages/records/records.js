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
    this.setData({ loading: true })
    try {
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
})
