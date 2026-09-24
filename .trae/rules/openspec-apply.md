# .trae/rules/openspec-apply.md
## 核心红线（最高优先级）
无论修改多么微小（包括改一个变量名、修一个 typo、加一行日志），都必须严格遵循 OpenSpec 工作流：
1. 必须先执行 /opsx:propose 或 /opsx:new 创建变更
2. 必须生成 proposal.md、specs/、design.md、tasks.md 四个制品
3. 必须经人工审查确认提案后，才能执行 /opsx:apply
4. 必须执行 /opsx:verify 验证实现与规范的一致性
5. 最后执行 /opsx:archive 归档

禁止任何形式的“直接修改代码”行为。无提案，不编码。