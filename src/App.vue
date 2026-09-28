<script setup lang="ts">
import { HappyProvider } from '@antdv-next/happy-work-theme'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { error } from '@tauri-apps/plugin-log'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEventListener } from '@vueuse/core'
import { ConfigProvider, theme } from 'antdv-next'
import { isString } from 'es-toolkit'
import isURL from 'is-url'
import { onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView } from 'vue-router'

import { useTauriListen } from './composables/useTauriListen'
import { useReminderScheduler } from './composables/useReminderScheduler'
import { useWindowState } from './composables/useWindowState'
import { LANGUAGE, LISTEN_KEY } from './constants'
import { getAntdLocale } from './locales/index.ts'
import { hideWindow, showWindow } from './plugins/window'
import { useAppStore } from './stores/app'
import { useCatStore } from './stores/cat'
import { useGeneralStore } from './stores/general'
import { useModelStore } from './stores/model'
import { useShortcutStore } from './stores/shortcut.ts'
import { useStockStore } from './stores/stock'
import { useReminderStore } from './stores/reminder'

const appStore = useAppStore()
const modelStore = useModelStore()
const catStore = useCatStore()
const generalStore = useGeneralStore()
const shortcutStore = useShortcutStore()
const stockStore = useStockStore()
const reminderStore = useReminderStore()
const appWindow = getCurrentWebviewWindow()
const { isRestored, restoreState } = useWindowState()
const { darkAlgorithm, defaultAlgorithm } = theme
const { locale } = useI18n()

onMounted(async () => {
  // 容错启动：每一步都「独立 try/catch + 独立超时」。
  // 8/24 回归 / 8/29 白屏根因：store 的 $tauri.start() 或 init() 一旦**挂起不 resolve**，
  // 后面的 restoreState() 就永远执行不到 → <RouterView v-if="isRestored"> 不渲染
  // → 主窗口（transparent）全透明空白，表现为「软件没打开 / 没反应」。
  // 所以这里对每一步单独限时，并对 restoreState 做最终兜底：即便失败也强制挂载界面。
  const withTimeout = <T,>(promise: Promise<T>, ms: number, name: string) =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`${name} 超时 ${ms}ms（promise 未 resolve）`)), ms)
      }),
    ])

  const step = async (name: string, fn: () => unknown) => {
    try {
      await withTimeout(Promise.resolve(fn()), 5000, name)

      error(`[BOOT] ok   ${name}`)
    } catch (err) {
      error(`[BOOT] FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  await step('app.$tauri.start', () => appStore.$tauri.start())
  await step('app.init', () => appStore.init())
  await step('model.$tauri.start', () => modelStore.$tauri.start())
  await step('model.init', () => modelStore.init())
  await step('cat.$tauri.start', () => catStore.$tauri.start())
  await step('cat.init', () => catStore.init())
  await step('general.$tauri.start', () => generalStore.$tauri.start())
  await step('general.init', () => generalStore.init())
  await step('shortcut.$tauri.start', () => shortcutStore.$tauri.start())
  await step('stock.$tauri.start', () => stockStore.$tauri.start())
  await step('reminder.$tauri.start', () => reminderStore.$tauri.start())

  // 无论上面成败如何，都必须让主界面挂载出来
  try {
    await withTimeout(restoreState(), 5000, 'restoreState')

    error('[BOOT] ok   restoreState')
  } catch (err) {
    error(`[BOOT] FAIL restoreState: ${err instanceof Error ? err.message : String(err)} — 强制挂载界面`)

    isRestored.value = true
  }
})

// 提醒调度器（仅主窗口执行一次）。
// ⚠️ 必须在 setup 顶层同步调用，不能在 onMounted 里调用——
//    否则 useReminderScheduler 内部注册的 onMounted 不会触发，调度器永不运行。
if (appWindow.label === 'main') {
  useReminderScheduler()
}

watch(() => generalStore.appearance.language, (value) => {
  locale.value = value ?? LANGUAGE.EN_US
})

useTauriListen(LISTEN_KEY.SHOW_WINDOW, ({ payload }) => {
  if (appWindow.label !== payload) return

  showWindow()
})

useTauriListen(LISTEN_KEY.HIDE_WINDOW, ({ payload }) => {
  if (appWindow.label !== payload) return

  hideWindow()
})

let rejectionCount = 0

useEventListener('unhandledrejection', ({ reason }) => {
  // 临时诊断：只打印前 5 次 + 每 50 次汇总，避免刷爆日志
  rejectionCount++

  if (rejectionCount <= 5 || rejectionCount % 50 === 0) {
    const detail = reason instanceof Error
      ? `Error: ${reason.message} @ ${reason.stack?.split('\n').slice(0, 4).join(' | ')}`
      : `reason: ${String(reason)} type=${typeof reason}`

    error(`[unhandledrejection #${rejectionCount}] ${detail}`)
  }
})

useEventListener('click', (event) => {
  const link = (event.target as HTMLElement).closest('a')

  if (!link) return

  const { href, target } = link

  if (target === '_blank') return

  event.preventDefault()

  if (!isURL(href)) return

  openUrl(href)
})
</script>

<template>
  <HappyProvider
    v-slot="{ wave }"
    enabled
  >
    <ConfigProvider
      :locale="getAntdLocale(generalStore.appearance.language)"
      :theme="{
        algorithm: generalStore.appearance.isDark ? darkAlgorithm : defaultAlgorithm,
      }"
      :wave="wave"
    >
      <RouterView v-if="isRestored" />
    </ConfigProvider>
  </HappyProvider>
</template>
