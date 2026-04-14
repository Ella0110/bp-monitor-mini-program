const fs = require('fs')
const assert = require('assert')

function readPngSize(path) {
  const buffer = fs.readFileSync(path)
  assert.strictEqual(buffer.toString('ascii', 1, 4), 'PNG', `${path} should be a PNG file`)
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const app = JSON.parse(fs.readFileSync('app.json', 'utf8'))
assert.strictEqual(app.tabBar.color, '#94A3B8')
assert.strictEqual(app.tabBar.selectedColor, '#3182F7')

const expectedIcons = [
  'assets/icons/data.png',
  'assets/icons/data-active.png',
  'assets/icons/family.png',
  'assets/icons/family-active.png',
]

for (const icon of expectedIcons) {
  const size = readPngSize(icon)
  assert.ok(size.width >= 64, `${icon} width should be at least 64px, got ${size.width}`)
  assert.ok(size.height >= 64, `${icon} height should be at least 64px, got ${size.height}`)
}

assert.deepStrictEqual(app.tabBar.list.map(item => item.iconPath), [
  'assets/icons/data.png',
  'assets/icons/family.png',
])
assert.deepStrictEqual(app.tabBar.list.map(item => item.selectedIconPath), [
  'assets/icons/data-active.png',
  'assets/icons/family-active.png',
])

console.log('tabbar icon checks passed')
