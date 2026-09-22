import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import GameGrid from './components/GameGrid'
import GroupManager from './components/GroupManager'
import Settings from './components/Settings'
import GameDrawer from './components/GameDrawer'
import GameForm from './components/GameForm'
import { ToastProvider, useToast } from './components/Toast'
import type { Game, Group, AppSettings } from './types'

type View = 'home' | 'groups' | 'settings'

/** 内层 —— 使用 useToast 必须在 Provider 里面 */
function AppInner() {
  const toast = useToast()
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
        window_close_behavior: (all['window.close.behavior'] as any) ?? 'minimize-to-tray'
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
    if (!confirm(`确定要删除「${g.name}」吗？`)) return
    await window.electronAPI?.gamesDelete(g.id)
    setSelectedGame(null)
    refresh()
  }

  // 排序：分组内游戏
  const handleGamesReorder = async (groupId: number | null, items: { id: number; sort_order: number }[]) => {
    await window.electronAPI?.gamesReorder(groupId, items)
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
              onReorder={handleGamesReorder}
            />
          )}
          {view === 'groups' && (
            <GroupManager
              groups={groups}
              games={games}
              onRefresh={refresh}
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
