# Design: frameless-window-titlebar

## D1 — Native Frame Removal Strategy

**Decision**: Use `BrowserWindow({ frame: false, transparent: false, resizable: true, maximizable: true, minimizable: true, closable: true })`.

**Rationale**:
- `frame: false` is the canonical Electron option for custom title bars on Windows — removes the OS-provided title bar, borders, and window control buttons in one step.
- `resizable: true` keeps the OS-level resize behavior (drag window edges), which still works under frameless on Windows.
- Not using `titleBarStyle: 'hidden'` because it preserves OS-level edge hit-testing and visual artifacts that conflict with a fully custom layout.
- `transparent: false` because we need OPAQUE content and CSS `box-shadow` to simulate window boundary. Enabling transparent would cause blank corners behind the window.

**Alternatives Considered**:
- `titleBarStyle: 'hidden'` + `frame: true`: retains 1px border, better macOS compatibility, but leaves non-zero hit-test regions under the hidden bar. Rejected for this Windows-first app.
- `transparent: true` + hand-rolled resize handles: highest control but adds ~200 lines of resize handle code. Overkill.

## D2 — Drag Region Implementation

**Decision**: Use CSS `-webkit-app-region: drag` on the entire `.titlebar` element, override with `-webkit-app-region: no-drag` on button children.

```css
.titlebar { -webkit-app-region: drag; }
.titlebar .tb-wincontrols { -webkit-app-region: no-drag; }
.titlebar .tb-btn { -webkit-app-region: no-drag; }
```

**Rationale**:
- Zero IPC round-trips — browser handles drag natively.
- Text input fields / buttons in the drag region are naturally not-drag when set explicitly.
- Only requires a `<meta http-equiv="Content-Security-Policy">` directive allowing no overrides (no issue in our current CSP setup).

**Alternatives Considered**:
- `win.startDragging()` via IPC: works but requires a drag-triggering element and pollutes main process. Not needed.

## D3 — Window Control IPC Surface

**Decision**: Expose 4 new functions on `window.electronAPI.windowControls` via contextBridge:

| Preload API | Main Handler | BrowserWindow API |
|-------------|-------------|-------------------|
| `winControls.minimize()` | `ipcMain.handle('win:minimize')` | `win.minimize()` |
| `winControls.toggleMaximize()` | `ipcMain.handle('win:toggle-maximize')` | `win.isMaximized() ? win.unmaximize() : win.maximize()` |
| `winControls.close()` | `ipcMain.handle('win:close')` | `win.close()` |
| `winControls.isMaximized()` | `ipcMain.handle('win:is-maximized')` | `win.isMaximized()` → boolean |

**Important**: The existing `hideToTray()` / `quit()` preload APIs and main-process `minimize`/`close` event interceptors remain in place. The new IPC calls fire the same `win.minimize()` / `win.close()` APIs, so the event interceptors will naturally respect user tray settings.

## D4 — Maximize Icon State Sync

**Decision**: Use main-process `maximize` and `unmaximize` event handlers to broadcast the current maximized state via `webContents.send()`. Renderer subscribes via `ipcRenderer.on()` from preload.

```
Main:
  win.on('maximize', () => win.webContents.send('win:maximized', true))
  win.on('unmaximize', () => win.webContents.send('win:maximized', false))
  win.on('minimize', () => win.webContents.send('win:maximized', false))
  win.on('restore',  () => win.webContents.send('win:maximized', win.isMaximized()))

Preload:
  onMaximizeChange(cb) → ipcRenderer.on('win:maximized', (_e, val) => cb(val))

Renderer (App.tsx):
  const [isMaximized, setIsMaximized] = useState(false)
  useEffect(() => window.electronAPI?.onMaximizeChange(setIsMaximized))
```

**Rationale**: Catches maximization from non-button sources (Win+Up, system menu, double-click title bar edge, other apps activating maximize). Polling is too slow; this is event-driven and zero-cost when idle.

## D5 — Frameless Visual Boundary

**Decision**: Use CSS to simulate the missing OS frame:

```css
body {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.7);
  border-radius: 0;  /* sharp edges — no rounded corners (Windows convention) */
}
```

The 1px border prevents "floating in space" feeling; the drop shadow provides elevation. This is applied to the app root (`.app`) not the browser window (which we can't style).

**Windows DWM consideration**: Windows DWM may suppress shadow when `frame: false`. If shadow is absent, add `win.setWindowButtonVisibility(false)` + a 4px transparent border workaround, but try simple box-shadow first — newer Electron versions respect CSS shadow.

## D6 — Resize Hit Test

**Decision**: No explicit resize handles. Rely on Windows DWM edge hit-testing (works with `frame: false, resizable: true`). If edge detection proves too thin/touchy, add a 4px invisible CSS-only resize zone via a transparent `::before` element on `.app`.

**Scope**: Windows-only for this release; macOS traffic-light handling is out of scope.

## D7 — File Impact Matrix

| File | Change |
|------|--------|
| `electron/main.ts` | BrowserWindow options add `frame: false`; new IPC handlers (4); win event listeners (maximize/unmaximize/minimize/restore); possibly `setWindowButtonVisibility(false)` |
| `electron/preload.ts` | Add `winControls` namespace; add `onMaximizeChange` subscription; extend WindowApi type |
| `src/App.tsx` | Add `isMaximized` state + subscription; replace direct `hideToTray/quit` calls in titlebar with new `winControls.*`; conditional button icon (□ / ❐) |
| `src/styles/globals.css` | `.titlebar { -webkit-app-region: drag }` + `.no-drag` selector + body box-shadow |
| `openspec/changes/frameless-window-titlebar/.openspec.yaml` | existing scaffold, no schema change needed |
