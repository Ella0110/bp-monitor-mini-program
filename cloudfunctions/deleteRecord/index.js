const cloud = require('wx-server-sdk')
const { requireMember, canEditRecord } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const record = (await db.collection('records').doc(event.id).get()).data
  const family = (await db.collection('families').doc(record.familyId).get()).data
  const member = requireMember(family, OPENID)
  if (!canEditRecord(member)) return { success: false, error: '没有删除权限' }
  await db.collection('records').doc(event.id).remove()
  return { success: true }
}
