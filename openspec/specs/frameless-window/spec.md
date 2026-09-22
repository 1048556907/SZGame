# frameless-window

## Purpose

为 SZGame 应用去除 Electron 原生窗口边框，用 React 渲染的自定义标题栏作为窗口的唯一控制入口，消除原生标题栏与设计稿标题栏的重复并还原设计意图。自定义标题栏需完整提供拖拽移动、最小化、最大化切换、关闭等行为，并保持 Windows 平台的视觉边界识别。

## Requirements

### Requirement: FRM-1 — Frameless Window

The main application window SHALL be created without the native OS window frame.

#### Scenario: Application launches without native title bar
- **WHEN** the user starts SZGame
- **THEN** the window appears without a native title bar, borders, or OS-provided window controls
- **AND** the window content is laid out edge-to-edge with no reserved space for a native frame

### Requirement: FRM-2 — Custom Title Bar as Single Window Control Entry

The application SHALL provide a custom title bar rendered by the renderer process as the sole entry point for window control operations.

#### Scenario: Title bar is visible at the top of every view
- **WHEN** the application is displaying any view (home, group management, settings)
- **THEN** a custom title bar occupies the topmost row of the window
- **AND** the title bar contains: application logo, application name, minimize button, maximize/restore button, close button

#### Scenario: No native window control buttons exist
- **WHEN** the user inspects the window (visually or via system APIs)
- **THEN** there are no OS-native minimize, maximize, or close buttons rendered anywhere on the window

### Requirement: FRM-3 — Window Drag Region

The custom title bar SHALL be draggable by mouse to move the window.

#### Scenario: Dragging the title bar moves the window
- **WHEN** the user clicks and drags on the title bar (not on any button)
- **THEN** the window follows the cursor and moves to the new screen position
- **AND** the window does not enter text selection mode during drag

#### Scenario: Buttons within title bar are not part of drag region
- **WHEN** the user clicks on minimize, maximize, or close buttons within the title bar
- **THEN** the corresponding action fires instead of initiating a window drag

### Requirement: FRM-4 — Window Control Actions

The custom title bar buttons SHALL perform the same window control actions that native OS buttons would.

#### Scenario: Minimize button minimizes the window
- **WHEN** the user clicks the minimize button in the title bar
- **THEN** the window is minimized (or hidden to system tray, per user settings)

#### Scenario: Maximize button toggles maximize / restore
- **WHEN** the user clicks the maximize button while the window is not maximized
- **THEN** the window expands to fill the available desktop area
- **AND** the maximize button visually changes to indicate "restore" state
- **WHEN** the user clicks the restore button while the window is maximized
- **THEN** the window returns to its previous size and position
- **AND** the button visually changes back to "maximize"

#### Scenario: Close button closes the window
- **WHEN** the user clicks the close button
- **THEN** the window is closed (or hidden to system tray, per user settings)

### Requirement: FRM-5 — Visual Integrity Without Native Frame

The frameless window SHALL maintain visual integrity, readability, and recognizability.

#### Scenario: Window has visible boundary on Windows
- **WHEN** SZGame runs on Windows
- **THEN** the window exhibits a visible boundary (e.g., box-shadow or 1px border) so the user can perceive the window edges against the desktop background

#### Scenario: Window shadow / elevation is present
- **WHEN** the window is visible (not minimized, not hidden)
- **THEN** it casts a subtle drop shadow that provides elevation cues against the desktop

### Requirement: FRM-6 — Settings-Driven Minimize / Close Behavior Is Preserved

Removal of the native frame SHALL NOT change the semantics of the existing minimize-to-tray and close-to-tray settings.

#### Scenario: Minimize button respects user's tray preference
- **GIVEN** the user has set "最小化时: 系统托盘"
- **WHEN** the user clicks the minimize button
- **THEN** the window is hidden to the system tray rather than appearing on the taskbar

#### Scenario: Close button respects user's tray preference
- **GIVEN** the user has set "关闭按钮时: 最小化到托盘"
- **WHEN** the user clicks the close button
- **THEN** the window is hidden to the system tray rather than quitting the application

### Requirement: FRM-7 — Maximum Icon State Synchronization

The custom title bar SHALL accurately reflect the current maximization state regardless of how the state was changed.

#### Scenario: Icon updates when maximization changes via non-button means
- **WHEN** the window is maximized via OS keyboard shortcut (e.g., Windows+Up) or system menu
- **THEN** the maximize/restore button in the custom title bar updates to the correct icon (❐)
- **AND** the state persists through minimize → restore cycle
