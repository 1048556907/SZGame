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

        {/* 分组 — 可拖拽 */}
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

        {showCreateInput ? (
          <div style={{ padding: '6px 8px 6px 8px' }}>
            <input
              autoFocus
              type="text"
              placeholder="分组名称"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const name = newGroupName.trim()
                  if (name) { onCreateGroup?.(name); setNewGroupName('') }
                  setShowCreateInput(false)
                }
                if (e.key === 'Escape') { setShowCreateInput(false); setNewGroupName('') }
              }}
              onBlur={() => {
                if (newGroupName.trim()) { onCreateGroup?.(newGroupName.trim()); setNewGroupName('') }
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
        ) : (
          <div className="sb-add-group" onClick={() => setShowCreateInput(true)}>
            <span>＋</span>
            <span>新建分组</span>
          </div>
        )}

        <div className="sb-section-label" style={{ paddingTop: 20 }}>管理</div>

        <div
          className={`sb-item ${view === 'groups' ? 'active' : ''}`}
          onClick={() => onViewChange('groups')}
        >
          <img src="../images/group.png" alt="" />
          <span className="sb-label">分组管理</span>
        </div>
      </nav>

      <div className="sb-bottom">
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

/** 可拖拽的侧栏分组项 */
function SortableSidebarGroup({
  group, count, active, onClick
}: {
  group: Group; count: number; active: boolean; onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none'
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={`sb-item ${active ? 'active' : ''}`}
        onClick={onClick}
        title="拖拽可排序"
      >
        <span className="sb-ico" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>#</span>
        <span className="sb-label">{group.name}</span>
        <span className="sb-count">{count}</span>
      </div>
    </div>
  )
}
