# Tasks: frameless-window-titlebar

## TG1 — Electron Main Process Changes

### T1.1: Remove native frame from BrowserWindow
- **File**: `electron/main.ts`, function `createMainWindow`
- **Change**: Add `frame: false` to BrowserWindow options
- **Keep**: `resizable: true`, `minimizable: true`, `maximizable: true`, `closable: true`, `autoHideMenuBar: true`
- **Verify**: Dev launch shows frameless window (no OS title bar), window still shows up properly

### T1.2: Add window control IPC handlers
- **File**: `electron/main.ts`, after existing `ipcMain.handle` block
- **Add 4 handlers**:
  - `win:minimize` → `mainWindow?.minimize()`
  - `win:toggle-maximize` → `mainWindow?.isMaximized() ? mainWindow?.unmaximize() : mainWindow?.maximize()`
  - `win:close` → `mainWindow?.close()`
  - `win:is-maximized` → returns `mainWindow?.isMaximized() ?? false`
- **Verify**: Each handler returns expected type, no runtime errors when mainWindow is null

### T1.3: Broadcast maximization state changes
- **File**: `electron/main.ts`, inside `createMainWindow` after `mainWindow` creation
- **Add event listeners** on `win`: `maximize`, `unmaximize`, `minimize`, `restore` → each calls `mainWindow.webContents.send('win:maximized', boolean)`
- **Verify**: Dev console shows broadcast events fire on manual maximize/unmaximize

## TG2 — Electron Preload Extension

### T2.1: Expose windowControls API on contextBridge
- **File**: `electron/preload.ts`, extend `electronAPI` object
- **Add**: `winControls: { minimize, toggleMaximize, close, isMaximized }`
- **Add**: `onMaximizeChange: (cb: (maximized: boolean) => void) => { ipcRenderer.on('win:maximized', (_e, v) => cb(v)) }`
- **Verify**: `window.electronAPI.winControls` is defined in DevTools console

## TG3 — Renderer Titlebar Wiring

### T3.1: Add isMaximized state + subscription
- **File**: `src/App.tsx`, inside `AppInner`
- **Add**: `const [isMaximized, setIsMaximized] = useState(false)`
- **Add**: `useEffect(() => { window.electronAPI?.onMaximizeChange(setIsMaximized) }, [])`
- **Verify**: Clicking native Win+Up / Win+Down reflects icon change

### T3.2: Wire titlebar buttons to windowControls
- **File**: `src/App.tsx`, titlebar area
- **Minimize button**: replace current `hideToTray()` call with `winControls.minimize()` — tray logic is preserved by main process event interceptor
- **Maximize button**: replace placeholder with `winControls.toggleMaximize()`
- **Close button**: keep `quit()` OR switch to `winControls.close()` — verify tray interceptor still works; prefer `close()` to maintain symmetry
- **Verify**: All three buttons perform expected actions

### T3.3: Conditional maximize/restore icon
- **File**: `src/App.tsx`, titlebar maximize button
- **Icon**: `isMaximized ? '❐' : '□'` (HTML entity `&#x2750;` vs `&#x25A1;`)
- **Tooltip**: `isMaximized ? '还原' : '最大化'`
- **Verify**: Icon changes in real-time when maximizing or restoring

## TG4 — CSS Drag Region & Visual Boundary

### T4.1: Declare titlebar as drag region
- **File**: `src/styles/globals.css`
- **Add**: `.titlebar { -webkit-app-region: drag; }`
- **Add**: `.titlebar .tb-wincontrols, .titlebar .tb-btn { -webkit-app-region: no-drag; }`
- **Verify**: Dragging empty space in titlebar moves window; dragging a button performs its action

### T4.2: Add frameless visual boundary
- **File**: `src/styles/globals.css`
- **Add**: `:root / body / .app` box-shadow + 1px border for elevation
- **Values**: `box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.7)`
- **Verify**: Window has visible shadow against white/light desktop background

## TG5 — Build & Smoke Test

### T5.1: Dev build verification
- **Cmd**: `npm run dev`
- **Checklist**:
  - [ ] Window launches frameless
  - [ ] Title bar visible at top
  - [ ] Title bar drag moves window
  - [ ] Minimize → tray (per default settings)
  - [ ] Maximize → expands; icon changes to ❐
  - [ ] Restore → shrinks; icon back to □
  - [ ] Close → tray (per default settings)
  - [ ] Tray menu "显示窗口" restores properly after minimize-to-tray

### T5.2: Production build verification
- **Cmd**: `npm run build` (or `npx electron-builder --win` with `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`)
- **Run**: `release/win-unpacked/SZGame.exe`
- **Checklist**:
  - [ ] No console errors on launch
  - [ ] Window frameless in production build
  - [ ] All window controls functional
  - [ ] Tray icon visible after minimize-to-tray
  - [ ] Shadow/boundary present in production

## TG6 — Update design.md note (optional)

- D6 (resize hit test): Confirm DWM edge detection works on target Windows 10/11 — if not, add 4px invisible resize zone
