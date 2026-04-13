const assert = require('assert')
const {
  calcAge,
  createDefaultProfile,
  createDefaultSettings,
  normalizeProfile,
  normalizeSettings,
} = require('../utils/family-settings')

assert.strictEqual(calcAge(1960, new Date('2026-04-13T00:00:00+08:00')), 66)
assert.strictEqual(calcAge('', new Date('2026-04-13T00:00:00+08:00')), '--')

assert.deepStrictEqual(createDefaultProfile(), {
  name: '',
  birthYear: null,
  medicationsText: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
})

assert.deepStrictEqual(createDefaultSettings(), {
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
})

assert.deepStrictEqual(normalizeProfile({
  name: ' 妈妈 ',
  birthYear: '1960',
  medications: '旧字段',
  emergencyContact: '旧联系人',
  medicationsText: ' 氨氯地平 ',
  emergencyContactName: ' Ella ',
  emergencyContactPhone: ' 13812341223 ',
}), {
  name: '妈妈',
  birthYear: 1960,
  medicationsText: '氨氯地平',
  emergencyContactName: 'Ella',
  emergencyContactPhone: '13812341223',
})

assert.deepStrictEqual(normalizeSettings({
  notifyAll: true,
  notifyMemberIds: 'bad',
  alertSystolic: '170',
  alertDiastolic: '105',
  medicationReminderEnabled: true,
  morningReminderTime: '07:30',
  eveningReminderTime: '21:00',
  morningEveningLabel: true,
  splitLines: true,
  fontSize: 'huge',
}), {
  abnormalBpNotifyEnabled: false,
  notifyMemberIds: [],
  alertSystolic: 170,
  alertDiastolic: 105,
  medicationReminderEnabled: true,
  morningReminderTime: '07:30',
  eveningReminderTime: '21:00',
  morningEveningLabel: true,
  splitLines: true,
  fontSize: 'standard',
})

console.log('family settings checks passed')
