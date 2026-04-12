const cloud = require('wx-server-sdk')
const {
  createDefaultProfile,
  createDefaultSettings,
} = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toUpperCase()
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const profile = { ...createDefaultProfile(), ...(event.profile || {}) }
  const displayName = event.displayName || (profile.name ? `${profile.name}的健康记录` : '家庭健康记录')

  const familyRes = await db.collection('families').add({
    data: {
      displayName,
      inviteCode: randomCode(),
      inviteToken: randomToken(),
      createdBy: OPENID,
      members: [{
        openid: OPENID,
        role: 'admin',
        nickname: event.nickname || '我',
        avatarUrl: event.avatarUrl || '',
        canWrite: true,
        canEdit: true,
        joinedAt: db.serverDate(),
      }],
      profile,
      settings: createDefaultSettings(),
      createdAt: db.serverDate(),
    },
  })

  await db.collection('users').doc(OPENID).update({
    data: { familyId: familyRes._id, role: 'admin' },
  })

  return { success: true, familyId: familyRes._id }
}
