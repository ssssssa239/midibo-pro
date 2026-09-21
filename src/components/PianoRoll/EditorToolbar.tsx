import React from 'react';
import { EditorTool } from '../../types/editor';
import { InstrumentProfile } from '../../types/midiboProfile';

interface Props {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  profile: InstrumentProfile;
  activeKeySwitch: number;
  onSelectKeySwitch: (note: number) => void;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onOpenProfileModal: () => void;
}

export const EditorToolbar: React.FC<Props> = ({
  activeTool,
  onSelectTool,
  profile,
  activeKeySwitch,
  onSelectKeySwitch,
  zoomLevel,
  onZoomChange,
  onOpenProfileModal
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 12px',
        background: '#11111c',
        borderBottom: '1px solid #111320',
        gap: 10,
        flexShrink: 0,
        color: '#E2EFFF',
        whiteSpace: 'nowrap'
      }}
    >
      {/* 1. ポインタツール */}
      <div style={{ display: 'flex', gap: 3, padding: 1, borderRadius: 4 }}>
        <button
          onClick={() => onSelectTool('pencil')}
          title="鉛筆ツール (P)"
          style={{
            padding: '3px 10px',
            fontSize: 14,
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            background: activeTool === 'pencil' ? '#6c61ff' : '#455571',
            lineHeight: 1
          }}
        >
          ✏️
        </button>
        <button
          onClick={() => onSelectTool('eraser')}
          title="消しゴムツール (E)"
          style={{
            padding: '3px 10px',
            fontSize: 14,
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            background: activeTool === 'eraser' ? '#f2515e' : '#455571',
            lineHeight: 1
          }}
        >
          ⌫
        </button>
        {/* ★ 奏法ブラシボタン（1本化・選択時はアクセントオレンジ） */}
        <button
          onClick={() => onSelectTool('brush')}
          title="奏法ブラシ (数字 1〜9, 0)"
          style={{
            padding: '3px 10px',
            fontSize: 14,
            border: 'none',
            borderRadius: 3,
            cursor: 'pointer',
            background: activeTool === 'brush' ? '#fabc49' : '#455571',
            color: activeTool === 'brush' ? '#1E202C' : '#E2EFFF',
            lineHeight: 1,
            transition: 'background 0.15s ease'
          }}
        >
          🖌️
        </button>
      </div>

      <div style={{ width: 1, height: 18, background: '#242B3D' }} />

      {/* 2. 小節間隔ズーム */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onZoomChange(Math.max(0.1, Number((zoomLevel - 0.1).toFixed(2))))}
          title="小節幅を縮小"
          style={{
            background: '#455571',
            border: '0px solid #72829F',
            color: '#E2EFFF',
            borderRadius: 3,
            width: 18,
            height: 18,
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1,
            padding: 0
          }}
        >
          -
        </button>
        <input
          type="range"
          min={0.1}
          max={3.0}
          step={0.05}
          value={zoomLevel}
          onChange={e => onZoomChange(Number(e.target.value))}
          style={{ width: 60, accentColor: '#b6d0ff', cursor: 'pointer' }}
        />
        <button
          onClick={() => onZoomChange(Math.min(3.0, Number((zoomLevel + 0.1).toFixed(2))))}
          title="小節幅を拡大"
          style={{
            background: '#455571',
            border: '0px solid #72829F',
            color: '#E2EFFF',
            borderRadius: 3,
            width: 18,
            height: 18,
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1,
            padding: 0
          }}
        >
          +
        </button>
      </div>

      <div style={{ width: 1, height: 18, background: '#242B3D' }} />

      {/* 3. 奏法パレット */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {profile.keySwitches.filter(k => k.isEnabled).map(ks => (
          <button
            key={ks.note}
            onClick={() => {
              onSelectKeySwitch(ks.note);
              onSelectTool('brush');
            }}
            title={`${ks.customName} (${ks.note})`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 7px',
              fontSize: 11,
              borderRadius: 3,
              border: activeKeySwitch === ks.note && activeTool === 'brush'
                ? `1.5px solid ${ks.badgeColor}`
                : '1px solid #434c62',
              background: activeKeySwitch === ks.note && activeTool === 'brush'
                ? 'rgba(255, 255, 255, 0.12)'
                : '#1A2030',
              color: '#E2EFFF',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: ks.badgeColor,
                display: 'inline-block'
              }}
            />
            <span>{ks.customName}</span>
            <span style={{ fontSize: 9, color: '#8FA4C4' }}>({ks.note})</span>
          </button>
        ))}
      </div>

      {/* 4. 楽器プロファイル設定ボタン */}
      <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
        <button
          onClick={onOpenProfileModal}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            background: '#242B3D',
            color: '#E3EFFF',
            border: '1px solid #ae8adc',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          楽器プリセット設定
        </button>
      </div>
    </div>
  );
};