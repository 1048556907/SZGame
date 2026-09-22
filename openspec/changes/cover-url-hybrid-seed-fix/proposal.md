# cover-url-hybrid-seed-fix

## Why
两个独立问题：(1) 远程封面经本地下载→存盘→protocol→回显链路始终存在二进制损坏风险（UTF-8 级联损坏），不如直接让浏览器从 Steam CDN 加载；(2) games 表无 UNIQUE 约束导致 SEED_SQL 每次启动 INSERT 多 3 条示例数据。

## What Changes
- **封面混合方案**：`cover_image` 字段现在存 Steam CDN URL（`https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_hero.jpg`）
- GameForm / GameGrid 渲染：`cover_image.startsWith('http')` → `<img src={cover_image}>`；否则（本地文件）→ `<img src="szgame://...">`
- CoverPickerModal `pick()` 不再调用 `downloadCover`，直接把 `c.imageUrl` 传给 `onPick()`
- **种子数据守卫**：`initDatabase` 里加 `if (!getSetting('db.seeded')) { ...; setSetting('db.seeded', '1') }`，首次启动才执行 SEED_SQL

## Capabilities
- `skip_specs: true`（运行时初始化 + 存储格式调整，无 spec 行为变化）

## Impact
- `electron/db.ts` — SEED_SQL 执行加守卫
- `src/components/CoverPickerModal.tsx` — pick() 跳过 downloadCover
- `src/components/GameForm.tsx` — 封面渲染加 URL 判断
- `src/components/GameGrid.tsx` — 卡片封面渲染加 URL 判断
