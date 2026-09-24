/**
 * SZGame — 自动更新模块
 *
 * 零新依赖：使用 Node 原生 https + fs + os + child_process。
 * 发布源：Gitee Releases API —— https://gitee.com/api/v5/repos/sinszer/SZGame/releases
 * 安装器：NSIS .exe，静默安装参数 /S
 */

import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'node:child_process'
import type { BrowserWindow } from 'electron'

// —— 配置常量 ——
const GITEE_API_BASE = 'https://gitee.com/api/v5/repos/sinszer/SZGame/releases'
const OWNER = 'sinszer'
const REPO = 'SZGame'
const ASSET_NAME_PREFIX = 'SZGame Setup '   // 构建产物名前缀

// —— semver 比较 ——

/**
 * 比较两个语义化版本字符串（major.minor.patch）。
 * 返回 -1 (a < b), 0 (a == b), 1 (a > b)。
 * 容忍 tag_name 中的 'v' 前缀，如 'v0.1.1'。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').trim().split('.').map(s => parseInt(s, 10) || 0)
  const pb = b.replace(/^v/, '').trim().split('.').map(s => parseInt(s, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na < nb) return -1
    if (na > nb) return 1
  }
  return 0
}

// —— Gitee Releases API ——

interface GiteeAsset {
  name: string
  browser_download_url: string
}

interface GiteeRelease {
  tag_name: string
  prerelease: boolean
  assets: GiteeAsset[]
}

/** GET /repos/{owner}/{repo}/releases  */
export function fetchReleasesFromGitee(): Promise<GiteeRelease[]> {
  return new Promise((resolve, reject) => {
    const url = `${GITEE_API_BASE}?owner=${encodeURIComponent(OWNER)}&repo=${encodeURIComponent(REPO)}&page=1&per_page=30`
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Gitee API returned ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
          resolve(json as GiteeRelease[])
        } catch (e) {
          reject(new Error(`Gitee API JSON parse failed: ${e}`))
        }
      })
    }).on('error', reject)
  })
}

/**
 * 从 releases 列表中找 semver 最高的稳定版 tag，
 * 并返回其 .exe asset 的下载 URL。
 * 若无 .exe asset，返回 null。
 */
export function findLatestSemverTag(releases: GiteeRelease[]): { tag: string; exeUrl: string } | null {
  let best: { tag: string; exeUrl: string } | null = null

  for (const rel of releases) {
    if (rel.prerelease) continue

    // 找 .exe asset
    const exeAsset = rel.assets.find(a =>
      a.name.toLowerCase().endsWith('.exe')
    )
    if (!exeAsset) continue

    const tag = rel.tag_name.replace(/^v/, '').trim()
    if (!tag) continue

    if (!best || compareVersions(tag, best.tag) > 0) {
      best = { tag, exeUrl: exeAsset.browser_download_url }
    }
  }

  return best
}

// —— 版本检测 ——

export interface CheckResult {
  hasUpdate: boolean
  remoteTag?: string
  localVersion: string
  exeUrl?: string
}

/** 完整检查流程：fetch → findLatest → compare */
export async function checkForUpdate(localVersion: string): Promise<CheckResult> {
  let releases: GiteeRelease[]
  try {
    releases = await fetchReleasesFromGitee()
  } catch (e) {
    console.warn('[updater] fetchReleases failed:', (e as Error).message)
    return { hasUpdate: false, localVersion }
  }

  const latest = findLatestSemverTag(releases)
  if (!latest) {
    console.info('[updater] no .exe asset found in any release')
    return { hasUpdate: false, localVersion }
  }

  const cmp = compareVersions(latest.tag, localVersion.replace(/^v/, ''))
  if (cmp <= 0) {
    console.info(`[updater] local ${localVersion} >= remote ${latest.tag}, no update`)
    return { hasUpdate: false, localVersion }
  }

  console.info(`[updater] new version available: ${latest.tag} > ${localVersion}`)
  return { hasUpdate: true, remoteTag: latest.tag, localVersion, exeUrl: latest.exeUrl }
}

// —— 下载 ——

export interface DownloadResult {
  dest: string
  bytes: number
  total: number
}

/**
 * 带重定向跟随的下载函数。
 * Gitee browser_download_url 返回 302 → CDN，需要手动跟随。
 */
