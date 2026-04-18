const cloud = require('wx-server-sdk')
const { requireAdmin } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function clearUserFamilyState(openid) {
  const users = db.collection('users')
  const clearedIds = new Set()

  try {
    await users.doc(openid).update({
      data: { familyId: '', role: '' },
    })
    clearedIds.add(openid)
  } catch (e) {
    // Older data may not use OPENID as the users document id.
  }

  const legacyUserQuery = await users.where({ _openid: openid }).get()
  const legacyUsers = legacyUserQuery.data || []
  for (const user of legacyUsers) {
    if (!user._id || clearedIds.has(user._id)) continue
    await users.doc(user._id).update({
      data: { familyId: '', role: '' },
    })
    clearedIds.add(user._id)
  }

  return clearedIds.size
}

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

  await clearUserFamilyState(targetOpenid)

  return { success: true }
}
