# Spec Delta

## MODIFIED Requirements

### Requirement: 游戏卡片拖拽排序
系统 SHALL 允许用户在同一分组内通过拖拽调整卡片顺序，排序结果 SHALL 持久化保存。拖拽过程和结束 SHALL 提供**零闪烁的平滑过渡体验**：UI 立即响应（乐观更新）、动画流畅无硬切、松手后回弹自然。

#### Scenario: 分组内拖拽排序
- **WHEN** 用户将一张卡片拖拽到同组内另一位置并释放
- **THEN** 该卡片立即（<50ms）移动到目标位置，同组其他卡片平滑让位，整个过程无可见闪烁；刷新页面后顺序保持不变

#### Scenario: 跨分组拖拽受限
- **WHEN** 用户尝试将一张卡片从分组 A 拖拽到分组 B 的位置
- **THEN** 拖拽操作 SHALL 被拒绝或不改变归属关系（分组归属的变更应通过编辑游戏操作完成）

#### Scenario: 乐观更新无闪烁
- **WHEN** 用户释放拖拽
- **THEN** 网格 SHALL 先在本地渲染新顺序（乐观更新），然后异步写入后端；即使后端写入耗时，UI 也不得等待或冻结。写入失败时 SHALL 静默回滚到原顺序

#### Scenario: 拖拽启动平滑
- **WHEN** 用户按住卡片并开始拖拽
- **THEN** 在 PointerSensor activation 阈值（≥6px）内卡片不得位移或抖动；一旦激活，原位置卡片 SHALL 平滑淡出（opacity → 0）而非硬切

#### Scenario: 松手回弹动画
- **WHEN** 用户释放拖拽且目标位置已锁定
- **THEN** DragOverlay SHALL 播放回弹过渡（dropAnimation，时长 150–250ms，easing ease-out）而非立即消失

#### Scenario: 让位动画流畅
- **WHEN** 被拖拽卡片从位置 A 移动到位置 B，期间跨越其他卡片
- **THEN** 被跨越的卡片 SHALL 通过 CSS transition 平滑让位，时长 150–250ms，不得出现"啪"一下跳开的硬切效果
