# Tasks

## 1. 新增 NSIS 保护脚本

- [x] 1.1 创建 `build/installer.nsh`：定义 `customRemoveFiles` 宏——在默认清旧文件前，把 `$INSTDIR/data/` 备份到 `$TEMP\SZGame-data-backup\data\`
- [x] 1.2 同文件：定义 `customInstall` 宏——默认安装完新文件后，把备份从 `$TEMP` 恢复回 `$INSTDIR/data/`

## 2. 配置 electron-builder 引用自定义脚本

- [x] 2.1 修改 `package.json` 的 `build.nsis`：增加 `"include": "build/installer.nsh"`

## 3. 验证

- [x] 3.1 `npm run build` 验证 NSIS 脚本能正确编译（无 makensis 错误）
- [x] 3.2 安装当前版本 → 手动在 `$INSTDIR/data/` 放一个测试文件 → 重新安装（覆盖）→ 验证 data/ 和测试文件仍存在
