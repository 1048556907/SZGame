# Tasks: fix-rounded-corners

## TG1 — 窗口圆角修复

### T1.1: 从 main.ts 删除 backgroundColor
- 删除 `backgroundColor: '#0d1219'`
- 让 transparent:true 默认透明，DWM 圆角透出来

### T1.2: html/body/#root 加裁剪链
- `border-radius: 12px; overflow: hidden; background: transparent`

### T1.3: .app 加实色背景
- 加 `background: var(--surface-0);`（之前漏了导致透桌面）

## TG2 — 滚动条圆角修复

### T2.1: 换成朴素方案
- track `background: rgba(255,255,255,0.04); border-radius: 5px`
- thumb `background: rgba(255,255,255,0.18); border-radius: 5px`
- 去掉 transparent border + background-clip hack
