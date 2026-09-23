/**
 * SZGame — Electron Main Process
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, protocol, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// —— 必须在 app.whenReady 之前注册，否则 protocol.handle 的自定义协议无法被 <img src> / fetch 加载 ——
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'szgame',
    privileges: {
      standard: true,       // 让 szgame:// 像 http:// 一样解析
      secure: true,         // 标记为安全协议，允许加载敏感资源
      supportFetchAPI: true,// 支持 fetch() API
      bypassCSP: true,      // 绕过 Content-Security-Policy（否则 <img src="szgame://..."> 会被 CSP 拒）
      corsEnabled: false,
      stream: true          // 允许 stream Response
    }
  }
])

import { initDatabase, getSetting, setSetting, getAllSettings,
  listGroups, createGroup, renameGroup, deleteGroup, reorderGroups, updateGroup,
  listGames, createGame, updateGame, deleteGame, reorderGames, getGame,
  type GameCreateInput } from './db'
import { launch } from './launcher'
import { initCoverManager, saveFromPath } from './cover-manager'
import { initRemoteCover, searchCovers, downloadCover, downloadAsBase64 } from './remote-cover'

// ============================================================
// State
// ============================================================
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let DATA_DIR = ""    // resolveUserDataDir() 启动时缓存

let minimizeBehavior: 'taskbar' | 'tray' = 'tray'
let closeBehavior: 'exit' | 'minimize-to-tray' = 'minimize-to-tray'

// ============================================================
// Dev detection
// ============================================================
const isDev = !app.isPackaged
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL


// ── 数据目录解析：便携模式优先（EXE 同级 ./data/），不可写则 fallback 到 APPDATA
//  dev 模式直接用 APPDATA（process.execPath=node_modules/electron/dist/Electron.exe，没意义）
//  同时处理 legacy DB 搬移：
//    来源 1 (优先)：{exe}/szgame.db —— 旧版 DATA_DIR="" 遗留（如 D:\game\SZGame\szgame.db）
//    来源 2 (兜底)：%APPDATA%/SZGame/szgame.db —— 62a98ab 之前的版本
function resolveUserDataDir(): string {
  // dev 模式：直接用 Electron 默认 userData
  if (!app.isPackaged) {
    const devDir = app.getPath('userData')
    console.info('[app] dev mode, using userData:', devDir)
    return devDir
  }

  const exeDir = path.dirname(process.execPath)
  const portableDir = path.join(exeDir, 'data')
  const portableDB = path.join(portableDir, 'szgame.db')

  // legacy DB 来源（按优先级）：{exe}/szgame.db > APPDATA/szgame.db
  const legacySources = [
    path.join(exeDir, 'szgame.db'),
    path.join(app.getPath('userData'), 'szgame.db'),
  ]

  try {
    fs.mkdirSync(portableDir, { recursive: true })
    fs.writeFileSync(path.join(portableDir, '.write_test'), 'ok')
    fs.unlinkSync(path.join(portableDir, '.write_test'))

    // 便携目录可写 —— 遍历 legacy 来源，找到第一个存在的 → 搬过去
    if (!fs.existsSync(portableDB)) {
      for (const legacyDB of legacySources) {
        if (legacyDB !== portableDB && fs.existsSync(legacyDB)) {
          fs.copyFileSync(legacyDB, portableDB)
          console.info('[app] migrated legacy DB:', legacyDB, '→', portableDB)
          break
        }
      }
    }
    console.info('[app] using portable data dir:', portableDir)
    return portableDir
  } catch {
    const fallback = app.getPath('userData')
    console.warn('[app] portable dir not writable, fallback to:', fallback)
    return fallback
  }
}

// ============================================================
// Window
// ============================================================
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    resizable: false,
    minimizable: true,
    maximizable: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    roundedCorners: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev && VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())

  win.on('minimize' as any, (e: Electron.Event) => {
    if (minimizeBehavior === 'tray') {
      e.preventDefault()
      win.hide()
      ensureTray()
    }
  })

  win.on('close' as any, (e: Electron.Event) => {
    if (!app.isQuiting && closeBehavior === 'minimize-to-tray') {
      e.preventDefault()
      win.hide()
      ensureTray()
    }
  })

  win.on('closed', () => { mainWindow = null })

  // —— maximize 状态广播 + restore 冻结 workaround ——
  const broadcastMax = () => {
    win.webContents.send('win:maximized', win.isMaximized())
  }
  win.on('maximize',   broadcastMax)
  win.on('unmaximize', broadcastMax)
  win.on('minimize',   () => win.webContents.send('win:maximized', false))
  win.on('restore',    () => {
    // —— workaround: transparent+frameless minimize→restore 后窗口尺寸变化 + WebContents 冻结 ——
    // Chromium 已知 bug：透明无边框窗口从 minimized 恢复后，Windows 会把 bounds 重置为系统默认
    // 必须在 restore 后强制写回固定尺寸，否则窗口会变大/变小
    win.setBounds({ width: 1200, height: 780 }, false)
    win.show()
    win.focus()
    win.webContents.focus()
    setTimeout(() => {
      win.webContents.setFrameRate(60)
      win.webContents.executeJavaScript(
        'document.body.style.display="none"; requestAnimationFrame(()=>document.body.style.display="")'
      ).catch(() => {})
    }, 80)
    broadcastMax()
  })

  return win
}

// ============================================================
// Tray
// ============================================================
function ensureTray(): Tray | null {
  if (tray) return tray
  const iconPath = path.join(__dirname, '../images/logo.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) { console.warn('[tray] icon not found'); return null }

  tray = new Tray(icon)
  tray.setToolTip('SZGame')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuiting = true; app.quit() } }
  ]))
  tray.on('click', () => showMainWindow())
  return tray
}

function showMainWindow() {
  if (!mainWindow) return
  mainWindow.show(); mainWindow.focus()
  if (mainWindow.isMinimized()) mainWindow.restore()
}

// ============================================================
// IPC Handlers
// ============================================================

// —— 窗口 & 设置 ——
ipcMain.handle('window:getVersion', () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf-8'))
    return pkg.version
  } catch { return 'unknown' }
})

// —— 安全存储敏感设置（safeStorage 加密）——
const SENSITIVE_KEYS = new Set(['rawg.api.key'])
function isSensitiveKey(k: string): boolean { return SENSITIVE_KEYS.has(k) }

function encryptValueIfNeeded(k: string, v: string): string {
  if (!isSensitiveKey(k)) return v
  if (!v) return v
  if (v.startsWith('enc:')) return v // 已加密
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(v)
      return 'enc:' + buf.toString('base64')
    }
  } catch { /* 降级：明文存储 */ }
  return v
}

