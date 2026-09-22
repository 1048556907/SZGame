/**
 * SZGame — Electron Main Process
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, protocol } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

import { initDatabase, getSetting, setSetting, getAllSettings,
  listGroups, createGroup, renameGroup, deleteGroup, reorderGroups, updateGroup,
  listGames, createGame, updateGame, deleteGame, reorderGames, getGame,
  type GameCreateInput } from './db'
import { launch } from './launcher'
import { initCoverManager, saveFromPath } from './cover-manager'

// ============================================================
// State
// ============================================================
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

let minimizeBehavior: 'taskbar' | 'tray' = 'tray'
let closeBehavior: 'exit' | 'minimize-to-tray' = 'minimize-to-tray'

// ============================================================
// Dev detection
// ============================================================
const isDev = !app.isPackaged
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

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

  // —— maximize 状态广播 ——
  const broadcastMax = () => {
    win.webContents.send('win:maximized', win.isMaximized())
  }
  win.on('maximize',   broadcastMax)
  win.on('unmaximize', broadcastMax)
  win.on('minimize',   () => win.webContents.send('win:maximized', false))
  win.on('restore',    broadcastMax)

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

ipcMain.handle('db:settings:get', (_e, key: string) => getSetting(key))
ipcMain.handle('db:settings:getAll', () => getAllSettings())
ipcMain.handle('db:settings:set', (_e, key: string, value: string) => {
  setSetting(key, value)
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
  if (row?.cover_image) initCoverManager(app.getPath('userData')) // 确保已初始化
  return { ok: true }
})
ipcMain.handle('db:games:reorder', (_e, groupId: number | null, items: { id: number; sort_order: number }[]) => {
  reorderGames(groupId, items); return { ok: true }
})

// —— Launcher ——
ipcMain.handle('launcher:launch', (_e, gameId: number) => {
  const g = getGame(gameId)
  if (!g) return { success: false, message: '游戏不存在' }
  const result = launch(g.launch_type, g.launch_path, g.launch_args ?? undefined)
  if (result.success && g.launch_type === 'exe') {
    // 启动 EXE 成功后，将 SZGame 窗口最小化到任务栏
    mainWindow?.minimize()
  }
  return result
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
  const userDataDir = app.getPath('userData')
  initCoverManager(userDataDir)
  return saveFromPath(sourcePath)
})
ipcMain.handle('groupIcon:saveFromPath', (_e, sourcePath: string) => {
  const userDataDir = app.getPath('userData')
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
  const userDataDir = app.getPath('userData')
  const coversDir = path.join(userDataDir, 'covers')

  // 初始化 DB
  await initDatabase(userDataDir)
  initCoverManager(userDataDir)

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { app.isQuiting = true })
