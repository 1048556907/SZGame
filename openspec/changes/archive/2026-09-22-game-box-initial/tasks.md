# Tasks

## 1. 项目脚手架与依赖

- [ ] 1.1 创建 package.json，声明 Electron + Vite + React + TypeScript 依赖，配好 dev/build/scripts 脚本（含 electron-rebuild）。验证：`npm install` 无报错，package.json 脚本结构与设计一致
- [ ] 1.2 创建 Vite + React + TypeScript 基础骨架（src/main.tsx, App.tsx, index.html, tsconfig.json, vite.config.ts 含 electron 插件）。验证：`npm run dev` 能启动开发服务器，浏览器显示空页面
- [ ] 1.3 引入 better-sqlite3 和 @dnd-kit/core + @dnd-kit/sortable 依赖并 electron-rebuild。验证：主进程 require better-sqlite3 不报错

## 2. 主进程 — DB 层

- [ ] 2.1 实现 `electron/db/init.ts`：初始化 SQLite 连接（使用 app.getPath('userData') 定位文件）、建 groups/games/settings 三张表、种子数据（默认分组 + 默认设置）。验证：首次启动时 userDataDir 下生成 .db 文件，schema 与 design D2 一致
- [ ] 2.2 实现 `electron/db/groups.ts`：list/create/rename/delete/reorder，list 返回每组 game_count。验证：单元测试覆盖 CRUD 全路径
- [ ] 2.3 实现 `electron/db/games.ts`：list（支持 groupId 过滤和 search 模糊匹配）/create/update/delete/reorder。验证：单元测试覆盖 CRUD 全路径 + 模糊搜索
- [ ] 2.4 实现 `electron/db/settings.ts`：get/getAll/set。验证：settings.set 后 settings.get 能立即读到值

## 3. 主进程 — IPC Handlers

- [ ] 3.1 实现 `electron/ipc/handlers.ts`：注册 db:groups:* / db:games:* / db:settings:* 所有 ipcMain.handle，参数校验后转发到对应 db 层函数。验证：每个 handler 有 try-catch，错误返回结构化对象
- [ ] 3.2 实现 dialog:selectFile 和 cover:saveFromPath handler（封面图复制到 userDataDir/covers/）。验证：传入源路径返回相对路径，目标文件确实存在
- [ ] 3.3 实现 launcher:launch handler（根据 launch_type 分发 spawn/exec/shell.openExternal）。验证：传 exe 路径能正确 spawn，传 URL 能调用 shell.openExternal
- [ ] 3.4 实现 window:getVersion handler（读取 package.json version）。验证：返回字符串格式与 package.json 一致

## 4. 主进程 — 窗口与托盘

- [ ] 4.1 实现 `electron/main.ts`：创建 BrowserWindow（无边框或有边框按设计）、注册 minimize/close 事件监听、根据 settings 行为决定拦截还是放行。验证：minimize 到托盘和 close 到托盘两种模式下行为符合 spec
- [ ] 4.2 实现系统 Tray：创建 Tray 实例、注册左键点击恢复、右键菜单（恢复/退出）。验证：托盘图标显示正常，菜单操作能正确恢复窗口或退出应用
- [ ] 4.3 实现窗口事件与设置联动：应用启动时从 settings 加载配置并绑定到事件处理。验证：切换设置后无需重启，关闭按钮行为立即生效

## 5. 主进程 — 启动器与封面管理

- [ ] 5.1 实现 `electron/launcher.ts`：根据 launch_type 执行 exe (spawn + 启动参数) / bat (cmd /c) / url (shell.openExternal)，返回成功/失败状态。验证：分别传入三种类型的启动路径，执行效果符合预期
- [ ] 5.2 实现 `electron/cover-manager.ts`：复制封面到 covers/ 目录、删除封面文件（游戏删除时）。验证：复制后目标文件存在且内容一致，删除后源文件也被清理

## 6. 渲染进程 — 布局骨架与主题

- [ ] 6.1 创建 `src/styles/globals.css`：深色主题 CSS 变量（背景色、主色、蓝色点缀、圆角、阴影）、全局 reset。验证：页面背景为深色，按钮有蓝色 hover 态
- [ ] 6.2 实现 `src/App.tsx` + `src/components/Sidebar.tsx` + `GameGrid.tsx` 骨架：左侧导航栏 + 右侧内容区 + 顶部搜索框。验证：布局按 design D7 的结构渲染，侧边栏/网格/搜索框都占位显示
- [ ] 6.3 创建 `src/types/index.ts` 和 `src/hooks/useIPC.ts`：共享类型（Game, Group, Settings）和 IPC 调用封装（window.electronAPI 类型定义）。验证：TypeScript 编译通过，类型在组件中正确使用

