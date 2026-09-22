import { useState, useEffect } from 'react'
import type { Game, Group, LaunchType } from '../types'
import CoverPickerModal from './CoverPickerModal'

interface Props {
  open: boolean
  editing?: Game | null
  groups: Group[]
  defaultGroupId?: number | null
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  name: string
  launch_path: string
  launch_type: LaunchType
  launch_args: string
  cover_image: string | null
  group_id: number | null
}

const emptyForm: FormState = {
  name: '',
  launch_path: '',
  launch_type: 'exe',
  launch_args: '',
  cover_image: null,
  group_id: null
}

/** 游戏新建 / 编辑表单（Modal） */
export default function GameForm({
  open, editing, groups, defaultGroupId, onClose, onSaved
}: Props) {

  const [form, setForm] = useState<FormState>({ ...emptyForm })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)

  // 打开时根据 context 初始化
  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        name: editing.name,
        launch_path: editing.launch_path,
        launch_type: editing.launch_type,
        launch_args: editing.launch_args ?? '',
        cover_image: editing.cover_image ?? null,
        group_id: editing.group_id
      })
    } else {
      setForm({ ...emptyForm, group_id: defaultGroupId ?? null })
    }
    setErrors({})
  }, [open, editing, defaultGroupId])

  if (!open) return null

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) e.name = '游戏名称不能为空'
    if (!form.launch_path.trim()) e.launch_path = '启动路径不能为空'
    // URL 校验
    if (form.launch_type === 'url') {
      try { new URL(form.launch_path.trim()) }
      catch { e.launch_path = 'URL 格式不正确（需含 http:// 或 https://）' }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSelectCover = async () => {
    const api = window.electronAPI
    if (!api) return
    const r = await api.selectFile([{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }])
    if (r.canceled || !r.filePaths[0]) return
    const src = r.filePaths[0]
    // 保存到 covers/ 目录，拿到 relativePath
    const saved = await api.coverSaveFromPath(src)
    update('cover_image', saved.relativePath)
  }

  /** 选择 EXE / 脚本文件 */
  const handleSelectLaunchFile = async () => {
    const api = window.electronAPI
    if (!api) return
    const filters = form.launch_type === 'bat'
      ? [{ name: '脚本文件', extensions: ['bat', 'cmd', 'ps1', 'vbs'] }]
      : [{ name: '可执行文件', extensions: ['exe', 'com', 'msi'] }]
    const r = await api.selectFile(filters)
    if (r.canceled || !r.filePaths[0]) return
    update('launch_path', r.filePaths[0])
  }

  const handleLaunchTypeChange = (t: LaunchType) => {
    update('launch_type', t)
    // 切换类型时清空可能无效的路径
    if (t !== 'url' && form.launch_path.startsWith('http')) update('launch_path', '')
    if (t === 'url' && !form.launch_path.startsWith('http')) update('launch_path', '')
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const api = window.electronAPI!
      if (editing) {
        await api.gamesUpdate(editing.id, {
          name: form.name.trim(),
          launch_path: form.launch_path.trim(),
          launch_type: form.launch_type,
          launch_args: form.launch_args || undefined,
          cover_image: form.cover_image,
          group_id: form.group_id
        })
      } else {
        await api.gamesCreate({
          name: form.name.trim(),
          launch_path: form.launch_path.trim(),
          launch_type: form.launch_type,
          launch_args: form.launch_args || undefined,
          cover_image: form.cover_image,
          group_id: form.group_id
        })
      }
      onSaved()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions: { label: string; value: LaunchType; hint: string }[] = [
    { label: 'EXE 程序', value: 'exe', hint: '.exe 可执行文件' },
    { label: '脚本', value: 'bat', hint: '.bat / .cmd 脚本' },
    { label: '网页 / 商店', value: 'url', hint: 'URL 或 steam://' }
  ]

  return (
    <>
      {/* 遮罩 */}
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', zIndex: 100
      }} />

      {/* Modal */}
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 560, maxHeight: '90vh',
        background: 'var(--surface-0)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        zIndex: 110,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center'
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>
            {editing ? '编辑游戏' : '添加游戏'}
          </div>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* 表单内容 */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* 封面图 */}
          <FormRow label="封面图" hint="点击下方区域选择本地图片" error={errors.cover_image}>
            <div
              onClick={handleSelectCover}
              style={{
                aspectRatio: '16/9',
                borderRadius: 10,
                border: '2px dashed var(--border-strong)',
                background: form.cover_image
                  ? '#000'
                  : 'var(--surface-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative', overflow: 'hidden',
                transition: 'border-color 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
            >
              {form.cover_image ? (
                <img
                  src={`szgame://${form.cover_image}`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>🖼</div>
                  点击选择封面图
                </div>
              )}
            </div>
          </FormRow>

          {/* 游戏名称 */}
          <FormRow label="游戏名称 *" error={errors.name}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="例如：Counter-Strike 2"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                style={{ ...inputStyle(!!errors.name), flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setCoverPickerOpen(true)}
                disabled={!form.name.trim()}
                title="从 RAWG 搜索封面"
                style={{
                  height: 36, padding: '0 14px', borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: form.name.trim() ? 'var(--surface-1)' : 'var(--surface-2)',
                  color: form.name.trim() ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 12, cursor: form.name.trim() ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'border-color 0.15s'
                }}
              >🎨 获取封面</button>
            </div>
          </FormRow>

          {/* 启动类型 */}
          <FormRow label="启动类型">
            <div style={{ display: 'flex', gap: 8 }}>
              {typeOptions.map(opt => {
                const active = form.launch_type === opt.value
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleLaunchTypeChange(opt.value)}
                    style={{
                      flex: 1, padding: '10px 12px',
                      borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-subtle)' : 'var(--surface-1)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, marginTop: 2, opacity: 0.7 }}>{opt.hint}</div>
                  </div>
                )
              })}
            </div>
          </FormRow>

          {/* 启动路径 */}
          <FormRow label="启动路径 *" error={errors.launch_path}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={pathPlaceholder(form.launch_type)}
                value={form.launch_path}
                onChange={e => update('launch_path', e.target.value)}
                style={{ ...inputStyle(!!errors.launch_path), fontFamily: 'monospace', fontSize: 12, flex: 1 }}
              />
              {form.launch_type !== 'url' && (
                <button
                  onClick={handleSelectLaunchFile}
                  type="button"
                  title={form.launch_type === 'bat' ? '选择脚本文件' : '选择可执行文件'}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    background: 'var(--surface-1)',
                    color: 'var(--text-primary)', fontSize: 12,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
                  }}
                >浏览…</button>
              )}
            </div>
          </FormRow>

          {/* 启动参数 */}
          <FormRow label="启动参数" hint="选填，原样透传给程序">
            <input
              type="text"
              placeholder="-fullscreen -novsync"
              value={form.launch_args}
              onChange={e => update('launch_args', e.target.value)}
              style={{ ...inputStyle(false), fontFamily: 'monospace', fontSize: 12 }}
            />
          </FormRow>

          {/* 所属分组 */}
          <FormRow label="所属分组">
            <select
              value={form.group_id ?? ''}
              onChange={e => update('group_id', e.target.value ? Number(e.target.value) : null)}
              style={selectStyle()}
            >
              <option value="">全部</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </FormRow>
        </div>

        {/* 底部操作 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 10, justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} style={btnGhost}>取消</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...btnPrimary,
              opacity: submitting ? 0.6 : 1,
              cursor: submitting ? 'default' : 'pointer'
            }}
          >
            {submitting ? '保存中...' : (editing ? '保存修改' : '添加游戏')}
          </button>
        </div>
      </div>

      {/* 远程封面选择弹窗 */}
      <CoverPickerModal
        open={coverPickerOpen}
        keyword={form.name}
        onClose={() => setCoverPickerOpen(false)}
        onPick={(relativePath) => update('cover_image', relativePath)}
      />
    </>
  )
}

