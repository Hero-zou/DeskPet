<script setup lang="ts">
import { DeleteOutlined, PlusOutlined } from '@antdv-next/icons'
import {
  Button,
  DatePicker,
  Empty,
  Flex,
  Input,
  InputNumber,
  Segmented,
  Switch,
  TimePicker,
  message,
} from 'antdv-next'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { ref } from 'vue'

dayjs.extend(customParseFormat)

import ProList from '@/components/pro-list/index.vue'
import { useReminderStore, type ReminderKind } from '@/stores/reminder'

const store = useReminderStore()

const newClockLabel = ref('')
const newCountdownKind = ref<ReminderKind>('daily')

const KIND_OPTIONS = [
  { label: '每天', value: 'daily' },
  { label: '指定日期', value: 'date' },
  { label: '每月发薪', value: 'monthly' },
  { label: '下班', value: 'offwork' },
]

const SEASON_OPTIONS = [
  { label: '不分', value: 'none' },
  { label: '夏令/冬令', value: 'summerWinter' },
]

function handleAddClock() {
  store.addClock({ label: newClockLabel.value.trim() || '新提醒' })
  newClockLabel.value = ''
}

function handleAddCountdown() {
  store.addCountdown({ kind: newCountdownKind.value })
}

function kindLabel(kind: ReminderKind) {
  return KIND_OPTIONS.find(o => o.value === kind)?.label ?? kind
}
</script>

