import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { env } from 'node:process'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'
import vitePluginDayjs from 'vite-plugin-dayjs'

const host = env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [vue(), UnoCSS(), vitePluginDayjs()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    // 必须显式绑 IPv4：`host: false` 会让 Node 把 localhost 解析成 ::1（纯 IPv6），
    // 导致 127.0.0.1:1420 连接被拒；而 WebView2 的沙箱网络进程解析 localhost 走 IPv4，
    // 结果页面永远加载不出来（无 msedgewebview2 渲染进程，窗口全透明 = 看起来"没打开"）。
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
