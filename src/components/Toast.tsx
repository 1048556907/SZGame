import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'

type ToastType = 'error' | 'success' | 'info' | 'warning'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++_id
    setItems(prev => [...prev, { id, type, message }])
    if (duration > 0) {
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), duration)
    }
  }, [])

  const showError = useCallback((message: string) => showToast(message, 'error', 5000), [showToast])
  const showSuccess = useCallback((message: string) => showToast(message, 'success', 2500), [showToast])

  const remove = (id: number) => setItems(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
      {children}
      <ToastViewport items={items} onRemove={remove} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ============================================================
// Viewport
// ============================================================

function ToastViewport({ items, onRemove }: { items: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none'
    }}>
      {items.map(t => (
        <ToastBar key={t.id} item={t} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  )
}

function ToastBar({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r) }, [])

  const palette = {
    error:   { bg: '#2a0f0f', border: '#ef4444', fg: '#fca5a5', icon: '⚠' },
    success: { bg: '#0f2a1a', border: '#22c55e', fg: '#86efac', icon: '✓' },
    warning: { bg: '#2a250f', border: '#f59e0b', fg: '#fcd34d', icon: '!' },
    info:    { bg: '#0f1a2a', border: '#3b82f6', fg: '#93c5fd', icon: 'ⓘ' },
  }[item.type]

  return (
    <div onClick={onClose} style={{
      pointerEvents: 'auto',
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      minWidth: 240, maxWidth: 360,
      boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${palette.border}22`,
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer', userSelect: 'none',
      transform: mounted ? 'translateX(0)' : 'translateX(120%)',
      opacity: mounted ? 1 : 0,
      transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: `${palette.border}22`,
        color: palette.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, flexShrink: 0
      }}>{palette.icon}</div>
      <div style={{ flex: 1, color: palette.fg, fontSize: 12.5, lineHeight: 1.45 }}>{item.message}</div>
      <div style={{ color: palette.border, opacity: 0.5, fontSize: 14, lineHeight: 1 }}>×</div>
    </div>
  )
}
