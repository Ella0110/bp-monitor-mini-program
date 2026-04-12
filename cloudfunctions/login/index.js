const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const userRef = db.collection('users').doc(OPENID)
  let user = null

  try {
    user = (await userRef.get()).data
  } catch (e) {
    await userRef.set({
      data: {
        _id: OPENID,
        nickname: '',
        avatarUrl: '',
        familyId: '',
        role: '',
        preferences: {},
        createdAt: db.serverDate(),
      },
    })
    user = (await userRef.get()).data
  }

  let memberPermissions = { canWrite: false, canEdit: false }
  if (user.familyId) {
    const family = (await db.collection('families').doc(user.familyId).get()).data
    const member = (family.members || []).find(item => item.openid === OPENID)
    if (member) {
      memberPermissions = {
        canWrite: member.role === 'admin' || member.canWrite === true,
        canEdit: member.role === 'admin' || member.canEdit === true,
      }
    }
  }

  return {
    openid: OPENID,
    familyId: user.familyId || '',
    role: user.role || '',
    memberPermissions,
  }
}
