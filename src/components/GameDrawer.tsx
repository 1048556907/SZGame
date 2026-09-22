import { useState } from 'react'
import type { Game, Group } from '../types'
import Lightbox from './Lightbox'

interface Props {
  game: Game
  groups: Group[]
  onClose: () => void
  onLaunch: (id: number) => void
  onEdit?: () => void
  onDelete?: () => void
  onRefresh?: () => void
}

export default function GameDrawer({ game, groups, onClose, onLaunch, onEdit, onDelete }: Props) {
  const [launching, setLaunching] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const handleLaunch = async () => {
    if (launching) return
    setLaunching(true)
    try {
      await onLaunch(game.id)
    } finally {
      setLaunching(false)
    }
  }

  const groupName = groups.find(g => g.id === game.group_id)?.name ?? '未分组'
  const coverUrl = game.cover_image ? `szgame://${game.cover_image}` : null

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 50
        }}
      />

      {/* 抽屉本体 */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 480,
        background: 'var(--surface-0)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        zIndex: 60,
        display: 'flex', flexDirection: 'column'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 14
        }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{game.name}</strong>
            <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
              · {game.launch_type.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 6,
              border: 'none', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer',
              fontSize: 16
            }}
          >×</button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {/* 封面 —— 点击放大 */}
          <div
            onClick={() => coverUrl && setLightboxOpen(true)}
            style={{
              aspectRatio: '16/9',
              borderRadius: 10,
              background: coverUrl ? '#000' : 'linear-gradient(135deg, var(--surface-2), var(--surface-3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              cursor: coverUrl ? 'zoom-in' : 'default',
              transition: 'border-color 0.15s',
              position: 'relative'
            }}
            onMouseEnter={e => { if (coverUrl) e.currentTarget.style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {coverUrl ? (
              <img src={coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src="../images/game.png" alt="" style={{ width: 64, height: 64, opacity: 0.3 }} />
            )}
            {coverUrl && (
              <div style={{
                position: 'absolute', bottom: 8, right: 10,
                fontSize: 10, color: 'rgba(255,255,255,0.6)',
                fontFamily: 'monospace', letterSpacing: 0.5,
                textShadow: '0 1px 2px rgba(0,0,0,0.9)'
              }}>🔍 点击放大</div>
            )}
          </div>

          {/* 字段 */}
          <DrawerField label="游戏名称" value={game.name} />
          <DrawerField label="启动路径" value={game.launch_path} mono />
          {game.launch_args && (
            <DrawerField label="启动参数" value={game.launch_args} mono />
          )}
          <DrawerField label="启动类型" value={game.launch_type.toUpperCase()} />
          <DrawerField label="所属分组" value={groupName} />
          <DrawerField label="添加时间" value={game.created_at?.slice(0, 19) ?? '-'} />
        </div>

        {/* 底部操作 */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10
        }}>
          {onEdit && (
            <button
              onClick={onEdit}
              style={{
                height: 40, padding: '0 16px', borderRadius: 6,
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >✏ 编辑</button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              style={{
                height: 40, padding: '0 16px', borderRadius: 6,
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--danger)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >🗑 删除</button>
          )}
          <button
            onClick={handleLaunch}
            disabled={launching}
            style={{
              flex: 1, height: 40, borderRadius: 6, border: 'none',
              background: launching ? 'var(--surface-3)' : 'var(--accent)',
              color: launching ? 'var(--text-tertiary)' : '#fff',
              fontSize: 13, fontWeight: 600, cursor: launching ? 'default' : 'pointer',
              transition: 'background 0.15s'
            }}
          >
            {launching ? '启动中...' : '▶ 启动游戏'}
          </button>
        </div>
      </div>
      {/* Lightbox —— 封面放大预览 */}
      <Lightbox
        imageUrl={lightboxOpen && coverUrl ? coverUrl : null}
        alt={game.name}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  )
}

/** 单个字段渲染 */
function DrawerField({ label, value, mono }: {
  label: string; value: string; mono?: boolean
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5
      }}>{label}</div>
      <div style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: mono ? 'monospace' : 'inherit',
        color: 'var(--text-secondary)',
        wordBreak: 'break-all',
        lineHeight: 1.5
      }}>{value}</div>
    </div>
  )
}
