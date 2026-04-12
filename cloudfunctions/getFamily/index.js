const cloud = require('wx-server-sdk')
const { requireMember } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId } = event
  const family = (await db.collection('families').doc(familyId).get()).data
  const member = requireMember(family, OPENID)
  return { success: true, family, member }
}
