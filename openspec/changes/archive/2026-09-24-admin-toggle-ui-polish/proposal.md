# Proposal

## Why

游戏添加/编辑表单中 "以管理员身份运行" 的文案不够简洁，且详情抽屉（GameDrawer）没有展示这个字段，用户保存后无法从详情页确认该游戏是否以提权模式启动。本次变更统一命名并补全详情展示，让游戏的启动模式在添加、编辑、查看三个阶段保持一致可见。

## What Changes

- **重命名**：GameForm 中 toggle 的 label 从 "以管理员身份运行" 改为 "提权运行"，hint 文案同步调整
- **补全详情展示**：GameDrawer 详情抽屉新增"提权运行"字段，值为"是"或"否"（带视觉区分），位于"启动类型"与"所属分组"之间
- **Spec 层补全**：game-box spec 的"游戏添加" requirement 补充 needs_admin（提权运行）字段；"卡片详情抽屉" requirement 明确抽屉 SHALL 展示启动模式

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `game-box`：游戏添加 requirement 补充"提权运行"字段；卡片详情抽屉 requirement 补充启动模式展示

## Impact

| 文件 | 改动 |
|------|------|
| `src/components/GameForm.tsx` | toggle label/hint 文案变更 |
| `src/components/GameDrawer.tsx` | 新增"提权运行" DrawerField |
| `openspec/changes/admin-toggle-ui-polish/specs/game-box/spec.md` | delta spec：补充 needs_admin 字段要求 |

**无 Breaking**（纯 UI 文案 + 展示层补全，DB schema / IPC / launcher 不变）
