<script setup lang="ts">
import { DeleteOutlined, HolderOutlined } from '@antdv-next/icons'
import { Button, Flex, Input, Modal, Slider, Switch, message } from 'antdv-next'
import { ref } from 'vue'

import ProList from '@/components/pro-list/index.vue'
import ProListItem from '@/components/pro-list-item/index.vue'
import { refreshStockQuotes } from '@/composables/useStockQuote'
import { useStockStore, type StockItem } from '@/stores/stock'

const stockStore = useStockStore()

const codeInput = ref('')
const draggingIndex = ref<number | null>(null)

// ---------------- 添加 ----------------
function handleAdd() {
  const code = codeInput.value.trim()

  if (!/^\d{6}$/.test(code)) {
    message.warning('请输入正确的6位股票代码')

    return
  }

  if (stockStore.stocks.some(item => item.code === code)) {
    message.warning('该股票已在列表中')

    return
  }

  // 先用代码占位添加，随后拉取实时行情回填名称/价格
  stockStore.addStock(code)

  void refreshStockQuotes().then((quotes) => {
    // 行情接口未返回该代码 => 不存在/退市/代码错误，拒绝入库
    // quotes 为 null 表示网络异常，无法校验，保留占位不误删
    if (quotes !== null && !quotes.some(quote => quote.code === code)) {
      stockStore.removeStock(code)
      message.warning('未找到该股票，请检查代码')
    }
  })

  codeInput.value = ''
}

// ---------------- 删除 ----------------
function handleRemove(item: StockItem) {
  Modal.confirm({
    title: '确定删除该股票吗？',
    content: `${item.code} ${item.name}`,
    okText: '删除',
    cancelText: '取消',
    onOk: () => stockStore.removeStock(item.code),
  })
}

// ---------------- 拖动排序（pointer 方案，WebView2 下比 HTML5 DnD 可靠） ----------------
let dragFromIndex = -1

function handlePointerDown(event: PointerEvent, index: number) {
  // 只允许拖动手柄触发
  const target = event.target as HTMLElement

  if (!target.closest('.drag-handle')) return

  event.preventDefault()

  dragFromIndex = index

  draggingIndex.value = index

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(event: PointerEvent) {
  if (dragFromIndex < 0) return

  // 实时找鼠标当前位置所在的行
  const el = document.elementFromPoint(event.clientX, event.clientY)
  const row = el?.closest('.stock-row') as HTMLElement | null

  if (!row) return

  const targetIndex = Number(row.dataset.index)

  if (targetIndex === dragFromIndex) return

  stockStore.reorder(dragFromIndex, targetIndex)

  dragFromIndex = targetIndex
}

function handlePointerUp() {
  draggingIndex.value = null
  dragFromIndex = -1

  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}
</script>

<template>
  <ProList title="股票列表">
    <ProListItem
      title="面板透明度"
      description="拖动调整外部股票面板的整体透明度，拉到最左可完全隐藏"
      vertical
    >
      <Slider
        v-model:value="stockStore.panelOpacity"
        class="m-0!"
        :min="0"
        :max="100"
        :tooltip="{
          formatter(value) {
            return `${value}%`
          },
        }"
      />
    </ProListItem>

    <ProListItem
      title="显示股票代码"
      description="在悬停面板中显示每只股票的代码"
    >
      <Switch
        :checked="stockStore.showCode"
        @change="stockStore.toggleShowCode()"
      />
    </ProListItem>

    <Flex
      class="mb-3"
      :gap="8"
    >
      <Input
        v-model:value="codeInput"
        class="flex-1!"
        :maxlength="6"
        placeholder="输入6位股票代码"
        @press-enter="handleAdd"
      />

      <Button
        type="primary"
        @click="handleAdd"
      >
        添加
      </Button>
    </Flex>

    <template v-if="stockStore.stocks.length === 0">
      <ProListItem title="暂无股票，点击上方添加" />
    </template>

    <template v-else>
      <div
        v-for="(item, index) in stockStore.sortedStocks"
        :key="item.code"
        class="stock-row flex items-center gap-2 rounded-lg bg-[--ant-color-fill-quaternary] px-3 py-2 transition hover:bg-[--ant-color-fill-tertiary]"
        :class="{ 'opacity-60 ring-2 ring-blue-500/40': draggingIndex === index }"
        :data-index="index"
      >
        <HolderOutlined
          class="drag-handle cursor-grab color-text-tertiary active:cursor-grabbing"
          @pointerdown="handlePointerDown($event, index)"
        />

        <div class="w-16 shrink-0 font-mono text-3.5">
          {{ item.code }}
        </div>

        <div class="min-w-20 flex-1 text-3.5">
          {{ item.name }}
        </div>

        <div class="w-24 shrink-0 text-right font-mono text-3.5">
          {{ item.price > 0 ? `¥${item.price.toFixed(2)}` : '--' }}
        </div>

        <div
          class="w-16 shrink-0 text-right font-mono text-3.5"
          :class="item.changePct >= 0 ? 'text-[#f5222d]' : 'text-[#52c41a]'"
        >
          {{ item.changePct >= 0 ? '+' : '' }}{{ item.changePct.toFixed(2) }}%
        </div>

        <Switch
          :checked="item.visible"
          size="small"
          @change="stockStore.toggleVisible(item.code)"
        />

        <Button
          type="text"
          size="small"
          danger
          @click="handleRemove(item)"
        >
          <DeleteOutlined />
        </Button>
      </div>
    </template>
  </ProList>
</template>
