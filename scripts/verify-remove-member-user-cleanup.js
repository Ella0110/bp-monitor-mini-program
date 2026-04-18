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

const removeMember = 'cloudfunctions/removeMember/index.js'

assertIncludes(removeMember, 'async function clearUserFamilyState(openid)')
assertIncludes(removeMember, 'doc(openid).update({')
assertIncludes(removeMember, "where({ _openid: openid })")
assertIncludes(removeMember, "data: { familyId: '', role: '' }")
assertIncludes(removeMember, 'await clearUserFamilyState(targetOpenid)')

console.log('removeMember user cleanup checks passed')
