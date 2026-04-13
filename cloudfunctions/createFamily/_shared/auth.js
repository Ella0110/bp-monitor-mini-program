function findMember(family, openid) {
  if (!family || !Array.isArray(family.members)) return null
  return family.members.find(member => member.openid === openid) || null
}

function requireMember(family, openid) {
  const member = findMember(family, openid)
  if (!member) {
    const err = new Error('无权访问该家庭组')
    err.code = 'FORBIDDEN'
    throw err
  }
  return member
}

function requireAdmin(family, openid) {
  const member = requireMember(family, openid)
  if (member.role !== 'admin') {
    const err = new Error('仅管理员可操作')
    err.code = 'ADMIN_REQUIRED'
    throw err
  }
  return member
}

function canWriteRecord(member) {
  return member.role === 'admin' || member.canWrite === true
}

function canEditRecord(member) {
  return member.role === 'admin' || member.canEdit === true
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

module.exports = {
  findMember,
  requireMember,
  requireAdmin,
  canWriteRecord,
  canEditRecord,
  createDefaultProfile,
  createDefaultSettings,
}
