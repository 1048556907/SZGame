# steam-cover-improve

## Why
当前 Steam 封面获取有三个致命缺陷：(1) `httpsGet` 统一用 UTF-8 解码，导致下载的 JPEG 封面损坏；(2) `library_hero.jpg` 并非所有 appid 都有，直接拼出来可能 404；(3) 对返回 JSON 字段类型校验不足。

## What Changes
- **BREAKING** 拆分 `httpsGet` → `httpsGetText(url)` 返回 string（JSON API 用）+ `httpsGetBinary(url)` 返回 Buffer（图片下载用）
- 封面 fallback 链：`library_hero.jpg` → `header.jpg` → `capsule_616x353.jpg`，按序尝试，第一个 200 就用
- 搜索结果额外字段：`type`、`platforms`、`price`（国区价）纳入 CoverCandidate
- `metascore` 兼容空字符串 `""` / 缺失 / 数字三态
- JSON body 增加 `total` 统计字段
- CoverPickerModal 卡片展示国区价格 + 平台图标（win/mac/linux）

## Capabilities
- `skip_specs: true`（纯实现级修复 + 字段扩展，对外 API 形状不变）

## Impact
- `electron/remote-cover.ts` — 拆分 HTTP 函数 + fallback 链 + 类型完整化
- `src/components/CoverPickerModal.tsx` — 卡片展示国区价/平台
- `electron/preload.ts` / `src/types/index.ts` — candidates 加 price/platforms 字段
