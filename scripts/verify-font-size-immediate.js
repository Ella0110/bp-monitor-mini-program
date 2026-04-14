const assert = require('assert')

let pageConfig
let cloudCallResolver
const app = { globalData: { fontSizeClass: 'standard' } }

global.getApp = () => app
global.Page = (config) => {
  pageConfig = config
}
global.wx = {
  cloud: {
    callFunction() {
      return new Promise((resolve) => {
        cloudCallResolver = resolve
      })
    },
  },
  showToast() {},
  navigateTo() {},
  switchTab() {},
}

require('../pages/family/family')

const page = {
  data: {
    canManage: true,
    fontSizeClass: 'standard',
    family: {
      _id: 'family-1',
      profile: {},
      settings: {
        fontSize: 'standard',
      },
    },
  },
  setData(patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'family.settings') this.data.family.settings = value
      else this.data[key] = value
    }
  },
}
for (const [key, value] of Object.entries(pageConfig)) {
  if (key !== 'data') page[key] = value
}

const save = page.onFontSizeTap({
  currentTarget: { dataset: { value: 'xlarge' } },
})

assert.strictEqual(page.data.family.settings.fontSize, 'xlarge')
assert.strictEqual(page.data.fontSizeClass, 'xlarge')
assert.strictEqual(app.globalData.fontSizeClass, 'xlarge')

cloudCallResolver({ result: { success: true } })

Promise.resolve(save).then(() => {
  assert.strictEqual(page.data.family.settings.fontSize, 'xlarge')
  assert.strictEqual(page.data.fontSizeClass, 'xlarge')
  assert.strictEqual(app.globalData.fontSizeClass, 'xlarge')
  console.log('font size immediate checks passed')
})
