# detail-panel-cover-fix

## Why
封面统一改为 base64 data URI 存 DB 后，GameDrawer（右侧滑出的详情页）没有同步改封面渲染逻辑，仍然只拼 `szgame://` 前缀，导致 base64 封面无法显示（GameGrid 和 GameForm 之前已修复，GameDrawer 漏了）。

## What Changes
- `src/components/GameDrawer.tsx` 第 30 行 coverUrl 计算：新增 `data:` 前缀判断

## Impact
- 单文件改动，skip_specs: true
