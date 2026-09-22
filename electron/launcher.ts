/**
 * SZGame — 启动器
 *
 * 根据 launch_type 分发到不同的执行方式
 * - EXE:  防重复启动（按可执行文件名检测）+ 启动后回调主进程最小化
 * - 脚本: 直接启动
 * - URL:  shell.openExternal
 */
import { spawn, exec, execSync } from 'node:child_process'
import { shell } from 'electron'
import path from 'node:path'

export interface LaunchResult {
  success: boolean
  message?: string
  /** exe 类型：进程是否已在运行（防重复启动检测结果）*/
  alreadyRunning?: boolean
}

/** 运行中进程缓存 —— 避免频繁 tasklist 调用 */
let cachedProcessList: Set<string> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 1500 // 1.5 秒

/** 获取当前所有运行中的进程名（Windows 用 tasklist）*/
function getRunningProcesses(): Set<string> {
  const now = Date.now()
  if (cachedProcessList && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProcessList
  }
  try {
    const output = execSync('tasklist /FO CSV /NH', {
      encoding: 'utf-8',
      windowsHide: true,
      timeout: 2000
    })
    const names = new Set<string>()
    for (const line of output.split(/\r?\n/)) {
      // CSV: "Image Name","PID","Session Name","Session#","Mem Usage"
      const m = line.match(/^"([^"]+)"\s*,/)
      if (m) names.add(m[1].toLowerCase())
    }
    cachedProcessList = names
    cacheTimestamp = now
    return names
  } catch {
    return new Set()
  }
}

/** 清除进程缓存（launch 成功后刷新）*/
function invalidateProcessCache() {
  cachedProcessList = null
  cacheTimestamp = 0
}

/** 按可执行文件名检测进程是否已运行 */
export function isProcessRunning(exePath: string): boolean {
  const name = path.basename(exePath).toLowerCase()
  const running = getRunningProcesses()
  return running.has(name)
}

export function launch(
  launchType: 'exe' | 'bat' | 'url',
  launchPath: string,
  launchArgs?: string
): LaunchResult {
  try {
    switch (launchType) {
      case 'exe': {
        // 防重复启动检测
        const name = path.basename(launchPath)
        if (isProcessRunning(launchPath)) {
          return {
            success: false,
            message: `游戏「${name}」已在运行中，请勿重复启动`,
            alreadyRunning: true
          }
        }
        const args = launchArgs ? splitArgs(launchArgs) : []
        spawn(launchPath, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        }).unref()
        // 启动后刷新进程缓存（让下一次检测生效）
        invalidateProcessCache()
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
