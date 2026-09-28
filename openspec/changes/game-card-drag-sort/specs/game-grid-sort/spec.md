# Spec Delta

## Purpose

游戏卡片的展示排序与拖拽重排能力——让用户可以通过拖拽卡片调整游戏在网格中的位置顺序。

## Requirements

### Requirement: 游戏卡片可拖拽排序
系统 SHALL 允许用户在游戏卡片网格中通过拖拽任意卡片到目标位置来调整展示顺序。拖拽完成后，新顺序 SHALL 立即持久化到后端，下次打开应用时保持该顺序。

#### Scenario: 同分组内拖拽调整顺序
- **WHEN** 用户在某个分组视图下按住一张游戏卡片拖拽到另一位置松开
- **THEN** 卡片列表按拖拽后的新顺序重新排列，并将新的 sort_order 数组持久化到后端

#### Scenario: 全局视图下拖拽排序
- **WHEN** 用户在"全部"视图下拖拽卡片
- **THEN** 该拖拽卡片所属分组内的排序被更新（传入 `gamesReorder(null, items)`）

#### Scenario: 拖拽后刷新保持顺序
- **WHEN** 用户完成一次拖拽排序后关闭应用再重新打开
- **THEN** 游戏卡片 SHALL 按上次保存的 sort_order 顺序展示

### Requirement: sort_order 优先级最高
系统 SHALL 优先按 `sort_order` 升序排列游戏卡片。当所有游戏的 sort_order 均为 0 或 NULL（即尚未进行过拖拽排序）时，SHALL fallback 到创建时间倒序 + 名称拼音正序的次级排序规则。

#### Scenario: 有 sort_order 数据时
- **WHEN** 当前分组下存在游戏的 sort_order 互不相同
- **THEN** 所有游戏严格按 sort_order 升序排列，忽略创建时间和名称

#### Scenario: 首次进入无 sort_order 时
- **WHEN** 当前分组下所有游戏的 sort_order 均为 0（新增游戏默认值）
- **THEN** 系统 SHALL 按创建时间倒序、名称拼音正序排列，表现与当前版本一致

#### Scenario: 混合场景（部分有 sort_order 部分为 0）
- **WHEN** 分组内已有游戏完成过拖拽排序（sort_order 有效），又新增了一个游戏（sort_order = 0）
- **THEN** 有有效 sort_order 的游戏按其值升序排在前面，新增游戏（sort_order = 0）排在最后，并在其内部按创建时间倒序

### Requirement: 拖拽视觉反馈
系统 SHALL 为拖拽中的卡片提供清晰的视觉反馈：被拖拽的卡片提升 z-index 并降低不透明度，放置目标位置 SHALL 有视觉指示。

#### Scenario: 拖拽起始反馈
- **WHEN** 用户开始按住并拖动一张卡片
- **THEN** 被拖拽的卡片 SHALL 降低 opacity 至 0.5-0.7 之间并略微放大或保持原尺寸

#### Scenario: 拖拽目标指示
- **WHEN** 被拖拽卡片悬停在另一张卡片上方
- **THEN** 目标卡片位置 SHALL 出现占位符或位移动画，明确指示松手后的落点
