import { isNil } from 'es-toolkit'
import { watch } from 'vue'

import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

import { WINDOW_LABEL } from '@/constants'
import { useAppStore } from '@/stores/app'
import { useStockStore } from '@/stores/stock'
import { startStockQuotePolling, stopStockQuotePolling } from '@/composables/useStockQuote'
import { inBetween } from '@/utils/is'
import { hideWindow, showWindow } from '@/plugins/window'

const PANEL_GAP = 4
const HIDE_DELAY = 300

export function useStockPanelHover() {
  const appStore = useAppStore()
  const stockStore = useStockStore()

  let wasInCat = false
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let panelVisible = false
  let dragging = false // 拖动中：暂停轮询与悬停判断

  const appWindow = getCurrentWebviewWindow()

  /** 拖动状态开关：拖动中暂停行情轮询与悬停面板逻辑，释放后恢复 */
  function setDragging(value: boolean) {
    dragging = value

    if (value) {
      // 拖动中：暂停行情轮询 + 立即隐藏面板（不走 300ms 延迟）
      stopStockQuotePolling()

      if (hideTimer) {
        clearTimeout(hideTimer)

        hideTimer = void 0
      }

      if (panelVisible) {
        hideWindow(WINDOW_LABEL.STOCK_PANEL)
        panelVisible = false
      }
    } else {
      // 释放后：若面板仍可见则恢复轮询
      if (panelVisible) startStockQuotePolling()
    }
  }

  // 通过事件告知 stock-panel 窗口自行定位（避免跨窗口直接调用 API 的兼容问题）
  function movePanelTo(x: number, y: number) {
    emit('stock-panel-position', { x: Math.round(x), y: Math.round(y) })
  }

  // 定位弹层到猫咪右上方（首次显示时用 windowState）
  function positionPanel() {
    const catState = appStore.windowState[WINDOW_LABEL.MAIN] ?? {}

    if (isNil(catState.x) || isNil(catState.y) || isNil(catState.width)) return

    movePanelTo(catState.x + catState.width + PANEL_GAP, catState.y)
  }

  // 猫被拖动时实时跟随：onMoved 事件自带窗口新位置（不读 store，避免滞后一帧）
  appWindow.onMoved(({ payload }) => {
    if (!panelVisible) return

    const catState = appStore.windowState[WINDOW_LABEL.MAIN] ?? {}
    const width = isNil(catState.width) ? 122 : catState.width

    movePanelTo(payload.x + width + PANEL_GAP, payload.y)
  })

  function isInCat(x: number, y: number) {
    const state = appStore.windowState[WINDOW_LABEL.MAIN] ?? {}
    const { x: winX, y: winY, width, height } = state

    if (isNil(winX) || isNil(winY) || isNil(width) || isNil(height)) return false

    return inBetween(x, winX, winX + width) && inBetween(y, winY, winY + height)
  }

  function isInPanel(x: number, y: number) {
    const state = appStore.windowState[WINDOW_LABEL.STOCK_PANEL] ?? {}

    if (isNil(state.x) || isNil(state.y) || isNil(state.width) || isNil(state.height)) return false

    // 外扩 20px 避免移出弹层瞬间就隐藏
    return inBetween(x, state.x - 20, state.x + state.width + 20)
      && inBetween(y, state.y - 20, state.y + state.height + 20)
  }

  function showPanel() {
    if (hideTimer) {
      clearTimeout(hideTimer)

      hideTimer = void 0
    }

    if (stockStore.visibleStocks.length === 0) return

    panelVisible = true

    // 面板可见时才轮询行情，移开即停（避免后台空转）
    startStockQuotePolling()

    positionPanel()

    showWindow(WINDOW_LABEL.STOCK_PANEL)
  }

  function hidePanel() {
    if (hideTimer) {
      clearTimeout(hideTimer)
    }

    hideTimer = setTimeout(() => {
      hideWindow(WINDOW_LABEL.STOCK_PANEL)

      // 面板隐藏后停止行情轮询，省 CPU / 网络
      stopStockQuotePolling()

      panelVisible = false
    }, HIDE_DELAY)
  }

  watch(() => stockStore.visibleStocks.length, (count) => {
    // 列表清空时隐藏弹层
    if (count === 0) {
      hidePanel()
    }
  })

  function onCursorMove(x: number, y: number) {
    // 拖动中不处理悬停逻辑（避免拖拽时频繁判断/显隐）
    if (dragging) return

    const inCat = isInCat(x, y)
    const inPanel = isInPanel(x, y)

    if (inCat || inPanel) {
      if (!wasInCat) {
        showPanel()
      }

      wasInCat = true
    } else {
      if (wasInCat) {
        hidePanel()
      }

      wasInCat = false
    }
  }

  return {
    onCursorMove,
    setDragging,
  }
}
