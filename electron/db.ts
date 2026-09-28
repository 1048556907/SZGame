/**
 * SZGame — 数据库模块（基于 sql.js）
 *
 * sql.js 是 SQLite 的 WASM 移植，不需要 node-gyp 编译。
 * 初始化流程：
 *   1. 从 node_modules/sql.js/dist/sql-wasm.wasm 加载 WASM
 *   2. 如果磁盘上有 .db 文件，读入 ArrayBuffer → new SQL.Database(data)
 *      如果没有，new SQL.Database() 创建空库
 *   3. 每次写操作后 fs.writeFileSync 回写到磁盘
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import fs from 'node:fs'
import path from 'node:path'

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let dbPath: string = ''

// ============================================================
// Schema & Seeds
// ============================================================

/** 当前 DB schema 版本 —— 每次加新列/改表升级这个数字 */
const SCHEMA_VERSION = 3

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon_image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  launch_path TEXT NOT NULL,
  launch_type TEXT NOT NULL CHECK(launch_type IN ('exe','bat','url')),
  launch_args TEXT,
  cover_image TEXT,
  needs_admin INTEGER NOT NULL DEFAULT 0,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  global_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

// 历史种子数据 —— 彻底删除（每次启动不插入任何示例游戏）
// 保留原 groups/settings 默认值写入逻辑（用户配置初始化）
const DEFAULT_SETTINGS_SQL = `
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('window.minimize.behavior', 'tray'),
  ('window.close.behavior', 'minimize-to-tray'),
  ('app.update.auto.check', 'true'),
  ('app.update.force', 'false');
`

// 首次启动时插入默认收藏夹（可修改/删除）
const DEFAULT_GROUPS = [
  { name: '角色扮演', sort_order: 0 },
  { name: '动作冒险', sort_order: 1 },
  { name: '休闲益智', sort_order: 2 },
  { name: '枪战射击', sort_order: 3 },
  { name: '模拟经营', sort_order: 4 },
  { name: '辅助工具', sort_order: 5 },
]

function ensureDefaultGroups(): void {
  const existing = getDB().exec('SELECT name FROM groups')
  const existingNames = new Set((existing[0]?.values ?? []).map((r: any[]) => r[0] as string))
  let insertOrder = existingNames.size
  for (const g of DEFAULT_GROUPS) {
    if (!existingNames.has(g.name)) {
      getDB().run(
        'INSERT INTO groups (name, icon_image, sort_order) VALUES (?, NULL, ?)',
        [g.name, insertOrder++]
      )
      console.info(`[db] ensureDefaultGroups: inserted "${g.name}"`)
    }
  }
}

// ============================================================
// Initialize
// ============================================================
export async function initDatabase(userDataDir: string): Promise<void> {
  dbPath = path.join(userDataDir, 'szgame.db')

  // 找到 WASM 文件 —— sql.js 包内自带
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')
  const wasmBinary = fs.readFileSync(wasmPath)

  SQL = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer })

  // 加载已有 DB 或创建新库
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath)
    db = new SQL.Database(data)
  } else {
    db = new SQL.Database()
  }

  // 建表（幂等）
  db.run(SCHEMA_SQL)

  // 写入默认 settings 配置（窗口行为等）
  db.run(DEFAULT_SETTINGS_SQL)

  // 插入默认收藏夹（角色扮演/动作冒险/休闲益智/枪战射击/模拟经营/辅助工具）
  // —— 仅首次启动执行一次，已存在的不会重复
  const groupsInitialized = getSetting('db.groups.initialized')
  if (!groupsInitialized) {
    ensureDefaultGroups()
    db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('db.groups.initialized', '1')")
  }

  // ── Schema version 集中迁移 ──
  const version = Number(getSetting('db.schema.version') ?? '1')
  if (version < SCHEMA_VERSION) {
    runMigrations(version, SCHEMA_VERSION)
    setSetting('db.schema.version', String(SCHEMA_VERSION))
  }

  // 首次启动回写
  save()

  console.log('[db] initialized at', dbPath)
}

/** 持久化到磁盘 —— 每次写操作后调用 */
function save() {
  if (!db) return
  const data = db.export() as unknown as ArrayBuffer
  fs.writeFileSync(dbPath, Buffer.from(data))
}

