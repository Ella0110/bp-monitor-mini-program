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

const dataJson = JSON.parse(read('pages/data/data.json'))
const familyJson = JSON.parse(read('pages/family/family.json'))
const recordsJson = JSON.parse(read('pages/records/records.json'))

assertIncludes('app.js', 'async refreshSession()')
assertIncludes('app.js', 'return result')
assertIncludes('app.js', 'this.loginReady = this.refreshSession()')
assertIncludes('app.js', 'return this.refreshSession()')

assertIncludes('pages/join-family/join-family.js', 'await app.refreshSession()')
assertNotIncludes('pages/join-family/join-family.js', 'getApp().globalData.familyId = res.result.familyId')

assertIncludes('pages/add-record/add-record.js', 'await app.refreshSession()')

assertNotIncludes('pages/data/data.js', "role === ''")
assertIncludes('pages/data/data.js', 'const canWrite = !app.globalData.familyId || role === \'admin\' || perms.canWrite === true')
assertIncludes('pages/data/data.js', 'async onPullDownRefresh()')
assertIncludes('pages/data/data.js', 'async refreshDataPage()')
assertIncludes('pages/data/data.js', 'async onDataRefresherRefresh()')
assertIncludes('pages/data/data.js', 'dataRefreshing: false')
assertIncludes('pages/data/data.js', 'await app.refreshSession()')
assertIncludes('pages/data/data.js', 'wx.stopPullDownRefresh()')
assertIncludes('pages/data/data.wxml', 'refresher-enabled="{{true}}"')
assertIncludes('pages/data/data.wxml', 'refresher-triggered="{{dataRefreshing}}"')
assertIncludes('pages/data/data.wxml', 'bindrefresherrefresh="onDataRefresherRefresh"')

assertIncludes('pages/family/family.js', 'function formatMemberViews')
assertIncludes('pages/family/family.js', "member.nickname === '我'")
assertIncludes('pages/family/family.js', 'async onPullDownRefresh()')
assertIncludes('pages/family/family.js', 'await app.refreshSession()')
assertIncludes('pages/family/family.js', 'wx.stopPullDownRefresh()')
assertIncludes('pages/family/family.wxml', 'item.displayInitial')
assertIncludes('pages/family/family.wxml', 'item.displayLabel')
assertIncludes('pages/family/family.wxml', 'wx:if="{{canManage}}" class="mc" bindtap="onInviteTap"')

assertIncludes('pages/records/records.js', 'async onPullDownRefresh()')
assertIncludes('pages/records/records.js', 'await app.refreshSession()')
assertIncludes('pages/records/records.js', 'wx.stopPullDownRefresh()')

assert.strictEqual(dataJson.enablePullDownRefresh, true)
assert.strictEqual(familyJson.enablePullDownRefresh, true)
assert.strictEqual(recordsJson.enablePullDownRefresh, true)

console.log('permission refresh checks passed')
