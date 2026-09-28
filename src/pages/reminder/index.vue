<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen } from '@tauri-apps/api/event'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { onMounted, ref } from 'vue'

import { LISTEN_KEY } from '@/constants'
import { hideWindow } from '@/plugins/window'

const appWindow = getCurrentWebviewWindow()

interface ToastPayload {
  title: string
  body: string
  x: number
  y: number
}

interface Toast extends ToastPayload {
  id: number
}

interface PreviewItem {
  label: string
  text: string
}

interface PanelPayload {
  items: PreviewItem[]
  x: number
  y: number
  persistent?: boolean
}

const TOAST_WIDTH = 248
const TOAST_ROW = 60
const TOAST_PAD = 12
const TOAST_DISMISS = 8000
const PANEL_WIDTH = 208
const PANEL_ROW = 26
const PANEL_DISMISS = 5000

const toasts = ref<Toast[]>([])
const panelItems = ref<PreviewItem[]>([])
const panelVisible = ref(false)
const offworkImage = ref<string>('')
const offworkVisible = ref(false)
let seq = 0
let panelTimer: ReturnType<typeof setTimeout> | undefined
let offworkTimer: ReturnType<typeof setTimeout> | undefined

function fitWindow() {
  const toastH = toasts.value.length ? toasts.value.length * (TOAST_ROW + 8) + TOAST_PAD : 0
  const panelH = panelVisible.value
    ? Math.max(panelItems.value.length, 1) * PANEL_ROW + 10
    : 0
  const height = Math.max(toastH, panelH, TOAST_PAD) + 4 // 预留 2px 边框上下各 1 条
  const width = (panelVisible.value ? Math.max(TOAST_WIDTH, PANEL_WIDTH) : TOAST_WIDTH) + 4

  void appWindow.setSize(new PhysicalSize({ width, height }))
}

function positionWindow(x: number, y: number) {
  void appWindow.setPosition(new PhysicalPosition(x, y))
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter(item => item.id !== id)

  if (toasts.value.length === 0 && !panelVisible.value) {
    hideWindow('reminder')
  } else {
    fitWindow()
  }
}

function addToast(payload: ToastPayload) {
  const id = ++seq

  toasts.value.push({ ...payload, id })
  positionWindow(payload.x, payload.y)
  fitWindow()

  setTimeout(() => removeToast(id), TOAST_DISMISS)
}

function showPanel(items: PreviewItem[], x: number, y: number, persistent = false) {
  panelItems.value = items
  panelVisible.value = true
  positionWindow(x, y)
  fitWindow()

  if (panelTimer) clearTimeout(panelTimer)

  // 常显模式：不自动消失，由 main 窗口的常显开关控制隐藏
  if (persistent) return

  // 几秒后自动消失
  panelTimer = setTimeout(() => {
    panelVisible.value = false

    if (toasts.value.length === 0) hideWindow('reminder')
    else fitWindow()
  }, PANEL_DISMISS)
}

onMounted(async () => {
  await listen<ToastPayload>(LISTEN_KEY.REMINDER_TOAST, ({ payload }) => {
    addToast(payload)
  })

  await listen<PanelPayload>(LISTEN_KEY.REMINDER_PANEL, ({ payload }) => {
    showPanel(payload.items, payload.x, payload.y, payload.persistent)
  })

  // 常显模式下，猫咪拖动时实时更新面板位置
  await listen<{ x: number; y: number }>(LISTEN_KEY.REMINDER_PANEL_POSITION, ({ payload }) => {
    if (!panelVisible.value) return

    positionWindow(payload.x, payload.y)
  })

  // 下班到点：桌面正中间弹图，显示 durationSec 秒后自动消失
  await listen<{ image?: string; durationSec?: number }>(LISTEN_KEY.REMINDER_OFFWORK_IMAGE, ({ payload }) => {
    offworkImage.value = payload.image ?? ''
    offworkVisible.value = true

    // 窗口尺寸设为图片尺寸 + 边距（居中定位）
    const W = 220
    const H = 220
    const screen = window.screen
    const x = Math.max(0, Math.round((screen.width - W) / 2))
    const y = Math.max(0, Math.round((screen.height - H) / 2))

    void appWindow.setSize(new PhysicalSize({ width: W, height: H }))
    void appWindow.setPosition(new PhysicalPosition(x, y))
    void appWindow.show()

    if (offworkTimer) clearTimeout(offworkTimer)

    const durationMs = (payload.durationSec ?? 2) * 1000

    offworkTimer = setTimeout(() => {
      offworkVisible.value = false
      hideWindow('reminder')
    }, durationMs)
  })
})
</script>

<template>
  <div class="pointer-events-none fixed left-0 top-0 flex h-full w-full flex-col">
    <!-- 下班到点：桌面正中间弹图，2 秒后自动消失（窗口已定位屏幕正中） -->
    <div
      v-if="offworkVisible"
      class="pointer-events-none fixed inset-0 flex items-center justify-center"
    >
      <img
        :src="offworkImage || '/offwork-default.png'"
        class="max-h-[200px] max-w-[200px] object-contain"
        alt="下班"
      >
    </div>

    <div class="flex w-full flex-col gap-2 p-1.5">
      <!-- 双击猫咪出现的倒计时面板：白底 + 黑边(#333) -->
      <div
        v-if="panelVisible"
        class="rounded-md border-2 border-[#333] bg-white px-2.5 py-1.5 shadow-lg"
      >
        <div
          v-for="(p, i) in panelItems"
          :key="i"
          class="flex items-center"
        >
          <span class="text-3 font-medium text-black/80">{{ p.label }}</span>
          <span class="ml-5 font-mono text-3 font-medium text-black/60">{{ p.text }}</span>
        </div>
        <div
          v-if="panelItems.length === 0"
          class="py-0.5 text-3 text-black/50"
        >
          暂无倒计时提醒
        </div>
      </div>

      <!-- 时钟提醒的自动 toast -->
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="rounded-xl border border-black/10 bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
        >
          <div class="text-3.5 font-bold text-black/90">
            {{ toast.title }}
          </div>
          <div class="mt-0.5 text-3 text-black/60">
            {{ toast.body }}
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all .3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(.92);
}
</style>
