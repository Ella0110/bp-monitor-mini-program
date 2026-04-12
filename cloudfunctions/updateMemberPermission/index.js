const cloud = require('wx-server-sdk')
const { requireAdmin } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, targetOpenid, canWrite, canEdit } = event
  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  const members = (family.members || []).map(member => {
    if (member.openid !== targetOpenid) return member
    if (member.role === 'admin') return member
    return { ...member, canWrite: canWrite === true, canEdit: canEdit === true }
  })

  await familyRef.update({ data: { members } })
  return { success: true }
}
