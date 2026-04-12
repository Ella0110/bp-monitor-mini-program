const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { inviteToken } = event
  if (!inviteToken) return { success: false, error: '邀请无效' }

  const res = await db.collection('families')
    .where({ inviteToken })
    .field({ displayName: true })
    .limit(1)
    .get()

  if (!res.data.length) return { success: false, error: '邀请已失效' }
  return {
    success: true,
    displayName: res.data[0].displayName || '家庭健康记录',
  }
}
