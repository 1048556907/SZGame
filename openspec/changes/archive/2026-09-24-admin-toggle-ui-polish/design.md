# Design

## Context

See proposal.md - Why. 涉及两处现有 UI 组件的定点改动，无新依赖、无数据模型变更、无跨模块协调。`needs_admin` 字段已经贯通 DB → IPC → launcher，本次仅补全"添加时的命名"和"查看时的展示"两个 UI 层缺口。

## Goals / Non-Goals

**Goals:**
- GameForm 中 toggle 的可见文案（label + hint + 状态提示）从"以管理员身份运行"统一重命名为"提权运行"
- GameDrawer 在"启动类型"与"所属分组"之间新增 DrawerField 展示 `needs_admin` 的值，以"是 / 否"呈现

**Non-Goals:**
- 不修改 DB schema、IPC 通道、launcher 逻辑
- 不在卡片网格上新增 needs_admin 徽标（可作为独立 change）
- 不做启动时的 needs_admin toast 反馈（已有日志可观察）

## Decisions

### 决策 1：GameDrawer needs_admin 展示形式

**选择**：复用现有 DrawerField 组件，label="提权运行"，value 用 `game.needs_admin ? '是' : '否'`

**备选**：用 Badge/Toggle 组件做视觉化展示 —— 不采用，DrawerField 统一文本风格更克制，与周围字段（启动类型、所属分组）一致，Toggle 组件会显得过于交互化（抽屉是只读视图）。

**位置**：插入 line 125 (`<DrawerField label="启动类型" ...>`) 与 line 126 (`<DrawerField label="所属分组" ...>`) 之间。

### 决策 2：文案变更范围

**选择**：改 GameForm.tsx 中所有用户可见的 needs_admin 相关中文文案：
- FormRow label: `"以管理员身份运行"` → `"提权运行"`
- FormRow hint: `"启动时弹出 UAC 提权框..."` → `"以管理员权限启动游戏，适用于反作弊 / Program Files 下的程序"`
- 状态提示: `'启动时弹出 UAC 以管理员权限运行'` → `'以管理员权限启动'`，`'普通用户权限启动'` → `'普通权限启动'`
- 注释 `{/* 以管理员身份运行 */}` → `{/* 提权运行 toggle */}`

**不改**：变量名 `needs_admin`、DB 列名、IPC 字段、launcher.ts 中的内部命名 —— 这些是系统契约/英文标识符，改动收益低且引入风险。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| DrawerField 只接受 string value，boolean→string 转换在调用处做 | 用 `game.needs_admin ? '是' : '否'` 内联，无需改 DrawerField 签名 |
| GameForm 同时服务"添加"和"编辑"两个模式，需验证编辑已有 needs_admin=1 的游戏时 toggle 回显正确 | 现有 form 初始化已正确映射 `!!editing.needs_admin`，文案改动不影响回显逻辑 |

**无迁移风险**：纯 UI 层改动，无数据迁移、无 breaking change。
