import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import GameGrid from './components/GameGrid'
import GroupManager from './components/GroupManager'
import Settings from './components/Settings'
import GameDrawer from './components/GameDrawer'
import GameForm from './components/GameForm'
import { ToastProvider, useToast } from './components/Toast'
import type { Game, Group, AppSettings } from './types'

type View = 'home' | 'groups' | 'settings'

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  danger?: boolean
  onConfirm: (() => void) | null
}

/** 全局确认弹窗 — 替代浏览器原生 confirm()，避免阻塞主线程导致 DndContext PointerSensor 卡死 */
function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  if (!state.open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '22px 26px', minWidth: 340, maxWidth: 420,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{state.title}</div>
        <div style={{
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
          whiteSpace: 'pre-wrap', marginBottom: 20
        }}>{state.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            height: 32, padding: '0 16px', borderRadius: 6,
            border: '1px solid var(--border-strong)', background: 'transparent',
            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12
          }}>取消</button>
          <button onClick={() => { state.onConfirm?.(); onClose() }} style={{
            height: 32, padding: '0 16px', borderRadius: 6, border: 'none',
            background: state.danger ? 'var(--danger)' : 'var(--accent)',
            color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600
          }}>{state.confirmText}</button>
        </div>
      </div>
    </div>
  )
}

/** 全局 confirm hook — 替代原生 window.confirm，返回 Promise<boolean> */
function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false, title: '', message: '', confirmText: '确定',
    danger: false, onConfirm: null
  })
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((title: string, message: string, opts?: { confirmText?: string; danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setState({
        open: true, title, message,
        confirmText: opts?.confirmText ?? '确定',
        danger: opts?.danger ?? false,
        onConfirm: null // 不使用 onConfirm，用 resolver
      })
    })
  }, [])

  const handleClose = useCallback(() => {
    const r = resolverRef.current
    resolverRef.current = null
    setState(s => ({ ...s, open: false }))
    r?.(false)
  }, [])

  const handleConfirm = useCallback(() => {
    const r = resolverRef.current
    resolverRef.current = null
    setState(s => ({ ...s, open: false }))
    r?.(true)
  }, [])

  return { confirm, state, handleClose, handleConfirm }
}

