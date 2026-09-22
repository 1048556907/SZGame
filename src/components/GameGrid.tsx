import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  onReorder: (groupId: number | null, items: { id: number; sort_order: number }[]) => void
}

/** 卡片网格（支持拖拽排序） */
export default function GameGrid({
  games, currentGroup, searchQuery, groups,
  onOpenGame, onLaunch, onAddGame, onReorder
}: GameGridProps) {

  // debounced 搜索值（Sidebar 的 onChange 是即时的，这里延迟 300ms）
  const debouncedSearch = useDebounced(searchQuery, 300)

  let list = [...games]
  if (currentGroup !== 'all') list = list.filter(g => g.group_id === currentGroup)
  if (debouncedSearch.trim()) {
    const q = debouncedSearch.trim().toLowerCase()
    list = list.filter(g => g.name.toLowerCase().includes(q))
  }

  const groupName = currentGroup === 'all'
    ? '全部游戏'
    : groups.find(gr => gr.id === currentGroup)?.name ?? '未知分组'

  const title = debouncedSearch ? `搜索：${debouncedSearch}` : groupName

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  /** 拖拽结束 —— 写回 sort_order */
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = list.findIndex(g => g.id === active.id)
    const newIndex = list.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(list, oldIndex, newIndex)
    // 写回 DB
    const items = reordered.map((g, i) => ({ id: g.id, sort_order: i }))
    onReorder(currentGroup === 'all' ? null : currentGroup, items)
  }

  const searchActive = !!debouncedSearch.trim()

  return (
    <div className="content-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <div className="page-subtitle">
            共 {list.length} 款游戏
            {!searchActive && currentGroup !== 'all' && list.length > 1 &&
              <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· 可拖拽排序</span>}
          </div>
        </div>
        {!searchActive && (
          <button onClick={onAddGame} style={addBtnStyle}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}>
            ＋ 添加游戏
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-tertiary)', fontSize: 14 }}>
          {searchActive ? '未找到匹配的游戏' : '该分组下暂无游戏'}
        </div>
      ) : searchActive || currentGroup === 'all' ? (
        // 搜索态 / 全部分组：禁用拖拽（跨分组无意义）
        <div style={gridStyle}>
          {list.map(g => (
            <GameCard key={g.id} game={g} onOpen={() => onOpenGame(g)} onLaunch={() => onLaunch(g.id)} />
          ))}
        </div>
      ) : (
        // 单分组：启用拖拽
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={list.map(g => g.id)} strategy={verticalListSortingStrategy}>
            <div style={gridStyle}>
              {list.map(g => (
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
// 可拖拽卡片
// ============================================================
function SortableGameCard({ game, onOpen, onLaunch }: {
  game: Game
  onOpen: () => void
  onLaunch: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: game.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <GameCard game={game} onOpen={onOpen} onLaunch={onLaunch} draggable />
    </div>
  )
}

// ============================================================
// 基础卡片
// ============================================================
function GameCard({ game, onOpen, onLaunch, draggable }: {
  game: Game; onOpen: () => void; onLaunch: () => void; draggable?: boolean
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
        {draggable && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            width: 22, height: 22, borderRadius: 4,
            background: 'rgba(0,0,0,0.5)', color: 'var(--text-tertiary)',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'grab', opacity: hover ? 0.8 : 0
          }}>⋮⋮</div>
        )}
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