function decryptValueIfNeeded(k: string, v: string | null): string | null {
  if (!isSensitiveKey(k) || !v) return v
  if (!v.startsWith('enc:')) return v
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const raw = safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'))
      return raw
    }
  } catch { /* 解密失败返回原值 */ }
  return v
}

ipcMain.handle('db:settings:get', (_e, key: string) => {
  const v = getSetting(key)
  return decryptValueIfNeeded(key, v)
})
ipcMain.handle('db:settings:getAll', () => {
  const all = getAllSettings()
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(all)) {
    const d = decryptValueIfNeeded(k, v)
    if (d !== null) result[k] = d
  }
  return result
})
ipcMain.handle('db:settings:set', (_e, key: string, value: string) => {
  const toStore = encryptValueIfNeeded(key, value)
  setSetting(key, toStore)
  // 实时生效
  if (key === 'window.minimize.behavior') minimizeBehavior = value as any
  if (key === 'window.close.behavior') closeBehavior = value as any
  return { ok: true }
})

// —— Groups ——
ipcMain.handle('db:groups:list', () => listGroups())
ipcMain.handle('db:groups:create', (_e, name: string, iconImage: string | null = null) => {
  try { return { ok: true, id: createGroup(name, iconImage) } }
  catch (e: any) { return { ok: false, error: e.message } }
})
ipcMain.handle('db:groups:update', (_e, id: number, name: string, iconImage: string | null) => {
  try { updateGroup(id, name, iconImage); return { ok: true } }
  catch (e: any) { return { ok: false, error: e.message } }
})
ipcMain.handle('db:groups:rename', (_e, id: number, name: string) => {
  renameGroup(id, name); return { ok: true }
})
ipcMain.handle('db:groups:delete', (_e, id: number) => {
  deleteGroup(id); return { ok: true }
})
ipcMain.handle('db:groups:reorder', (_e, items: { id: number; sort_order: number }[]) => {
  reorderGroups(items); return { ok: true }
})

