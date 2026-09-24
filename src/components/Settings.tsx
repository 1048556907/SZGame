import { useState } from 'react'
import type { AppSettings } from '../types'

interface Props {
  version: string
  settings: AppSettings
  onSettingsChange: (key: string, value: string) => void
  onManualCheck: () => Promise<void>
}

export default function Settings({ version, settings, onSettingsChange, onManualCheck }: Props) {

  const minimizeValue = settings.window_minimize_behavior
  const closeValue = settings.window_close_behavior
  const autoCheck = settings.update_auto_check
  const forceUpdate = settings.update_force

  const [checking, setChecking] = useState(false)

  return (
    <div className="content-inner">
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <div className="page-subtitle">偏好与窗口行为</div>
        </div>
      </div>

      {/* 窗口行为 */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 14, marginBottom: 18, overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--border)',
          fontSize: 13, fontWeight: 600
        }}>窗口行为</div>

        {/* 最小化 */}
        <SettingRow
          title="点击最小化按钮时"
          desc="窗口最小化后停靠位置"
          value="taskbar"
          options={[
            { label: '任务栏（固定）', value: 'taskbar' }
          ]}
          onChange={v => onSettingsChange('window.minimize.behavior', v)}
        />

        <div style={{ height: 1, background: 'var(--border)', margin: '0 22px' }} />

        {/* 关闭 */}
        <SettingRow
          title="点击关闭按钮时"
          desc="决定关闭按钮是退出应用还是隐藏到托盘"
          value={closeValue}
          options={[
            { label: '直接退出', value: 'exit' },
            { label: '最小化到托盘', value: 'minimize-to-tray' }
          ]}
          onChange={v => onSettingsChange('window.close.behavior', v)}
        />
      </div>

      {/* 自动更新 */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 14, marginBottom: 18, overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--border)',
          fontSize: 13, fontWeight: 600
        }}>自动更新</div>

        {/* 启用自动检查 */}
        <ToggleRow
          title="启动时自动检查"
          desc="每次启动时自动检测 Gitee Releases 是否有新版本"
          checked={autoCheck}
          onChange={v => onSettingsChange('app.update.auto.check', v ? 'true' : 'false')}
        />

        <div style={{ height: 1, background: 'var(--border)', margin: '0 22px' }} />

        {/* 强制更新 */}
        <ToggleRow
          title="强制更新"
          desc="检测到新版本后自动下载并静默安装，不弹窗提示"
          checked={forceUpdate}
          onChange={v => onSettingsChange('app.update.force', v ? 'true' : 'false')}
        />

        <div style={{ height: 1, background: 'var(--border)', margin: '0 22px' }} />

        {/* 手动检查按钮 */}
        <div style={{
          padding: '16px 22px',
          display: 'flex', alignItems: 'center', gap: 20
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>手动检查</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              立即向 Gitee 发起一次版本检测
            </div>
          </div>
          <button
            onClick={async () => { setChecking(true); try { await onManualCheck() } finally { setChecking(false) } }}
            disabled={checking}
            style={{
              height: 32, padding: '0 16px', borderRadius: 6, border: 'none',
              background: checking ? 'var(--border)' : 'var(--accent)',
              color: '#fff', cursor: checking ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 600
            }}
          >{checking ? '检查中…' : '检查更新'}</button>
        </div>
      </div>

      {/* 关于 */}
      <div style={{
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 22px', borderBottom: '1px solid var(--border)',
          fontSize: 13, fontWeight: 600
        }}>关于</div>
        <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--accent-subtle)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src="../images/logo.png" alt="" style={{ width: 32, height: 32 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>SZGame</div>
            <div style={{
              fontSize: 12, color: 'var(--accent)',
              fontFamily: 'monospace', marginTop: 2
            }}>Version {version || 'loading...'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
              轻量本地游戏管理盒子 · Electron + React + SQLite
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 一行 Radio 选择 */
function SettingRow({ title, desc, value, options, onChange }: {
  title: string; desc: string; value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      padding: '16px 22px',
      display: 'flex', alignItems: 'center', gap: 20
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map(opt => {
          const active = opt.value === value
          return (
            <div
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                padding: '7px 14px', borderRadius: 6,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                background: active ? 'var(--accent-subtle)' : 'var(--surface-0)',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s', fontWeight: active ? 600 : 400,
                userSelect: 'none'
              }}
            >
              {opt.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 一行开关 Toggle */
function ToggleRow({ title, desc, checked, onChange }: {
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      padding: '16px 22px',
      display: 'flex', alignItems: 'center', gap: 20
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>{desc}</div>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 11,
          background: checked ? 'var(--accent)' : 'var(--border)',
          cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
        }}
      >
        <div style={{
          position: 'absolute', top: 2,
          left: checked ? 18 : 2,
          width: 18, height: 18, borderRadius: 9,
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  )
}
