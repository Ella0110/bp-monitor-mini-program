const cloud = require('wx-server-sdk')
const { requireAdmin, createDefaultProfile, createDefaultSettings } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function trim(value) {
  return String(value || '').trim()
}

function toNumberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function validTime(value, fallback) {
  const text = trim(value)
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
    targetSystolic: toNumberOrDefault(profile.targetSystolic, defaults.targetSystolic),
    targetDiastolic: toNumberOrDefault(profile.targetDiastolic, defaults.targetDiastolic),
    targetHRMin: toNumberOrDefault(profile.targetHRMin, defaults.targetHRMin),
    targetHRMax: toNumberOrDefault(profile.targetHRMax, defaults.targetHRMax),
  }
}

function normalizeSettings(settings = {}) {
  const defaults = createDefaultSettings()
  const fontSize = ['standard', 'large', 'xlarge'].includes(settings.fontSize) ? settings.fontSize : defaults.fontSize
  return {
    ...defaults,
    abnormalBpNotifyEnabled: settings.abnormalBpNotifyEnabled === true,
    notifyMemberIds: Array.isArray(settings.notifyMemberIds) ? settings.notifyMemberIds : [],
    alertSystolic: toNumberOrDefault(settings.alertSystolic, defaults.alertSystolic),
    alertDiastolic: toNumberOrDefault(settings.alertDiastolic, defaults.alertDiastolic),
    medicationReminderEnabled: settings.medicationReminderEnabled === true,
    morningReminderTime: validTime(settings.morningReminderTime, defaults.morningReminderTime),
    eveningReminderTime: validTime(settings.eveningReminderTime, defaults.eveningReminderTime),
    morningEveningLabel: settings.morningEveningLabel === true,
    splitLines: settings.splitLines === true,
    fontSize,
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { familyId } = event
  const familyRef = db.collection('families').doc(familyId)
  const family = (await familyRef.get()).data
  requireAdmin(family, OPENID)

  const existingProfile = family.profile || {}
  const existingSettings = family.settings || {}
  const profile = normalizeProfile({ ...existingProfile, ...(event.profile || {}) })
  const settings = normalizeSettings({ ...existingSettings, ...(event.settings || {}) })

  await familyRef.update({
    data: {
      profile,
      settings,
      updatedAt: db.serverDate(),
    },
  })

  return { success: true, profile, settings }
}
