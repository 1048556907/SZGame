# Design

## Context

See proposal.md for motivation. This is a greenfield Electron + React desktop application (React 18 + TypeScript + Vite + Electron) for managing arbitrary local executables and URLs as game cards. All data persists locally — no remote service. The application runs on Windows as primary target. AGENTS.md mandates an embedded SQL database (SQLite or H2); this design chooses SQLite.

## Goals / Non-Goals

**Goals:**
- Single-process Electron architecture with Main process owning all I/O (DB, file system, window/托盘 APIs) and Renderer handling only UI
- Clear IPC contract between Main and Renderer, no direct DB access from Renderer
- Cross-platform user-data directory resolution (via Electron's `app.getPath('userData')`)
- Cover image files stored as files on disk; DB stores only relative paths
- Setting persistence with a single source of truth (SQLite settings table) — no duplicated storage in Renderer localStorage
- Dark themed UI with blue accent (matches the provided image assets)

**Non-Goals:**
- Cloud sync or multi-device sharing
- Game library auto-scanning (users add games manually only)
- In-app game running monitoring / process tracking (启动后不追踪子进程状态)
- Plugin system for external integrations

## Decisions

### D1: 数据库选型 — better-sqlite3

**选择:** `better-sqlite3` — 同步 API 的 Node.js SQLite 绑定
**替代:** `sqlite3` (异步回调 API), sql.js (纯 WASM)

**理由:**
- `better-sqlite3` 的同步 API 在 IPC handler 中使用最简洁，不需要额外的 Promise 包装层
- 它是原生模块，Electron 主进程直接 require 即可（注意 electron-rebuild）
- sql.js 虽然免原生编译但有额外 WASM 加载开销，对本地嵌入式场景属于过度设计
- `sqlite3` 的回调风格在 TypeScript 下需要更多样板代码

### D2: 数据模型 — 三张表，单选归属

```sql
-- 分组
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 游戏
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  launch_path TEXT NOT NULL,
  launch_args TEXT,           -- 启动参数，可空
  cover_image TEXT,           -- 相对 userDataDir 的路径，可空；空时用默认占位图
  group_id INTEGER,           -- 外键，可空表示"全部"之外不属于任何分组？不 — 必填
  sort_order INTEGER NOT NULL DEFAULT 0,
  launch_type TEXT NOT NULL,  -- 'exe' | 'bat' | 'url' — 根据 launch_path 推断或用户选择
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
);

-- 设置（key-value 表，而非硬编码列，便于扩展）
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 预插入默认分组
INSERT INTO groups (name, sort_order) VALUES ('未分类', 0);  -- 默认分组

-- 预插入默认设置
INSERT INTO settings (key, value) VALUES
  ('window.minimize.behavior', 'taskbar'),   -- 'taskbar' | 'tray'
  ('window.close.behavior', 'exit');         -- 'exit' | 'minimize-to-tray'
```

**注意:** `games.group_id ON DELETE SET NULL` — 删除分组时该组游戏的 group_id 变为 NULL，在 UI 上归入"未分类"分组。**不级联删除游戏**（用户删除非空分组时 spec 要求确认，确认后才删除分组和组内游戏——这在应用层实现，不用 DB 级级联）。

### D3: 封面图存储策略

- 用户选择图片后，主进程通过 `dialog.showOpenDialog()` 获取原始路径
- 主进程将图片文件复制到 `{userDataDir}/covers/` 目录，文件名用 UUID 避免冲突
- DB 的 `games.cover_image` 存相对路径 `covers/xxx-uuid.jpg`
- Renderer 通过 `file://` 协议或 Electron 的 `protocol.registerFileProtocol` 加载
- 不存储 base64 或 data URI 到 DB

**替代:** DB 内 BLOB 存储 — 拒绝，会导致 SQLite 文件膨胀、备份迁移困难

### D4: 启动执行策略

```
launch_type 推断逻辑:
  launch_path.endsWith('.exe')      → 'exe'
  launch_path.endsWith('.bat')      → 'bat'
  launch_path.startsWith('http://') 
    || launch_path.startsWith('https://') → 'url'
  其他 → 用户手动选择

执行:
  'exe' → child_process.spawn(path, [launch_args], { detached: true })
  'bat' → child_process.exec(`cmd /c "${path}" ${launch_args}`)
  'url' → shell.openExternal(url)
```

启动后主进程返回成功/失败状态给 Renderer，**不追踪子进程生命周期**。

### D5: IPC 契约

所有 IPC 通信通过 `ipcMain.handle` / `ipcRenderer.invoke`（双向请求-响应模式），不使用 send/on 的单向推送。主进程内部封装 db 层和 launcher 层，IPC handler 仅做参数校验和路由。

```
Channel                          Direction        Payload / Response
─────────────────────────────────────────────────────────────────────
db:groups:list                   R → M ()         [{id, name, sort_order, game_count}]
db:groups:create                 R → M (name)     id
db:groups:rename                 R → M (id, name) ok / error
db:groups:delete                 R → M (id)       ok / error
db:groups:reorder                R → M ([{id, sort_order}])   ok

db:games:list                    R → M ({groupId?, search?})  [{id, name, cover_image, group_id, launch_type, sort_order}]
db:games:create                  R → M (payload)  id
db:games:update                  R → M (id, payload)  ok
db:games:delete                  R → M (id)       ok
db:games:reorder                 R → M (groupId, [{id, sort_order}])  ok

db:settings:get                  R → M (key)      value (string)
db:settings:getAll               R → M ()         {key: value}
db:settings:set                  R → M (key, value)  ok

launcher:launch                  R → M (gameId)   {success: true/false, message?}

dialog:selectFile                R → M ({filters})  { canceled, filePaths[] }
cover:saveFromPath               R → M (sourcePath) { relativePath }   -- 主进程负责复制到 userDataDir/covers/
window:getVersion                R → M ()         string            -- 读取 package.json version

window:hideToTray                M (self)         -- 设置变更后主进程内部调用
window:minimize                  M (self)         -- 主进程监听 minimize 事件，根据设置决定行为
window:close                     M (self)         -- 主进程监听 close 事件，根据设置决定行为
```

**关键约束:** Renderer **不得**直接访问 SQLite 或文件系统。所有持久化和执行操作必须通过 IPC。

### D6: 托盘与窗口行为的实现方式

```
主进程启动时:
├── 创建 BrowserWindow
├── 创建 Tray（始终创建，但根据设置决定是否显示）
├── 加载设置（从 SQLite）
└── 监听窗口事件:
    ├── 'minimize' → 读 settings.window.minimize.behavior
    │   ├── 'taskbar' → 正常最小化（不拦截）
    │   └── 'tray' → event.preventDefault(); hide(); 显示 tray
    ├── 'close' → 读 settings.window.close.behavior
    │   ├── 'exit' → 正常关闭（不拦截）
    │   └── 'minimize-to-tray' → event.preventDefault(); hide(); 显示 tray
    └── tray 事件:
        ├── 'click' → show(); focus();
        └── context-menu → [{label: '恢复', click: show}, {label: '退出', click: app.quit}]
```

### D7: 项目结构

```
SZGame/
├── electron/                    # 主进程代码
│   ├── main.ts                   # BrowserWindow + Tray + 事件监听
│   ├── db/
│   │   ├── init.ts               # SQLite 初始化、建表、种子数据
│   │   ├── groups.ts             # groups 表 CRUD
│   │   ├── games.ts              # games 表 CRUD
│   │   └── settings.ts           # settings 表 CRUD
│   ├── ipc/
│   │   └── handlers.ts           # 所有 ipcMain.handle 注册
│   ├── launcher.ts               # exe/bat/url 启动
│   └── cover-manager.ts          # 封面图复制/删除
├── src/                          # Renderer (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── Sidebar.tsx           # 左侧分组导航
│   │   ├── GameGrid.tsx          # 卡片网格
│   │   ├── GameCard.tsx          # 单张卡片
│   │   ├── GameDrawer.tsx        # 详情抽屉
│   │   ├── GameForm.tsx          # 添加/编辑表单
│   │   ├── GroupManager.tsx      # 分组管理面板
│   │   ├── Settings.tsx          # 设置页面
│   │   ├── SearchBar.tsx         # 搜索框
│   │   └── CoverPreview.tsx      # 封面放大预览
│   ├── hooks/
│   │   └── useGames.ts           # 游戏数据管理 hook
│   ├── styles/
│   │   └── globals.css           # 深色主题 + CSS 变量
│   └── types/
│       └── index.ts              # 共享类型定义
├── images/                       # 图片资源（已存在）
├── package.json
├── vite.config.ts                # 含 electron 相关插件
├── tsconfig.json
└── AGENTS.md
```

### D8: 拖拽排序方案

- 使用 `@dnd-kit/core` + `@dnd-kit/sortable` — React 社区主流的拖拽库，轻量且类型完备
- 卡片网格使用 `DndContext` + `SortableContext` + `useSortable`
- 左侧分组列表同理
- 拖拽结束时调用 `db:games:reorder` 或 `db:groups:reorder` IPC，批量提交新的 sort_order
- **不**在拖拽过程中实时保存 — 只在拖拽完成（onDragEnd）时落盘，避免频繁 DB 写入

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Windows 上 .exe 路径含空格导致启动失败 | 启动报错 | 启动时对路径做引号包裹处理；bat 用 `cmd /c "path"` |
| 跨平台路径差异（Windows `\` vs Unix `/`） | 封面加载失败 | 主进程统一用 `path.resolve` 和 `path.sep`；DB 存储用正斜杠相对路径 |
| better-sqlite3 原生模块编译 | 首次构建需 node-gyp | 在 devDependencies 中配好 `electron-rebuild`，或改用 `@electron/rebuild`；CI 中执行 rebuild |
| 删除非空分组的级联行为歧义 | 用户误删游戏 | spec 要求二次确认；应用层在删除分组前先 count 该组游戏，非零时弹确认框 |
| 设置值被 falsy 值吞没（如 `|| true` bug） | 布尔设置保存失败 | 经验教训：用 `?? 默认值` 代替 `|| 默认值`；settings 表 value 存字符串 "true"/"false"，Renderer 侧解析 |
| 搜索 debounce 时序问题 | 输入过程中闪烁 | 统一用 React 的 `useDeferredValue` 或手动 debounce hook（300ms） |
| 封面图文件与 DB 记录不一致（手动删除文件） | 卡片显示破图 | Renderer 加载图片失败时 fallback 到默认占位图（onError 事件） |

## Migration Plan

首次启动时 `db/init.ts` 负责建表和种子数据，无需迁移脚本。后续 schema 变更时引入 user_version + WAL 模式下的迁移函数。

## Open Questions

（空 — 当前设计没有需要延期决策的问题）