/** 获取 DB 实例（内部用） */
function getDB(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase first.')
  return db
}

/** 迁移辅助：检查并补齐缺失列 */
function ensureColumn(table: string, col: string, colType: string) {
  const result = getDB().exec(`PRAGMA table_info(${table})`)
  if (result.length === 0) return
  const cols = result[0].values.map((r: any[]) => r[1])
  if (!cols.includes(col)) {
    getDB().run(`ALTER TABLE ${table} ADD COLUMN ${col} ${colType}`)
    console.log(`[db] migrated: added ${col} to ${table}`)
  }
}

/** 集中式 schema 迁移 —— 按版本号递增执行 */
function runMigrations(fromVersion: number, toVersion: number) {
  console.log(`[db] runMigrations ${fromVersion} → ${toVersion}`)
  if (fromVersion < 2) {
    // v1 → v2：给旧 DB 补齐 icon_image + needs_admin 列
    ensureColumn('groups', 'icon_image', 'TEXT')
    ensureColumn('games', 'needs_admin', 'INTEGER NOT NULL DEFAULT 0')
  }
  if (fromVersion < 3) {
    // v2 → v3：新增 global_order（全部视图独立排序字段）
    ensureColumn('games', 'global_order', 'INTEGER NOT NULL DEFAULT 0')
    // 回填：让现有游戏的 global_order = 按 id 递增（首次"全部"视图排序 fallback 到 created_at）
    getDB().run('UPDATE games SET global_order = id')
    console.log('[db] migrated: games.global_order backfilled from id')
  }
}

// ============================================================
// Groups
// ============================================================
export interface GroupRow {
  id: number
  name: string
  icon_image: string | null
  sort_order: number
  created_at: string
  game_count?: number
}

export function listGroups(): GroupRow[] {
  const stmt = getDB().prepare(`
    SELECT g.*, COUNT(ga.id) as game_count
    FROM groups g
    LEFT JOIN games ga ON ga.group_id = g.id
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.id ASC
  `)
  const rows: GroupRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as GroupRow)
  stmt.free()
  return rows
}

export function createGroup(name: string, iconImage: string | null = null): number {
  const maxOrder = getDB().exec('SELECT COALESCE(MAX(sort_order), -1) FROM groups')[0]?.values[0][0] ?? -1
  getDB().run('INSERT INTO groups (name, icon_image, sort_order) VALUES (?, ?, ?)', [name, iconImage, (maxOrder as number) + 1])
  save()
  return getDB().exec('SELECT last_insert_rowid()')[0].values[0][0] as number
}

export function updateGroup(id: number, name: string, iconImage: string | null): void {
  getDB().run('UPDATE groups SET name = ?, icon_image = ? WHERE id = ?', [name, iconImage, id])
  save()
}

export function renameGroup(id: number, name: string): void {
  getDB().run('UPDATE groups SET name = ? WHERE id = ?', [name, id])
  save()
}

export function deleteGroup(id: number): void {
  // 先把关联的游戏迁移到无分组（group_id = NULL）
  getDB().run('UPDATE games SET group_id = NULL WHERE group_id = ?', [id])
  getDB().run('DELETE FROM groups WHERE id = ?', [id])
  save()
}

export function reorderGroups(items: { id: number; sort_order: number }[]): void {
  const stmt = getDB().prepare('UPDATE groups SET sort_order = ? WHERE id = ?')
  getDB().run('BEGIN')
  for (const it of items) stmt.run([it.sort_order, it.id])
  getDB().run('COMMIT')
  stmt.free()
  save()
}

// ============================================================
// Games
// ============================================================
export interface GameRow {
  id: number
  name: string
  launch_path: string
  launch_type: 'exe' | 'bat' | 'url'
  launch_args: string | null
  cover_image: string | null
  needs_admin: number
  group_id: number | null
  sort_order: number
  global_order: number
  created_at: string
  updated_at: string
}

export interface GameCreateInput {
  name: string
  launch_path: string
  launch_type: 'exe' | 'bat' | 'url'
  launch_args?: string
  cover_image?: string | null
  needs_admin?: boolean
  group_id: number | null
}

