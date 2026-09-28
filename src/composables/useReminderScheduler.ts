import { emit } from '@tauri-apps/api/event'
import { onMounted, onUnmounted } from 'vue'

import { LISTEN_KEY, WINDOW_LABEL } from '@/constants'
import { useAppStore } from '@/stores/app'
import { useReminderStore } from '@/stores/reminder'
import { buildCountdownPreview, atTime, todayHours } from '@/composables/useCountdownPreview'
import { showWindow } from '@/plugins/window'

const pad = (n: number) => String(n).padStart(2, '0')
const hhmm = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * 提醒调度器：仅在主窗口启动一次。
 * 每 10s 轮询一次，命中「时钟提醒」则自动弹出悬浮提示窗。
 * 「倒计时提醒」改为双击猫咪手动查看（见 useCountdownPreview + main 双击处理），不再自动弹。
 */
export function useReminderScheduler() {
  const store = useReminderStore()
  const appStore = useAppStore()
  let timer: ReturnType<typeof setInterval> | undefined

  function fire(
    title: string,
    body: string,
    keyHolder: { lastFiredKey?: string },
    key: string,
  ) {
    // 同一触发实例只提醒一次（防重复）
    if (keyHolder.lastFiredKey === key) return

    keyHolder.lastFiredKey = key

    const main = appStore.windowState[WINDOW_LABEL.MAIN]

    showWindow(WINDOW_LABEL.REMINDER)

    void emit(LISTEN_KEY.REMINDER_TOAST, {
      title,
      body,
      // 让提示窗定位到猫咪右上方
      x: main?.x != null && main?.width != null ? main.x + main.width + 12 : 120,
      y: main?.y != null ? Math.max(8, main.y) : 120,
    })
  }

  function check() {
    const now = new Date()
    const today = dateKey(now)
    const nowStr = hhmm(now)

    // 时钟提醒：到指定时分即提醒
    for (const item of store.clockReminders) {
      if (!item.enabled) continue

      if (item.time === nowStr) {
        fire(`⏰ ${item.label}`, `现在是 ${item.time}`, item, `${today}-${item.time}`)
      }
    }

    // 倒计时提醒：到达各自 remindAt 时刻时，把当天所有倒计时快照弹出（每项每天只弹一次）
    const countdownItems = store.countdownReminders
    let due = false

    for (const item of countdownItems) {
      if (!item.enabled) continue

      let remindAt = ''

      if (item.kind === 'daily') {
        remindAt = item.target ?? ''
      }
      else if (item.kind === 'date') {
        remindAt = item.remindAt ?? '09:00'
      }
      else if (item.kind === 'monthly') {
        remindAt = item.monthlyRemindAt ?? '09:00'
      }
      else if (item.kind === 'offwork') {
        remindAt = item.offLeadMinutes ? '' : '' // 下班模式到点单独处理（弹图）
      }

      if (remindAt && remindAt === nowStr) {
        const key = `${today}-${item.id}-${remindAt}`

        if (item.lastFiredKey !== key) {
          item.lastFiredKey = key
          due = true
        }
      }
    }

    // 下班到点：弹居中的下班图片 2 秒后自动消失
    for (const item of countdownItems) {
      if (!item.enabled || item.kind !== 'offwork') continue

      const h = todayHours(item, now)
      const end = atTime(now, h.end)
      const endStr = hhmm(end)

      if (endStr === nowStr) {
        const key = `${today}-${item.id}-offwork-img`

        if (item.lastFiredKey !== key) {
          item.lastFiredKey = key
          showWindow(WINDOW_LABEL.REMINDER)

          void emit(LISTEN_KEY.REMINDER_OFFWORK_IMAGE, {
            image: item.offworkImage,
            durationSec: item.offworkDurationSec ?? 2,
          })
        }
      }
    }

    if (due) {
      const preview = buildCountdownPreview(countdownItems)
      const main = appStore.windowState[WINDOW_LABEL.MAIN]

      showWindow(WINDOW_LABEL.REMINDER)

      // 面板宽度/高度估算（与 reminder 窗口 PANEL_WIDTH 一致），用于边界与头顶定位
      const PANEL_W = 208
      const PANEL_H = 66
      const SCREEN_W = window.screen.width
      let px = main?.x != null && main?.width != null ? main.x + main.width + 12 : 120

      if (px + PANEL_W > SCREEN_W && main?.x != null) {
        px = main.x - PANEL_W - 12
      }

      const py = main?.y != null ? Math.max(0, main.y - PANEL_H - 8) : 120

      void emit(LISTEN_KEY.REMINDER_PANEL, {
        items: preview,
        x: Math.max(0, px),
        y: py,
      })
    }
  }

  onMounted(() => {
    // 启动即检查一次，之后每 10s 轮询
    check()
    timer = setInterval(check, 10_000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })
}
