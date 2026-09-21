import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorTrack, EditorTool, EditorNote } from './types/editor';
import { InstrumentProfile } from './types/midiboProfile';
import { DEFAULT_PROFILES } from './constants/defaultProfiles';
import { ProfileStorage } from './storage/ProfileStorage';
import { PianoRollCanvas } from './components/PianoRoll/PianoRollCanvas';
import { EditorToolbar } from './components/PianoRoll/EditorToolbar';
import { KeySwitchLane } from './components/PianoRoll/KeySwitchLane';
import { TrackList } from './components/TrackList/TrackList';
import { ProfileModal } from './components/ProfileModal/ProfileModal';
import { parseMidiFile, exportMidiFile } from './utils/midiExporter';

const MAX_HISTORY_STEPS = 50;

export const App: React.FC = () => {
  const [tracks, setTracks] = useState<EditorTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // プリセット一覧 (IndexedDB より復元)
  const [registeredProfiles, setRegisteredProfiles] = useState<InstrumentProfile[]>(DEFAULT_PROFILES);

  const [activeTool, setActiveTool] = useState<EditorTool>('pencil');
  const [isRangeMode, setIsRangeMode] = useState<boolean>(false);
  const [activeKeySwitch, setActiveKeySwitch] = useState<number>(2);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isKeySwitchLaneOpen, setIsKeySwitchLaneOpen] = useState<boolean>(true);
  const [pianoRollScrollX, setPianoRollScrollX] = useState<number>(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // ★ Undo / Redo スタック
  const undoStackRef = useRef<EditorNote[][]>([]);
  const redoStackRef = useRef<EditorNote[][]>([]);

  const currentTrack: EditorTrack | null =
    tracks.find(t => t.id === selectedTrackId) || tracks[0] || null;

  // トラックが切り替わったらUndo/Redoスタックをクリア
  useEffect(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [selectedTrackId]);

  // IndexedDB からプリセットを非同期ロード
  useEffect(() => {
    const initStorage = async () => {
      try {
        const storage = ProfileStorage.getInstance();
        const loaded = await storage.loadAllProfiles();
        if (loaded && loaded.length > 0) {
          setRegisteredProfiles(loaded);

          setTracks(prev =>
            prev.map(t => {
              const exists = loaded.some(p => p.id === t.profile.id);
              return exists ? t : { ...t, profile: JSON.parse(JSON.stringify(loaded[0])) };
            })
          );
        }
      } catch (err) {
        console.error('Failed to load profiles from IndexedDB:', err);
      }
    };
    initStorage();
  }, []);

  const handleImportFile = async (file: File) => {
    try {
      const parsedTracks = await parseMidiFile(file, registeredProfiles);
      if (parsedTracks.length > 0) {
        setTracks(parsedTracks);
        setSelectedTrackId(parsedTracks[0].id);
        undoStackRef.current = [];
        redoStackRef.current = [];
      }
    } catch (err) {
      alert('MIDIファイルの読み込みに失敗しました。');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
      handleImportFile(file);
    }
  };

  // ★ 操作前の状態を直接Undoスタックへ記録する関数
  const handleRecordHistory = useCallback((snapshotBeforeChange: EditorNote[]) => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(snapshotBeforeChange)));
    if (undoStackRef.current.length > MAX_HISTORY_STEPS) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = []; // 新しい操作が入ったのでRedoはクリア
  }, []);

  // ★ ノート更新関数
  const handleUpdateNotes = useCallback(
    (newNotes: EditorNote[]) => {
      if (!currentTrack) return;
      setTracks(prev =>
        prev.map(t => (t.id === currentTrack.id ? { ...t, notes: newNotes } : t))
      );
    },
    [currentTrack]
  );

  // ★ Undo (元に戻す)
  const handleUndo = useCallback(() => {
    if (!currentTrack || undoStackRef.current.length === 0) return;

    const previousNotes = undoStackRef.current.pop();
    if (!previousNotes) return;

    // 現在の状態をRedoスタックに退避
    redoStackRef.current.push(JSON.parse(JSON.stringify(currentTrack.notes)));

    setTracks(prev =>
      prev.map(t => (t.id === currentTrack.id ? { ...t, notes: previousNotes } : t))
    );
  }, [currentTrack]);

  // ★ Redo (やり直す)
  const handleRedo = useCallback(() => {
    if (!currentTrack || redoStackRef.current.length === 0) return;

    const nextNotes = redoStackRef.current.pop();
    if (!nextNotes) return;

    // 現在の状態をUndoスタックに退避
    undoStackRef.current.push(JSON.parse(JSON.stringify(currentTrack.notes)));

    setTracks(prev =>
      prev.map(t => (t.id === currentTrack.id ? { ...t, notes: nextNotes } : t))
    );
  }, [currentTrack]);

  const handleUpdateTrackProfilePreset = (trackId: string, profileId: string) => {
    const found = registeredProfiles.find(p => p.id === profileId);
    if (!found) return;
    setTracks(prev =>
      prev.map(t => (t.id === trackId ? { ...t, profile: JSON.parse(JSON.stringify(found)) } : t))
    );
  };

  const handleApplyProfile = async (profile: InstrumentProfile) => {
    if (!currentTrack) return;
    await ProfileStorage.getInstance().saveProfile(profile);

    setRegisteredProfiles(prev => {
      const exists = prev.some(p => p.id === profile.id);
      return exists ? prev.map(p => (p.id === profile.id ? profile : p)) : [...prev, profile];
    });

    setTracks(prev =>
      prev.map(t => (t.id === currentTrack.id ? { ...t, profile } : t))
    );
  };

  const handleCreateProfile = async (newProfile: InstrumentProfile) => {
    await ProfileStorage.getInstance().saveProfile(newProfile);
    setRegisteredProfiles(prev => [...prev, newProfile]);
  };

  const handleRenameProfile = async (id: string, newName: string) => {
    const target = registeredProfiles.find(p => p.id === id);
    if (!target) return;
    const updated = { ...target, name: newName };

    await ProfileStorage.getInstance().saveProfile(updated);
    setRegisteredProfiles(prev => prev.map(p => (p.id === id ? updated : p)));
    setTracks(prev =>
      prev.map(t => (t.profile.id === id ? { ...t, profile: updated } : t))
    );
  };

  const handleDeleteProfile = async (id: string) => {
    await ProfileStorage.getInstance().deleteProfile(id);
    setRegisteredProfiles(prev => prev.filter(p => p.id !== id));
  };

  const handleToggleBrush = () => {
    if (activeTool !== 'brush') {
      setActiveTool('brush');
      setIsRangeMode(false);
    } else {
      setIsRangeMode(prev => !prev);
    }
  };

  // ★ キーボードショートカット (Undo/Redo & ツール切り替え)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中はブラウザ標準のテキスト操作に譲る
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // 1. Undo / Redo の判定
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo(); // Cmd + Shift + Z (Mac) / Ctrl + Shift + Z (Win)
        } else {
          handleUndo(); // Cmd + Z / Ctrl + Z
        }
        return;
      }

      if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo(); // Ctrl + Y (Win Redo)
        return;
      }

      // 2. ツール切り替えショートカット
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 10) {
        setActiveKeySwitch(num);
        setActiveTool('brush');
      } else if (e.key === 'p') {
        setActiveTool('pencil');
      } else if (e.key === 'e') {
        setActiveTool('eraser');
      } else if (e.key === 'v') {
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0D111A',
        color: '#E2EFFF',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* 最上部ヘッダー */}
      <div
        style={{
          height: 42,
          padding: '0 16px',
          background: '#181822',
          borderBottom: '2px solid #94A1B8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 17, fontWeight: 'bold', color: '#8ec6ff' }}>Midibo Pro</span>
          <span style={{ fontSize: 10, color: '#8FA4C4' }}>| Beta版</span>
        </div>

        {currentTrack && (
          <div style={{ fontSize: 12, color: '#E3EFFF', background: '#1D2436', padding: '3px 10px', borderRadius: 12 }}>
            編集中のプリセット: <strong>{currentTrack.profile?.name}</strong> ({currentTrack.notes?.length || 0} 音)
          </div>
        )}
      </div>

      {/* メイン作業ペイン */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <TrackList
          tracks={tracks}
          selectedTrackId={currentTrack?.id || null}
          availableProfiles={registeredProfiles}
          onSelectTrack={id => setSelectedTrackId(id)}
          onUpdateTrackProfile={handleUpdateTrackProfilePreset}
          onImportMidi={handleImportFile}
          onExportMidi={() => exportMidiFile(tracks)}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
          {/* 右側のアール */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 50,
              pointerEvents: 'none'
            }}
          >
            <path d="M 0 0 L 0 14 Q 0 0 14 0 Z" fill="#94A1B8" />
          </svg>

          {currentTrack ? (
            <>
              <EditorToolbar
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                profile={currentTrack.profile}
                activeKeySwitch={activeKeySwitch}
                onSelectKeySwitch={setActiveKeySwitch}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onOpenProfileModal={() => setIsProfileModalOpen(true)}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                  <PianoRollCanvas
                    track={currentTrack}
                    activeTool={activeTool}
                    activeKeySwitch={activeKeySwitch}
                    zoomLevel={zoomLevel}
                    onZoomChange={setZoomLevel}
                    onNotesChange={handleUpdateNotes}
                    onRecordHistory={handleRecordHistory}
                    onScrollXChange={setPianoRollScrollX}
                  />
                </div>

                <div
                  onClick={() => setIsKeySwitchLaneOpen(prev => !prev)}
                  style={{
                    height: 22,
                    background: '#181822',
                    borderTop: '1px solid #475569',
                    borderBottom: isKeySwitchLaneOpen ? '1px solid #475569' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 12px',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: isKeySwitchLaneOpen ? '#c6d5e7' : '#8FA4C4',
                    userSelect: 'none'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>
                    {isKeySwitchLaneOpen ? '▼' : '▲'} キースイッチ専用ピアノロール (ノート 1〜10)
                  </span>
                  <span style={{ fontSize: 10, color: '#72829F' }}>
                    {isKeySwitchLaneOpen ? 'クリックして収納' : 'クリックして展開・手動編集'}
                  </span>
                </div>

                {isKeySwitchLaneOpen && (
                  <KeySwitchLane
                    track={currentTrack}
                    activeTool={activeTool}
                    scrollX={pianoRollScrollX}
                    zoomLevel={zoomLevel}
                    onScrollXChange={setPianoRollScrollX}
                    onNotesChange={handleUpdateNotes}
                    onRecordHistory={handleRecordHistory} // ★ 追加
                  />
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8FA4C4',
                gap: 12
              }}
            >
              <div style={{ fontSize: 48 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 'bold' }}>MIDIファイルをドラッグ＆ドロップしてください</div>
              <div style={{ fontSize: 12 }}>または左メニューの「+ MIDI追加」からファイルを選択します</div>
            </div>
          )}
        </div>
      </div>

      {currentTrack && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          currentProfile={currentTrack.profile}
          availableProfiles={registeredProfiles}
          onApplyProfileToTrack={handleApplyProfile}
          onCreateProfile={handleCreateProfile}
          onRenameProfile={handleRenameProfile}
          onDeleteProfile={handleDeleteProfile}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;