// ============================================================
// Helpers
// ============================================================

function pathPlaceholder(type: LaunchType): string {
  switch (type) {
    case 'exe': return 'C:\\Games\\GameFolder\\game.exe'
    case 'bat': return 'C:\\Games\\start.bat'
    case 'url': return 'https://... 或 steam://rungameid/730'
  }
}

function FormRow({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
        marginBottom: 7, letterSpacing: 0.3, display: 'flex', alignItems: 'baseline', gap: 8
      }}>
        <span style={{ textTransform: 'uppercase' }}>{label}</span>
        {hint && <span style={{ fontWeight: 400, textTransform: 'none', opacity: 0.6 }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠ {error}</div>
      )}
    </div>
  )
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%', height: 36,
    background: 'var(--surface-1)',
    border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border-strong)'}`,
    borderRadius: 6, padding: '0 12px',
    color: 'var(--text-primary)', fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s'
  }
}

function selectStyle(): React.CSSProperties {
  return {
    width: '100%', height: 36,
    background: 'var(--surface-1)',
    border: '1px solid var(--border-strong)',
    borderRadius: 6, padding: '0 10px',
    color: 'var(--text-primary)', fontSize: 13,
    outline: 'none', cursor: 'pointer'
  }
}

const closeBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 6,
  border: 'none', background: 'transparent',
  color: 'var(--text-tertiary)', cursor: 'pointer',
  fontSize: 16
}

const btnPrimary: React.CSSProperties = {
  height: 38, padding: '0 22px', borderRadius: 6,
  border: 'none', background: 'var(--accent)', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'background 0.15s'
}

const btnGhost: React.CSSProperties = {
  height: 38, padding: '0 22px', borderRadius: 6,
  border: '1px solid var(--border-strong)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
  transition: 'all 0.15s'
}