function downloadFollowRedirect(
  url: string,
  dest: string,
  onProgress?: (bytes: number, total: number) => void,
  depth = 0
): Promise<DownloadResult> {
  if (depth > 5) return Promise.reject(new Error('Too many redirects'))
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const code = res.statusCode ?? 0

      // 跟随重定向
      if (code >= 300 && code < 400 && res.headers.location) {
        const loc = res.headers.location
        console.info(`[updater] redirect ${code} → ${loc}`)
        // 销毁当前 socket，递归跟随
        res.resume()
        req.destroy()
        downloadFollowRedirect(loc, dest, onProgress, depth + 1).then(resolve, reject)
        return
      }

      if (code >= 400) {
        reject(new Error(`Download failed: HTTP ${code}`))
        return
      }

      const total = parseInt(res.headers['content-length'] || '0', 10) || 0
      let bytes = 0
      const writeStream = fs.createWriteStream(dest)

      res.on('data', (chunk) => {
        bytes += chunk.length
        onProgress?.(bytes, total)
      })

      res.on('end', () => {
        writeStream.end(() => {
          const stat = fs.statSync(dest)
          if (total > 0 && stat.size !== total) {
            reject(new Error(`Download size mismatch: expected ${total}, got ${stat.size}`))
            return
          }
          resolve({ dest, bytes: stat.size, total })
        })
      })

      res.on('error', (err) => { writeStream.destroy(); reject(err) })
      res.pipe(writeStream)
      writeStream.on('error', reject)
    })

    req.on('error', reject)
  })
}

export function download(
  url: string,
  dest: string,
  onProgress?: (bytes: number, total: number) => void
): Promise<DownloadResult> {
  console.info(`[updater] download start: ${url}`)
  return downloadFollowRedirect(url, dest, onProgress)
}

// —— 安装 ——

/**
 * 静默安装 NSIS .exe（/S 参数）。
 * 返回 spawn 进程句柄（不等待完成 —— 调用方应先 app.quit() 让安装程序接管）。
 */
export function install(exePath: string) {
  console.info(`[updater] spawn NSIS installer: ${exePath}`)
  const child = spawn(exePath, ['/S'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  })
  child.unref()
  return child
}

// —— 主流程 ——

import { getSetting } from './db'
import { app } from 'electron'

/**
 * 启动时自动更新入口。
 * 仅在 packaged 模式 + auto.check 开启时执行。
 */
export async function startAutoUpdateFlow(mainWindow: BrowserWindow | null): Promise<void> {
  if (!app.isPackaged) return

  const autoCheck = getSetting('app.update.auto.check')
  if (autoCheck === 'false') {
    console.info('[updater] auto check disabled by setting')
    return
  }

  // 读取本地版本（app.getAppPath() 在 dev 和 packaged 模式下都能正确返回 package.json 所在目录）
  let localVersion = '0.0.0'
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    localVersion = pkg.version || '0.0.0'
    console.info(`[updater] local version: ${localVersion}`)
  } catch (e) {
    console.warn('[updater] failed to read local version:', e)
  }

  const result = await checkForUpdate(localVersion)
  console.info(`[updater] check result: hasUpdate=${result.hasUpdate}, remoteTag=${result.remoteTag ?? 'null'}`)
  if (!result.hasUpdate || !result.remoteTag || !result.exeUrl) return

  const force = getSetting('app.update.force') === 'true'

  if (force) {
    // —— 强制更新：全自动下载 + 静默安装 ——
    console.info('[updater] force update enabled, starting download silently')
    await triggerUpdateChain(result.remoteTag, result.exeUrl, mainWindow)
  } else {
    // —— 非强制：通知渲染进程弹窗 ——
    mainWindow?.webContents.send('update:available', { remoteTag: result.remoteTag })
  }
}

/**
 * 从 Renderer 手动触发（点"立即更新"或"强制更新"）：下载 → 安装 → quit
 */
export async function triggerUpdateChain(
  remoteTag: string,
  exeUrl: string,
  mainWindow: BrowserWindow | null
): Promise<void> {
  const dest = path.join(os.tmpdir(), `SZGame-${remoteTag}.exe`)

  try {
    // 下载（带进度推送给 Renderer）
    await download(exeUrl, dest, (bytes, total) => {
      mainWindow?.webContents.send('update:progress', { bytes, total })
    })

    // 通知即将退出
    mainWindow?.webContents.send('update:installed', { exePath: dest })

    // 启动 NSIS 静默安装
    install(dest)

    // 给 spawn 留一点时间注册进程，然后退出
    setTimeout(() => {
      app.isQuiting = true
      app.quit()
    }, 500)
  } catch (err) {
    console.error('[updater] download/install failed:', err)
    // 清理临时文件
    try { if (fs.existsSync(dest)) fs.unlinkSync(dest) } catch {}
    mainWindow?.webContents.send('update:install-failed', { error: (err as Error).message })
  }
}
