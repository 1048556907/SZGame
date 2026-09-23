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

/** 构造 PowerShell Start-Process -Verb RunAs 命令并以 EncodedCommand（UTF-16 LE Base64）执行
 *  为什么用 EncodedCommand：避免内联 -Command 在中文 Windows 上被 GBK 代码页解析导致路径乱码 */
function spawnRunAs(psCmd: string): void {
  const utf16le = Buffer.from(psCmd, 'utf16le')
  const encoded = utf16le.toString('base64')
  const child = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  let stderr = ''
  child.stderr?.on('data', d => { stderr += d.toString('utf-8') })
  child.stdout?.on('data', d => { /* Start-Process 无 stdout */ })
  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`[launcher] RunAs PowerShell exit code=${code}: ${stderr || '(no stderr)'}`)
      console.error(`[launcher] Failed command: ${psCmd}`)
    }
  })
  child.on('error', (err) => {
    console.error(`[launcher] RunAs spawn error: ${err.message}`)
  })
  child.unref()
}

export function launch(
  launchType: 'exe' | 'bat' | 'url',
  launchPath: string,
  launchArgs?: string,
  needsAdmin: boolean = false
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
        if (needsAdmin) {
          // RunAs：用 PowerShell Start-Process -Verb RunAs 触发 UAC
          // 路径和参数都用 single-quoting 包裹，防止 PowerShell 解析转义
          const escapedPath = launchPath.replace(/'/g, "''")
          const psCmd = args.length
            ? `Start-Process -FilePath '${escapedPath}' -Verb RunAs -ArgumentList ${args.map(a => `'${a.replace(/'/g, "''")}'`).join(',')}`
            : `Start-Process -FilePath '${escapedPath}' -Verb RunAs`
          spawnRunAs(psCmd)
        } else {
          spawn(launchPath, args, {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
          }).unref()
        }
        invalidateProcessCache()
        return { success: true }
      }
      case 'bat': {
        if (needsAdmin) {
          const escaped = launchPath.replace(/'/g, "''")
          const psCmd = `Start-Process -FilePath 'cmd.exe' -Verb RunAs -ArgumentList '/c "${escaped}${launchArgs ? ' ' + launchArgs : ''}"'`
          spawnRunAs(psCmd)
        } else {
          const args = ['/c', launchPath]
          if (launchArgs) args.push(...splitArgs(launchArgs))
          spawn('cmd.exe', args, {
            detached: true, stdio: 'ignore', windowsHide: false
          }).unref()
        }
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
