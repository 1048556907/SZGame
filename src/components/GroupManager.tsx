import { useState } from 'react'
import type { Game, Group } from '../types'

interface Props {
  games: Game[]
  groups: Group[]
  onRefresh?: () => void
  onAddGame?: () => void
}

/** 分组管理页 — 完整 CRUD */
export default function GroupManager({ games, groups, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const gamesByGroup = (gid: number) => games.filter(g => g.group_id === gid)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    await window.electronAPI?.groupsCreate(name)
    setNewName(''); setCreating(false)
    onRefresh?.()
  }

  const handleStartRename = (g: Group) => {
    setEditingId(g.id); setEditValue(g.name)
  }
  const handleRename = async () => {
    if (editingId === null) return
    const name = editValue.trim()
    if (!name) { setEditingId(null); return }
    await window.electronAPI?.groupsRename(editingId, name)
    setEditingId(null); onRefresh?.()
  }

  const handleDelete = async (g: Group) => {
    const count = gamesByGroup(g.id).length
    if (count > 0) {
      if (!confirm(`分组「${g.name}」下有 ${count} 款游戏。\n\n确定要删除分组并**同时删除这些游戏**吗？\n\n（点击取消则不删除任何内容）`)) return
      await window.electronAPI?.groupsDelete(g.id, true)
    } else {
      if (!confirm(`确定要删除空分组「${g.name}」吗？`)) return
      await window.electronAPI?.groupsDelete(g.id, false)
    }
    onRefresh?.()
  }

  return (
    <div className="content-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">分组管理</h1>
          <div className="page-subtitle">创建、重命名或删除分组 · 共 {groups.length} 个分组</div>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={addBtnStyle}
        >＋ 新建分组</button>
      </div>

      {/* 新建分组行 */}
      {creating && (
        <div style={{
          background: 'var(--surface-1)', border: '1px dashed var(--accent)',
          borderRadius: 10, padding: '14px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <input
            type="text"
            autoFocus
            placeholder="输入分组名称..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
            style={inputStyle()}
          />
          <button onClick={handleCreate} style={saveBtnStyle}>确认</button>
          <button onClick={() => { setCreating(false); setNewName('') }} style={cancelBtnStyle}>取消</button>
        </div>
      )}

      {/* 分组列表 */}
      {groups.length === 0 && !creating ? (
        <div style={{
          textAlign: 'center', padding: 80,
          color: 'var(--text-tertiary)', fontSize: 14
        }}>
          还没有任何分组 — 点击「＋ 新建分组」开始
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(g => {
            const groupGames = gamesByGroup(g.id)
            const isEditing = editingId === g.id
            return (
              <div key={g.id} style={{
                background: 'var(--surface-1)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
                transition: 'border-color 0.15s'
              }}>
                {/* 分组头部 */}
                <div style={{
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  borderBottom: groupGames.length ? '1px solid var(--border)' : 'none'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--accent-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', fontSize: 14, fontWeight: 700
                  }}>#</div>

                  {isEditing ? (
                    <>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingId(null) }}
                        style={inputStyle()}
                      />
                      <button onClick={handleRename} style={saveBtnStyle}>保存</button>
                      <button onClick={() => setEditingId(null)} style={cancelBtnStyle}>取消</button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {groupGames.length} 款游戏 · 创建于 {g.created_at?.slice(0, 10) ?? '-'}
                        </div>
                      </div>
                      <button onClick={() => handleStartRename(g)} style={iconBtn('var(--text-tertiary)')} title="重命名">✏</button>
                      <button onClick={() => handleDelete(g)} style={iconBtn('var(--danger)')} title="删除">🗑</button>
                    </>
                  )}
                </div>

                {/* 分组下的游戏 chips */}
                {groupGames.length > 0 && (
                  <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {groupGames.map(gg => (
                      <span key={gg.id} style={{
                        padding: '5px 11px', borderRadius: 14,
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        fontSize: 12, color: 'var(--text-secondary)'
                      }}>
                        {gg.name}
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
                          {gg.launch_type.toUpperCase()}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
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

function iconBtn(color: string): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 6,
    border: 'none', background: 'transparent', color, fontSize: 13,
    cursor: 'pointer', transition: 'background 0.15s'
  }
}
