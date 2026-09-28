<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Flex, Spin } from 'antdv-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UpdateApp from '@/components/update-app/index.vue'
import { useTray } from '@/composables/useTray'
import { useAppStore } from '@/stores/app'
import { useGeneralStore } from '@/stores/general'
import { useModelStore } from '@/stores/model'
import { isMac } from '@/utils/platform'

import About from './components/about/index.vue'
import Cat from './components/cat/index.vue'
import General from './components/general/index.vue'
import Model from './components/model/index.vue'
import Reminder from './components/reminder/index.vue'
import Shortcut from './components/shortcut/index.vue'
import Stock from './components/stock/index.vue'

import { LISTEN_KEY } from '@/constants'
import { useTauriListen } from '@/composables/useTauriListen'

useTray()
const appStore = useAppStore()
const current = ref(0)
const { t } = useI18n()
const generalStore = useGeneralStore()
const modelStore = useModelStore()
const appWindow = getCurrentWebviewWindow()

watch(() => generalStore.appearance.language, () => {
  appWindow.setTitle(t('pages.preference.title'))
}, { immediate: true })

const menus = computed(() => [
  {
    key: 'cat',
    label: t('pages.preference.cat.title'),
    icon: 'i-solar:cat-bold',
    component: Cat,
  },
  {
    key: 'stock',
    label: '股票',
    icon: 'i-solar:chart-bold',
    component: Stock,
  },
  {
    key: 'reminder',
    label: '提醒',
    icon: 'i-solar:alarm-bold',
    component: Reminder,
  },
  {
    key: 'general',
    label: t('pages.preference.general.title'),
    icon: 'i-solar:settings-minimalistic-bold',
    component: General,
  },
  {
    key: 'model',
    label: t('pages.preference.model.title'),
    icon: 'i-solar:magic-stick-3-bold',
    component: Model,
  },
  {
    key: 'shortcut',
    label: t('pages.preference.shortcut.title'),
    icon: 'i-solar:keyboard-bold',
    component: Shortcut,
  },
  {
    key: 'about',
    label: t('pages.preference.about.title'),
    icon: 'i-solar:info-circle-bold',
    component: About,
  },
])

const topKeys = ['cat', 'stock', 'reminder']
const bottomKeys = ['general', 'model', 'shortcut', 'about']

const topMenus = computed(() => menus.value.filter(item => topKeys.includes(item.key)))
const bottomMenus = computed(() => menus.value.filter(item => bottomKeys.includes(item.key)))

const selectByKey = (key: string) => {
  const index = menus.value.findIndex(item => item.key === key)
  if (index !== -1) current.value = index
}

useTauriListen<undefined>(LISTEN_KEY.SHOW_STOCK_SETTINGS, () => {
  current.value = menus.value.findIndex(item => item.key === 'stock')
})
</script>

<template>
  <Spin
    class="max-h-unset!"
    :description="t('pages.main.hints.switching')"
    fullscreen
    size="large"
    :spinning="!modelStore.modelReady"
  />

  <Flex class="h-screen">
    <div
      class="h-full w-30 flex flex-col items-center gap-4 overflow-auto bg-gradient-from-blue-1 bg-gradient-to-black/1 bg-gradient-linear dark:bg-none"
      :class="[isMac ? 'pt-8' : 'pt-4']"
      data-tauri-drag-region
    >
      <div class="flex flex-col items-center gap-2">
        <div class="b-1 b-solid b-border-sec rounded-2xl">
          <img
            class="size-15"
            data-tauri-drag-region
            src="/logo.png"
          >
        </div>

        <span class="font-bold">{{ appStore.name }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="item in topMenus"
          :key="item.key"
          class="size-20 flex flex-col cursor-pointer items-center justify-center gap-2 transition color-text-tertiary rounded-lg hover:bg-[--ant-color-fill-tertiary] dark:color-text-secondary"
          :class="{ 'bg-container! color-blue-5! dark:color-blue-7! font-bold dark:bg-[--ant-color-fill-quaternary]!': current === menus.findIndex(m => m.key === item.key) }"
          @click="selectByKey(item.key)"
        >
          <div
            class="size-8"
            :class="item.icon"
          />

          <span>{{ item.label }}</span>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="item in bottomMenus"
          :key="item.key"
          class="size-20 flex flex-col cursor-pointer items-center justify-center gap-2 transition color-text-tertiary rounded-lg hover:bg-[--ant-color-fill-tertiary] dark:color-text-secondary"
          :class="{ 'bg-container! color-blue-5! dark:color-blue-7! font-bold dark:bg-[--ant-color-fill-quaternary]!': current === menus.findIndex(m => m.key === item.key) }"
          @click="selectByKey(item.key)"
        >
          <div
            class="size-8"
            :class="item.icon"
          />

          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>

    <div
      v-for="(item, index) in menus"
      v-show="current === index"
      :key="item.key"
      class="flex-1 overflow-x-hidden overflow-y-auto bg-[--ant-color-fill-quaternary] p-4 dark:bg-container"
      data-tauri-drag-region
    >
      <component :is="item.component" />
    </div>
  </Flex>

  <UpdateApp />
</template>
