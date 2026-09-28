import type { CountdownReminder } from '@/stores/reminder'

const DAY_MS = 86_400_000

function atTime(base: Date, hhmmStr: string) {
  const [h, m] = hhmmStr.split(':').map(Number)
  const date = new Date(base)

  date.setHours(h, m, 0, 0)

  return date
}

export { atTime }

function dateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(
    ((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
  )

  return week
}

/** 今天是否工作日（下班倒计时用）。大小周：偶数 ISO 周为大周，周六仅大周上班；周日永远休息。 */
function isWorkday(now: Date, bigSmallWeek: boolean) {
  const dow = now.getDay() // 0=周日 .. 6=周六

  if (dow === 0) return false // 周日
  if (dow === 6) {
    if (!bigSmallWeek) return false // 双休，周六休
    return getISOWeek(now) % 2 === 0 // 周六仅大周上班
  }

  return true // 周一~周五
}

/** 根据季节模式取今天工时（start/end 均为 "HH:mm"） */
export function todayHours(item: {
  offSeasonMode?: 'none' | 'summerWinter'
  offStartStandard?: string
  offEndStandard?: string
  offStartSummer?: string
  offEndSummer?: string
  offStartWinter?: string
  offEndWinter?: string
}, now: Date) {
  if (item.offSeasonMode === 'summerWinter') {
    const m = now.getMonth() + 1
    const isSummer = m >= 5 && m <= 9 // 5~9 月为夏令时

    return {
      start: isSummer ? item.offStartSummer ?? '08:30' : item.offStartWinter ?? '09:00',
      end: isSummer ? item.offEndSummer ?? '18:00' : item.offEndWinter ?? '17:30',
    }
  }

  return {
    start: item.offStartStandard ?? '09:00',
    end: item.offEndStandard ?? '18:30',
  }
}

function fmtDuration(ms: number): string {
  const abs = Math.abs(ms)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const s = Math.floor((abs % 60_000) / 1000)

  // HH:MM:SS 倒计时格式
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

function describe(item: CountdownReminder, now: Date): string {
  if (item.kind === 'daily') {
    const target = atTime(now, item.target ?? '18:30')
    const diff = target.getTime() - now.getTime()

    if (diff > 0) return `还有 ${fmtDuration(diff)}`
    if (diff > -60_000) return '就是现在！'
    return `已过 ${fmtDuration(-diff)}`
  }

  if (item.kind === 'date') {
    const raw = item.targetDate ?? item.target ?? ''
    const [y, m, d] = raw.split('-').map(Number)

    if (!y || !m || !d) return '未设置目标日'

    const target = new Date(y, m - 1, d, 0, 0, 0, 0)
    const days = Math.round((target.getTime() - now.getTime()) / DAY_MS)

    if (days > 0) return `还有 ${days} 天`
    if (days === 0) return '就是今天！'
    return `已过 ${-days} 天`
  }

  if (item.kind === 'monthly') {
    const md = Math.min(31, Math.max(1, item.monthDay ?? 1))
    const year = now.getFullYear()
    const month = now.getMonth()
    let next = new Date(year, month, md, 0, 0, 0, 0)

    if (next.getTime() <= now.getTime()) {
      next = new Date(year, month + 1, md, 0, 0, 0, 0)
    }

    const days = Math.ceil((next.getTime() - now.getTime()) / DAY_MS)

    return `还有 ${days} 天`
  }

  if (item.kind === 'offwork') {
    if (!isWorkday(now, !!item.offBigSmallWeek)) return '今天休息，不计算下班'

    const h = todayHours(item, now)
    const end = atTime(now, h.end)
    const diff = end.getTime() - now.getTime()

    if (diff > 0) return `还有 ${fmtDuration(diff)}`
    if (diff > -60_000) return '下班啦！'
    return `已下班 ${fmtDuration(-diff)}`
  }

  return ''
}

export interface CountdownPreviewItem {
  label: string
  text: string
}

/** 计算所有已启用倒计时提醒的实时剩余状态（双击猫咪时调用） */
export function buildCountdownPreview(
  items: CountdownReminder[],
  now: Date = new Date(),
): CountdownPreviewItem[] {
  const result: CountdownPreviewItem[] = []

  for (const item of items) {
    if (!item.enabled) continue

    result.push({ label: item.label || '倒计时', text: describe(item, now) })
  }

  return result
}
