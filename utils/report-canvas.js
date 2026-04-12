const { drawBloodPressureChart, drawHeartRateChart } = require('./canvas-charts')

const COLORS = {
  background: '#FFFFFF',
  title: '#0F172A',
  text: '#334155',
  muted: '#64748B',
  line: '#E2E8F0',
  warning: '#E53935',
}

function setFill(ctx, color) {
  if (ctx.setFillStyle) ctx.setFillStyle(color)
  else ctx.fillStyle = color
}

function setStroke(ctx, color) {
  if (ctx.setStrokeStyle) ctx.setStrokeStyle(color)
  else ctx.strokeStyle = color
}

function setFont(ctx, size, weight = '400') {
  if (ctx.setFontSize) ctx.setFontSize(size)
  else ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, sans-serif`
}

function text(ctx, value, x, y, size = 24, color = COLORS.text, weight = '400') {
  setFill(ctx, color)
  setFont(ctx, size, weight)
  ctx.fillText(String(value), x, y)
}

function line(ctx, x1, y1, x2, y2) {
  setStroke(ctx, COLORS.line)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawWrappedText(ctx, value, x, y, maxWidth, lineHeight, size, color) {
  const chars = String(value).split('')
  let lineText = ''
  chars.forEach(char => {
    const next = lineText + char
    if (ctx.measureText(next).width > maxWidth && lineText) {
      text(ctx, lineText, x, y, size, color)
      y += lineHeight
      lineText = char
    } else {
      lineText = next
    }
  })
  if (lineText) text(ctx, lineText, x, y, size, color)
  return y + lineHeight
}

function drawEmptyChart(ctx, label, x, y, width, height) {
  setStroke(ctx, COLORS.line)
  ctx.strokeRect(x, y, width, height)
  text(ctx, label, x + width / 2 - 84, y + height / 2, 24, COLORS.muted)
}

function reportImageHeight(report) {
  const recordHeight = report.recentRecords.length ? report.recentRecords.length * 58 : 58
  return 1500 + recordHeight
}

function drawSummary(ctx, report, x, y) {
  const avgBp = report.avg.systolic === '--' ? '--' : `${report.avg.systolic}/${report.avg.diastolic}`
  const items = [
    ['记录次数', `${report.totalCount}`],
    ['血压均值', avgBp],
    ['心率均值', `${report.avg.heartRate}`],
    ['血压需关注', `${report.stats.bp.attention}`],
    ['心率需关注', `${report.stats.hr.attention}`],
  ]
  items.forEach((item, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const left = x + col * 330
    const top = y + row * 72
    text(ctx, item[1], left, top, 32, index >= 3 && Number(item[1]) > 0 ? COLORS.warning : COLORS.title, '700')
    text(ctx, item[0], left, top + 30, 20, COLORS.muted)
  })
}

function drawReportImage(ctx, report, width, height) {
  setFill(ctx, COLORS.background)
  ctx.fillRect(0, 0, width, height)

  let y = 48
  text(ctx, report.title, 32, y, 36, COLORS.title, '700')
  y += 46
  text(ctx, `${report.familyName} · ${report.profileName}`, 32, y, 24, COLORS.text)
  y += 34
  text(ctx, `${report.periodTitle} · 生成时间 ${report.generatedAt}`, 32, y, 22, COLORS.muted)
  y += 38
  line(ctx, 32, y, width - 32, y)
  y += 56

  text(ctx, '摘要', 32, y, 28, COLORS.title, '700')
  y += 48
  drawSummary(ctx, report, 32, y)
  y += 240

  text(ctx, '血压趋势', 32, y, 28, COLORS.title, '700')
  y += 18
  if (report.bpChart.records.length) drawBloodPressureChart(ctx, report.bpChart, width - 64, 260, { title: '', x: 32, y })
  else drawEmptyChart(ctx, '当前周期暂无记录', 32, y, width - 64, 220)
  y += 288

  text(ctx, '心率趋势', 32, y, 28, COLORS.title, '700')
  y += 18
  if (report.hrChart.records.length) drawHeartRateChart(ctx, report.hrChart, width - 64, 260, { title: '', x: 32, y })
  else drawEmptyChart(ctx, '当前周期暂无记录', 32, y, width - 64, 220)
  y += 288

  text(ctx, '最近记录', 32, y, 28, COLORS.title, '700')
  y += 42
  if (!report.recentRecords.length) {
    text(ctx, '当前周期暂无记录', 32, y, 22, COLORS.muted)
    y += 48
  } else {
    report.recentRecords.forEach(record => {
      text(ctx, record.time, 32, y, 20, COLORS.muted)
      text(ctx, `${record.bpText} · ${record.heartRateText}`, 260, y, 22, COLORS.text, '700')
      y += 26
      text(ctx, `血压${record.bpStatus} · 心率${record.hrStatus}`, 260, y, 20, COLORS.muted)
      y += 32
    })
  }

  line(ctx, 32, y, width - 32, y)
  y += 40
  drawWrappedText(ctx, report.disclaimer, 32, y, width - 64, 30, 20, COLORS.muted)
}

module.exports = {
  drawReportImage,
  reportImageHeight,
}
