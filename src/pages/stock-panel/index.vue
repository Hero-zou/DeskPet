<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

import { useStockStore } from '@/stores/stock'

const stockStore = useStockStore()
const appWindow = getCurrentWebviewWindow()

const list = computed(() => stockStore.visibleStocks)

// 股票名最多显示 4 个字，超出用 …
function displayName(name: string) {
  if (name.length <= 4) return name

  return `${name.slice(0, 4)}…`
}

const ROW_HEIGHT = 38
const ROW_GAP = -10
const PADDING = 8
const PANEL_WIDTH = 208

// 平滑跟随：rAF 插值到目标位置，避免 setPosition 积压/抖动
const FOLLOW_SMOOTHING = 0.35

let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0
let rafId: number | undefined

function smoothFollow() {
  const dx = targetX - currentX
  const dy = targetY - currentY

  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    currentX = targetX
    currentY = targetY

    rafId = void 0

    return
  }

  currentX += dx * FOLLOW_SMOOTHING
  currentY += dy * FOLLOW_SMOOTHING

  void appWindow.setPosition(new PhysicalPosition(Math.round(currentX), Math.round(currentY))).catch(() => {
    // 窗口不可用时停止跟随，避免无限刷错误
    rafId = void 0
  })

  rafId = requestAnimationFrame(smoothFollow)
}

function setPanelPosition(x: number, y: number) {
  targetX = x
  targetY = y

  if (rafId !== void 0) return

  currentX = x
  currentY = y

  void appWindow.setPosition(new PhysicalPosition(Math.round(currentX), Math.round(currentY))).catch(() => {
    rafId = void 0
  })

  rafId = requestAnimationFrame(smoothFollow)
}

// 根据列表数量调整窗口高度
async function fitWindow() {
  const count = list.value.length

  if (count === 0) return

  const height = count * ROW_HEIGHT + (count - 1) * ROW_GAP + PADDING

  await appWindow.setSize(new PhysicalSize({ width: PANEL_WIDTH, height }))
}

watch(list, async () => {
  await nextTick()

  await fitWindow()
}, { deep: true })

onMounted(async () => {
  // 监听 main 窗口的定位指令
  await listen<{ x: number; y: number }>('stock-panel-position', async ({ payload }) => {
    setPanelPosition(payload.x, payload.y)
  })

  await nextTick()

  await fitWindow()
})
</script>

<template>
  <div
    class="pointer-events-none flex h-screen w-screen flex-col overflow-hidden rounded-md border border-black/15 bg-white shadow-lg"
    :style="{ opacity: stockStore.panelOpacity / 100 }"
  >
    <div v-if="list.length === 0" class="flex flex-1 items-center justify-center px-3 text-3 text-black/40">
      暂无股票，右键猫咪 → 股票设置添加
    </div>

    <div v-else class="flex flex-1 flex-col overflow-hidden">
      <div
        v-for="(item, index) in list"
        :key="item.code"
        class="flex h-[38px] shrink-0 items-center px-2.5"
        :style="{ marginBottom: index === list.length - 1 ? 0 : `${ROW_GAP}px` }"
      >
        <div class="flex min-w-0 flex-none flex-col justify-center">
          <span class="truncate text-3 font-medium text-black/90">{{ displayName(item.name) }}</span>
          <span class="font-mono text-3 text-black/70">{{ item.price > 0 ? item.price.toFixed(2) : '--' }}</span>
        </div>

        <div class="ml-3 flex shrink-0 items-center">
          <span
            class="font-mono text-3 font-medium"
            :class="item.changePct >= 0 ? 'text-[#f5222d]' : 'text-[#00b42a]'"
          >
            {{ `${item.changePct >= 0 ? '+' : ''}${item.changePct.toFixed(2)}%` }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
