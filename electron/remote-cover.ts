/**
 * SZGame — 远程封面获取
 *
 * 通过 Steam 商店接口（无 Key、中文友好、国内直连）搜索游戏，
 * 用 appid 拼 Steam CDN URL 拿到 library_hero.jpg 横幅封面
 * 并将选中的候选下载保存到 userDataDir/covers/
 *
 * Step 1 — 搜索:
 *   https://store.steampowered.com/api/storesearch/?term={关键词}&l=schinese&cc=CN
 *   返回: { items: [{ id, name, tiny_image, metascore, price, ... }] }
 *
 * Step 2 — 拼封面 URL:
 *   https://cdn.akamai.steamstatic.com/steam/apps/{appid}/library_hero.jpg
 */
import https from 'node:https'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface CoverCandidate {
  /** Steam appid */
  appid: number
  /** 游戏名（Steam 返回的中文名） */
  name: string
  /** 最终封面 URL（library_hero.jpg） */
  imageUrl: string
  /** Steam 搜索返回的 tiny_image（小图，作缩略预览用） */
  thumbUrl: string
  /** Metascore 评分（0-100） */
  score: number | null
  /** appid 拼的 library_hero.jpg URL */
  libraryHero: string
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

/** HTTPS GET 返回文本，超时默认 25s */
function httpsGet(url: string, timeoutMs = 25000): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SZGame/0.1',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`)); return
      }
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`请求超时（${Math.round(timeoutMs/1000)}s）`))
    })
  })
}

/** 用 Steam appid 拼 library_hero.jpg 横幅封面 URL */
function libraryHeroUrl(appid: number): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`
}

/** 搜索 Steam 商店候选游戏 — 不需要 API Key */
export async function searchCovers(keyword: string): Promise<SearchResult> {
  const trimmed = keyword.trim()
  if (!trimmed) return { ok: false, error: '请输入游戏名称' }

  const encoded = encodeURIComponent(trimmed)
  // l=schinese 中文界面 / cc=CN 国区（返回国区价）
  const url = `https://store.steampowered.com/api/storesearch/?term=${encoded}&l=schinese&cc=CN`

  try {
    const body = await httpsGet(url)
    const json = JSON.parse(body)

    const items = Array.isArray(json.items) ? json.items : []
    if (items.length === 0) {
      return { ok: false, error: `Steam 未找到 "${trimmed}" 的匹配项` }
    }

    // Steam storesearch 最多返回 10 条，取前 6 条作候选
    const candidates: CoverCandidate[] = items.slice(0, 6).map((it: any) => ({
      appid: it.id,
      name: it.name,
      thumbUrl: it.tiny_image ?? '',
      libraryHero: libraryHeroUrl(it.id),
      // 封面实际下载走 tiny_image 同域 Steam CDN 的大图
      imageUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${it.id}/library_hero.jpg`,
      score: typeof it.metascore === 'number' ? it.metascore : null
    }))

    return { ok: true, candidates }
  } catch (err: any) {
    return { ok: false, error: `Steam 商店接口错误: ${err?.message || '未知错误'}` }
  }
}

/** 把远程图片下载到 covers/ 目录，返回相对路径 */
export async function downloadCover(imageUrl: string): Promise<{ ok: boolean; relativePath?: string; error?: string }> {
  try {
    const url = new URL(imageUrl)
    // Steam CDN 返回的可能没有扩展名（或 .jpg），统一补 .jpg
    const extFromPath = path.extname(url.pathname)
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(extFromPath) ? extFromPath : '.jpg'

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
