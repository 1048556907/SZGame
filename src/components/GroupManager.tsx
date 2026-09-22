import { useState, useRef, useEffect } from 'react'
import type { Game, Group } from '../types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props {
  games: Game[]
  groups: Group[]
  onRefresh?: () => void
  onConfirm?: (title: string, message: string, opts?: { confirmText?: string; danger?: boolean }) => Promise<boolean>
}

const DEFAULT_ICON = '../images/default_group.png'

function iconSrc(group: Group): string {
  return group.icon_image ? `szgame://${group.icon_image}` : DEFAULT_ICON
}

/** 收藏夹管理页 — CRUD + 图标 + 拖拽排序 + 安全删除 */
export default function GroupManager({ games, groups, onRefresh, onConfirm }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editIcon, setEditIcon] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState<string | null>(null)
  const createNameInputRef = useRef<HTMLInputElement>(null)

  // 修复 autofocus：creating 变为 true 后用 useEffect 确保 DOM 已挂载
  useEffect(() => {
    if (creating) {
      // 下一帧再 focus，避免 React 渲染时序问题
      requestAnimationFrame(() => createNameInputRef.current?.focus())
    }
  }, [creating])

  const gamesByGroup = (gid: number) => games.filter(g => g.group_id === gid)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    if (name.length > 9) { alert('收藏夹名称不能超过 9 个字符'); return }
    await window.electronAPI?.groupsCreate(name, newIcon)
    setNewName(''); setNewIcon(null); setCreating(false)
    onRefresh?.()
  }

  const handleStartEdit = (g: Group) => {
    setEditingId(g.id); setEditValue(g.name); setEditIcon(g.icon_image ?? null)
  }
  const handleSaveEdit = async () => {
    if (editingId === null) return
    const name = editValue.trim()
    if (!name) { setEditingId(null); return }
    if (name.length > 9) { alert('收藏夹名称不能超过 9 个字符'); return }
    await window.electronAPI?.groupsUpdate(editingId, name, editIcon)
    setEditingId(null); onRefresh?.()
  }

  const handleDelete = async (g: Group) => {
    const count = gamesByGroup(g.id).length
    const title = count > 0 ? '删除收藏夹' : '删除收藏夹'
    const message = count > 0
      ? `收藏夹「${g.name}」下有 ${count} 款游戏。\n\n删除后这些游戏将自动归入「全部」（无分组）。\n\n确定要删除收藏夹吗？`
      : `确定要删除收藏夹「${g.name}」吗？`
    const ok = onConfirm
      ? await onConfirm(title, message, { confirmText: '删除', danger: true })
      : window.confirm(message) // fallback
    if (!ok) return
    await window.electronAPI?.groupsDelete(g.id)
    onRefresh?.()
  }

  const pickFile = async (): Promise<string | null> => {
    const res = await window.electronAPI?.selectFile([
      { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'] }
    ])
    if (!res || res.canceled || res.filePaths.length === 0) return null
    const saved = await window.electronAPI?.groupIconSaveFromPath(res.filePaths[0])
    return saved?.relativePath ?? null
  }

  const handleCreatePickIcon = async () => {
    const p = await pickFile(); if (p) setNewIcon(p)
  }
  const handleEditPickIcon = async () => {
    const p = await pickFile(); if (p) setEditIcon(p)
  }

  // ── 拖拽排序 ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex(g => g.id === active.id)
    const newIndex = groups.findIndex(g => g.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const newOrder = [...groups]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)
    const items = newOrder.map((g, i) => ({ id: g.id, sort_order: i }))
    await window.electronAPI?.groupsReorder(items)
    onRefresh?.()
  }

  return (
    <div className="content-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">收藏夹</h1>
          <div className="page-subtitle">拖拽排序 · 创建/重命名/删除 · 共 {groups.length} 个收藏夹</div>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={addBtnStyle}
        >＋ 新建收藏夹</button>
      </div>

      {/* 新建收藏夹行 */}
      {creating && (
        <div style={{
          background: 'var(--surface-1)', border: '1px dashed var(--accent)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <button onClick={handleCreatePickIcon} style={iconPickBtn} title="选择图标">
            <img src={newIcon ? `szgame://${newIcon}` : DEFAULT_ICON} alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
              onError={(e) => { if ((e.target as HTMLImageElement).src !== DEFAULT_ICON) (e.target as HTMLImageElement).src = DEFAULT_ICON }}
            />
          </button>
          {newIcon && (
            <button onClick={() => setNewIcon(null)} style={clearIconBtn} title="清除图标">✕</button>
          )}
          <input
            ref={createNameInputRef}
            type="text" placeholder="输入收藏夹名称（≤9字）..."
            value={newName}
            maxLength={9}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); setNewIcon(null) } }}
            style={inputStyle()}
          />
          <button onClick={handleCreate} style={saveBtnStyle}>确认</button>
          <button onClick={() => { setCreating(false); setNewName(''); setNewIcon(null) }} style={cancelBtnStyle}>取消</button>
        </div>
      )}

      {/* 收藏夹列表 */}
      {groups.length === 0 && !creating ? (
        <div style={{
          textAlign: 'center', padding: 80,
          color: 'var(--text-tertiary)', fontSize: 14
        }}>
          还没有任何收藏夹 — 点击「＋ 新建收藏夹」开始
        </div>
      ) : groups.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {groups.map(g => (
                <SortableGroupCard
                  key={g.id}
                  group={g}
                  gameCount={gamesByGroup(g.id).length}
                  editing={editingId === g.id}
                  editValue={editValue}
                  editIcon={editIcon}
                  onEditValueChange={setEditValue}
                  onEditIconChange={setEditIcon}
                  onStartEdit={() => handleStartEdit(g)}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={() => setEditingId(null)}
                  onPickEditIcon={handleEditPickIcon}
                  onDelete={() => handleDelete(g)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}
    </div>
  )
}

interface SortableCardProps {
  group: Group
  gameCount: number
  editing: boolean
  editValue: string
  editIcon: string | null
  onEditValueChange: (v: string) => void
  onEditIconChange: (v: string | null) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onPickEditIcon: () => void
  onDelete: () => void
}

function SortableGroupCard({
  group, gameCount, editing, editValue, editIcon,
  onEditValueChange, onEditIconChange,
  onStartEdit, onSaveEdit, onCancelEdit, onPickEditIcon, onDelete
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto'
  }

  const editInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing) requestAnimationFrame(() => editInputRef.current?.focus())
  }, [editing])

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'border-color 0.15s',
        cursor: 'grab'
      }}
      onMouseDown={(e) => {
        // 点在按钮或 input 上不触发拖拽
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'IMG') return
      }}
      >
        <div style={{
          padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          {editing ? (
            <>
              <button onClick={onPickEditIcon} style={iconPickBtn} title="更换图标">
                <img src={editIcon ? `szgame://${editIcon}` : DEFAULT_ICON} alt=""
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
                  onError={(e) => { if ((e.target as HTMLImageElement).src !== DEFAULT_ICON) (e.target as HTMLImageElement).src = DEFAULT_ICON }}
                />
              </button>
              {editIcon && (
                <button onClick={() => onEditIconChange(null)} style={clearIconBtn} title="清除图标">✕</button>
              )}
            </>
          ) : (
            <img src={iconSrc(group)} alt=""
              style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
              onError={(e) => { if ((e.target as HTMLImageElement).src !== DEFAULT_ICON) (e.target as HTMLImageElement).src = DEFAULT_ICON }}
            />
          )}

          {editing ? (
            <>
              <input
                ref={editInputRef}
                value={editValue}
                maxLength={9}
                onChange={e => onEditValueChange(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit() }}
                style={inputStyle()}
              />
              <button onClick={onSaveEdit} style={saveBtnStyle}>保存</button>
              <button onClick={onCancelEdit} style={cancelBtnStyle}>取消</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{group.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {gameCount} 款游戏 · 创建于 {group.created_at?.slice(0, 10) ?? '-'}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit() }}
                style={editDelIconBtn} title="编辑"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <img src="../images/scj_edit.png" alt="编辑" style={{ height: '1em', display: 'block' }} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                style={editDelIconBtn} title="删除"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <img src="../images/scj_del.png" alt="删除" style={{ height: '1em', display: 'block' }} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Styles
// ============================================================

const addBtnStyle: React.CSSProperties = {
  height: 36, padding: '0 18px', borderRadius: 8, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', transition: 'background 0.15s'
}

const editDelIconBtn: React.CSSProperties = {
  padding: 5, border: 'none', background: 'transparent',   // padding+5px → 点击区域放大
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 26, width: 26, borderRadius: 6,                // 按钮本体 26×26，原 16px（~1em）+5×2 padding
  lineHeight: 1
}

const clearIconBtn: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 10, padding: 0,
  border: 'none', background: 'var(--danger)', color: '#fff',
  fontSize: 11, cursor: 'pointer', lineHeight: 1
}

const inputStyle = (): React.CSSProperties => ({
  flex: 1, height: 36,
  background: 'var(--surface-0)',
  border: '1px solid var(--border-strong)',
  borderRadius: 6, padding: '0 12px',
  color: 'var(--text-primary)', fontSize: 13,
  fontFamily: 'inherit', outline: 'none'
})

const saveBtnStyle: React.CSSProperties = {
  height: 34, padding: '0 14px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
}

const cancelBtnStyle: React.CSSProperties = {
  height: 34, padding: '0 14px', borderRadius: 6,
  border: '1px solid var(--border-strong)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer'
}

const iconPickBtn: React.CSSProperties = {
  width: 36, height: 36, padding: 0, borderRadius: 8,
  border: '1px dashed var(--border-strong)', background: 'var(--surface-2)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0
}
