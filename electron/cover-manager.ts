/**
 * SZGame — 封面图管理器
 *
 * 负责把用户选择的封面图复制到 userDataDir/covers/ 目录
 * 并返回相对路径（DB 中存储这个相对路径）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

let coversDir: string = ''

export function initCoverManager(userDataDir: string): void {
  coversDir = path.join(userDataDir, 'covers')
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true })
  }
}

/**
 * 将源文件复制到 userDataDir/<subDir>/ 目录，返回相对路径
 * @param sourcePath 源文件绝对路径
 * @param subDir 子目录名，默认 'covers'。图标用 'group-icons'
 */
export function saveFromPath(sourcePath: string, subDir: string = 'covers'): { relativePath: string } {
  const rootDir = path.dirname(coversDir) // userDataDir
  const targetDir = path.join(rootDir, subDir)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  const ext = path.extname(sourcePath) || '.png'
  const hash = crypto.randomBytes(8).toString('hex')
  const filename = `${hash}${ext}`
  const destPath = path.join(targetDir, filename)

  fs.copyFileSync(sourcePath, destPath)

  // 用正斜杠存相对路径，跨平台友好
  return { relativePath: `${subDir}/${filename}` }
}

/**
 * 获取封面的绝对路径
 */
export function resolveCoverPath(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null
  const absolute = path.join(path.dirname(coversDir), relativePath)
  return fs.existsSync(absolute) ? absolute : null
}

/**
 * 删除封面文件（游戏删除时清理）
 */
export function deleteCover(relativePath: string | null | undefined): void {
  if (!relativePath) return
  const absolute = path.join(path.dirname(coversDir), relativePath)
  if (fs.existsSync(absolute)) {
    try { fs.unlinkSync(absolute) } catch { /* 忽略：可能已被手动删除 */ }
  }
}
