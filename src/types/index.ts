/**
 * 共享类型定义 —— 主进程与渲染进程共用的业务类型
 */

export type LaunchType = 'exe' | 'bat' | 'url'

export interface Game {
  id: number
  name: string
  launch_path: string
  launch_type: LaunchType
  launch_args?: string
  cover_image?: string | null
  needs_admin?: boolean
  group_id: number | null
  sort_order: number
  global_order: number
  created_at: string
  updated_at: string
}

export interface Group {
  id: number
  name: string
  icon_image?: string | null
  sort_order: number
  game_count?: number
  created_at?: string
}

export type MinimizeBehavior = 'taskbar' | 'tray'
export type CloseBehavior = 'exit' | 'minimize-to-tray'

export interface AppSettings {
  window_minimize_behavior: MinimizeBehavior
  window_close_behavior: CloseBehavior
  update_auto_check: boolean
  update_force: boolean
}

/** window.electronAPI 类型声明 — 与 electron/preload.ts 对齐 */
declare global {
  interface Window {
    electronAPI?: {
      // window
      getVersion: () => Promise<string>

      // settings
      settingsGet: (key: string) => Promise<string | null>
      settingsGetAll: () => Promise<Record<string, string>>
      settingsSet: (key: string, value: string) => Promise<{ ok: boolean }>

      // groups
      groupsList: () => Promise<Group[]>
      groupsCreate: (name: string, iconImage?: string | null) => Promise<{ ok: boolean; id?: number; error?: string }>
      groupsUpdate: (id: number, name: string, iconImage: string | null) => Promise<{ ok: boolean; error?: string }>
      groupsRename: (id: number, name: string) => Promise<{ ok: boolean }>
      groupsDelete: (id: number) => Promise<{ ok: boolean }>
      groupsReorder: (items: { id: number; sort_order: number }[]) => Promise<{ ok: boolean }>

      // games
      gamesList: (opts?: { groupId?: number | null; search?: string; sortBy?: 'per-group' | 'global' }) => Promise<Game[]>
      gamesCreate: (input: Omit<Game, 'id' | 'created_at' | 'updated_at' | 'sort_order' | 'global_order'>) => Promise<{ ok: boolean; id?: number; error?: string }>
      gamesUpdate: (id: number, input: Partial<Omit<Game, 'id' | 'created_at' | 'updated_at'>>) => Promise<{ ok: boolean }>
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

      // window control — frameless titlebar
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
      onUpdateInstalled:  (cb: (info?: { exePath?: string }) => void) => () => void
      onUpdateInstallFailed: (cb: (info: { error: string }) => void) => () => void
    }
  }
}

export {}
