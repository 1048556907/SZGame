import { useState, useEffect } from 'react'

interface Props {
  open: boolean
  keyword: string
  onClose: () => void
  onPick: (relativePath: string) => void
}

interface Candidate {
  appid: number
  name: string
  imageUrl: string
  thumbUrl: string
  score: number | null
  libraryHero: string
}

/** 远程封面候选选择弹窗（Steam 商店） */
export default function CoverPickerModal({ open, keyword, onClose, onPick }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [pickingIdx, setPickingIdx] = useState<number | null>(null) // 正在下载的卡片

  // 打开时自动搜索
  useEffect(() => {
    if (!open) return
    if (!keyword.trim()) {
      setError('请先填写游戏名称')
      setCandidates([])
      return
    }
    void search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyword])

  async function search() {
    const api = window.electronAPI
    if (!api) { setError('Electron API 不可用'); return }
    setLoading(true); setError(null); setCandidates([])
    try {
      const r = await api.remoteCoverSearch(keyword.trim())
      if (r.ok && r.candidates) {
        setCandidates(r.candidates)
        if (r.candidates.length === 0) {
          setError(`Steam 商店未找到 "${keyword}" 的匹配项`)
        }
      } else {
        setError(r.error || '搜索失败')
      }
    } catch (e: any) {
      setError(e?.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  async function pick(c: Candidate, idx: number) {
    const api = window.electronAPI
    if (!api) return
    setPickingIdx(idx)
    try {
      const r = await api.remoteCoverDownload(c.imageUrl)
      if (r.ok && r.relativePath) {
        onPick(r.relativePath)
        onClose()
      } else {
        setError(r.error || '下载失败')
      }
    } catch (e: any) {
      setError(e?.message || '下载错误')
    } finally {
      setPickingIdx(null)
    }
  }

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', zIndex: 115
      }} />

      {/* Modal */}
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 720, maxHeight: '85vh',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        zIndex: 120,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 头部 */}
        <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
              🎨 获取封面 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 12 }}>（来源：Steam 商店）</span>
            </div>
            <button onClick={onClose} style={{
              width: 28, height: 28, borderRadius: 6,
              border: 'none', background: 'transparent',
              color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 16
            }}>×</button>
          </div>

        {/* 内容区 */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
              🔍 正在从 Steam 商店搜索候选封面...
            </div>
          )}

          {!loading && error && (
            <div style={{
              textAlign: 'center', padding: 40,
              color: 'var(--danger)', fontSize: 13,
              background: 'var(--surface-1)', borderRadius: 10, border: '1px dashed var(--border-strong)'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && candidates.length > 0 && (
            <div style={{
              display: 'grid', gap: 14,
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
            }}>
              {candidates.map((c, idx) => {
                const picking = pickingIdx === idx
                return (
                  <div key={c.appid}
                    onClick={() => !picking && pick(c, idx)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: picking ? 'default' : 'pointer',
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s, transform 0.15s',
                      transform: picking ? 'scale(0.97)' : 'scale(1)',
                      borderColor: picking ? 'var(--accent)' : 'var(--border)'
                    }}
                    onMouseEnter={e => { if (!picking) e.currentTarget.style.borderColor = 'var(--accent)' }}
                    onMouseLeave={e => { if (!picking) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{
                      aspectRatio: '460/215', // Steam library_hero 比例
                      background: '#111',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {/* 先用 tiny_image 预览（小图），选中下载 library_hero.jpg */}
                      <img
                        src={c.thumbUrl || c.imageUrl}
                        alt={c.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {picking && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0.6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: 12
                        }}>⬇ 下载中...</div>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-1)' }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: 'var(--text-primary)'
                      }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        AppID: {c.appid}
                        {c.score != null && c.score > 0 ? ` · Metascore ${c.score}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          fontSize: 11, color: 'var(--text-tertiary)'
        }}>
          <span style={{ marginRight: 'auto', alignSelf: 'center' }}>
            💡 支持中文关键词搜索 · 封面取自 Steam CDN · 无次数限制
          </span>
          <button onClick={onClose} style={{
            height: 32, padding: '0 16px', borderRadius: 6,
            border: '1px solid var(--border-strong)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer'
          }}>取消</button>
        </div>
      </div>
    </>
  )
}
