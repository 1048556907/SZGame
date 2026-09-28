/**
 * Preload — 暴露安全的 IPC API 给 Renderer
 */
import { contextBridge, ipcRenderer } from 'electron'

export interface SZGameAPI {
  // window
  getVersion: () => Promise<string>

  // settings
  settingsGet: (key: string) => Promise<string | null>
  settingsGetAll: () => Promise<Record<string, string>>
  settingsSet: (key: string, value: string) => Promise<{ ok: boolean }>

  // groups
  groupsList: () => Promise<any[]>
  groupsCreate: (name: string, iconImage?: string | null) => Promise<{ ok: boolean; id?: number; error?: string }>
  groupsUpdate: (id: number, name: string, iconImage: string | null) => Promise<{ ok: boolean; error?: string }>
  groupsRename: (id: number, name: string) => Promise<{ ok: boolean }>
  groupsDelete: (id: number) => Promise<{ ok: boolean }>
  groupsReorder: (items: { id: number; sort_order: number }[]) => Promise<{ ok: boolean }>

  // games
  gamesList: (opts?: { groupId?: number | null; search?: string; sortBy?: 'per-group' | 'global' }) => Promise<any[]>
  gamesCreate: (input: any) => Promise<{ ok: boolean; id?: number; error?: string }>
  gamesUpdate: (id: number, input: any) => Promise<{ ok: boolean }>
  gamesDelete: (id: number) => Promise<{ ok: boolean }>
  gamesReorder: (mode: 'per-group' | 'global', items: { id: number; order: number }[]) => Promise<{ ok: boolean }>

  // launcher
  launch: (gameId: number) => Promise<{ success: boolean; message?: string }>

  // dialogs
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{
    canceled: boolean
    filePaths: string[]
  }>
  coverSaveFromPath: (sourcePath: string) => Promise<{ relativePath: string }>
  groupIconSaveFromPath: (sourcePath: string) => Promise<{ relativePath: string }>

  // remote cover (Steam) — 无 Key，中文友好，支持 fallback 链
  remoteCoverSearch: (keyword: string) => Promise<{
    ok: boolean
    total?: number
    candidates?: {
      appid: number; name: string; imageUrl: string; thumbUrl: string;
      score: number | null; priceCny: number | null;
      platforms: { windows: boolean; mac: boolean; linux: boolean }
    }[]
    error?: string
  }>
  remoteCoverDownload: (imageUrl: string) => Promise<{ ok: boolean; relativePath?: string; error?: string }>
  remoteCoverDownloadAsBase64: (imageUrl: string) => Promise<{ ok: boolean; dataUri?: string; size?: number; error?: string }>
  fileToBase64: (sourcePath: string) => Promise<{ ok: boolean; dataUri?: string; size?: number; error?: string }>

  // app control
  hideToTray: () => Promise<void>
  quit: () => Promise<void>

  // window control (frameless titlebar)
  winMinimize:       () => Promise<void>
  winToggleMaximize: () => Promise<void>
  winClose:          () => Promise<void>
  winIsMaximized:    () => Promise<boolean>
  onMaximizeChange:  (cb: (maximized: boolean) => void) => () => void

  // updater
  updaterCheck: () => Promise<{ hasUpdate: boolean; remoteTag?: string; localVersion: string; exeUrl?: string }>
  updaterInstall: (remoteTag: string, exeUrl: string) => Promise<void>
  onUpdateAvailable:  (cb: (info: { remoteTag: string }) => void) => () => void
  onUpdateProgress:   (cb: (info: { bytes: number; total: number }) => void) => () => void
  onUpdateInstalled:  (cb: (info: { exePath?: string }) => void) => () => void
  onUpdateInstallFailed: (cb: (info: { error: string }) => void) => () => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:        () => ipcRenderer.invoke('window:getVersion'),

  settingsGet:       (k) => ipcRenderer.invoke('db:settings:get', k),
  settingsGetAll:    () => ipcRenderer.invoke('db:settings:getAll'),
  settingsSet:       (k, v) => ipcRenderer.invoke('db:settings:set', k, v),

  groupsList:        () => ipcRenderer.invoke('db:groups:list'),
  groupsCreate:      (n, ic) => ipcRenderer.invoke('db:groups:create', n, ic),
  groupsUpdate:      (i, n, ic) => ipcRenderer.invoke('db:groups:update', i, n, ic),
  groupsRename:      (i, n) => ipcRenderer.invoke('db:groups:rename', i, n),
  groupsDelete:      (i) => ipcRenderer.invoke('db:groups:delete', i),
  groupsReorder:     (it) => ipcRenderer.invoke('db:groups:reorder', it),

  gamesList:         (o) => ipcRenderer.invoke('db:games:list', o),
  gamesCreate:       (i) => ipcRenderer.invoke('db:games:create', i),
  gamesUpdate:       (i, p) => ipcRenderer.invoke('db:games:update', i, p),
  gamesDelete:       (i) => ipcRenderer.invoke('db:games:delete', i),
  gamesReorder:      (m, it) => ipcRenderer.invoke('db:games:reorder', m, it),

  launch:            (id) => ipcRenderer.invoke('launcher:launch', id),

  selectFile:        (f) => ipcRenderer.invoke('dialog:selectFile', f),
  coverSaveFromPath:      (p) => ipcRenderer.invoke('cover:saveFromPath', p),
  groupIconSaveFromPath:  (p) => ipcRenderer.invoke('groupIcon:saveFromPath', p),

  remoteCoverSearch:              (kw) => ipcRenderer.invoke('cover:searchRemote', kw),
  remoteCoverDownload:            (url) => ipcRenderer.invoke('cover:downloadRemote', url),
  remoteCoverDownloadAsBase64:    (url) => ipcRenderer.invoke('cover:downloadAsBase64', url),
  fileToBase64:                   (p)  => ipcRenderer.invoke('cover:fileToBase64', p),

  hideToTray:        () => ipcRenderer.invoke('app:hideToTray'),
  quit:              () => ipcRenderer.invoke('app:quit'),

  // window control — frameless titlebar
  winMinimize:       () => ipcRenderer.invoke('win:minimize'),
  winToggleMaximize: () => ipcRenderer.invoke('win:toggle-maximize'),
  winClose:          () => ipcRenderer.invoke('win:close'),
  winIsMaximized:    () => ipcRenderer.invoke('win:is-maximized'),
  onMaximizeChange: (cb) => {
    const handler = (_e: unknown, v: boolean) => cb(v)
    ipcRenderer.on('win:maximized', handler)
    return () => ipcRenderer.removeListener('win:maximized', handler)
  },

  // updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterInstall: (tag, url) => ipcRenderer.invoke('updater:install', tag, url),
  onUpdateAvailable: (cb) => {
    const handler = (_e: unknown, info: any) => cb(info)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },
  onUpdateProgress: (cb) => {
    const handler = (_e: unknown, info: any) => cb(info)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },
  onUpdateInstalled: (cb) => {
    const handler = (_e: unknown, info: any) => cb(info)
    ipcRenderer.on('update:installed', handler)
    return () => ipcRenderer.removeListener('update:installed', handler)
  },
  onUpdateInstallFailed: (cb) => {
    const handler = (_e: unknown, info: any) => cb(info)
    ipcRenderer.on('update:install-failed', handler)
    return () => ipcRenderer.removeListener('update:install-failed', handler)
  }
} satisfies SZGameAPI)
