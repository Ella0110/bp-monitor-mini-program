const FONT_SIZES = ['standard', 'large', 'xlarge']

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

function calcAge(birthYear, now = new Date()) {
  const year = Number(birthYear)
  if (!Number.isFinite(year) || year <= 0) return '--'
  return Math.max(0, now.getFullYear() - year)
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

function normalizeProfile(profile = {}) {
  const defaults = createDefaultProfile()
  return {
    ...defaults,
    name: trim(profile.name),
    birthYear: toNumberOrNull(profile.birthYear),
    medicationsText: trim(profile.medicationsText || profile.medications),
    emergencyContactName: trim(profile.emergencyContactName || profile.emergencyContact),
    emergencyContactPhone: trim(profile.emergencyContactPhone),
  }
}

function normalizeSettings(settings = {}) {
  const defaults = createDefaultSettings()
  const fontSize = FONT_SIZES.includes(settings.fontSize) ? settings.fontSize : defaults.fontSize
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

module.exports = {
  FONT_SIZES,
  calcAge,
  createDefaultProfile,
  createDefaultSettings,
  normalizeProfile,
  normalizeSettings,
}
