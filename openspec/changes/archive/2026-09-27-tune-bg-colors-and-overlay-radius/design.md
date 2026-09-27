# Design

## Context

- **v1（原始设计稿）**：`sidebar-bg #080c12, surface-0 #0d1219` — 三个区域几乎糊成一片
- **v2（optimize-ui-background-hierarchy）**：大幅提亮 `titlebar-bg #0a0f16, sidebar-bg #141d2b, surface-0 #1a2536` — 层次清晰但整体过亮、不协调，用户反馈"又太浅了"
- 当前需要在 v1 和 v2 之间取一个平衡点：比 v1 稍亮以避免"糊"，但比 v2 暗 30–40% 以避免"晃"
- overlay 圆角问题：已确认 UpdateDialog.tsx L43 和 CoverPickerModal.tsx L175 两个遮罩层缺 `borderRadius: 12`

## Goals / Non-Goals

**Goals:**
- 三层背景色在 v1–v2 之间取中间偏暗值，色调协调不突兀
- 保留标题栏独立色阶（不回退到 v1 的共用状态）
- 修复所有缺失圆角的 overlay 遮罩层
- 仅修改 CSS 变量值和两个组件的 inline style

**Non-Goals:**
- 不改变 accent、text、radii、shadows 等非背景变量
- 不新增/删除 overlay，只修复已有 overlay 的 borderRadius
- 不引入新组件或新 CSS 类

## Decisions

### Decision 1: 三层色调回调方案

采用中间偏暗策略（v2 → 回调约 35%），让整体色调既比 v1 亮一档，又不像 v2 那样"漂白"：

| 层级 | 变量 | v1 原始 | v2 过度提亮 | **新值** | ΔRGB (v1→新) | ΔRGB (新→v2) |
|------|------|---------|------------|---------|-------------|-------------|
| 最深 | `--titlebar-bg` | _(无)_ | `#0a0f16` | **`#0a0e14`** | — | — |
| 中间 | `--sidebar-bg` | `#080c12` | `#141d2b` | **`#0f151f`** | (7,9,13) | (5,8,10) |
| 最亮 | `--surface-0` | `#0d1219` | `#1a2536` | **`#141c28`** | (7,10,15) | (6,9,14) |

层次差验证：
- titlebar → sidebar：ΔRGB (5,7,11) → 清晰可辨
- sidebar → surface-0：ΔRGB (5,7,9) → 协调递进，不突兀

### Decision 2: Surface 派生变量回调

| 变量 | v1 原始 | v2 过度 | **新值** |
|------|---------|---------|---------|
| `--surface-1` | `#131a24` | `#212d41` | **`#192130`** |
| `--surface-2` | `#1a2230` | `#2a384f` | **`#212b3d`** |
| `--surface-3` | `#232d3d` | `#344560` | **`#2a374c`** |

四档之间保持 ~7–9 RGB 通道的等差梯度。

### Decision 3: Border opacity 回调

v2 把 border 从 0.06 → 0.08、0.12 → 0.15。新表面比 v2 暗，border 在暗背景上的相对可见度提升，回调到 0.07/0.13 即可：

| 变量 | v1 | v2 | **新值** |
|------|----|----|---------|
| `--border` | 0.06 | 0.08 | **0.07** |
| `--border-strong` | 0.12 | 0.15 | **0.13** |

### Decision 4: Overlay 圆角修复清单

| 文件 | 位置 | 问题 | 修复 |
|------|------|------|------|
| `UpdateDialog.tsx` | L42-46 `position: fixed, inset: 0` | 缺 `borderRadius: 12` | 加入 `borderRadius: 12, overflow: 'hidden'` |
| `CoverPickerModal.tsx` | L175 `position: absolute, inset: 0` | 缺 `borderRadius: 12` | 加入 `borderRadius: 12, overflow: 'hidden'` |

模式参考：App.tsx L28、Lightbox.tsx L32、GameDrawer.tsx L44、GameForm.tsx L157 均已正确使用 `borderRadius: 12`。

## Risks / Trade-offs

- **[色调回调后对比度略降]** → 新值仍比 v1 亮约 30%，surface-0 在 RGB 20 区间，远高于 v1 的 RGB 13
- **[CoverPickerModal L175 context 可能不同]** → 实施前需读取上下文确认确实是 overlay 而非普通内容容器
