import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface StockItem {
  code: string
  name: string
  price: number
  changePct: number
  visible: boolean
  order: number
}

export const useStockStore = defineStore('stock', () => {
  const stocks = ref<StockItem[]>([])

  // 外部股票面板的整体透明度（0–100，0 = 完全隐藏，100 = 不透明）
  const panelOpacity = ref(100)

  const setPanelOpacity = (value: number) => {
    panelOpacity.value = Math.min(100, Math.max(0, Math.round(value)))
  }

  // 悬停面板是否显示股票代码
  const showCode = ref(true)

  const toggleShowCode = () => {
    showCode.value = !showCode.value
  }

  const sortedStocks = computed(() => {
    return [...stocks.value].sort((a, b) => a.order - b.order)
  })

  const visibleStocks = computed(() => {
    return sortedStocks.value.filter(item => item.visible)
  })

  const addStock = (code: string, name = code, price = 0, changePct = 0) => {
    const normalized = code.trim().toUpperCase()

    if (!/^\d{6}$/.test(normalized)) return false

    if (stocks.value.some(item => item.code === normalized)) return false

    stocks.value.push({
      code: normalized,
      name,
      price,
      changePct,
      visible: true,
      order: stocks.value.length,
    })

    return true
  }

  const removeStock = (code: string) => {
    const index = stocks.value.findIndex(item => item.code === code)

    if (index === -1) return

    stocks.value.splice(index, 1)

    // 重新整理排序权重
    stocks.value.forEach((item, i) => {
      item.order = i
    })
  }

  const toggleVisible = (code: string) => {
    const item = stocks.value.find(stock => stock.code === code)

    if (!item) return

    item.visible = !item.visible
  }

  const reorder = (from: number, to: number) => {
    if (from === to) return

    const list = [...stocks.value]

    const [moved] = list.splice(from, 1)

    list.splice(to, 0, moved)

    list.forEach((item, i) => {
      item.order = i
    })
  }

  const updateQuote = (code: string, price: number, changePct: number) => {
    const item = stocks.value.find(stock => stock.code === code)

    if (!item) return

    item.price = price
    item.changePct = changePct
  }

  return {
    stocks,
    sortedStocks,
    visibleStocks,
    panelOpacity,
    setPanelOpacity,
    showCode,
    toggleShowCode,
    addStock,
    removeStock,
    toggleVisible,
    reorder,
    updateQuote,
  }
})