<template>
  <Flex vertical :gap="16">
    <!-- ============ 时钟提醒 ============ -->
    <ProList title="时钟提醒">
      <Flex
        class="mb-3"
        :gap="8"
      >
        <Input
          v-model:value="newClockLabel"
          class="flex-1!"
          :maxlength="20"
          placeholder="提醒事件，如 喝水 / 开会"
          @press-enter="handleAddClock"
        />

        <Button
          type="primary"
          @click="handleAddClock"
        >
          <PlusOutlined />
          添加
        </Button>
      </Flex>

      <Empty
        v-if="store.clockReminders.length === 0"
        description="还没有时钟提醒"
      />

      <Flex
        v-for="item in store.clockReminders"
        :key="item.id"
        class="mb-2 items-center gap-2 rounded-lg bg-[--ant-color-fill-quaternary] px-3 py-2"
        wrap
      >
        <Input
          v-model:value="item.label"
          class="w-32!"
          :maxlength="20"
          placeholder="事件"
        />

        <TimePicker
          :value="item.time ? dayjs(item.time, 'HH:mm') : null"
          format="HH:mm"
          placeholder="时间"
          @change="(val: any) => store.updateClock(item.id, { time: val ? dayjs(val).format('HH:mm') : '09:00' })"
        />

        <Flex
          class="ml-auto items-center gap-2"
          :gap="4"
        >
          <Switch
            :checked="item.enabled"
            size="small"
            @change="(checked: any) => store.updateClock(item.id, { enabled: !!checked })"
          />

          <Button
            type="text"
            size="small"
            danger
            @click="store.removeClock(item.id)"
          >
            <DeleteOutlined />
          </Button>
        </Flex>
      </Flex>
    </ProList>

    <!-- ============ 倒计时提醒 ============ -->
    <ProList title="倒计时提醒">
      <Flex
        class="mb-3 items-center gap-2"
        :gap="8"
      >
        <Switch
          :checked="store.panelAlwaysVisible"
          size="small"
          @change="(checked: any) => store.panelAlwaysVisible = !!checked"
        />
        <span class="text-3.5">面板常显</span>
        <span class="text-3 color-text-tertiary">（开启后倒计时面板一直跟随猫咪显示，不再双击触发）</span>
      </Flex>

      <Flex
        class="mb-3"
        :gap="8"
      >
        <Segmented
          v-model:value="newCountdownKind"
          :options="KIND_OPTIONS"
          block
        />

        <Button
          type="primary"
          class="ml-auto"
          @click="handleAddCountdown"
        >
          <PlusOutlined />
          添加
        </Button>
      </Flex>

      <Empty
        v-if="store.countdownReminders.length === 0"
        description="还没有倒计时提醒"
      />

      <Flex
        v-for="item in store.countdownReminders"
        :key="item.id"
        class="mb-2 flex-col gap-2 rounded-lg bg-[--ant-color-fill-quaternary] px-3 py-2"
      >
        <Flex
          class="items-center gap-2"
          wrap
        >
          <Input
            v-model:value="item.label"
            class="w-28!"
            :maxlength="20"
            placeholder="名称"
          />

          <span
            class="rounded bg-[--ant-color-primary-bg] px-2 py-0.5 text-3 text-[--ant-color-primary]"
          >
            {{ kindLabel(item.kind) }}
          </span>

          <Flex
            class="ml-auto items-center gap-2"
            :gap="4"
          >
            <Switch
              :checked="item.enabled"
              size="small"
              @change="(checked: any) => store.updateCountdown(item.id, { enabled: !!checked })"
            />

            <Button
              type="text"
              size="small"
              danger
              @click="store.removeCountdown(item.id)"
            >
              <DeleteOutlined />
            </Button>
          </Flex>
        </Flex>

        <!-- 每天模式：目标时间 + 提前提醒 -->
        <Flex
          v-if="item.kind === 'daily'"
          class="items-center gap-2"
          wrap
        >
          <span class="text-3 color-text-tertiary">每天</span>
          <TimePicker
            :value="item.target ? dayjs(item.target, 'HH:mm') : null"
            format="HH:mm"
            placeholder="目标时间"
            @change="(val: any) => store.updateCountdown(item.id, { target: val ? dayjs(val).format('HH:mm') : '18:30' })"
          />
          <span class="text-3 color-text-tertiary">提前</span>
          <InputNumber
            v-model:value="item.leadMinutes"
            :min="0"
            :max="600"
            class="w-20!"
          />
          <span class="text-3 color-text-tertiary">分钟提醒</span>
        </Flex>

        <!-- 指定日期模式：目标日期 + 间隔 + 每天提醒时间 -->
        <Flex
          v-else-if="item.kind === 'date'"
          class="items-center gap-2"
          wrap
        >
          <span class="text-3 color-text-tertiary">目标日</span>
          <DatePicker
            :value="(item.targetDate ?? item.target) ? dayjs(item.targetDate ?? item.target) : null"
            placeholder="选择日期"
            @change="(val: any) => store.updateCountdown(item.id, { targetDate: val ? dayjs(val).format('YYYY-MM-DD') : '' })"
          />
          <span class="text-3 color-text-tertiary">每隔</span>
          <InputNumber
            v-model:value="item.intervalDays"
            :min="1"
            :max="365"
            class="w-20!"
          />
          <span class="text-3 color-text-tertiary">天提醒</span>
          <TimePicker
            :value="item.remindAt ? dayjs(item.remindAt, 'HH:mm') : null"
            format="HH:mm"
            placeholder="提醒时刻"
            @change="(val: any) => store.updateCountdown(item.id, { remindAt: val ? dayjs(val).format('HH:mm') : '09:00' })"
          />
        </Flex>

        <!-- 每月发薪模式：每月几号 + 间隔 + 每天提醒时间 -->
        <Flex
          v-else-if="item.kind === 'monthly'"
          class="items-center gap-2"
          wrap
        >
          <span class="text-3 color-text-tertiary">每月</span>
          <InputNumber
            v-model:value="item.monthDay"
            :min="1"
            :max="31"
            class="w-20!"
          />
          <span class="text-3 color-text-tertiary">号</span>
          <span class="text-3 color-text-tertiary">每隔</span>
          <InputNumber
            v-model:value="item.monthlyIntervalDays"
            :min="1"
            :max="31"
            class="w-20!"
          />
          <span class="text-3 color-text-tertiary">天提醒</span>
          <TimePicker
            :value="item.monthlyRemindAt ? dayjs(item.monthlyRemindAt, 'HH:mm') : null"
            format="HH:mm"
            placeholder="提醒时刻"
            @change="(val: any) => store.updateCountdown(item.id, { monthlyRemindAt: val ? dayjs(val).format('HH:mm') : '09:00' })"
          />
        </Flex>

        <!-- 下班模式：大小周 + 季节 + 工时 + 提前提醒 -->
        <Flex
          v-else-if="item.kind === 'offwork'"
          class="flex-col gap-2"
        >
          <Flex
            class="items-center gap-2"
            wrap
          >
            <span class="text-3 color-text-tertiary">大小周</span>
            <Switch
              :checked="item.offBigSmallWeek"
              size="small"
              @change="(checked: any) => store.updateCountdown(item.id, { offBigSmallWeek: !!checked })"
            />
            <span class="text-3 color-text-tertiary">（偶数周为大周，周六仅大周上班）</span>
          </Flex>

          <Flex
            class="items-center gap-2"
            wrap
          >
            <span class="text-3 color-text-tertiary">季节</span>
            <Segmented
              v-model:value="item.offSeasonMode"
              :options="SEASON_OPTIONS"
              block
              @change="(val: any) => store.updateCountdown(item.id, { offSeasonMode: val })"
            />
          </Flex>

          <!-- 不分季节：一组工时 -->
          <Flex
            v-if="item.offSeasonMode !== 'summerWinter'"
            class="items-center gap-2"
            wrap
          >
            <span class="text-3 color-text-tertiary">上班</span>
            <TimePicker
              :value="item.offStartStandard ? dayjs(item.offStartStandard, 'HH:mm') : null"
              format="HH:mm"
              placeholder="上班"
              @change="(val: any) => store.updateCountdown(item.id, { offStartStandard: val ? dayjs(val).format('HH:mm') : '09:00' })"
            />
            <span class="text-3 color-text-tertiary">下班</span>
            <TimePicker
              :value="item.offEndStandard ? dayjs(item.offEndStandard, 'HH:mm') : null"
              format="HH:mm"
              placeholder="下班"
              @change="(val: any) => store.updateCountdown(item.id, { offEndStandard: val ? dayjs(val).format('HH:mm') : '18:30' })"
            />
          </Flex>

          <!-- 夏令/冬令：两组工时 -->
          <template v-else>
            <Flex
              class="items-center gap-2"
              wrap
            >
              <span class="text-3 color-text-tertiary">夏令时</span>
              <TimePicker
                :value="item.offStartSummer ? dayjs(item.offStartSummer, 'HH:mm') : null"
                format="HH:mm"
                placeholder="上班"
                @change="(val: any) => store.updateCountdown(item.id, { offStartSummer: val ? dayjs(val).format('HH:mm') : '08:30' })"
              />
              <TimePicker
                :value="item.offEndSummer ? dayjs(item.offEndSummer, 'HH:mm') : null"
                format="HH:mm"
                placeholder="下班"
                @change="(val: any) => store.updateCountdown(item.id, { offEndSummer: val ? dayjs(val).format('HH:mm') : '18:00' })"
              />
            </Flex>
            <Flex
              class="items-center gap-2"
              wrap
            >
              <span class="text-3 color-text-tertiary">冬令时</span>
              <TimePicker
                :value="item.offStartWinter ? dayjs(item.offStartWinter, 'HH:mm') : null"
                format="HH:mm"
                placeholder="上班"
                @change="(val: any) => store.updateCountdown(item.id, { offStartWinter: val ? dayjs(val).format('HH:mm') : '09:00' })"
              />
              <TimePicker
                :value="item.offEndWinter ? dayjs(item.offEndWinter, 'HH:mm') : null"
                format="HH:mm"
                placeholder="下班"
                @change="(val: any) => store.updateCountdown(item.id, { offEndWinter: val ? dayjs(val).format('HH:mm') : '17:30' })"
              />
            </Flex>
          </template>

          <Flex
            class="items-center gap-2"
            wrap
          >
            <span class="text-3 color-text-tertiary">下班提前</span>
            <InputNumber
              v-model:value="item.offLeadMinutes"
              :min="0"
              :max="600"
              class="w-20!"
            />
            <span class="text-3 color-text-tertiary">分钟提醒</span>
          </Flex>

          <!-- 下班到点弹图：上传图片，到下班时间桌面正中弹 N 秒 -->
          <Flex
            class="items-center gap-2"
            wrap
          >
            <span class="text-3 color-text-tertiary">到点弹图</span>
            <label class="relative inline-flex cursor-pointer items-center">
              <input
                type="file"
                accept="image/*"
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                @change="(e: Event) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    const dataUrl = String(reader.result)
                    store.updateCountdown(item.id, { offworkImage: dataUrl })
                    message.success('图片已设置')
                  }
                  reader.onerror = () => message.error('读取图片失败')
                  reader.readAsDataURL(file)
                  ;(e.target as HTMLInputElement).value = ''
                }"
              >
              <span class="rounded bg-black/5 px-2 py-0.5 text-3 text-black/70 hover:bg-black/10">
                {{ item.offworkImage ? '更换图片' : '上传图片' }}
              </span>
            </label>
            <img
              v-if="item.offworkImage"
              :src="item.offworkImage"
              class="size-8 rounded object-contain"
              alt="下班图"
            >
            <Button
              v-if="item.offworkImage"
              size="small"
              type="text"
              danger
              @click="store.updateCountdown(item.id, { offworkImage: undefined })"
            >
              移除
            </Button>
            <span class="text-3 color-text-tertiary">显示</span>
            <InputNumber
              v-model:value="item.offworkDurationSec"
              :min="1"
              :max="60"
              class="w-16!"
              @change="(val: any) => store.updateCountdown(item.id, { offworkDurationSec: val ?? 2 })"
            />
            <span class="text-3 color-text-tertiary">秒</span>
          </Flex>
        </Flex>
      </Flex>
    </ProList>
  </Flex>
</template>
