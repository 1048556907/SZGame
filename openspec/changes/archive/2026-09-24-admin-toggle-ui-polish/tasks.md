# Tasks

## 1. GameForm 文案重命名

- [x] 1.1 将 GameForm.tsx 中 toggle 的 FormRow label 从 "以管理员身份运行" 改为 "提权运行"，hint 改为 "以管理员权限启动游戏，适用于反作弊 / Program Files 下的程序"，注释同步更新 — 验证：grep -n "提权运行\|以管理员" src/components/GameForm.tsx 确认只有新文案
- [x] 1.2 更新 toggle 下方的状态提示文案：'启动时弹出 UAC 以管理员权限运行' → '以管理员权限启动'，'普通用户权限启动' → '普通权限启动' — 验证：dev 模式打开游戏编辑弹窗，toggle 开/关时分别显示新状态文案

## 2. GameDrawer 新增 DrawerField

- [x] 2.1 在 GameDrawer.tsx 的"启动类型" DrawerField（line ~125）与"所属分组" DrawerField（line ~126）之间插入 `<DrawerField label="提权运行" value={game.needs_admin ? '是' : '否'} />` — 验证：dev 模式打开某游戏详情抽屉，"提权运行" 字段出现在正确位置，有 needs_admin=1 的游戏显示 "是"，其余显示 "否"

## 3. 整体验证

- [x] 3.1 启动 Electron dev，打开"添加游戏"弹窗确认 toggle label 和 hint 为新文案；编辑已有 needs_admin=1 的游戏确认 toggle 回显正确；打开详情抽屉确认新增 DrawerField 显示正确 — grep "以管理员身份运行" 返回 0 匹配，git diff --stat 确认仅改动 GameForm.tsx 和 GameDrawer.tsx