// —— Games ——
ipcMain.handle('db:games:list', (_e, opts?: { groupId?: number | null; search?: string }) => listGames(opts))
ipcMain.handle('db:games:create', (_e, input: GameCreateInput) => {
  try { return { ok: true, id: createGame(input) } }
  catch (e: any) { return { ok: false, error: e.message } }
})
ipcMain.handle('db:games:update', (_e, id: number, input: Partial<GameCreateInput>) => {
  updateGame(id, input); return { ok: true }
})
ipcMain.handle('db:games:delete', (_e, id: number) => {
  const row = deleteGame(id)
  if (row?.cover_image) initCoverManager(DATA_DIR) // 确保已初始化
  return { ok: true }
})
ipcMain.handle('db:games:reorder', (_e, groupId: number | null, items: { id: number; sort_order: number }[]) => {
  reorderGames(groupId, items); return { ok: true }
})

// —— Launcher ——
ipcMain.handle('launcher:launch', (_e, gameId: number) => {
  const g = getGame(gameId)
  if (!g) return { success: false, message: '游戏不存在' }
  // 防御性 needs_admin：兼容 DB INTEGER 1/0、前端传入 true/false、迁移前 undefined
  const needsAdmin = Boolean(g.needs_admin)
  const result = launch(g.launch_type, g.launch_path, g.launch_args ?? undefined, needsAdmin)
  if (result.success && g.launch_type === 'exe') {
    // 启动 EXE 成功后，将 SZGame 窗口最小化到任务栏
    mainWindow?.minimize()
  }
  return result
})

// —— 远程封面（Steam）——
ipcMain.handle('cover:searchRemote', async (_e, keyword: string) => {
  return searchCovers(keyword)
})
ipcMain.handle('cover:downloadRemote', async (_e, imageUrl: string) => {
  return downloadCover(imageUrl)
})
// 远程封面 → 直接转 base64 data URI（用于 cover_image 字段存储）
ipcMain.handle('cover:downloadAsBase64', async (_e, imageUrl: string) => {
  return downloadAsBase64(imageUrl)
})
// 本地图片文件 → 转 base64 data URI
ipcMain.handle('cover:fileToBase64', (_e, sourcePath: string) => {
  try {
    const buf = fs.readFileSync(sourcePath)
    const ext = path.extname(sourcePath).toLowerCase().replace('.', '')
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
    return { ok: true, dataUri: `data:${mime};base64,${buf.toString('base64')}`, size: buf.length }
  } catch (err: any) {
    return { ok: false, error: err?.message || '文件读取失败' }
  }
})

// —— Dialogs & Cover ——
ipcMain.handle('dialog:selectFile', async (_e, filters?: { name: string; extensions: string[] }[]) => {
  if (!mainWindow) return { canceled: true, filePaths: [] }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || []
  })
  return result
})

