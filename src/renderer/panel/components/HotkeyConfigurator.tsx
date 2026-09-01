/**
 * Hotkey Configurator & Overlay Toggle Component (Task H.5)
 *
 * Renders hotkey accelerator input and cursor companion toggle switch in Control Panel.
 *
 * References:
 *   PHASE_0_ARCHITECTURE.md §0.2 (renderer/panel module)
 *   PHASE_1_MODULES_AND_TASKS.md Task H.5 scoped checklist
 */

import React from 'react'
import { SettingsPayload } from '../../../shared/types/ipc'

export interface HotkeyConfiguratorProps {
  settings: SettingsPayload
  onUpdateSetting: (key: keyof SettingsPayload, value: unknown) => void
}

export const HotkeyConfigurator: React.FC<HotkeyConfiguratorProps> = ({
  settings,
  onUpdateSetting
}) => {
  return (
    <div className="panel-card">
      <div className="panel-card-title">Shortcut & Display</div>

      {/* Push-to-Talk Hotkey */}
      <div>
        <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
          Push-to-Talk Hotkey
        </label>
        <input
          type="text"
          className="panel-input"
          value={settings.pushToTalkHotkey}
          onChange={(e) => onUpdateSetting('pushToTalkHotkey', e.target.value)}
          placeholder="CommandOrControl+Alt+Space"
        />
      </div>

      {/* Cursor Companion Overlay Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>
            Visual Cursor Companion
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Show blue Pip avatar overlay
          </div>
        </div>

        <input
          type="checkbox"
          checked={settings.cursorEnabled}
          onChange={(e) => onUpdateSetting('cursorEnabled', e.target.checked)}
          style={{
            width: '18px',
            height: '18px',
            accentColor: '#38bdf8',
            cursor: 'pointer'
          }}
        />
      </div>
    </div>
  )
}
