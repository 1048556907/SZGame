# Spec Delta

## Purpose

游戏卡片的展示排序与拖拽重排——用户可通过拖拽卡片调整游戏在网格中的位置，**所有视图（全部 / 具体分组 / 搜索结果）统一按 global_order 字段排序**，分组视图自动继承"全部"视图的顺序。

## Requirements

### Requirement: 统一排序（global_order 为唯一真相源）

系统 SHALL 使用 `global_order` 作为**所有视图**（全部游戏、具体分组、搜索结果）的唯一排序键。

#### Scenario: 全部视图排序
- **WHEN** 用户打开"全部"视图
- **THEN** 所有游戏按 `global_order` 升序排列；`global_order` 相同或全部为 0 时 fallback 到 `created_at` 倒序 + `name` 拼音正序

#### Scenario: 分组视图自动继承
- **WHEN** 用户打开某个具体分组视图
- **THEN** 该分组内的游戏按 `global_order` 升序排列（与"全部"视图中这些游戏的相对顺序一致）

#### Scenario: 搜索视图
- **WHEN** 用户输入搜索关键词
- **THEN** 匹配结果按 `global_order` 升序排列（搜索态禁用拖拽）

### Requirement: 拖拽排序

系统 SHALL 允许用户在非搜索态下拖拽游戏卡片到目标位置，拖拽后 global_order 持久化到后端。

#### Scenario: 全部视图拖拽
- **WHEN** 用户在"全部"视图拖拽游戏卡片 A 到卡片 B 之后
- **THEN** 所有游戏的 global_order 被重新编号（0..N-1），A 现在排在 B 之后；刷新或切换到任何分组视图均保持新顺序

#### Scenario: 分组视图拖拽
- **WHEN** 用户在分组 X 视图拖拽游戏卡片 A 到卡片 B 之后
- **THEN** 只有分组 X 内的游戏相对位置改变，其他分组的游戏 global_order 保持不变；切到"全部"视图可看到分组 X 的游戏顺序变了，但其他分组不动

#### Scenario: 搜索态拖拽禁用
- **WHEN** 用户处于搜索态（有 debounced search query）
- **THEN** DndContext 不挂载，卡片不可拖拽

### Requirement: 拖拽视觉反馈

系统 SHALL 为拖拽中的卡片提供清晰的视觉反馈。

#### Scenario: 拖拽起始
- **WHEN** 用户开始拖拽一张卡片
- **THEN** 原位置卡片 opacity 降到 0.3，DragOverlay 显示完整卡片（scale:1.02 + 增强阴影）

#### Scenario: 拖拽中
- **WHEN** 被拖拽卡片悬停在其他卡片上方
- **THEN** 目标位置出现位移动画（dnd-kit 内置）

#### Scenario: 拖拽限制
- **WHEN** 用户将卡片拖到窗口边缘
- **THEN** DragOverlay 被 restrictToWindowEdges 限制不超出窗口

### Requirement: 数据持久化

#### Scenario: 刷新保持顺序
- **WHEN** 用户完成拖拽后关闭应用再重新打开
- **THEN** 游戏卡片按保存的 global_order 顺序展示

#### Scenario: 新增游戏自动排到末尾
- **WHEN** 用户新建一个游戏
- **THEN** 该游戏 global_order 被赋值为 `MAX(global_order) + 1`，排在所有现有游戏之后

#### Scenario: DB 迁移 v2 → v3
- **WHEN** 用户升级到包含 global_order 的版本
- **THEN** 现有游戏的 global_order 由 `ROW_NUMBER() OVER (ORDER BY group_id, sort_order, id)` 回填，保留用户已有分组内排序习惯
