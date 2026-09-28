import { useState, useMemo } from 'react'
import type { Game, Group } from '../types'
import { useDebounced } from '../hooks/useDebounced'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface GameGridProps {
  games: Game[]
  groups: Group[]
  currentGroup: number | 'all'
  searchQuery: string
  onOpenGame: (g: Game) => void
  onLaunch: (id: number) => void
  onAddGame: () => void
  onRefresh?: () => void
}

/** 中文 + 英文混合排序：按名称拼音首字母正序 */
const nameCollator = new Intl.Collator('zh-CN', {
  sensitivity: 'base',
  usage: 'sort',
  numeric: true
})

/** 卡片网格 —— sort_order 优先级最高，可拖拽排序 */
export default function GameGrid({
  games, currentGroup, searchQuery, groups,
  onOpenGame, onLaunch, onAddGame, onRefresh
}: GameGridProps) {

  // debounced 搜索值（Sidebar 的 onChange 是即时的，这里延迟 300ms）
  const debouncedSearch = useDebounced(searchQuery, 300)
  const searchActive = !!debouncedSearch.trim()

  // ── 拖拽传感器 ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const sortedList = useMemo(() => {
    let list = [...games]
    if (currentGroup !== 'all') list = list.filter(g => g.group_id === currentGroup)
    if (searchActive) {
      const q = debouncedSearch.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }

    // 排序优先级：
    // 1. sort_order 升序（用户拖拽过的）
    // 2. created_at 倒序
    // 3. name 拼音正序
    //
    // 当所有 sort_order 均为 0 或 null 时，走后两个的 fallback
    const hasSortOrder = list.some(g => (g.sort_order ?? 0) !== 0)
    list.sort((a, b) => {
      if (hasSortOrder) {
        const soCmp = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (soCmp !== 0) return soCmp
      }
      const timeCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '')
      if (timeCmp !== 0) return timeCmp
      return nameCollator.compare(a.name, b.name)
    })
    return list
  }, [games, currentGroup, debouncedSearch, searchActive])

  // ── 拖拽结束处理 ──
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    // 双保险：dragEnabled 已保证 !searchActive && currentGroup !== 'all'
    if (currentGroup === 'all') return

    const oldIndex = sortedList.findIndex(g => g.id === active.id)
    const newIndex = sortedList.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(sortedList, oldIndex, newIndex)
    const items = reordered.map((g: Game, i: number) => ({ id: g.id, sort_order: i }))

    try {
      await window.electronAPI?.gamesReorder(currentGroup, items)
      onRefresh?.()
    } catch {
      // 静默失败 —— 用户看到卡片没动，下次 refresh 会纠正
    }
  }

  const groupName = currentGroup === 'all'
    ? '全部游戏'
    : groups.find(gr => gr.id === currentGroup)?.name ?? '未知分组'

  // 拖拽仅在具体分组内启用 —— 搜索态和"全部"视图都禁用
  // （"全部"视图混排不同分组游戏，跨分组拖拽会破坏 per-group sort_order）
  const dragEnabled = !searchActive && currentGroup !== 'all'

  const title = searchActive ? `搜索：${debouncedSearch}` : groupName

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
      ) : !dragEnabled ? (
        // 搜索态 / "全部"视图：不挂载 DndContext，禁用拖拽
        <div style={gridStyle}>
          {sortedList.map(g => (
            <GameCard key={g.id} game={g} onOpen={() => onOpenGame(g)} onLaunch={() => onLaunch(g.id)} />
          ))}
        </div>
      ) : (
        // 具体分组视图 + 非搜索态：挂载 DndContext + SortableContext，启用拖拽排序
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedList.map(g => g.id)} strategy={rectSortingStrategy}>
            <div style={gridStyle}>
              {sortedList.map(g => (
                <SortableGameCard
                  key={g.id}
                  game={g}
                  onOpen={() => onOpenGame(g)}
                  onLaunch={() => onLaunch(g.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 16
}

const addBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', borderRadius: 8, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'background 0.15s',
  display: 'flex', alignItems: 'center', gap: 6
}

// ============================================================
// 可拖拽排序的游戏卡片
// ============================================================
function SortableGameCard({ game, onOpen, onLaunch }: {
  game: Game; onOpen: () => void; onLaunch: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GameCard game={game} onOpen={onOpen} onLaunch={onLaunch} />
    </div>
  )
}

// ============================================================
// 游戏卡片（纯展示，可被 SortableGameCard 包裹）
// ============================================================
function GameCard({ game, onOpen, onLaunch }: {
  game: Game; onOpen: () => void; onLaunch: () => void
}) {
  const [hover, setHover] = useState(false)
  const coverUrl = game.cover_image
    ? game.cover_image.startsWith('data:')
      ? game.cover_image                                              // base64 data URI（最稳方案）
      : game.cover_image.startsWith('http')
        ? game.cover_image                                            // 历史遗留 Steam CDN URL
        : `szgame://${game.cover_image}`                              // 历史遗留本地文件路径
    : null

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => {
        // 点在按钮或链接上不触发 dnd-kit 拖拽监听
        const t = e.target as HTMLElement
        if (t.tagName === 'BUTTON' || t.closest('button') || t.tagName === 'A') {
          e.stopPropagation()
        }
      }}
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
          <img src={coverUrl} alt="" referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
