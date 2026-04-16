const cloud = require('wx-server-sdk')
const { requireAdmin } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId, targetOpenid } = event

  if (!familyId || !targetOpenid) {
    return { success: false, error: 'MISSING_PARAMS' }
  }

  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  if (targetOpenid === OPENID) {
    const err = new Error('管理员不能移除自己')
    err.code = 'CANNOT_REMOVE_SELF'
    throw err
  }

  const members = (family.members || []).filter(
    member => member.openid !== targetOpenid
  )

  await familyRef.update({ data: { members } })

  const userQuery = await db.collection('users')
    .where({ _openid: targetOpenid })
    .get()

  if (userQuery.data.length > 0) {
    const userId = userQuery.data[0]._id
    await db.collection('users').doc(userId).update({
      data: { familyId: '', role: '' },
    })
  }

  return { success: true }
}
