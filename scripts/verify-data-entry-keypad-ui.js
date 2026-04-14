const fs = require('fs')

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assertIncludes(path, text) {
  const content = read(path)
  if (!content.includes(text)) {
    throw new Error(`${path} should include: ${text}`)
  }
}

function assertNotIncludes(path, text) {
  const content = read(path)
  if (content.includes(text)) {
    throw new Error(`${path} should not include: ${text}`)
  }
}

assertIncludes('pages/data/data.js', "quickEntryActive: false")
assertIncludes('pages/data/data.js', "quickField: 'systolic'")
assertIncludes('pages/data/data.js', 'onStartQuickEntry()')
assertIncludes('pages/data/data.js', 'onKeypadDigit(e)')
assertIncludes('pages/data/data.js', 'onKeypadDelete()')
assertIncludes('pages/data/data.js', 'onKeypadNext()')
assertIncludes('pages/data/data.js', 'moveToNextField()')
assertNotIncludes('pages/data/data.js', "wx.navigateTo({ url: '/pages/add-record/add-record' })")

assertIncludes('pages/data/data.wxml', '本次记录时间：----')
assertIncludes('pages/data/data.wxml', '最近一次记录时间：{{latestTime}}')
assertIncludes('pages/data/data.wxml', '<text class="nav-title" style="{{navTitleStyle}}">血压心率记录</text>')
assertNotIncludes('pages/data/data.wxml', '<text class="title">血压心率记录</text>')
assertIncludes('pages/data/data.wxml', 'keypad-panel')
assertIncludes('pages/data/data.wxml', 'blinking-cursor')
assertIncludes('pages/data/data.wxml', '立即添加')
assertIncludes('pages/data/data.wxml', "bpValueClass")
assertIncludes('pages/data/data.wxml', "hrValueClass")
assertIncludes('pages/data/data.wxml', 'analysis-card')
assertIncludes('pages/data/data.wxml', 'chart-divider')
assertIncludes('pages/data/data.wxml', 'section-icon bp-icon')
assertIncludes('pages/data/data.json', '"navigationBarTitleText": ""')
assertIncludes('pages/family/family.wxml', '<text class="nav-title" style="{{navTitleStyle}}">家庭</text>')
assertNotIncludes('pages/family/family.wxml', '<text class="fam-title">家庭</text>')
assertIncludes('pages/family/family.json', '"navigationBarTitleText": ""')
assertIncludes('pages/data/data.wxml', 'wx:if="{{hasChartRecords}}" class="download"')
assertNotIncludes('pages/data/data.wxml', 'quick-input')
assertNotIncludes('pages/data/data.wxml', 'quick-save')
assertNotIncludes('pages/data/data.wxml', '晨测')
assertNotIncludes('pages/data/data.wxml', '设置')
assertNotIncludes('pages/data/data.wxml', 'stat-card')
assertNotIncludes('pages/data/data.wxml', 'metric-value orange')
assertNotIncludes('pages/data/data.wxml', 'metric-value green')

assertIncludes('pages/data/data.js', 'bpValueClass: EMPTY_VALUE_CLASS')
assertIncludes('pages/data/data.js', 'hrValueClass: EMPTY_VALUE_CLASS')
assertIncludes('pages/data/data.js', 'getStatusClass(')

assertIncludes('pages/data/data.wxss', '.keypad-panel')
assertIncludes('pages/data/data.wxss', '@keyframes cursorBlink')
assertIncludes('pages/data/data.wxss', '.device-screen')
assertIncludes('pages/data/data.wxss', '.metric-value.empty')
assertIncludes('pages/data/data.wxss', '.metric-value.normal')
assertIncludes('pages/data/data.wxss', '.metric-value.warning')
assertIncludes('pages/data/data.wxss', '.metric-value.danger')
assertNotIncludes('pages/data/data.wxss', '.metric-value.orange')
assertNotIncludes('pages/data/data.wxss', '.metric-value.green')

console.log('data entry keypad UI checks passed')
