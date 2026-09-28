import type { RouteRecordRaw } from 'vue-router'

import { createRouter, createWebHashHistory } from 'vue-router'

import Main from '../pages/main/index.vue'
import Preference from '../pages/preference/index.vue'
import Reminder from '../pages/reminder/index.vue'
import StockPanel from '../pages/stock-panel/index.vue'

const routes: Readonly<RouteRecordRaw[]> = [
  {
    path: '/',
    component: Main,
  },
  {
    path: '/preference',
    component: Preference,
  },
  {
    path: '/stock-panel',
    component: StockPanel,
  },
  {
    path: '/reminder',
    component: Reminder,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
