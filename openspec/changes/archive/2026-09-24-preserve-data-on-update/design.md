# Design

## Context

See proposal.md - Why。

当前 `resolveUserDataDir()` 便携模式将数据放在 `{exeDir}/data/`（用户安装目录下的 data/ 子目录）。NSIS 覆盖安装会删除旧版本文件，卸载会 RMDir /r 整个 `$INSTDIR`——两种场景 data/ 都会被连带删除。

## Goals

- 覆盖安装（升级）时保留 `$INSTDIR/data/`
- 完全卸载时保留 `$INSTDIR/data/`（用户卸载后重新安装还能恢复数据）
- **不改动 main.ts 的数据目录逻辑**——便携模式完全保留
- 不改动 db.ts、App.tsx 等业务代码

## Non-Goals

- 不改变数据目录位置（不强制 APPDATA）
- 不做卸载时的 data 清理选项（用户卸载=数据保留，直到用户手动删）
- 不引入 custom script（完全重写 NSIS 脚本风险太高）

## Decisions

### D1: 用 `nsis.include` + 默认 `build/installer.nsh`

electron-builder 支持 `include` 选项指向 `.nsh` 文件，追加自定义宏到默认脚本。比 `script`（完全重写）侵入性小得多。

**替代方案**：完全自定义 NSIS script —— 拒绝，升级 electron-builder 时需要手动同步脚本变更，维护成本高。

**替代方案**：把 data 放 APPDATA —— 拒绝，破坏便携模式。

### D2: 升级保护 —— 覆盖 `customRemoveFiles` 宏

默认 `customRemoveFiles` 删除 `$INSTDIR` 下除 data/ 外的所有文件。覆盖这个宏，在遍历删除时跳过 `data/` 目录。

```nsis
!macro customRemoveFiles
  ; 保存 data 目录不删
  ; 默认逻辑会 RMDir /r $INSTDIR\dist, dist-electron, images 等
  ; 我们加判断: 如果路径是 data/ 就跳过
!macroend
```

但实际 electron-builder 的默认脚本里 `customRemoveFiles` 可能有默认实现。如果默认会删，我们需要先备份 data/ → 让默认删 → 恢复 data/。

**更稳健的方案**：在 `customRemoveFiles` 里先把 data/ 移到 `$TEMP\szgame-data-backup\`，等默认删除+新文件安装完后，在 `customInstall` 里移回来。

### D3: 卸载保护 —— `customUnInit` 备份 + `customUnInstall` 恢复

NSIS 默认卸载流程是 `RMDir /r "$INSTDIR"`，无法排除子目录。方案：

1. `customUnInit` — 卸载器启动时，检查 `$INSTDIR\data\` 是否存在
   - 存在 → 重命名为 `data.bak`（放在 `$INSTDIR` 外层的父目录？或者移到 `$TEMP`）
   - 我们把备份放在 `$INSTDIR\` 本身的同级可能不行，因为 RMDir /r 会连带。应该放在 `$TEMP\SZGame-backup\data\`

2. 默认卸载逻辑执行（RMDir /r "$INSTDIR"，data/ 不在里面了）

3. 卸载完成后，在 `customUnInstall` 里——等等，卸载完 $INSTDIR 都没了。所以：

   **实际上更合理的方案是**：用户点卸载后，卸载器正常走完（删 $INSTDIR），但 data 已经在 customUnInit 里搬到了 `$TEMP`。但 `$TEMP` 可能被系统清理，不是长久之计。

   **最终方案**：在 customUnInit 里，把 data 复制到 **上一级目录**（`$INSTDIR\..\SZGame-data-backup\`），这样卸载器 RMDir /r $INSTDIR 不会碰到父目录的东西。用户下次重新安装 SZGame 时，如果 `$INSTDIR\..\SZGame-data-backup\` 存在，可以在 App 启动时自动发现并搬回。

   或者更简单：**我们只保护升级场景，卸载时就 let it go**？不，升级更关键。

### 最终选定方案

实际上我觉得分两个场景处理更简洁：

**场景 1：覆盖安装（升级）—— 最关键的保护目标**
```
customRemoveFiles:
  IF $INSTDIR\data EXISTS
    COPY $INSTDIR\data → $TEMP\szgame-data-backup\data
  ENDIF
  ; 让默认删旧文件逻辑跑完
customInstall:
  IF $TEMP\szgame-data-backup\data EXISTS
    RMDir /r $INSTDIR\data   ; 万一升级时 nsiss 意外在 data/ 里写了东西
    COPY $TEMP\szgame-data-backup\data → $INSTDIR\data
    RMDir /r $TEMP\szgame-data-backup
  ENDIF
```

**场景 2：完全卸载 —— 次要保护**
```
customUnInit:
  IF $INSTDIR\data EXISTS
    ; 搬去 APPDATA，那是 Electron 标准持久化位置
    ; 这样用户重新安装（即使换目录），App 启动时 legacy 搬移逻辑会把它搬回来
    COPY $INSTDIR\data → "$APPDATA\SZGame\data"
  ENDIF
  ; 默认卸载逻辑删 $INSTDIR（data 已不在了）
```

不对，卸载后用户可能就是想删干净。让我简化：

**最终简化方案**：我们只保护升级场景（覆盖安装）。卸载场景让用户自己决定——如果用户卸载，默认行为就是删所有数据。用户卸载后重新安装相当于冷启动，可以接受。

这样设计就干净了：
- **覆盖安装（升级）**：customRemoveFiles 里先备份 data/ → 默认清旧文件 → customInstall 里恢复 data/
- **卸载**：保持默认行为，data/ 随 $INSTDIR 一起删除

## Risks / Trade-offs

- [升级保护只针对同目录覆盖] → 如果用户换目录升级，旧目录被删（但 NSIS 换目录安装实际上不会删旧目录，它只是在新目录装新版本，除非用户手动卸载旧版）
- [nsis.include 宏行为依赖 electron-builder 版本] → 升级 electron-builder 时检查默认脚本是否还调用 customRemoveFiles / customInstall
- [temp 目录备份] → 如果安装过程中安装器崩溃（比如被杀进程），data 还在 $TEMP 里。下一次升级时 customRemoveFiles 会检测不到 $TEMP\szgame-data-backup 里有遗留数据吗？需要加清理逻辑

## Migration Plan

1. 在 `build/` 目录创建 `installer.nsh`
2. 在 `package.json` 的 `build.nsis` 里加 `"include": "build/installer.nsh"`
3. 本地 `npm run build` 验证
4. 打包安装一个版本 → 放 data → 再装新版本 → 验证 data/ 还在
