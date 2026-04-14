Component({
  data: {
    selected: 0,
    color: '#94A3B8',
    selectedColor: '#3182F7',
    fontSizeClass: 'standard',
    list: [
      {
        pagePath: '/pages/data/data',
        text: '数据',
        iconPath: '/assets/icons/data.png',
        selectedIconPath: '/assets/icons/data-active.png',
      },
      {
        pagePath: '/pages/family/family',
        text: '家庭',
        iconPath: '/assets/icons/family.png',
        selectedIconPath: '/assets/icons/family-active.png',
      },
    ],
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index
      const item = this.data.list[index]
      if (!item) return
      wx.switchTab({ url: item.pagePath })
    },
  },
})