export function listGames(opts?: {
  groupId?: number | null
  search?: string
  sortBy?: 'per-group' | 'global'
}): GameRow[] {
  const clauses: string[] = []
  const params: any[] = []

  if (opts?.groupId !== undefined && opts.groupId !== null) {
    clauses.push('group_id = ?')
    params.push(opts.groupId)
  }
  if (opts?.search) {
    clauses.push('LOWER(name) LIKE ?')
    params.push(`%${opts.search.toLowerCase()}%`)
  }

  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
  // 全部视图用 global_order，具体分组视图用 sort_order
  const orderBy = opts?.sortBy === 'global'
    ? 'ORDER BY global_order ASC, id ASC'
    : 'ORDER BY sort_order ASC, id ASC'
  const sql = `SELECT * FROM games ${where} ${orderBy}`
  const stmt = getDB().prepare(sql)
  params.forEach(p => stmt.bind([p]))
  const rows: GameRow[] = []
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as GameRow)
  stmt.free()
  return rows
}

export function createGame(input: GameCreateInput): number {
  const { name, launch_path, launch_type, launch_args = '', cover_image = null, needs_admin = false, group_id } = input
  getDB().run(
    `INSERT INTO games (name, launch_path, launch_type, launch_args, cover_image, needs_admin, group_id, sort_order, global_order)
     VALUES (?, ?, ?, ?, ?, ?, ?,
       (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM games WHERE group_id = ?),
       (SELECT COALESCE(MAX(global_order), -1) + 1 FROM games))`,
    [name, launch_path, launch_type, launch_args, cover_image, needs_admin ? 1 : 0, group_id, group_id]
  )
  save()
  return getDB().exec('SELECT last_insert_rowid()')[0].values[0][0] as number
}

export function updateGame(id: number, input: Partial<GameCreateInput>): void {
  const sets: string[] = []
  const params: any[] = []
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) {
      sets.push(`${k} = ?`)
      params.push(v)
    }
  }
  if (!sets.length) return
  sets.push("updated_at = datetime('now')")
  params.push(id)
  getDB().run(`UPDATE games SET ${sets.join(', ')} WHERE id = ?`, params)
  save()
}

export function deleteGame(id: number): GameRow | null {
  const stmt = getDB().prepare('SELECT * FROM games WHERE id = ?')
  stmt.bind([id])
  const found = stmt.step() ? (stmt.getAsObject() as unknown as GameRow) : null
  stmt.free()
  getDB().run('DELETE FROM games WHERE id = ?', [id])
  save()
  return found
}

/**
 * 重排序游戏 —— 支持 per-group 和 global 两种模式
 * @param mode 'per-group' → 更新 sort_order；'global' → 更新 global_order
 */
export function reorderGames(
  mode: 'per-group' | 'global',
  items: { id: number; order: number }[]
): void {
  const col = mode === 'global' ? 'global_order' : 'sort_order'
  const stmt = getDB().prepare(`UPDATE games SET ${col} = ? WHERE id = ?`)
  getDB().run('BEGIN')
  for (const it of items) stmt.run([it.order, it.id])
  getDB().run('COMMIT')
  stmt.free()
  save()
}

export function getGame(id: number): GameRow | null {
  const stmt = getDB().prepare('SELECT * FROM games WHERE id = ?')
  stmt.bind([id])
  const found = stmt.step() ? (stmt.getAsObject() as unknown as GameRow) : null
  stmt.free()
  return found
}

// ============================================================
// Settings
// ============================================================
export function getSetting(key: string): string | null {
  const stmt = getDB().prepare('SELECT value FROM settings WHERE key = ?')
  stmt.bind([key])
  const val = stmt.step() ? (stmt.getAsObject() as any).value : null
  stmt.free()
  return val == null ? null : String(val)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDB().exec('SELECT key, value FROM settings')
  const obj: Record<string, string> = {}
  for (const row of rows[0]?.values ?? []) {
    obj[row[0] as string] = row[1] as string
  }
  return obj
}

export function setSetting(key: string, value: string): void {
  getDB().run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value])
  save()
}
