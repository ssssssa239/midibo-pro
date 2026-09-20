import React, { useState, useEffect, useRef } from 'react';
import { InstrumentProfile, KeySwitchConfig, PitchSplitRule } from '../../types/midiboProfile';
import { pitchToNoteName } from '../../utils/pitchHelper';

interface Props {
  isOpen: boolean;
  currentProfile: InstrumentProfile;
  availableProfiles: InstrumentProfile[];
  onApplyProfileToTrack: (profile: InstrumentProfile) => void;
  onCreateProfile: (newProfile: InstrumentProfile) => void;
  onRenameProfile: (id: string, newName: string) => void;
  onDeleteProfile: (id: string) => void;
  onClose: () => void;
}

type TabType = 'basic' | 'keyswitches' | 'splits';

/**
 * 音域（Pitch）専用入力コンポーネント
 * - 全削除時は自動で "0" にセット
 * - "0" の状態から入力された場合、打鍵した数字で 0 を即座に上書き
 * - 0〜127 の範囲で安全に制御
 */
const PitchInput: React.FC<{
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}> = ({ value, min = 0, max = 127, onChange }) => {
  const [text, setText] = useState<string>(String(value));
  const canOverwriteRef = useRef<boolean>(true);

  useEffect(() => {
    setText(String(value));
    canOverwriteRef.current = true;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // ★ 全部削除された場合は即座に "0" をセットし、次の打鍵で上書き可能にする
    if (raw === '') {
      setText('0');
      canOverwriteRef.current = true;
      onChange(0);
      return;
    }

    // ★ "0" の状態から入力された場合、0 を上書き
    if (canOverwriteRef.current && text === '0' && raw.length > 1) {
      if (raw === '00') {
        raw = '0';
      } else {
        raw = raw.replace('0', '');
      }
      canOverwriteRef.current = false;
    } else {
      canOverwriteRef.current = false;
    }

    // 先頭の余計なゼロを除去（"0" 単体は維持）
    if (raw.length > 1) {
      raw = raw.replace(/^0+/, '');
      if (raw === '') raw = '0';
    }

    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      const clamped = Math.min(max, Math.max(min, num));
      setText(raw);
      onChange(clamped);
    } else {
      setText(raw);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
    canOverwriteRef.current = true;
  };

  const handleBlur = () => {
    const num = parseInt(text, 10);
    const validNum = isNaN(num) ? 0 : Math.min(max, Math.max(min, num));
    setText(String(validNum));
    onChange(validNum);
    canOverwriteRef.current = true;
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        width: 64,
        background: '#191B2D',
        border: '1px solid #30354E',
        borderRadius: 4,
        color: '#FFF',
        padding: '4px 6px',
        fontSize: 12,
        textAlign: 'center'
      }}
    />
  );
};

/**
 * リードタイム専用入力コンポーネント
 */
