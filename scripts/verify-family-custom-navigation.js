const fs = require('fs')
const assert = require('assert')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assertIncludes(path, text) {
  const content = read(path)
  if (!content.includes(text)) throw new Error(`${path} should include: ${text}`)
}

function assertNotIncludes(path, text) {
  const content = read(path)
  if (content.includes(text)) throw new Error(`${path} should not include: ${text}`)
}

const familyJson = JSON.parse(read('pages/family/family.json'))
assert.strictEqual(familyJson.navigationStyle, 'custom')
assert.strictEqual(familyJson.navigationBarTitleText, '')
assert.strictEqual(familyJson.navigationBarTextStyle, 'black')

assertIncludes('pages/family/family.js', 'function makeFontSizeStyle(cls)')
assertIncludes('pages/family/family.js', "'--fs-title:38rpx'")
assertIncludes('pages/family/family.js', "'--fs-title:44rpx'")
assertIncludes('pages/family/family.js', "'--fs-title:49rpx'")
assertIncludes('pages/family/family.js', 'function buildNavMetrics()')
assertIncludes('pages/family/family.js', 'wx.getMenuButtonBoundingClientRect')
assertIncludes('pages/family/family.js', "fontSizeStyle: makeFontSizeStyle('standard')")
assertIncludes('pages/family/family.js', "navStyle: ''")
assertIncludes('pages/family/family.js', "navTitleStyle: ''")
assertIncludes('pages/family/family.js', "contentStyle: ''")
assertIncludes('pages/family/family.js', 'setNavMetrics()')
assertIncludes('pages/family/family.js', 'fontSizeStyle: makeFontSizeStyle(fontSizeClass)')

assertIncludes('pages/family/family.wxml', '<view class="container fs-{{fontSizeClass}}" style="{{fontSizeStyle}}">')
assertIncludes('pages/family/family.wxml', '<view class="custom-nav" style="{{navStyle}}">')
assertIncludes('pages/family/family.wxml', '<text class="nav-title" style="{{navTitleStyle}}">家庭</text>')
assertIncludes('pages/family/family.wxml', '<view class="fam-content" style="{{contentStyle}}">')
assertNotIncludes('pages/family/family.wxml', '<text class="fam-title">家庭</text>')

assertIncludes('pages/family/family.wxss', '.custom-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 30; box-sizing: border-box; background: #FFFFFF; }')
assertIncludes('pages/family/family.wxss', '.nav-title { position: absolute; left: 132rpx; right: 132rpx; text-align: center; color: #0F172A; font-size: var(--fs-title, 38rpx); font-weight: 800; letter-spacing: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }')
assertIncludes('pages/family/family.wxss', '.fs-large .nav-title { font-size: 44rpx; }')
assertIncludes('pages/family/family.wxss', '.fs-xlarge .nav-title { font-size: 49rpx; }')
assertIncludes('pages/family/family.wxss', '.fam-header { background: #fff; padding: 24rpx 40rpx 28rpx; border-bottom: 2rpx solid #DDE6F5; display: flex; align-items: center; justify-content: flex-end; }')
assertNotIncludes('pages/family/family.wxss', '.fam-title')

console.log('family custom navigation checks passed')
