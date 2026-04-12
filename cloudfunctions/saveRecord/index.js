const cloud = require('wx-server-sdk')
const { requireMember, canWriteRecord, canEditRecord } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function normalizeRecord(event, openid) {
  const systolic = Number(event.systolic)
  const diastolic = Number(event.diastolic)
  const heartRate = Number(event.heartRate)
  if (!systolic || systolic < 60 || systolic > 300) throw new Error('高压值不正确')
  if (!diastolic || diastolic < 40 || diastolic > 200) throw new Error('低压值不正确')
  if (!heartRate || heartRate < 30 || heartRate > 250) throw new Error('心率不正确')
  return {
    familyId: event.familyId,
    systolic,
    diastolic,
    heartRate,
    measuredAt: new Date(event.measuredAt),
    period: event.period || null,
    recordedBy: openid,
    updatedAt: db.serverDate(),
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const family = (await db.collection('families').doc(event.familyId).get()).data
  const member = requireMember(family, OPENID)
  const data = normalizeRecord(event, OPENID)

  if (event.id) {
    if (!canEditRecord(member)) return { success: false, error: '没有编辑权限' }
    const existing = (await db.collection('records').doc(event.id).get()).data
    if (existing.familyId !== event.familyId) return { success: false, error: '记录不属于当前家庭组' }
    delete data.recordedBy
    await db.collection('records').doc(event.id).update({ data })
    return { success: true, id: event.id }
  }

  if (!canWriteRecord(member)) return { success: false, error: '没有录入权限' }
  data.createdAt = db.serverDate()
  const res = await db.collection('records').add({ data })
  return { success: true, id: res._id }
}