/** 内层 —— 使用 useToast 必须在 Provider 里面 */
function AppInner() {
  const toast = useToast()
  const { confirm, state: confirmState, handleClose: closeConfirm, handleConfirm: doConfirm } = useConfirm()
  const [view, setView] = useState<View>('home')
  const [currentGroup, setCurrentGroup] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  const [games, setGames] = useState<Game[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    window_minimize_behavior: 'taskbar',
    window_close_behavior: 'minimize-to-tray'
  })
  const [version, setVersion] = useState('')

  // 订阅 maximize 状态变化
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.onMaximizeChange) return
    const unsubscribe = api.onMaximizeChange((v) => setIsMaximized(v))
    api.winIsMaximized?.().then(setIsMaximized).catch(() => {})
    return unsubscribe
  }, [])

  // GameForm state
  const [formOpen, setFormOpen] = useState(false)
  const [formEditing, setFormEditing] = useState<Game | null>(null)

  /** 刷新所有列表数据 */
  const refresh = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    try {
      const [gList, gaList, ver] = await Promise.all([
        api.groupsList(),
        api.gamesList(),
        api.getVersion()
      ])
      setGroups(gList as Group[])
      setGames(gaList as Game[])
      setVersion(ver)

      const all = await api.settingsGetAll()
      setSettings({
        window_minimize_behavior: (all['window.minimize.behavior'] as any) ?? 'tray',
        window_close_behavior: (all['window.close.behavior'] as any) ?? 'minimize-to-tray',
        rawg_api_key: all['rawg.api.key'] ?? ''
      })
    } catch (e) {
      toast.showError('数据加载失败，请查看控制台')
      console.error('[App] IPC load failed:', e)
    }
  }, [toast])

  useEffect(() => { refresh() }, [refresh])

  // —— handlers ——
  const openDrawer = (g: Game) => setSelectedGame(g)
  const closeDrawer = () => setSelectedGame(null)

  const handleViewChange = (v: View, groupId?: number | 'all') => {
    setView(v)
    if (groupId !== undefined) setCurrentGroup(groupId)
  }

  const handleLaunch = async (gameId: number) => {
    const r = await window.electronAPI?.launch(gameId)
    if (r?.success) {
      toast.showSuccess('已启动游戏')
    } else {
      toast.showError(r?.message ?? '启动失败')
      console.error('[launch]', r?.message)
    }
  }

  const handleSettingsChange = async (key: string, value: string) => {
    await window.electronAPI?.settingsSet(key, value)
    setSettings(prev => {
      const next = { ...prev } as any
      if (key === 'window.minimize.behavior') next.window_minimize_behavior = value
      if (key === 'window.close.behavior') next.window_close_behavior = value
      return next
    })
  }

  // GameForm
  const openAddGame = () => { setFormEditing(null); setFormOpen(true) }
  const openEditGame = (g: Game) => { setSelectedGame(null); setFormEditing(g); setFormOpen(true) }
  const closeForm = () => setFormOpen(false)

  // 删除游戏
  const handleDeleteGame = async (g: Game) => {
    if (!(await confirm('删除游戏', `确定要删除「${g.name}」吗？`, { confirmText: '删除', danger: true }))) return
    await window.electronAPI?.gamesDelete(g.id)
    setSelectedGame(null)
    refresh()
  }

  // 排序：侧栏分组
  const handleGroupsReorder = async (items: { id: number; sort_order: number }[]) => {
    await window.electronAPI?.groupsReorder(items)
    refresh()
  }

  // 侧栏快速新建分组
  const handleCreateGroup = async (name: string) => {
    const r = await window.electronAPI?.groupsCreate(name)
    if (r?.ok) refresh()
  }

  return (
    <div className="app">
      {/* 标题栏 */}
      <div className="titlebar">
        <img className="tb-logo" src="../images/logo.png" alt="" />
        <span className="tb-title">SZGame —— 游戏与程序管理盒子</span>
        <div className="tb-spacer" />
        <div className="tb-wincontrols">
          <div className="tb-btn" title="最小化"
            onClick={() => window.electronAPI?.winMinimize()}>—</div>
          <div className="tb-btn close" title="关闭"
            onClick={() => window.electronAPI?.winClose()}>✕</div>
        </div>
      </div>

      <div className="app-body">
        <Sidebar
          view={view}
          currentGroup={currentGroup}
          groups={groups}
          games={games}
          searchQuery={searchQuery}
          onViewChange={handleViewChange}
          onSearchChange={setSearchQuery}
          onCreateGroup={handleCreateGroup}
          onReorderGroups={handleGroupsReorder}
        />

        <main className="content">
          {view === 'home' && (
            <GameGrid
              games={games}
              groups={groups}
              currentGroup={currentGroup}
              searchQuery={searchQuery}
              onOpenGame={openDrawer}
              onLaunch={handleLaunch}
              onAddGame={openAddGame}
            />
          )}
          {view === 'groups' && (
            <GroupManager
              groups={groups}
              games={games}
              onRefresh={refresh}
              onConfirm={confirm}
            />
          )}
          {view === 'settings' && (
            <Settings
              version={version}
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          )}
        </main>
      </div>

      {/* 详情抽屉 */}
      {selectedGame && (
        <GameDrawer
          game={selectedGame}
          groups={groups}
          onClose={closeDrawer}
          onLaunch={handleLaunch}
          onEdit={() => openEditGame(selectedGame)}
          onDelete={() => handleDeleteGame(selectedGame)}
          onRefresh={refresh}
        />
      )}

      {/* 添加/编辑游戏表单 */}
      <GameForm
        open={formOpen}
        editing={formEditing}
        groups={groups}
        defaultGroupId={currentGroup !== 'all' ? currentGroup : null}
        onClose={closeForm}
        onSaved={() => { refresh(); closeDrawer() }}
      />

      {/* 全局确认弹窗 */}
      {confirmState.open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onClick={(e) => { if (e.target === e.currentTarget) closeConfirm() }}
        >
          <div style={{
            background: 'var(--surface-1)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '22px 26px', minWidth: 340, maxWidth: 420,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{confirmState.title}</div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', marginBottom: 20
            }}>{confirmState.message}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={closeConfirm} style={{
                height: 32, padding: '0 16px', borderRadius: 6,
                border: '1px solid var(--border-strong)', background: 'transparent',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12
              }}>取消</button>
              <button onClick={doConfirm} style={{
                height: 32, padding: '0 16px', borderRadius: 6, border: 'none',
                background: confirmState.danger ? 'var(--danger)' : 'var(--accent)',
                color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600
              }}>{confirmState.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
