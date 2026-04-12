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
    targetSystolic: 135,
    targetDiastolic: 85,
    targetHRMin: 60,
    targetHRMax: 80,
    medications: '',
    emergencyContact: '',
  }
}

function createDefaultSettings() {
  return {
    alertSystolic: 160,
    alertDiastolic: 100,
    notifyAll: true,
    notifyMemberIds: [],
    morningEveningLabel: false,
    splitLines: false,
    fontSize: 'large',
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
