import { useState, useMemo } from 'react'
import type { Game, Group } from '../types'
import { useDebounced } from '../hooks/useDebounced'

interface GameGridProps {
  games: Game[]
  groups: Group[]
  currentGroup: number | 'all'
  searchQuery: string
  onOpenGame: (g: Game) => void
  onLaunch: (id: number) => void
  onAddGame: () => void
}

/** 中文 + 英文混合排序：按名称拼音首字母正序 */
const nameCollator = new Intl.Collator('zh-CN', {
  sensitivity: 'base',
  usage: 'sort',
  numeric: true
})

/** 卡片网格（按创建时间倒序 + 名称拼音正序） */
export default function GameGrid({
  games, currentGroup, searchQuery, groups,
  onOpenGame, onLaunch, onAddGame
}: GameGridProps) {

  // debounced 搜索值（Sidebar 的 onChange 是即时的，这里延迟 300ms）
  const debouncedSearch = useDebounced(searchQuery, 300)

  const sortedList = useMemo(() => {
    let list = [...games]
    if (currentGroup !== 'all') list = list.filter(g => g.group_id === currentGroup)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }
    // 排序规则：
    // 1. 创建时间倒序（最新添加在前）
    // 2. 名称拼音首字母正序
    list.sort((a, b) => {
      const timeCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '')
      if (timeCmp !== 0) return timeCmp
      return nameCollator.compare(a.name, b.name)
    })
    return list
  }, [games, currentGroup, debouncedSearch])

  const groupName = currentGroup === 'all'
    ? '全部游戏'
    : groups.find(gr => gr.id === currentGroup)?.name ?? '未知分组'

  const title = debouncedSearch ? `搜索：${debouncedSearch}` : groupName
  const searchActive = !!debouncedSearch.trim()

  return (
    <div className="content-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <div className="page-subtitle">共 {sortedList.length} 款游戏</div>
        </div>
        {!searchActive && (
          <button onClick={onAddGame} style={addBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
            ＋ 添加游戏
          </button>
        )}
      </div>

      {sortedList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)', fontSize: 14 }}>
          {searchActive ? '未找到匹配的游戏' : '该分组下暂无游戏'}
        </div>
      ) : (
        <div style={gridStyle}>
          {sortedList.map(g => (
            <GameCard key={g.id} game={g} onOpen={() => onOpenGame(g)} onLaunch={() => onLaunch(g.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 20
}

const addBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', borderRadius: 8, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'background 0.15s',
  display: 'flex', alignItems: 'center', gap: 6
}

// ============================================================
// 游戏卡片
// ============================================================
function GameCard({ game, onOpen, onLaunch }: {
  game: Game; onOpen: () => void; onLaunch: () => void
}) {
  const [hover, setHover] = useState(false)
  const coverUrl = game.cover_image ? `szgame://${game.cover_image}` : null

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${hover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.5)' : 'none'
      }}
    >
      <div style={{
        aspectRatio: '16/10',
        background: coverUrl ? '#000' : 'linear-gradient(135deg, var(--surface-2), var(--surface-3))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <img src="../images/game.png" alt="" style={{ width: 42, height: 42, opacity: 0.28 }} />
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.5)', color: 'var(--text-primary)',
          fontSize: 10, padding: '3px 7px', borderRadius: 4,
          fontWeight: 600, letterSpacing: 0.5
        }}>{game.launch_type.toUpperCase()}</div>
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontSize: 14, fontWeight: 600, marginBottom: 12,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>{game.name}</div>
        <button onClick={(e) => { e.stopPropagation(); onLaunch() }}
          style={{
            width: '100%', height: 34, borderRadius: 6, border: 'none',
            background: hover ? 'var(--accent-hover)' : 'var(--accent)',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>▶ 启动游戏</button>
      </div>
    </div>
  )
}
