const cloud = require('wx-server-sdk')
const { requireAdmin } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, targetOpenid, canWrite, canEdit, nickname } = event
  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  const members = (family.members || []).map(member => {
    if (member.openid !== targetOpenid) return member
    if (member.role === 'admin') return member
    const updated = { ...member, canWrite: canWrite === true, canEdit: canEdit === true }
    if (nickname !== undefined && String(nickname).trim()) {
      updated.nickname = String(nickname).trim()
    }
    return updated
  })

  await familyRef.update({ data: { members } })
  return { success: true }
}
