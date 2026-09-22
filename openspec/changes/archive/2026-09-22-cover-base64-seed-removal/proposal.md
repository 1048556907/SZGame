# cover-base64-seed-removal

## Why
封面碎裂问题根因链（URL→本地文件→protocol 回显 / 混合 CDN URL 被 Electron CSP 拦截）始终有编码/协议层风险。最稳方案是：**下载后用 Canvas 缩到 max 460px → 转 base64 data URI → 直接存 DB**，渲染时 `<img src="data:image/jpeg;base64,...">` 纯浏览器原生。同时彻底删除 SEED_SQL 及所有引用，启动时也不插入示例数据、不叠加。

## What Changes
- CoverPickerModal pick()：download → resize(canvas max 460px) → base64 → `onPick(data:image/jpeg;base64,...)`
- GameForm handleSelectCover()：本地文件选图也 resize + base64（复用同一逻辑）
- GameForm / GameGrid 渲染：`cover_image` 以 `data:` 开头 → 直接 `<img src={...}>`
- **彻底删除** db.ts 中 SEED_SQL 常量及所有执行（initDatabase 里相关守卫、dedupSeedGames 全删）
- 启动时一次性清理：`DELETE FROM games WHERE name IN ('Counter-Strike 2','艾尔登法环','DOTA 2') AND launch_path LIKE 'steam://rungameid/%'`
- covers/ 目录可清理（base64 不再依赖本地封面文件）

## Capabilities
- `skip_specs: true`（存储格式 + 种子数据删除，纯实现）

## Impact
- `electron/db.ts` — 删除 SEED_SQL + dedupSeedGames；启动时 purge 种子行
- `electron/main.ts` — 新增 cover:resizeAndBase64 IPC（拿 Buffer 给前端 canvas 不好做，改成 main 端 canvas 或纯 Node）
  → 实际上 Node 端没 canvas，直接在 preload 用 fetch + canvas 做 base64 更靠谱
- `src/components/CoverPickerModal.tsx` — pick() 全改
- `src/components/GameForm.tsx` — handleSelectCover + 渲染 + onPick
- `src/components/GameGrid.tsx` — 渲染加 data: 判断
