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
assertIncludes('pages/data/data.wxml', 'keypad-panel')
assertIncludes('pages/data/data.wxml', 'blinking-cursor')
assertIncludes('pages/data/data.wxml', '立即添加')
assertIncludes('pages/data/data.wxml', 'wx:if="{{hasChartRecords}}" class="download"')
assertNotIncludes('pages/data/data.wxml', 'quick-input')
assertNotIncludes('pages/data/data.wxml', 'quick-save')
assertNotIncludes('pages/data/data.wxml', '晨测')
assertNotIncludes('pages/data/data.wxml', '设置')

assertIncludes('pages/data/data.wxss', '.keypad-panel')
assertIncludes('pages/data/data.wxss', '@keyframes cursorBlink')
assertIncludes('pages/data/data.wxss', '.device-screen')

console.log('data entry keypad UI checks passed')