const LeadTimeInput: React.FC<{
  value: number | undefined;
  onChange: (val: number) => void;
}> = ({ value, onChange }) => {
  const [text, setText] = useState<string>(String(value ?? 24));
  const canOverwriteRef = useRef<boolean>(true);

  useEffect(() => {
    setText(String(value ?? 24));
    canOverwriteRef.current = true;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    if (raw === '') {
      setText('');
      canOverwriteRef.current = false;
      return;
    }

    if (canOverwriteRef.current && text === '1' && raw.length > 1) {
      const newChar = raw.replace('1', '');
      raw = newChar !== '' ? newChar[0] : '1';
      canOverwriteRef.current = false;
    } else {
      canOverwriteRef.current = false;
    }

    raw = raw.replace(/^0+(?=\d)/, '');
    const num = parseInt(raw, 10);

    if (!isNaN(num)) {
      const clamped = Math.min(9999, Math.max(1, num));
      setText(String(clamped));
      onChange(clamped);
    } else {
      setText(raw);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
    canOverwriteRef.current = true;
  };

  const handleBlur = () => {
    const num = parseInt(text, 10);
    if (isNaN(num) || num < 1) {
      setText('24');
      onChange(24);
    } else {
      const clamped = Math.min(9999, Math.max(1, num));
      setText(String(clamped));
      onChange(clamped);
    }
    canOverwriteRef.current = true;
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{
        width: 52,
        background: '#191B2D',
        border: '1px solid #30354E',
        borderRadius: 4,
        color: '#FFF',
        padding: '3px 4px',
        fontSize: 11,
        textAlign: 'center'
      }}
    />
  );
};

export const ProfileModal: React.FC<Props> = ({
  isOpen,
  currentProfile,
  availableProfiles,
  onApplyProfileToTrack,
  onCreateProfile,
  onRenameProfile,
  onDeleteProfile,
  onClose
}) => {
  const [tempProfile, setTempProfile] = useState<InstrumentProfile>(currentProfile);
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTempProfile(JSON.parse(JSON.stringify(currentProfile)));
      setShowAdvanced(false);
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(tempProfile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tempProfile.name || 'Preset'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.playableRange || !parsed.keySwitches) {
          alert('不正なプリセットJSONです。');
          return;
        }
        const imported: InstrumentProfile = {
          ...parsed,
          id: `preset_${Date.now()}`
        };
        onCreateProfile(imported);
        setTempProfile(imported);
        alert(`プリセット「${imported.name}」をインポートしました！`);
      } catch (err) {
        alert('JSONファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectPreset = (presetId: string) => {
    const found = availableProfiles.find(p => p.id === presetId);
    if (found) {
      setTempProfile(JSON.parse(JSON.stringify(found)));
    }
  };

  const handleAddPreset = () => {
    const name = window.prompt('新しいプリセット名を入力してください:', `${tempProfile.name} (Copy)`);
    if (!name || !name.trim()) return;

    const newPreset: InstrumentProfile = {
      ...JSON.parse(JSON.stringify(tempProfile)),
      id: `preset_${Date.now()}`,
      name: name.trim()
    };
    onCreateProfile(newPreset);
    setTempProfile(newPreset);
  };

  const handleRenamePreset = () => {
    const name = window.prompt('新しいプリセット名を入力してください:', tempProfile.name);
    if (!name || !name.trim() || name === tempProfile.name) return;

    onRenameProfile(tempProfile.id, name.trim());
    setTempProfile(prev => ({ ...prev, name: name.trim() }));
  };

  const handleDeletePreset = () => {
    if (availableProfiles.length <= 1) {
      alert('最後の1つのプリセットは削除できません。');
      return;
    }
    if (!window.confirm(`プリセット「${tempProfile.name}」を削除しますか？`)) return;

    onDeleteProfile(tempProfile.id);
    const nextPreset = availableProfiles.find(p => p.id !== tempProfile.id);
    if (nextPreset) {
      setTempProfile(JSON.parse(JSON.stringify(nextPreset)));
    }
  };

  const handleUpdateKeySwitch = (note: number, updates: Partial<KeySwitchConfig>) => {
    setTempProfile(prev => ({
      ...prev,
      keySwitches: prev.keySwitches.map(ks => (ks.note === note ? { ...ks, ...updates } : ks))
    }));
  };

  const handleAddSplitRule = () => {
    const newRule: PitchSplitRule = {
      id: crypto.randomUUID(),
      name: `Part ${tempProfile.pitchSplitRules.length + 1}`,
      minPitch: tempProfile.playableRange.minPitch,
      maxPitch: tempProfile.playableRange.maxPitch,
      outputChannel: tempProfile.pitchSplitRules.length,
      color: '#54A0FF'
    };
    setTempProfile(prev => ({
      ...prev,
      pitchSplitRules: [...prev.pitchSplitRules, newRule]
    }));
  };

  const handleUpdateSplitRule = (id: string, updates: Partial<PitchSplitRule>) => {
    setTempProfile(prev => ({
      ...prev,
      pitchSplitRules: prev.pitchSplitRules.map(r => (r.id === id ? { ...r, ...updates } : r))
    }));
  };

  const handleDeleteSplitRule = (id: string) => {
    setTempProfile(prev => ({
      ...prev,
      pitchSplitRules: prev.pitchSplitRules.filter(r => r.id !== id)
    }));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 16, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        userSelect: 'none'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 700,
          maxHeight: '65vh',
          background: '#0A0E1A',
          border: '1px solid #DCB28A',
          borderRadius: 8,
          boxShadow: '0 12px 36px rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          color: '#E2EFFF',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 1. ヘッダー */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderBottom: '1px solid #30354E',
            background: '#10172A'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚙</span>
            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#C1CFE3' }}>
              演奏プリセット設定
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImportJSON}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '3px 8px', fontSize: 11, background: '#1C2742', color: '#E2EFFF', border: '1px solid #30354E', borderRadius: 4, cursor: 'pointer' }}
            >
              ⬇️ JSON読込
            </button>
            <button
              onClick={handleExportJSON}
              style={{ padding: '3px 8px', fontSize: 11, background: '#1C2742', color: '#E2EFFF', border: '1px solid #30354E', borderRadius: 4, cursor: 'pointer' }}
            >
              ⬆️ JSON書出
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#8FA4C4', fontSize: 16, cursor: 'pointer', marginLeft: 4 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2. ツールバー */}
        <div style={{ padding: '8px 16px', background: '#191B2D', borderBottom: '1px solid #30354E', display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            onChange={e => handleSelectPreset(e.target.value)}
            value={tempProfile.id}
            style={{
              background: '#10172A',
              color: '#FFF',
              border: '1px solid #30354E',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: 'bold',
              minWidth: 160
            }}
          >
            {availableProfiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={handleAddPreset}
            title="現在の設定をもとに新規プリセットを追加"
            style={{ padding: '4px 8px', fontSize: 11, background: '#30354E', color: '#A4D3FF', border: '1px solid #3E4B6E', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
          >
            ＋ 追加
          </button>
          <button
            onClick={handleRenamePreset}
            title="プリセット名を変更"
            style={{ padding: '4px 8px', fontSize: 11, background: '#30354E', color: '#E2EFFF', border: '1px solid #3E4B6E', borderRadius: 4, cursor: 'pointer' }}
          >
            ✎ 名前の変更
          </button>
          <button
            onClick={handleDeletePreset}
            disabled={availableProfiles.length <= 1}
            title="プリセットを削除"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              background: availableProfiles.length <= 1 ? '#1C2237' : '#30354E',
              color: availableProfiles.length <= 1 ? '#4E5568' : '#ff415e',
              border: '1px solid #3E4B6E',
              borderRadius: 4,
              cursor: availableProfiles.length <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            削除
          </button>

          {/* タブ切り替え */}
          <div style={{ marginLeft: 'auto', display: 'flex', background: '#10172A', borderRadius: 4, padding: 2 }}>
            <button
              onClick={() => setActiveTab('basic')}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer', background: activeTab === 'basic' ? '#4c689d' : 'transparent', color: '#FFF' }}
            >
              基本・音域
            </button>
            <button
              onClick={() => setActiveTab('keyswitches')}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer', background: activeTab === 'keyswitches' ? '#4c689d' : 'transparent', color: '#FFF' }}
            >
              キースイッチ
            </button>
            <button
              onClick={() => setActiveTab('splits')}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 3, cursor: 'pointer', background: activeTab === 'splits' ? '#4c689d' : 'transparent', color: '#FFF' }}
            >
              音域分割
            </button>
          </div>
        </div>

        {/* 3. タブコンテンツ */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto', maxHeight: 420 }}>
          {/* TAB 1: 基本・音域 (PitchInput による安定入力) */}
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 16, background: '#10172A', borderRadius: 6, border: '1px solid #30354E' }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: '#A4D3FF', marginBottom: 8 }}>
                  演奏可能音域 (Playable Range)
                </div>
                <div style={{ fontSize: 11, color: '#8FA4C4', marginBottom: 14 }}>
                  ※設定した音域の外側はピアノロール上で暗い灰色にマスクされます。
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#8FA4C4' }}>最低音 (Min Pitch):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      {/* ★ 最低音入力コンポーネント */}
                      <PitchInput
                        value={tempProfile.playableRange.minPitch}
                        min={0}
                        max={127}
                        onChange={num => {
                          setTempProfile({
                            ...tempProfile,
                            playableRange: {
                              ...tempProfile.playableRange,
                              minPitch: num
                            }
                          });
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#00D2D3' }}>
                        {pitchToNoteName(tempProfile.playableRange.minPitch)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, color: '#8FA4C4' }}>最高音 (Max Pitch):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      {/* ★ 最高音入力コンポーネント */}
                      <PitchInput
                        value={tempProfile.playableRange.maxPitch}
                        min={0}
                        max={127}
                        onChange={num => {
                          setTempProfile({
                            ...tempProfile,
                            playableRange: {
                              ...tempProfile.playableRange,
                              maxPitch: num
                            }
                          });
                        }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: '#FF4757' }}>
                        {pitchToNoteName(tempProfile.playableRange.maxPitch)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: キースイッチ */}
          {activeTab === 'keyswitches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8FA4C4', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showAdvanced}
                    onChange={e => setShowAdvanced(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#4c689d' }}
                  />
                  <span>高度な設定 (リードタイム・方式の個別指定)</span>
                </label>
              </div>

              {showAdvanced && (
                <div
                  style={{
                    padding: '8px 12px',
                    background: '#10172A',
                    border: '1px solid #30354E',
                    borderRadius: 6,
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: '#8FA4C4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <div>
                    <strong style={{ color: '#A4D3FF' }}>リード（リードタイム）:</strong> 音が鳴る何 ticks 前にキースイッチを先行送信（予約）するかを設定します（480 ticks = 1拍）。
                  </div>
                  <div>
                    <strong style={{ color: '#00D2D3' }}>ラッチ型:</strong> 次の指示まで奏法を維持します。次の通常音の直前（演奏ノートの途中）に通常復帰（Normal: 1）が自動予約されます。
                  </div>
                  <div>
                    <strong style={{ color: '#FFA500' }}>ワンショット型:</strong> その音のみに奏法を適用します。マイコン側で自動復帰するため、通常復帰キーは送信されません。
                  </div>
                </div>
              )}

              {tempProfile.keySwitches.map(ks => (
                <div
                  key={ks.note}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: ks.isEnabled ? '#191B2D' : '#252635',
                    borderRadius: 4,
                    border: '1px solid #30354E'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={ks.isEnabled}
                    disabled={ks.note === 1}
                    onChange={e => handleUpdateKeySwitch(ks.note, { isEnabled: e.target.checked })}
                  />
                  <span style={{ width: 18, fontSize: 12, fontWeight: 'bold', color: '#A4D3FF' }}>
                    {ks.note}
                  </span>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: ks.badgeColor, display: 'inline-block' }} />
                  <span style={{ width: 75, fontSize: 11, color: '#8FA4C4' }}>
                    {ks.standardType}
                  </span>
                  
                  <input
                    type="text"
                    value={ks.customName}
                    onChange={e => handleUpdateKeySwitch(ks.note, { customName: e.target.value })}
                    style={{ flex: 1, minWidth: 80, background: '#3D4764', border: '1px solid #30354E', borderRadius: 4, color: '#FFF', padding: '4px 8px', fontSize: 11 }}
                  />

                  {showAdvanced && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 10, color: '#8FA4C4' }}>リード:</span>
                        <LeadTimeInput
                          value={ks.leadTimeTicks}
                          onChange={val => handleUpdateKeySwitch(ks.note, { leadTimeTicks: val })}
                        />
                        <span style={{ fontSize: 10, color: '#8FA4C4' }}>tk</span>
                      </div>

                      <select
                        value={ks.mode ?? 'latch'}
                        disabled={ks.note === 1}
                        onChange={e => handleUpdateKeySwitch(ks.note, { mode: e.target.value as 'latch' | 'oneshot' })}
                        style={{
                          background: '#191B2D',
                          color: (ks.mode ?? 'latch') === 'latch' ? '#00D2D3' : '#FFA500',
                          border: '1px solid #30354E',
                          borderRadius: 4,
                          padding: '3px 6px',
                          fontSize: 11,
                          flexShrink: 0,
                          cursor: ks.note === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="latch">ラッチ型</option>
                        <option value="oneshot">ワンショット型</option>
                      </select>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: 音域分割 */}
          {activeTab === 'splits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 'bold' }}>
                  <input
                    type="checkbox"
                    checked={tempProfile.isPitchSplitEnabled}
                    onChange={e => setTempProfile({ ...tempProfile, isPitchSplitEnabled: e.target.checked })}
                  />
                  音域ごとに送信Chを自動で振り分ける
                </label>
                {tempProfile.isPitchSplitEnabled && (
                  <button
                    onClick={handleAddSplitRule}
                    style={{ padding: '3px 8px', fontSize: 11, background: '#72829F', color: '#FFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    + ルール追加
                  </button>
                )}
              </div>

              {tempProfile.isPitchSplitEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {tempProfile.pitchSplitRules.map((rule) => (
                    <div
                      key={rule.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#191B2D', borderRadius: 4, border: '1px solid #30354E' }}
                    >
                      <input
                        type="color"
                        value={rule.color}
                        onChange={e => handleUpdateSplitRule(rule.id, { color: e.target.value })}
                        style={{ width: 22, height: 22, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      />
                      <input
                        type="text"
                        value={rule.name}
                        onChange={e => handleUpdateSplitRule(rule.id, { name: e.target.value })}
                        style={{ width: 90, background: '#10172A', border: '1px solid #30354E', borderRadius: 4, color: '#FFF', padding: '3px 6px', fontSize: 11 }}
                      />
                      <span style={{ fontSize: 11, color: '#8FA4C4' }}>範囲:</span>
                      <input
                        type="number"
                        min={0}
                        max={rule.maxPitch}
                        value={rule.minPitch}
                        onChange={e => handleUpdateSplitRule(rule.id, { minPitch: Number(e.target.value) })}
                        style={{ width: 44, background: '#10172A', border: '1px solid #30354E', borderRadius: 4, color: '#FFF', padding: 2, fontSize: 11 }}
                      />
                      <span style={{ fontSize: 11, color: '#A4D3FF' }}>{pitchToNoteName(rule.minPitch)}</span>
                      <span>〜</span>
                      <input
                        type="number"
                        min={rule.minPitch}
                        max={127}
                        value={rule.maxPitch}
                        onChange={e => handleUpdateSplitRule(rule.id, { maxPitch: Number(e.target.value) })}
                        style={{ width: 44, background: '#10172A', border: '1px solid #30354E', borderRadius: 4, color: '#FFF', padding: 2, fontSize: 11 }}
                      />
                      <span style={{ fontSize: 11, color: '#A4D3FF' }}>{pitchToNoteName(rule.maxPitch)}</span>

                      <span style={{ fontSize: 11, color: '#8FA4C4', marginLeft: 6 }}>➔ Ch:</span>
                      <select
                        value={rule.outputChannel}
                        onChange={e => handleUpdateSplitRule(rule.id, { outputChannel: Number(e.target.value) })}
                        style={{ background: '#10172A', color: '#FFF', border: '1px solid #30354E', borderRadius: 4, padding: '2px 4px', fontSize: 11 }}
                      >
                        {Array.from({ length: 16 }, (_, i) => (
                          <option key={i} value={i}>Ch {i + 1}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleDeleteSplitRule(rule.id)}
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#FF4757', cursor: 'pointer', fontSize: 13 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. フッター */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '10px 18px',
            borderTop: '1px solid #30354E',
            background: '#10172A',
            gap: 10
          }}
        >
          <button
            onClick={onClose}
            style={{ padding: '5px 12px', fontSize: 12, background: '#30354E', color: '#E2EFFF', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            閉じる
          </button>
          <button
            onClick={() => {
              onApplyProfileToTrack(tempProfile);
              onClose();
            }}
            style={{ padding: '5px 14px', fontSize: 12, background: '#5286cf', color: '#FFF', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}
          >
            このプリセットをトラックに適用
          </button>
        </div>
      </div>
    </div>
  );
};