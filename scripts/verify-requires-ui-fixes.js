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

function assertCustomBackPage(name, title) {
  const base = `pages/${name}/${name}`
  const json = JSON.parse(read(`${base}.json`))
  assert.strictEqual(json.navigationStyle, 'custom', `${base}.json should use custom navigation`)
  assert.strictEqual(json.navigationBarTitleText, '', `${base}.json should hide native title`)
  assertIncludes(`${base}.wxml`, '<view class="custom-nav" style="{{navStyle}}">')
  assertIncludes(`${base}.wxml`, '<view class="nav-back" style="{{navBackStyle}}" bindtap="onBackTap"><view class="nav-back-icon"></view><text class="nav-back-text">返回</text></view>')
  assertIncludes(`${base}.wxml`, `<text class="nav-title" style="{{navTitleStyle}}">${title}</text>`)
  assertIncludes(`${base}.js`, 'function buildNavMetrics()')
  assertIncludes(`${base}.js`, 'onBackTap()')
  assertIncludes(`${base}.js`, 'wx.navigateBack({ delta: 1 })')
  assertNotIncludes(`${base}.js`, "wx.switchTab({ url: '/pages/data/data' })")
  assertNotIncludes(`${base}.js`, "wx.switchTab({ url: '/pages/family/family' })")
  assertIncludes(`${base}.wxss`, 'display: flex; align-items: center;')
  assertIncludes(`${base}.wxss`, '.nav-back-icon')
  assertIncludes(`${base}.wxss`, 'border-left: 4rpx solid currentColor; border-bottom: 4rpx solid currentColor;')
  assertIncludes(`${base}.wxss`, 'transform: rotate(45deg);')
}

assertCustomBackPage('records', '全部记录')
assertCustomBackPage('report', '就诊报告')
assertCustomBackPage('add-record', '添加记录')
assertCustomBackPage('settings', '设置')

assertIncludes('pages/settings/settings.wxml', '<scroll-view scroll-y class="container" style="{{contentStyle}}">')
assertIncludes('pages/settings/settings.wxml', '<view class="settings-content">')
assertIncludes('pages/settings/settings.wxss', '.container { position: fixed; left: 0; right: 0; bottom: 0; background: #EEF3FB; box-sizing: border-box; }')
assertIncludes('pages/settings/settings.wxss', '.settings-content { padding: 32rpx; box-sizing: border-box; }')
assertNotIncludes('pages/settings/settings.wxss', '.container { min-height: 100vh; height: 100vh; background: #EEF3FB; padding: 32rpx;')
assertIncludes('pages/settings/settings.js', 'contentStyle: `top:${navHeight}px;`')

assertIncludes('pages/report/report.wxml', '<scroll-view scroll-y class="container" style="{{contentStyle}}">')
assertIncludes('pages/report/report.wxml', '<view class="report-content">')
assertIncludes('pages/report/report.wxss', '.container { position: fixed; left: 0; right: 0; bottom: 0; background: #EEF3FB; box-sizing: border-box; }')
assertIncludes('pages/report/report.wxss', '.report-content { padding: 28rpx 32rpx 120rpx; box-sizing: border-box; }')
assertNotIncludes('pages/report/report.wxss', '.container { min-height: 100vh; height: 100vh; background: #EEF3FB; padding: 28rpx 32rpx 120rpx;')
assertIncludes('pages/report/report.js', 'contentStyle: `top:${navHeight}px;`')

assertIncludes('pages/family/family.wxml', '<scroll-view wx:if="{{family}}" scroll-y class="body" style="{{contentStyle}}">')
assertIncludes('pages/family/family.wxml', '<view class="body-inner">')
assertIncludes('pages/family/family.wxss', '.body { position: fixed; left: 0; right: 0; bottom: calc(114rpx + env(safe-area-inset-bottom)); box-sizing: border-box; }')
assertIncludes('pages/family/family.wxss', '.body-inner { padding: 16rpx 32rpx 40rpx; box-sizing: border-box; }')
assertNotIncludes('pages/family/family.wxss', '.body { width: 100%; box-sizing: border-box; padding:')

assertIncludes('pages/records/records.wxml', '<view class="right-line">')
assertIncludes('pages/records/records.wxss', '.right { flex-shrink: 0; }')
assertIncludes('pages/records/records.wxss', '.right-line { display: flex; align-items: center; justify-content: flex-end; gap: 18rpx;')
assertIncludes('pages/records/records.wxss', '.actions { display: flex; align-items: center; gap: 18rpx;')

assertIncludes('pages/data/data.wxss', '.add { height: 96rpx;')
assertIncludes('pages/data/data.wxss', 'display: flex; align-items: center; justify-content: center;')
assertIncludes('pages/add-record/add-record.wxss', '.save { min-height: 96rpx;')
assertIncludes('pages/add-record/add-record.wxss', 'display: flex; align-items: center; justify-content: center; line-height: 1;')
assertIncludes('pages/report/report.wxss', '.save { min-height: 88rpx;')
assertIncludes('pages/report/report.wxss', 'display: flex; align-items: center; justify-content: center; line-height: 1;')
assertIncludes('pages/family/family.wxss', '.primary { min-height: 96rpx;')
assertIncludes('pages/family/family.wxss', '.sheet-button { min-height: 96rpx;')
assertIncludes('pages/join-family/join-family.wxss', '.primary, .secondary { min-height: 96rpx;')
assertIncludes('pages/join-family/join-family.wxss', 'display: flex; align-items: center; justify-content: center; line-height: 1;')
assertNotIncludes('pages/data/data.wxml', '<view class="section-icon bp-icon"></view>')
assertNotIncludes('pages/data/data.wxml', '<view class="section-icon hr-icon"></view>')
assertNotIncludes('pages/data/data.wxss', '.section-icon')

assertIncludes('pages/family/family.wxml', '<button wx:if="{{canManage}}" class="settings-btn" hover-class="settings-btn-active" bindtap="onSettingsTap">设置</button>')
assertNotIncludes('pages/family/family.wxml', '⚙')
assertIncludes('pages/family/family.wxss', '.settings-btn { min-width: 96rpx;')
assertIncludes('pages/family/family.wxss', 'background: #DCEBFF;')
assertIncludes('pages/family/family.wxss', 'color: #1761D4;')
assertIncludes('pages/family/family.wxss', 'border: 2rpx solid rgba(49, 130, 247, 0.20);')
assertIncludes('pages/family/family.wxss', 'transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;')
assertIncludes('pages/family/family.wxss', '.settings-btn-active { background: #C9DFFF; transform: scale(0.97);')

console.log('requires UI fix checks passed')
