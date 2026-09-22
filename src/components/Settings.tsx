import type { AppSettings } from '../types'

interface Props {
  version: string
  settings: AppSettings
  onSettingsChange: (key: string, value: string) => void
}

export default function Settings({ version, settings, onSettingsChange }: Props) {

  const minimizeValue = settings.window_minimize_behavior
  const closeValue = settings.window_close_behavior

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
          desc="决定窗口最小化后的停靠位置"
          value={minimizeValue}
          options={[
            { label: '任务栏', value: 'taskbar' },
            { label: '系统托盘', value: 'tray' }
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
