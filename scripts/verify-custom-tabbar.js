const fs = require('fs')
const assert = require('assert')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assertIncludes(path, text) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`${path} should include: ${text}`)
}

const app = JSON.parse(read('app.json'))
assert.strictEqual(app.tabBar.custom, true)
assert.strictEqual(app.tabBar.color, '#94A3B8')
assert.strictEqual(app.tabBar.selectedColor, '#3182F7')

for (const file of [
  'custom-tab-bar/index.js',
  'custom-tab-bar/index.json',
  'custom-tab-bar/index.wxml',
  'custom-tab-bar/index.wxss',
]) {
  assert.ok(fs.existsSync(file), `${file} should exist`)
}

assertIncludes('custom-tab-bar/index.js', "selected: 0")
assertIncludes('custom-tab-bar/index.js', "fontSizeClass: 'standard'")
assertIncludes('custom-tab-bar/index.js', 'switchTab(e)')
assertIncludes('custom-tab-bar/index.js', 'wx.switchTab')
assertIncludes('custom-tab-bar/index.js', "pagePath: '/pages/data/data'")
assertIncludes('custom-tab-bar/index.js', "pagePath: '/pages/family/family'")

assertIncludes('custom-tab-bar/index.wxml', 'custom-tabbar fs-{{fontSizeClass}}')
assertIncludes('custom-tab-bar/index.wxml', 'tabbar-icon')
assertIncludes('custom-tab-bar/index.wxml', 'tabbar-label')
assertIncludes('custom-tab-bar/index.wxss', 'min-height: 90rpx')
assertIncludes('custom-tab-bar/index.wxss', 'padding-top: 18rpx')
assertIncludes('custom-tab-bar/index.wxss', 'padding-bottom: calc(6rpx + env(safe-area-inset-bottom))')
assertIncludes('custom-tab-bar/index.wxss', 'align-items: center')
assertIncludes('custom-tab-bar/index.wxss', 'gap: 6rpx')
assertIncludes('custom-tab-bar/index.wxss', 'font-size: 26rpx')
assertIncludes('custom-tab-bar/index.wxss', '.fs-large .tabbar-label')
assertIncludes('custom-tab-bar/index.wxss', '.fs-xlarge .tabbar-label')

assertIncludes('pages/data/data.js', "syncTabBar.call(this, 0")
assertIncludes('pages/family/family.js', "syncTabBar.call(this, 1")
assertIncludes('pages/data/data.wxml', 'class="tabbar-spacer"')
assertIncludes('pages/data/data.wxss', '.bottom { margin-bottom: 34rpx; }')
assertIncludes('pages/data/data.wxss', '.tabbar-spacer { height: calc(136rpx + env(safe-area-inset-bottom)); }')
assertIncludes('pages/family/family.wxss', '.container { min-height: 100vh; background: #EEF3FB; box-sizing: border-box; overflow-x: hidden; }')
assertIncludes('pages/family/family.wxss', '.body { position: fixed; left: 0; right: 0; bottom: calc(114rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }')
assertIncludes('pages/family/family.wxss', '.body-inner { padding: 16rpx 32rpx 40rpx; box-sizing: border-box; }')

console.log('custom tabbar checks passed')
