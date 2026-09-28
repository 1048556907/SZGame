import { useState, useMemo } from 'react'
import type { Game, Group } from '../types'
import { useDebounced } from '../hooks/useDebounced'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay,
  type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core'
import { restrictToWindowEdges } from '@dnd-kit/modifiers'
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

/** 卡片网格 —— sort_order（分组内）/ global_order（全部视图）优先级最高，可拖拽排序 */
export default function GameGrid({
  games, currentGroup, searchQuery, groups,
  onOpenGame, onLaunch, onAddGame, onRefresh
}: GameGridProps) {

  const debouncedSearch = useDebounced(searchQuery, 300)
  const searchActive = !!debouncedSearch.trim()
  const isAllView = currentGroup === 'all'

  // 当前正在拖拽的游戏（用于 DragOverlay）
  const [activeGameId, setActiveGameId] = useState<number | null>(null)
  const activeGame = activeGameId != null ? games.find(g => g.id === activeGameId) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  // 前端排序：按视图选优先级字段
  // 全部视图 → global_order；具体分组视图 → sort_order
  // 次级排序：created_at 倒序 + name 拼音正序（无有效 order 时 fallback）
  const sortedList = useMemo(() => {
    let list = [...games]
    if (!isAllView) list = list.filter(g => g.group_id === currentGroup)
    if (searchActive) {
      const q = debouncedSearch.trim().toLowerCase()
      list = list.filter(g => g.name.toLowerCase().includes(q))
    }

    const orderField = isAllView ? 'global_order' : 'sort_order'
    const hasOrder = list.some(g => (g[orderField] ?? 0) !== 0)
    list.sort((a, b) => {
      if (hasOrder) {
        const oCmp = (a[orderField] ?? 0) - (b[orderField] ?? 0)
        if (oCmp !== 0) return oCmp
      }
      const timeCmp = (b.created_at ?? '').localeCompare(a.created_at ?? '')
      if (timeCmp !== 0) return timeCmp
      return nameCollator.compare(a.name, b.name)
    })
    return list
  }, [games, currentGroup, debouncedSearch, searchActive, isAllView])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveGameId(event.active.id as number)
  }

  // 拖拽结束：全部视图更新 global_order，具体分组视图更新 sort_order
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveGameId(null)
    if (!over || active.id === over.id) return

    const oldIndex = sortedList.findIndex(g => g.id === active.id)
    const newIndex = sortedList.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(sortedList, oldIndex, newIndex)
    const mode: 'per-group' | 'global' = isAllView ? 'global' : 'per-group'
    const items = reordered.map((g: Game, i: number) => ({ id: g.id, order: i }))

    try {
      await window.electronAPI?.gamesReorder(mode, items)
      onRefresh?.()
    } catch { /* 静默失败 */ }
  }

  const groupName = isAllView
    ? '全部游戏'
    : groups.find(gr => gr.id === currentGroup)?.name ?? '未知分组'

  const dragEnabled = !searchActive
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
        <div style={gridStyle}>
          {sortedList.map(g => (
            <GameCard key={g.id} game={g} onOpen={() => onOpenGame(g)} onLaunch={() => onLaunch(g.id)} />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
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
          <DragOverlay dropAnimation={null}>
            {activeGame ? (
              <div style={{ transform: 'scale(1.02)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
                <GameCard game={activeGame} onOpen={() => {}} onLaunch={() => {}} isDragging />
              </div>
            ) : null}
          </DragOverlay>
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

function SortableGameCard({ game, onOpen, onLaunch }: {
  game: Game; onOpen: () => void; onLaunch: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : 'auto'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GameCard game={game} onOpen={onOpen} onLaunch={onLaunch} isDragging={isDragging} />
    </div>
  )
}

function GameCard({ game, onOpen, onLaunch, isDragging }: {
  game: Game; onOpen: () => void; onLaunch: () => void; isDragging?: boolean
}) {
  const [hover, setHover] = useState(false)
  const coverUrl = game.cover_image
    ? game.cover_image.startsWith('data:')
      ? game.cover_image
      : game.cover_image.startsWith('http')
        ? game.cover_image
        : `szgame://${game.cover_image}`
    : null

  const isHover = hover && !isDragging

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => !isDragging && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement
        if (t.tagName === 'BUTTON' || t.closest('button') || t.tagName === 'A') {
          e.stopPropagation()
        }
      }}
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${isHover ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
        transform: isHover ? 'translateY(-3px)' : 'translateY(0)',
        transition: isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        boxShadow: isHover && !isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none'
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
            background: isHover ? 'var(--accent-hover)' : 'var(--accent)',
            color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}>▶ 启动游戏</button>
      </div>
    </div>
  )
}
