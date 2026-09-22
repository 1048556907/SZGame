import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Game, Group } from '../types'

type View = 'home' | 'groups' | 'settings'

interface SidebarProps {
  view: View
  currentGroup: number | 'all'
  groups: Group[]
  games: Game[]
  searchQuery: string
  onViewChange: (v: View, groupId?: number | 'all') => void
  onSearchChange: (q: string) => void
  onCreateGroup?: (name: string) => void
  onReorderGroups?: (items: { id: number; sort_order: number }[]) => void
}

export default function Sidebar({
  view, currentGroup, groups, games,
  searchQuery, onViewChange, onSearchChange,
  onCreateGroup, onReorderGroups
}: SidebarProps) {
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const countByGroup = (gid: number | 'all') => {
    if (gid === 'all') return games.length
    return games.filter(g => g.group_id === gid).length
  }

  const isHomeActive = currentGroup === 'all' && view === 'home'

  // 拖拽只在 home view 且有 groups 时启用，避免 DndContext 在其他 view
  // （如收藏夹管理页）因全局 re-render 导致 PointerSensor 卡死 active 状态，
  // pointercapture 拦截所有 pointer 事件 → input 无法聚焦/输入
  const enableDrag = view === 'home' && groups.length > 0

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (e: DragEndEvent) => {
    if (!onReorderGroups) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex(g => g.id === active.id)
    const newIndex = groups.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(groups, oldIndex, newIndex)
    const items = reordered.map((g, i) => ({ id: g.id, sort_order: i }))
    onReorderGroups(items)
  }

  return (
    <aside className="sidebar">
      <div className="sb-search">
        <div className="sb-search-box">
          <input
            type="text"
            placeholder="搜索游戏..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <nav className="sb-nav">
        <div className="sb-section-label">我的游戏</div>

        {/* 全部 — 不可拖拽 */}
        <div
          className={`sb-item ${isHomeActive ? 'active' : ''}`}
          onClick={() => onViewChange('home', 'all')}
        >
          <img src="../images/all.png" alt="" />
          <span className="sb-label">全部</span>
          <span className="sb-count">{countByGroup('all')}</span>
        </div>

        {/* 分组 — 可拖拽（仅 home view 时挂载 DndContext）*/}
        {enableDrag ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map(g => (
                <SortableSidebarGroup
                  key={g.id}
                  group={g}
                  count={countByGroup(g.id)}
                  active={view === 'home' && currentGroup === g.id}
                  onClick={() => onViewChange('home', g.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          groups.map(g => (
            <div
              key={g.id}
              className={`sb-item ${view === 'home' && currentGroup === g.id ? 'active' : ''}`}
              onClick={() => onViewChange('home', g.id)}
            >
              <img src={g.icon_image ? `szgame://${g.icon_image}` : '../images/default_group.png'} alt=""
                style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover', flexShrink: 0,
                  filter: view === 'home' && currentGroup === g.id ? 'none' : 'brightness(0.85)' }}
              />
              <span className="sb-label">{g.name}</span>
              <span className="sb-count">{countByGroup(g.id)}</span>
            </div>
          ))
        )}

        {showCreateInput ? (
          <div style={{ padding: '6px 8px 6px 8px' }}>
            <input
              autoFocus
              type="text"
              placeholder="收藏夹名称（≤9字）"
              value={newGroupName}
              maxLength={9}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const name = newGroupName.trim()
                  if (name && name.length <= 9) { onCreateGroup?.(name); setNewGroupName('') }
                  else if (name.length > 9) { alert('收藏夹名称不能超过 9 个字符') }
                  setShowCreateInput(false)
                }
                if (e.key === 'Escape') { setShowCreateInput(false); setNewGroupName('') }
              }}
              onBlur={() => {
                const name = newGroupName.trim()
                if (name && name.length <= 9) { onCreateGroup?.(name); setNewGroupName('') }
                else if (name.length > 9) { alert('收藏夹名称不能超过 9 个字符') }
                setShowCreateInput(false)
              }}
              style={{
                width: '100%', height: 28, fontSize: 12,
                background: 'var(--surface-0)', border: '1px solid var(--accent)',
                borderRadius: 6, padding: '0 10px', color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'inherit'
              }}
            />
          </div>
        ) : null}
      </nav>

      <div className="sb-bottom">
        <div
          className={`sb-item ${view === 'groups' ? 'active' : ''}`}
          onClick={() => onViewChange('groups')}
        >
          <img src="../images/group.png" alt="" />
          <span className="sb-label">收藏夹</span>
        </div>
        <div
          className={`sb-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => onViewChange('settings')}
        >
          <img src="../images/setting.png" alt="" />
          <span className="sb-label">设置</span>
        </div>
      </div>
    </aside>
  )
}

/** 可拖拽的侧栏收藏夹项 */
function SortableSidebarGroup({
  group, count, active, onClick
}: {
  group: Group; count: number; active: boolean; onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })

  // 只保留 y 分量 → 垂直方向拖动
  const verticalTransform = transform ? { ...transform, x: 0 } : null

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(verticalTransform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none'
  }

  const iconSrc = group.icon_image
    ? `szgame://${group.icon_image}`
    : '../images/default_group.png'

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={`sb-item ${active ? 'active' : ''}`}
        onClick={onClick}
        title="拖拽可排序"
      >
        <img
          src={iconSrc}
          alt=""
          style={{
            width: 18, height: 18, borderRadius: 4,
            objectFit: 'cover', flexShrink: 0,
            filter: active ? 'none' : 'brightness(0.85)'
          }}
          onError={(e) => {
            if ((e.target as HTMLImageElement).src !== '../images/default_group.png') {
              (e.target as HTMLImageElement).src = '../images/default_group.png'
            }
          }}
        />
        <span className="sb-label">{group.name}</span>
        <span className="sb-count">{count}</span>
      </div>
    </div>
  )
}
