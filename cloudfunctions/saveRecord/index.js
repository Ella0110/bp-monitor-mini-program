const cloud = require('wx-server-sdk')
const { requireMember, canWriteRecord, canEditRecord } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function randomToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.toUpperCase()
}

function createDefaultProfile() {
  return {
    name: '',
    birthYear: null,
    medicationsText: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  }
}

function createDefaultSettings() {
  return {
    abnormalBpNotifyEnabled: false,
    notifyMemberIds: [],
    alertSystolic: 160,
    alertDiastolic: 100,
    medicationReminderEnabled: false,
    morningReminderTime: '08:00',
    eveningReminderTime: '20:00',
    morningEveningLabel: false,
    splitLines: false,
    fontSize: 'standard',
  }
}

async function createDefaultFamily(openid) {
  const familyRes = await db.collection('families').add({
    data: {
      displayName: '我的记录',
      inviteCode: randomCode(),
      inviteToken: randomToken(),
      createdBy: openid,
      members: [{
        openid,
        role: 'admin',
        nickname: '我',
        avatarUrl: '',
        canWrite: true,
        canEdit: true,
        joinedAt: db.serverDate(),
      }],
      profile: createDefaultProfile(),
      settings: createDefaultSettings(),
      createdAt: db.serverDate(),
    },
  })

  const userRef = db.collection('users').doc(openid)
  await userRef.update({
    data: { familyId: familyRes._id, role: 'admin' },
  }).catch(() => userRef.set({
    data: {
      nickname: '',
      avatarUrl: '',
      familyId: familyRes._id,
      role: 'admin',
      preferences: {},
      createdAt: db.serverDate(),
    },
  }))

  return familyRes._id
}

function normalizeRecord(event, openid, familyId) {
  const systolic = Number(event.systolic)
  const diastolic = Number(event.diastolic)
  const heartRate = Number(event.heartRate)
  if (!systolic || systolic < 60 || systolic > 300) throw new Error('高压值不正确')
  if (!diastolic || diastolic < 40 || diastolic > 200) throw new Error('低压值不正确')
  if (!heartRate || heartRate < 30 || heartRate > 250) throw new Error('心率不正确')
  return {
    familyId,
    systolic,
    diastolic,
    heartRate,
    measuredAt: new Date(event.measuredAt),
    period: event.period || null,
    recordedBy: openid,
    updatedAt: db.serverDate(),
  }
}

async function resolveWritableFamily(event, openid) {
  if (!event.familyId) {
    if (event.id) {
      return { success: false, error: '缺少记录所属空间' }
    }
    const familyId = await createDefaultFamily(openid)
    const family = (await db.collection('families').doc(familyId).get()).data
    const member = requireMember(family, openid)
    return { success: true, familyId, family, member }
  }

  const family = (await db.collection('families').doc(event.familyId).get()).data
  const member = requireMember(family, openid)
  return { success: true, familyId: event.familyId, family, member }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const resolved = await resolveWritableFamily(event, OPENID)
  if (!resolved.success) return resolved

  const { familyId, member } = resolved
  const data = normalizeRecord(event, OPENID, familyId)

  if (event.id) {
    if (!canEditRecord(member)) return { success: false, error: '没有编辑权限' }
    const existing = (await db.collection('records').doc(event.id).get()).data
    if (existing.familyId !== familyId) return { success: false, error: '记录不属于当前记录' }
    delete data.recordedBy
    await db.collection('records').doc(event.id).update({ data })
    return { success: true, id: event.id, familyId }
  }

  if (!canWriteRecord(member)) return { success: false, error: '没有录入权限' }
  data.createdAt = db.serverDate()
  const res = await db.collection('records').add({ data })
  return { success: true, id: res._id, familyId }
}
