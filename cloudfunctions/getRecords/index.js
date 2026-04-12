const cloud = require('wx-server-sdk')
const { requireMember } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, since } = event
  const family = (await db.collection('families').doc(familyId).get()).data
  requireMember(family, OPENID)

  const where = { familyId }
  if (since) where.measuredAt = _.gte(new Date(since))

  const res = await db.collection('records')
    .where(where)
    .orderBy('measuredAt', 'desc')
    .limit(500)
    .get()

  return { success: true, records: res.data }
}
