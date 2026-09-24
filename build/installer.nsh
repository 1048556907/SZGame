; ========================================================================
; SZGame — 自定义 NSIS 脚本
; 保护便携模式下的 data/ 目录（szgame.db 所在位置）
;
; electron-builder 通过 nsis.include 引用本文件
; 可用宏: customRemoveFiles  (升级时删旧文件前调用)
;        customInstall        (安装完新文件后调用)
;
; 注意: !define 是编译时文本替换, 不能含运行时变量 ($TEMP, $INSTDIR)
;       $ 开头的变量必须在宏内部直接写
; ========================================================================

; ------------------------------------------------------------------------
; customRemoveFiles — 升级覆盖安装时
;   在默认 NSIS 脚本清理旧文件之前调用
;   把 $INSTDIR/data/ 搬到 $TEMP\SZGame-data-backup\data\
; ------------------------------------------------------------------------
!macro customRemoveFiles
  ; 如果 data 目录存在 → 备份走
  IfFileExists "$INSTDIR\data\*.*" 0 +3
    RMDir /r "$TEMP\SZGame-data-backup"
    CopyFiles /SILENT "$INSTDIR\data\*.*" "$TEMP\SZGame-data-backup\data\"
    RMDir /r "$INSTDIR\data"
  ; data 不存在 → 跳过 (首次安装)
!macroend

; ------------------------------------------------------------------------
; customInstall — 升级覆盖安装时
;   在默认 NSIS 脚本安装完新文件之后调用
;   把备份从 $TEMP 恢复回 $INSTDIR\data\
; ------------------------------------------------------------------------
!macro customInstall
  IfFileExists "$TEMP\SZGame-data-backup\data\*.*" 0 +4
    RMDir /r "$INSTDIR\data"
    CopyFiles /SILENT "$TEMP\SZGame-data-backup\data\*.*" "$INSTDIR\data\"
    RMDir /r "$TEMP\SZGame-data-backup"
  ; 备份不存在 → 跳过 (首次安装, 没 data 要恢复)
!macroend
