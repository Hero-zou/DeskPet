import { execSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { env, platform } from 'node:process'

(() => {
  const isMac = env.PLATFORM?.startsWith('macos') ?? platform === 'darwin'

  const logoName = isMac ? 'logo-mac' : 'logo'

  const logoPath = `src-tauri/assets/${logoName}.png`
  const sentinel = 'src-tauri/icons/icon.png'

  // 图标已存在且不比源 logo 旧时直接跳过。
  // 原因：`tauri icon` 每次都会重写 19+ 个图标文件，在装有实时防护的机器上
  // 极易被瞬时占用（os error 5 / 拒绝访问），一旦失败就会让整条 `pnpm dev` 断掉、
  // 导致 `tauri dev` 起不来。图标平常不会变，没必要每次 dev 都重写。
  if (existsSync(sentinel) && existsSync(logoPath)) {
    if (statSync(sentinel).mtimeMs >= statSync(logoPath).mtimeMs) {
      console.log('[build:icon] icons are up to date, skip')

      return
    }
  }

  const command = `tauri icon ${logoPath}`

  try {
    execSync(command, { stdio: 'inherit' })
  }
  catch (error) {
    // 被安全软件锁住导致的失败不应阻断开发启动
    console.warn(`[build:icon] skipped: ${(error as Error).message}`)
  }
})()
