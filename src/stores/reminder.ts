import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ReminderKind = 'daily' | 'date' | 'monthly' | 'offwork'
export type SeasonMode = 'none' | 'summerWinter'

/** 时钟提醒：每天固定时间提醒某件事 */
export interface ClockReminder {
  id: string
  label: string
  time: string // "HH:mm"
  enabled: boolean
  lastFiredKey?: string
}

/**
 * 倒计时提醒，按 kind 区分：
 * - daily     ：每天 target(HH:mm) 的「提前 leadMinutes 分钟」与「到点」提醒（如 18:30 下班，提前 30 分钟）
 * - date      ：指定某一天 target(YYYY-MM-DD)，每天 remindAt(HH:mm) 提醒「还剩几天」，按 intervalDays 间隔（如 某项目截止）
 * - monthly   ：每月 monthDay 号（发薪日），每天 monthlyRemindAt 提醒「还剩几天」，按 monthlyIntervalDays 间隔
 * - offwork   ：下班倒计时，按 大小周(offBigSmallWeek) + 季节(offSeasonMode/工时) 计算今天下班时间，提前 offLeadMinutes 提醒
 */
export interface CountdownReminder {
  id: string
  label: string
  kind: ReminderKind
  enabled: boolean
  lastFiredKey?: string

  // daily
  target?: string // "HH:mm"
  leadMinutes?: number

  // date
  /** @deprecated 见 monthly.monthDay；date 模式复用 target 存 YYYY-MM-DD */
  targetDate?: string
  intervalDays?: number // 每隔几天提醒一次（默认 1 = 每天）
  remindAt?: string // date 模式每天几点提醒（"HH:mm"，默认 "09:00"）

  // monthly（发薪）
  monthDay?: number // 每月几号（1-31）
  monthlyIntervalDays?: number // 每隔几天提醒一次（默认 1）
  monthlyRemindAt?: string // 每天几点提醒（默认 "09:00"）

  // offwork（下班）
  offBigSmallWeek?: boolean // 是否大小周（偶数 ISO 周为大周，周六仅大周上班）
  offSeasonMode?: SeasonMode // 季节区分：不分 / 夏令冬令
  offStartStandard?: string // 不分时的上班时间
  offEndStandard?: string // 不分时的下班时间
  offStartSummer?: string // 夏令时上班
  offEndSummer?: string // 夏令时下班
  offStartWinter?: string // 冬令时上班
  offEndWinter?: string // 冬令时下班
  offLeadMinutes?: number // 下班提前提醒分钟数
  offworkImage?: string // 下班到点弹图（设置页上传，存 base64 或路径）
  offworkDurationSec?: number // 下班到点弹图显示秒数（默认 2）
}

const uid = () => Math.random().toString(36).slice(2, 10)

function defaultCountdown(kind: ReminderKind): CountdownReminder {
  const base: CountdownReminder = {
    id: uid(),
    label:
      kind === 'offwork' ? '下班' : kind === 'monthly' ? '发薪' : kind === 'date' ? '项目截止' : '新倒计时',
    kind,
    enabled: true,
  }

  if (kind === 'daily') {
    return { ...base, target: '18:30', leadMinutes: 30 }
  }

  if (kind === 'date') {
    return { ...base, target: '', intervalDays: 1, remindAt: '09:00' }
  }

  if (kind === 'monthly') {
    return { ...base, monthDay: 15, monthlyIntervalDays: 1, monthlyRemindAt: '09:00' }
  }

  // offwork
  return {
    ...base,
    offBigSmallWeek: false,
    offSeasonMode: 'none',
    offStartStandard: '09:00',
    offEndStandard: '18:30',
    offStartSummer: '08:30',
    offEndSummer: '18:00',
    offStartWinter: '09:00',
    offEndWinter: '17:30',
    offLeadMinutes: 30,
    offworkDurationSec: 2,
  }
}

export const useReminderStore = defineStore('reminder', () => {
  const clockReminders = ref<ClockReminder[]>([])
  const countdownReminders = ref<CountdownReminder[]>([])

  // 倒计时提示面板是否常显（跟随猫咪常驻，不再靠双击触发）
  const panelAlwaysVisible = ref(false)

  const togglePanelAlwaysVisible = () => {
    panelAlwaysVisible.value = !panelAlwaysVisible.value
  }

  // ---------------- 时钟提醒 ----------------
  const addClock = (partial?: Partial<ClockReminder>) => {
    clockReminders.value.push({
      id: uid(),
      label: partial?.label ?? '新提醒',
      time: partial?.time ?? '09:00',
      enabled: partial?.enabled ?? true,
    })
  }

  const removeClock = (id: string) => {
    clockReminders.value = clockReminders.value.filter(item => item.id !== id)
  }

  const updateClock = (id: string, patch: Partial<ClockReminder>) => {
    const item = clockReminders.value.find(item => item.id === id)

    if (item) Object.assign(item, patch)
  }

  // ---------------- 倒计时提醒 ----------------
  const addCountdown = (partial?: Partial<CountdownReminder>) => {
    const kind = partial?.kind ?? 'daily'
    const item = defaultCountdown(kind)

    Object.assign(item, partial)

    countdownReminders.value.push(item)
  }

  const removeCountdown = (id: string) => {
    countdownReminders.value = countdownReminders.value.filter(item => item.id !== id)
  }

  const updateCountdown = (id: string, patch: Partial<CountdownReminder>) => {
    const item = countdownReminders.value.find(item => item.id === id)

    if (item) Object.assign(item, patch)
  }

  return {
    clockReminders,
    countdownReminders,
    panelAlwaysVisible,
    togglePanelAlwaysVisible,
    addClock,
    removeClock,
    updateClock,
    addCountdown,
    removeCountdown,
    updateCountdown,
  }
})
