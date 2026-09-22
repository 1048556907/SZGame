/**
 * SZGame — 远程封面获取
 *
 * 通过 RAWG API (api.rawg.io) 搜索游戏封面
 * 并将选中的候选下载保存到 userDataDir/covers/
 */
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface CoverCandidate {
  name: string
  imageUrl: string
  rating: number | null
  released: string | null
}

export interface SearchResult {
  ok: boolean
  candidates?: CoverCandidate[]
  error?: string
}

let userDataDir: string = ''

export function initRemoteCover(dir: string): void {
  userDataDir = dir
}

/** 解码可能经过 safeStorage 加密的 key（以 "enc:" 开头表示加密） */
function tryDecodeKey(raw: string | null): string | null {
  if (!raw) return null
  if (raw.startsWith('enc:')) {
    try {
      // 在 main.ts 里用 safeStorage 解过再传过来，这里不再解
      return raw.slice(4)
    } catch { return null }
  }
  return raw
}

/** HTTPS GET 到 JSON */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'SZGame/0.1 (https://gitee.com/sinszer/SZGame)'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`)); return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
  })
}

/** 搜索游戏封面候选 */
export async function searchCovers(keyword: string, apiKey: string): Promise<SearchResult> {
  const trimmed = keyword.trim()
  if (!trimmed) return { ok: false, error: '请输入游戏名称' }
  if (!apiKey) return { ok: false, error: '未配置 RAWG API Key，请先到设置中填入' }

  const encoded = encodeURIComponent(trimmed)
  const url = `https://api.rawg.io/api/games?search=${encoded}&key=${apiKey}&page_size=8&ordering=-rating`

  try {
    const body = await httpsGet(url)
    const json = JSON.parse(body)
    const results: CoverCandidate[] = (json.results || [])
      .filter((g: any) => g.background_image) // 必须有封面
      .map((g: any) => ({
        name: g.name,
        imageUrl: g.background_image,
        rating: g.rating ?? null,
        released: g.released ?? null
      }))
    if (results.length === 0) {
      return { ok: false, error: `未找到 "${trimmed}" 的封面（RAWG 对中文名支持有限，试试英文名？）` }
    }
    return { ok: true, candidates: results }
  } catch (err: any) {
    return { ok: false, error: `RAWG API 错误: ${err?.message || '未知错误'}` }
  }
}

/** 把远程图片下载到 covers/ 目录，返回相对路径 */
export async function downloadCover(imageUrl: string): Promise<{ ok: boolean; relativePath?: string; error?: string }> {
  try {
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg'
    const hash = crypto.randomBytes(8).toString('hex')
    const filename = `${hash}${ext}`

    const coversDir = path.join(userDataDir, 'covers')
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })

    const destPath = path.join(coversDir, filename)

    const body = await httpsGet(imageUrl)
    fs.writeFileSync(destPath, body, { encoding: 'binary' as any })

    return { ok: true, relativePath: `covers/${filename}` }
  } catch (err: any) {
    return { ok: false, error: `下载失败: ${err?.message || '未知错误'}` }
  }
}
