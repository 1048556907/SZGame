/**
 * SZGame — 远程封面获取（Steam 商店方案）
 *
 * Step 1 — 搜索:
 *   GET https://store.steampowered.com/api/storesearch/?term={kw}&l=schinese&cc=CN
 *   返回: { total: number, items: [{ id, name, tiny_image, metascore, price, platforms, ... }] }
 *
 * Step 2 — 拼封面 URL（带 fallback 链）:
 *   优先: https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_hero.jpg
 *   备用: https://cdn.akamai.steamstatic.com/steam/apps/{appid}/header.jpg
 *   兜底: https://cdn.akamai.steamstatic.com/steam/apps/{appid}/capsule_616x353.jpg
 *
 * 注: store.steampowered.com 在国内直连良好，无 API Key，无速率限制
 */
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/** Steam 商店接口 item 原始类型（对齐真实 JSON） */
interface SteamStoreItem {
  type: 'app' | string
  name: string
  id: number
  price?: { currency?: string; initial?: number; final?: number }
  tiny_image?: string
  metascore?: number | string | null
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean }
  streamingvideo?: boolean
  controller_support?: string
}

export interface CoverCandidate {
  /** Steam appid */
  appid: number
  /** 游戏名（Steam 返回中文名） */
  name: string
  /** 实际采用的封面 URL（已经 fallback 链校验过存在） */
  imageUrl: string
  /** Steam 返回 tiny_image（小图缩略预览） */
  thumbUrl: string
  /** Metascore — number / 空字符串 / null 都可能 */
  score: number | null
  /** 国区最终价（分），如 26800 = ¥268 */
  priceCny: number | null
  /** 平台 */
  platforms: { windows: boolean; mac: boolean; linux: boolean }
}

export interface SearchResult {
  ok: boolean
  /** Steam total 字段（总命中数） */
  total?: number
  candidates?: CoverCandidate[]
  error?: string
}

let userDataDir: string = ''

export function initRemoteCover(dir: string): void {
  userDataDir = dir
}

// —— 底层 HTTP 工具 ——

const STEAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SZGame/0.1',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
}

/** HTTPS GET 返回文本（JSON API 用） */
function httpsGetText(url: string, timeoutMs = 25000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: STEAM_HEADERS, timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`)); return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`请求超时（${Math.round(timeoutMs/1000)}s）`)) })
  })
}

/** HTTPS GET 返回 Buffer（图片下载用，禁止 UTF-8 解码避免二进制损坏） */
function httpsGetBinary(url: string, timeoutMs = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: STEAM_HEADERS, timeout: timeoutMs }, (res) => {
      if (res.statusCode === 404) {
        // 404 单独抛出让 fallback 链接住
        res.resume()
        reject({ is404: true, message: 'HTTP 404' }); return
      }
      if (res.statusCode && res.statusCode >= 400) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}`)); return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error(`请求超时（${Math.round(timeoutMs/1000)}s）`)) })
  })
}

/** HEAD 请求探测 URL 是否存在（不下载 body，省带宽） */
function httpsHead(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http
    const req = client.request({ method: 'HEAD', url, headers: STEAM_HEADERS, timeout: timeoutMs }, (res) => {
      const code = res.statusCode ?? 0
      // 必须消费掉响应以防连接泄漏
      res.resume()
      resolve(code >= 200 && code < 400)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

// —— 封面 fallback 链 ——
// library_hero.jpg（16:9 横幅，460×215 或更大）→ header.jpg（3:4 竖版）→ capsule_616x353（通用）

function coverFallbackUrls(appid: number): string[] {
  const base = `https://cdn.akamai.steamstatic.com/steam/apps/${appid}`
  return [
    `${base}/library_hero.jpg`,
    `${base}/header.jpg`,
    `${base}/capsule_616x353.jpg`
  ]
}

/** 用 HEAD 探测候选封面哪个存在 —— 逐个尝试，返回第一个能 200 的 URL */
async function resolveCoverUrl(appid: number): Promise<string> {
  const urls = coverFallbackUrls(appid)
  for (const u of urls) {
    const ok = await httpsHead(u)
    if (ok) return u
  }
  return urls[0] // 全部 HEAD 失败也返回第一个，让用户选了再下
}

// —— 对外主 API ——

/** 搜索 Steam 商店候选游戏 */
export async function searchCovers(keyword: string): Promise<SearchResult> {
  const trimmed = keyword.trim()
  if (!trimmed) return { ok: false, error: '请输入游戏名称' }

  const encoded = encodeURIComponent(trimmed)
  const url = `https://store.steampowered.com/api/storesearch/?term=${encoded}&l=schinese&cc=CN`

  try {
    const body = await httpsGetText(url)
    const json = JSON.parse(body)

    const items: SteamStoreItem[] = Array.isArray(json.items) ? json.items : []
    if (items.length === 0) {
      return { ok: false, error: `Steam 商店未找到 "${trimmed}" 的匹配项` }
    }

    // 取前 6 条，排除 streamingvideo（视频条目）和 type !== 'app' 的
    const filtered = items
      .filter((it) => it.type === 'app' && !it.streamingvideo)
      .slice(0, 6)

    if (filtered.length === 0) {
      return { ok: false, error: `Steam 商店未找到 "${trimmed}" 的游戏条目` }
    }

    // 并行探测每条的最佳封面 URL（fallback 链）
    const coverUrls = await Promise.all(
      filtered.map((it) => resolveCoverUrl(it.id))
    )

    const candidates: CoverCandidate[] = filtered.map((it, idx) => {
      const ms = it.metascore
      const score: number | null = typeof ms === 'number' ? ms : null
      const finalPrice = it.price?.final
      const platforms = it.platforms ?? { windows: false, mac: false, linux: false }
      return {
        appid: it.id,
        name: it.name,
        imageUrl: coverUrls[idx],
        thumbUrl: it.tiny_image ?? '',
        score,
        priceCny: typeof finalPrice === 'number' && finalPrice > 0 ? finalPrice : null,
        platforms: {
          windows: !!platforms.windows,
          mac: !!platforms.mac,
          linux: !!platforms.linux
        }
      }
    })

    return { ok: true, total: typeof json.total === 'number' ? json.total : undefined, candidates }
  } catch (err: any) {
    return { ok: false, error: `Steam 商店接口错误: ${err?.message || '未知错误'}` }
  }
}

/** 把远程封面图下载到 covers/ 目录，返回相对路径 */
export async function downloadCover(
  imageUrl: string
): Promise<{ ok: boolean; relativePath?: string; error?: string }> {
  try {
    const url = new URL(imageUrl)
    const extFromPath = path.extname(url.pathname).toLowerCase()
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(extFromPath) ? extFromPath : '.jpg'

    const hash = crypto.randomBytes(8).toString('hex')
    const filename = `${hash}${ext}`

    const coversDir = path.join(userDataDir, 'covers')
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true })

    const destPath = path.join(coversDir, filename)

    // 关键：用 httpsGetBinary 拿 Buffer，直接写 binary —— 不再损坏
    const buf = await httpsGetBinary(imageUrl, 30000)
    fs.writeFileSync(destPath, buf)

    return { ok: true, relativePath: `covers/${filename}` }
  } catch (err: any) {
    return { ok: false, error: `下载失败: ${err?.message || '未知错误'}` }
  }
}
