import React, { useRef } from 'react';
import { EditorTrack } from '../../types/editor';
import { InstrumentProfile } from '../../types/midiboProfile';

interface Props {
  tracks: EditorTrack[];
  selectedTrackId: string | null;
  availableProfiles: InstrumentProfile[]; // ★ インポートされたプロファイル一覧
  onSelectTrack: (trackId: string) => void;
  onUpdateTrackProfile: (trackId: string, profileId: string) => void;
  onImportMidi: (file: File) => void;
  onExportMidi: () => void;
}

export const TrackList: React.FC<Props> = ({
  tracks,
  selectedTrackId,
  availableProfiles,
  onSelectTrack,
  onUpdateTrackProfile,
  onImportMidi,
  onExportMidi
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportMidi(file);
    }
    e.target.value = '';
  };

  return (
    <div
      style={{
        width: 260,
        background: '#1E202C',
        borderRight: '4px solid #94A1B8',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        userSelect: 'none',
        position: 'relative' // ★ absolute配置の基準にするため追加
      }}
    >
      {/* ★★★ 左側（TrackList右上隅）の滑らかなアール ★★★ */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          zIndex: 50,
          pointerEvents: 'none'
        }}
      >
        <path d="M 14 0 L 14 14 Q 14 0 0 0 Z" fill="#94A1B8" />
      </svg>

      <div style={{ padding: '12px 14px', borderBottom: '0px solid #72829F', background: '#1E202C' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#C1CFE3' }}>トラック一覧</span>
          <span style={{ fontSize: 12, color: '#C1CFE3' }}>{tracks.length} Tracks</span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".mid,.midi"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 11,
              fontWeight: 'bold',
              background: '#5D7FAF',
              color: '#FFF',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer', // ★ 常に pointer を指定
            }}
          >
            + MIDI追加
          </button>
          <button
            onClick={onExportMidi}
            disabled={tracks.length === 0}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: 11,
              fontWeight: 'bold',
              background: tracks.length === 0 ? '#1C2237' : '#394d92',
              color: tracks.length === 0 ? '#4E5568' : '#FFF',
              border: 'none',
              borderRadius: 4,
              cursor: tracks.length === 0 ? 'not-allowed' : 'pointer', // エクスポート側のみ維持
            }}
          >
            MIDIエクスポート
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tracks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#8FA4C4', fontSize: 12 }}>
            MIDIファイルをドラッグ＆ドロップするか、「+ MIDI追加」を押してください。
          </div>
        ) : (
          tracks.map(track => {
            const isSelected = track.id === selectedTrackId;
            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: isSelected ? '1.5px solid #8ABFDB' : '1.5px solid #181822',
                  background: isSelected ? '#233043' : '#181822',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 'bold', color: isSelected ? '#FFF' : '#E2EFFF' }}>
                    {track.name}
                  </span>
                  <span style={{ fontSize: 10, color: '#8FA4C4' }}>
                    {track.notes.length} notes
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#8FA4C4' }}>プリセット:</span>
                  <select
                    value={track.profile.id}
                    onClick={e => e.stopPropagation()}
                    onChange={e => onUpdateTrackProfile(track.id, e.target.value)}
                    style={{
                      flex: 1,
                      background: '#222431',
                      border: '1px solid #5b677d',
                      borderRadius: 3,
                      color: '#A4D3FF',
                      fontSize: 11,
                      padding: '2px 4px'
                    }}
                  >
                    {availableProfiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};