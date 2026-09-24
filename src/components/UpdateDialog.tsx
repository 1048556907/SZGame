import { useState, useEffect } from 'react'

interface Props {
  open: boolean
  currentVersion: string
  newVersion: string
  onUpdate: () => void
  onLater: () => void
}

export default function UpdateDialog({ open, currentVersion, newVersion, onUpdate, onLater }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null)

  useEffect(() => {
    if (!open) {
      setDownloading(false)
      setProgress(null)
      return
    }
    const api = window.electronAPI
    if (!api) return

    const offProgress = api.onUpdateProgress((info) => {
      setDownloading(true)
      setProgress({ bytes: info.bytes, total: info.total })
    })
    const offInstalled = api.onUpdateInstalled(() => {
      setDownloading(true)
      setProgress(null)
    })

    return () => { offProgress(); offInstalled() }
  }, [open])

  if (!open) return null

  const pct = progress && progress.total > 0 ? Math.round((progress.bytes / progress.total) * 100) : 0
  const human = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} KB`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '24px 28px', minWidth: 360, maxWidth: 420,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>发现新版本</div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
          fontSize: 13
        }}>
          <VersionTag label="当前" ver={currentVersion} />
          <span style={{ color: 'var(--text-tertiary)' }}>→</span>
          <VersionTag label="最新" ver={newVersion} highlight />
        </div>

        {downloading ? (
          <div>
            {progress ? (
              <>
                <div style={{
                  height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden',
                  marginBottom: 8
                }}>
                  <div style={{
                    height: '100%', background: 'var(--accent)', borderRadius: 3,
                    width: `${pct}%`, transition: 'width 0.2s'
                  }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                  下载中 {human(progress.bytes)} / {human(progress.total)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                准备安装…
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onLater} style={{
              height: 32, padding: '0 16px', borderRadius: 6,
              border: '1px solid var(--border-strong)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12
            }}>稍后再说</button>
            <button onClick={() => { setDownloading(true); onUpdate() }} style={{
              height: 32, padding: '0 16px', borderRadius: 6, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer',
              fontSize: 12, fontWeight: 600
            }}>立即更新</button>
          </div>
        )}
      </div>
    </div>
  )
}

function VersionTag({ label, ver, highlight }: { label: string; ver: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '6px 12px', borderRadius: 6,
      background: highlight ? 'var(--accent-subtle)' : 'var(--surface-0)',
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
      textAlign: 'center', minWidth: 90
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</div>
      <div style={{
        fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
        color: highlight ? 'var(--accent)' : 'var(--text-primary)'
      }}>v{ver}</div>
    </div>
  )
}