ipcMain.handle('cover:saveFromPath', (_e, sourcePath: string) => {
  const userDataDir = DATA_DIR
  initCoverManager(userDataDir)
  return saveFromPath(sourcePath)
})
ipcMain.handle('groupIcon:saveFromPath', (_e, sourcePath: string) => {
  const userDataDir = DATA_DIR
  initCoverManager(userDataDir)
  return saveFromPath(sourcePath, 'group-icons')
})

// —— App control ——
ipcMain.handle('app:hideToTray', () => {
  mainWindow?.hide()
  ensureTray()
})
ipcMain.handle('app:quit', () => { app.isQuiting = true; app.quit() })

// —— Window control (for frameless titlebar) ——
ipcMain.handle('win:minimize', () => {
  mainWindow?.minimize()
})
ipcMain.handle('win:toggle-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.handle('win:close', () => {
  mainWindow?.close()
})
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false)

// ============================================================
// Single Instance Lock
// ============================================================
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  // 已有实例在运行，直接退出（second-instance 会被原实例触发 show）
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  // 用户又双击了 exe / 运行了快捷方式 → 呼起已存在的主窗口
  showMainWindow()
})

// ============================================================
// Lifecycle
// ============================================================
app.whenReady().then(async () => {
  // ↓↓↓ 这一行 commit 62a98ab 漏了，导致 DATA_DIR 永远是空串 ↓↓↓
  DATA_DIR = resolveUserDataDir()
  const userDataDir = DATA_DIR
  const coversDir = path.join(userDataDir, 'covers')

  // 初始化 DB
  await initDatabase(userDataDir)
  initCoverManager(userDataDir)
  initRemoteCover(userDataDir)

  // 启动时清理旧 exe 遗留的 UTF-8 损坏封面
  purgeCorruptedCovers(userDataDir)

  // 注册自定义协议 szgame://<relativePath>  →  userDataDir/covers/<relativePath>
  protocol.handle('szgame', (request) => {
    try {
      const url = new URL(request.url)
      // szgame://covers/xxx.jpg → covers/xxx.jpg
      const relative = url.hostname + url.pathname
      const absolute = path.join(userDataDir, relative)
      if (fs.existsSync(absolute)) {
        return new Response(fs.readFileSync(absolute), {
          headers: { 'Content-Type': mimeByExt(path.extname(absolute)) }
        })
      }
      return new Response('Not Found', { status: 404 })
    } catch {
      return new Response('Internal Error', { status: 500 })
    }
  })

  // 从 DB 加载设置
  const mb = getSetting('window.minimize.behavior')
  const cb = getSetting('window.close.behavior')
  if (mb) minimizeBehavior = mb as any
  if (cb) closeBehavior = cb as any

  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    else showMainWindow()
  })
})

/** 根据扩展名推断 Content-Type */
function mimeByExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png':  return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif':  return 'image/gif'
    case '.bmp':  return 'image/bmp'
    default:      return 'application/octet-stream'
  }
}

/** 校验文件是否为合法图片（magic bytes） */
function isLikelyImage(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(16)
    fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)
    // JPEG: FF D8 FF ..
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
    // WebP: RIFF .... WEBP
    if (buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP') return true
    // GIF: 47 49 46 38
    if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return true
    return false
  } catch {
    return false
  }
}

/** 启动时自动清理 covers/ + group-icons/ 目录下被 UTF-8 损坏的图片文件 */
function purgeCorruptedCovers(userDataDir: string): void {
  const dirs = ['covers', 'group-icons']
  for (const dir of dirs) {
    const fullDir = path.join(userDataDir, dir)
    if (!fs.existsSync(fullDir)) continue
    const files = fs.readdirSync(fullDir)
    for (const f of files) {
      const ext = path.extname(f).toLowerCase()
      if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) continue
      const filePath = path.join(fullDir, f)
      if (!isLikelyImage(filePath)) {
        try {
          fs.unlinkSync(filePath)
          console.warn(`[purge] deleted corrupted image: ${dir}/${f}`)
        } catch { /* ignore */ }
      }
    }
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { app.isQuiting = true })
