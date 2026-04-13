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

assertIncludes('cloudfunctions/saveRecord/index.js', 'async function createDefaultFamily')
assertIncludes('cloudfunctions/saveRecord/index.js', 'return { success: true, id: res._id, familyId }')
assertIncludes('pages/data/data.js', 'async onQuickSave()')
assertIncludes('pages/data/data.wxml', '查看家人的记录？输入邀请码')
assertIncludes('pages/family/family.wxml', '创建我的记录')
assertIncludes('pages/family/family.wxml', '查看家人的记录')
assertIncludes('pages/family/family.wxml', '仅用于报告展示，您可以填写昵称或简称。')
assertIncludes('pages/join-family/join-family.wxml', '查看家人的记录')
assertIncludes('pages/join-family/join-family.json', '查看家人的记录')
assertIncludes('pages/settings/settings.wxml', '请先保存一条记录，或查看家人的记录')
assertIncludes('pages/report/report.js', '请先保存一条记录，或查看家人的记录')
assertNotIncludes('pages/add-record/add-record.js', '请先创建或加入家庭组')
assertNotIncludes('pages/family/family.wxml', '家庭组')
assertNotIncludes('pages/join-family/join-family.wxml', '家庭组')

console.log('zero-friction MVP static checks passed')
