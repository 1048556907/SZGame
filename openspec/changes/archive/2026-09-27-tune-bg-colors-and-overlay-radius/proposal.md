# Proposal

## Why

上一次背景色调整（`optimize-ui-background-hierarchy`）把基底色提亮幅度过大（surface-0 从 `#0d1219` → `#1a2536`，ΔRGB ≈ 13/通道），用户反馈"又太浅了"且三个大区域不协调。同时，App 内多个全屏遮罩层（UpdateDialog、CoverPickerModal 等 overlay）使用 `position: fixed/absolute, inset: 0` 但缺少 `borderRadius: 12`，在 12px 圆角的窗口内显示出直角方形遮罩，视觉穿帮。

## What Changes

- **回调基底色值至中间区间**：在保持三层层次（标题栏最暗、侧边栏居中、主内容区最亮）的前提下，将所有 surface 变量从上一版回调 30–40% 的亮度增幅，取得比原始设计稿稍亮但又不"晃眼"的平衡点
- **修正三层色调比例**：标题栏、侧边栏、主内容区之间的 ΔRGB 差重新校准，使三者视觉上协调递进而非突兀跃迁
- **修复 UpdateDialog 遮罩圆角**：为 `UpdateDialog.tsx` 的 `position: fixed + inset: 0` 遮罩层补上 `borderRadius: 12`（参考已正确实现的 App.tsx、Lightbox.tsx、GameForm.tsx 等）
- **修复 CoverPickerModal 内层遮罩圆角**：`CoverPickerModal.tsx` L175 的第二个绝对定位遮罩同样补上 `borderRadius: 12`

## Capabilities

### New Capabilities

_（无，本次为纯样式/视觉微调）_

### Modified Capabilities

_（无，不涉及 spec 级行为变更）_

## Impact

- **文件**：
  - `src/styles/globals.css`（CSS 变量值回调 + 可能微调 border opacity）
  - `src/components/UpdateDialog.tsx`（遮罩层 L43 加 `borderRadius: 12`）
  - `src/components/CoverPickerModal.tsx`（遮罩层 L175 加 `borderRadius: 12`）
- **无 API / 依赖 / 业务逻辑影响**
