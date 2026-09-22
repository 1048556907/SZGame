/**
 * SZGame — 启动器
 *
 * 根据 launch_type 分发到不同的执行方式
 */
import { spawn, exec } from 'node:child_process'
import { shell } from 'electron'
import path from 'node:path'

export interface LaunchResult {
  success: boolean
  message?: string
}

export function launch(
  launchType: 'exe' | 'bat' | 'url',
  launchPath: string,
  launchArgs?: string
): LaunchResult {
  try {
    switch (launchType) {
      case 'exe': {
        const args = launchArgs ? splitArgs(launchArgs) : []
        // spawn 自动处理 Windows 路径中的空格
        spawn(launchPath, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        }).unref()
        return { success: true }
      }
      case 'bat': {
        const args = ['/c', launchPath]
        if (launchArgs) args.push(...splitArgs(launchArgs))
        spawn('cmd.exe', args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        }).unref()
        return { success: true }
      }
      case 'url': {
        shell.openExternal(launchPath)
        return { success: true }
      }
      default:
        return { success: false, message: `未知的启动类型: ${launchType}` }
    }
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) }
  }
}

/** 简单的命令行参数分割（支持双引号包裹） */
function splitArgs(args: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ' ' && !inQuote) {
      if (current) result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) result.push(current)
  return result
}
