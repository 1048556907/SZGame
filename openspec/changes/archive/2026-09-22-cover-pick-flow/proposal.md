# cover-pick-flow

## Why
远程封面下载到本地后，GameForm 回显碎裂、GameGrid 显示全黑。根因是：旧 exe 的 httpsGet 用 `.toString('utf-8')` 把二进制 JPEG 损坏成了 `FD FD FD FD`（UTF-8 替换字符 0xEF 0xBF 0xBD 经过 buffer 转字符串再写回的级联损坏）。即使后续代码修好了 httpsGetBinary + Buffer 直写，**已损坏的文件仍然躺在 covers/ 目录 + DB 仍指向它们**，protocol.handle 正确读文件也只能读出坏图。

## What Changes
- 启动时扫描 covers/ + group-icons/ 目录下的所有文件
- 读取文件前 4 字节（magic bytes）校验格式：JPEG=`FF D8 FF`, PNG=`89 50 4E 47`, WebP=`52 49 46 46`（RIFF）
- 损坏文件（magic bytes 不匹配）自动删除
- 下次用户在 GameForm 里点"获取封面"重新下载时，文件就是好的

## Capabilities
- `skip_specs: true`（运行时自检逻辑，无用户行为变化）

## Impact
- `electron/main.ts` —— app.whenReady 里加 `purgeCorruptedCovers(userDataDir)`
- 新函数放在 main.ts 或独立 utils
