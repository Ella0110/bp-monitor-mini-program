const fs = require('fs')
const assert = require('assert')

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

const dataJson = JSON.parse(read('pages/data/data.json'))
assert.strictEqual(dataJson.navigationStyle, 'custom')

assertIncludes('pages/data/data.js', 'function buildNavMetrics()')
assertIncludes('pages/data/data.js', 'wx.getMenuButtonBoundingClientRect')
assertIncludes('pages/data/data.js', "navStyle: ''")
assertIncludes('pages/data/data.js', "navTitleStyle: ''")
assertIncludes('pages/data/data.js', "contentStyle: ''")
assertIncludes('pages/data/data.js', "heroStyle: ''")
assertIncludes('pages/data/data.js', 'navScrolled: false')
assertIncludes('pages/data/data.js', 'heroStyle: `padding-top:${navHeight + 18}px;`')
assertIncludes('pages/data/data.js', 'onLoad()')
assertIncludes('pages/data/data.js', 'setNavMetrics()')
assertIncludes('pages/data/data.js', 'setNavScrolled(scrollTop)')
assertIncludes('pages/data/data.js', 'onDataScroll(e)')
assertIncludes('pages/data/data.js', 'onPageScroll(e)')
assertIncludes('pages/data/data.js', 'const navScrolled = scrollTop > 12')

assertIncludes('pages/data/data.wxml', '<view class="page fs-{{fontSizeClass}}" style="{{fontSizeStyle}}">')
assertIncludes('pages/data/data.wxml', '<view class="custom-nav {{navScrolled ?')
assertIncludes('pages/data/data.wxml', '<text class="nav-title" style="{{navTitleStyle}}">血压心率记录</text>')
assertIncludes('pages/data/data.wxml', '<scroll-view scroll-y class="container" style="{{contentStyle}}" bindscroll="onDataScroll">')
assertIncludes('pages/data/data.wxml', '<view class="hero" style="{{heroStyle}}">')
assertNotIncludes('pages/data/data.wxml', '<text class="title">血压心率记录</text>')

assertIncludes('pages/data/data.wxss', '.page { min-height: 100vh; background: #EEF3FB; }')
assertIncludes('pages/data/data.wxss', 'height: 100vh')
assertIncludes('pages/data/data.wxss', '.custom-nav')
assertIncludes('pages/data/data.wxss', 'background: transparent')
assertIncludes('pages/data/data.wxss', '.custom-nav.scrolled')
assertIncludes('pages/data/data.wxss', '.nav-title')

console.log('data custom navigation checks passed')