## 7. 渲染进程 — 左侧分组导航

- [ ] 7.1 实现 `Sidebar.tsx`：从 IPC 加载 groups 列表、渲染"全部"固定项 + 所有自定义分组、显示每个分组的 game_count。验证：导航栏列表与 DB 数据一致，分组切换触发 GameGrid 刷新
- [ ] 7.2 实现 Sidebar 内的分组 CRUD：新建（弹出输入框，名称校验唯一性）、重命名（双击）、删除（空分组直接删，非空弹确认框 + 级联删除组内游戏）。验证：CRUD 操作后导航栏和卡片网格同步更新
- [ ] 7.3 实现 Sidebar 拖拽排序（@dnd-kit），onDragEnd 后调用 db:groups:reorder 持久化。验证：拖拽后分组顺序改变，刷新后保持

## 8. 渲染进程 — 游戏卡片网格

- [ ] 8.1 实现 `GameCard.tsx`：封面图（file:// 协议加载，onError fallback 到默认占位图）、名称、启动按钮、点击非启动区域打开详情抽屉。验证：卡片显示正确，封面加载失败时有默认图
- [ ] 8.2 实现 `GameGrid.tsx`：从 IPC 加载 games 列表（按当前分组或搜索结果）、渲染 GameCard 网格、空状态提示。验证：切换分组/清空搜索时网格刷新
- [ ] 8.3 实现 GameGrid 内卡片拖拽排序（@dnd-kit），onDragEnd 后调用 db:games:reorder 持久化（仅分组内排序，跨分组禁止）。验证：同组拖拽后顺序改变并持久化，跨组拖拽不改变归属

## 9. 渲染进程 — 搜索

- [ ] 9.1 实现 `SearchBar.tsx`：输入框 + debounce 300ms，输入停止后调用 db:games:list({ search }) 跨分组聚合。验证：输入关键词后 300ms 网格刷新显示匹配结果
- [ ] 9.2 搜索结果空状态 + 清空搜索恢复原状。验证：无匹配时显示"未找到"提示，清空后网格回到当前分组

## 10. 渲染进程 — 详情抽屉与封面预览

- [ ] 10.1 实现 `GameDrawer.tsx`：侧边滑出、深色半透明背景、显示封面大图/名称/路径/参数/分组、启动/编辑/删除按钮。验证：点击卡片非启动区打开，点击外部或 ESC 关闭
- [ ] 10.2 实现编辑功能：Drawer 内的编辑模式（或复用 GameForm），保存后调用 db:games:update 并关闭抽屉。验证：编辑后卡片网格刷新
- [ ] 10.3 实现删除确认：Drawer 内删除操作弹二次确认，确认后调 db:games:delete + cover-manager 删除封面文件。验证：删除后网格刷新，封面文件不存在
- [ ] 10.4 实现 `CoverPreview.tsx`：全屏/大尺寸封面图预览，点击任意位置关闭。验证：点击详情抽屉封面弹出预览，点击关闭

## 11. 渲染进程 — 添加/编辑表单

- [ ] 11.1 实现 `GameForm.tsx`：添加和编辑共用，收集名称/启动路径/启动参数/封面上传/归属分组。验证：必填项缺失时表单不提交并高亮
- [ ] 11.2 实现封面图上传：点击"上传"按钮调用 dialog:selectFile → cover:saveFromPath，返回相对路径后预览显示。验证：选图后立即在表单内显示缩略图，保存后 DB 存相对路径

## 12. 渲染进程 — 设置页面

- [ ] 12.1 实现 `Settings.tsx`：最小化行为下拉/单选、关闭按钮行为下拉/单选、版本号展示。验证：设置项从 IPC 回填初始值，修改后即时保存到 DB
- [ ] 12.2 设置保存后立即生效（最小化/关闭按钮行为），无需重启。验证：修改设置后点击窗口关闭按钮，行为按新设置执行

## 13. 集成与构建

- [ ] 13.1 应用端到端冒烟测试：启动应用 → 创建分组 → 添加 exe 和 URL 类型游戏 → 启动 exe → 关闭到托盘 → 恢复窗口 → 删除游戏 → 退出。验证：完整流程走通，无报错
- [ ] 13.2 `npm run build` 成功生成可执行文件（Windows .exe），双击运行行为与开发环境一致。验证：构建产物在 dist/ 或 release/ 目录，运行托盘/窗口/设置功能正常
