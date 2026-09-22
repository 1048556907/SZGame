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
  groupsCreate: (name: string) => Promise<{ ok: boolean; id?: number; error?: string }>
  groupsRename: (id: number, name: string) => Promise<{ ok: boolean }>
  groupsDelete: (id: number, deleteGames?: boolean) => Promise<{ ok: boolean }>
  groupsReorder: (items: { id: number; sort_order: number }[]) => Promise<{ ok: boolean }>

  // games
  gamesList: (opts?: { groupId?: number | null; search?: string }) => Promise<any[]>
  gamesCreate: (input: any) => Promise<{ ok: boolean; id?: number; error?: string }>
  gamesUpdate: (id: number, input: any) => Promise<{ ok: boolean }>
  gamesDelete: (id: number) => Promise<{ ok: boolean }>
  gamesReorder: (groupId: number | null, items: { id: number; sort_order: number }[]) => Promise<{ ok: boolean }>

  // launcher
  launch: (gameId: number) => Promise<{ success: boolean; message?: string }>

  // dialogs
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<{
    canceled: boolean
    filePaths: string[]
  }>
  coverSaveFromPath: (sourcePath: string) => Promise<{ relativePath: string }>

  // app control
  hideToTray: () => Promise<void>
  quit: () => Promise<void>

  // window control (frameless titlebar)
  winMinimize:       () => Promise<void>
  winToggleMaximize: () => Promise<void>
  winClose:          () => Promise<void>
  winIsMaximized:    () => Promise<boolean>
  onMaximizeChange:  (cb: (maximized: boolean) => void) => () => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion:        () => ipcRenderer.invoke('window:getVersion'),

  settingsGet:       (k) => ipcRenderer.invoke('db:settings:get', k),
  settingsGetAll:    () => ipcRenderer.invoke('db:settings:getAll'),
  settingsSet:       (k, v) => ipcRenderer.invoke('db:settings:set', k, v),

  groupsList:        () => ipcRenderer.invoke('db:groups:list'),
  groupsCreate:      (n) => ipcRenderer.invoke('db:groups:create', n),
  groupsRename:      (i, n) => ipcRenderer.invoke('db:groups:rename', i, n),
  groupsDelete:      (i, d) => ipcRenderer.invoke('db:groups:delete', i, d),
  groupsReorder:     (it) => ipcRenderer.invoke('db:groups:reorder', it),

  gamesList:         (o) => ipcRenderer.invoke('db:games:list', o),
  gamesCreate:       (i) => ipcRenderer.invoke('db:games:create', i),
  gamesUpdate:       (i, p) => ipcRenderer.invoke('db:games:update', i, p),
  gamesDelete:       (i) => ipcRenderer.invoke('db:games:delete', i),
  gamesReorder:      (g, it) => ipcRenderer.invoke('db:games:reorder', g, it),

  launch:            (id) => ipcRenderer.invoke('launcher:launch', id),

  selectFile:        (f) => ipcRenderer.invoke('dialog:selectFile', f),
  coverSaveFromPath: (p) => ipcRenderer.invoke('cover:saveFromPath', p),

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
  }
} satisfies SZGameAPI)
