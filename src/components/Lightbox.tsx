import { useEffect } from 'react'

interface Props {
  imageUrl: string | null
  alt?: string
  onClose: () => void
}

/**
 * 全屏图片预览 —— 点击 / ESC 关闭
 */
export default function Lightbox({ imageUrl, alt, onClose }: Props) {
  useEffect(() => {
    if (!imageUrl) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    // 锁定 body 滚动
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = prev
    }
  }, [imageUrl, onClose])

  if (!imageUrl) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out'
      }}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          width: 40, height: 40, borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(0,0,0,0.4)',
          color: '#fff', fontSize: 20,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'background 0.15s'
        }}
        title="关闭 (ESC)"
      >×</button>

      {/* 图片容器 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '88vh',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
          animation: 'lightboxFadeIn 0.25s ease-out'
        }}
      >
        <img
          src={imageUrl}
          alt={alt ?? ''}
          style={{
            maxWidth: '92vw', maxHeight: '88vh',
            objectFit: 'contain', display: 'block'
          }}
        />
      </div>

      {/* 提示 */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.5)', fontSize: 12,
        fontFamily: 'monospace', letterSpacing: 1
      }}>
        点击任意处关闭 · ESC
      </div>

      <style>{`
        @keyframes lightboxFadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
