const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { inviteToken, inviteCode, nickname, avatarUrl } = event
  const where = inviteToken ? { inviteToken } : { inviteCode }

  const res = await db.collection('families').where(where).limit(1).get()
  if (!res.data.length) return { success: false, error: '邀请无效，请让家人重新邀请' }

  const family = res.data[0]
  if ((family.members || []).some(member => member.openid === OPENID)) {
    return { success: false, error: '你已经是该家庭成员' }
  }
  if ((family.members || []).length >= 10) {
    return { success: false, error: '家庭成员已达上限（10人）' }
  }

  await db.collection('families').doc(family._id).update({
    data: {
      members: _.push({
        openid: OPENID,
        role: 'member',
        nickname: nickname || '家人',
        avatarUrl: avatarUrl || '',
        canWrite: false,
        canEdit: false,
        joinedAt: db.serverDate(),
      }),
    },
  })

  const userRef = db.collection('users').doc(OPENID)
  await userRef.update({
    data: { familyId: family._id, role: 'member' },
  }).catch(() => userRef.set({
    data: {
      _id: OPENID,
      nickname: nickname || '',
      avatarUrl: avatarUrl || '',
      familyId: family._id,
      role: 'member',
      preferences: {},
      createdAt: db.serverDate(),
    },
  }))

  return { success: true, familyId: family._id }
}
