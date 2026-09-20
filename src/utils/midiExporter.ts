import { Midi } from '@tonejs/midi';
import { EditorTrack, EditorNote } from '../types/editor';
import { InstrumentProfile } from '../types/midiboProfile';
import { DEFAULT_PROFILES } from '../constants/defaultProfiles';

/**
 * MIDIファイルを読み込み、エディタ用トラック配列へ変換
 * @param file MIDIファイル
 * @param availableProfiles 現在登録されているプリセット一覧（IndexedDBロード済み）
 */
export async function parseMidiFile(
  file: File,
  availableProfiles: InstrumentProfile[] = DEFAULT_PROFILES
): Promise<EditorTrack[]> {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const tracks: EditorTrack[] = [];

  midi.tracks.forEach((tr, idx) => {
    if (tr.notes.length === 0) return;

    // ★ 登録済みプリセットの中からトラック名に合うものを検索、無ければ現在有効な先頭プリセット
    const trackName = tr.name || `Track ${idx + 1}`;
    const matchedProfile =
      availableProfiles.find(p => trackName.toLowerCase().includes(p.name.toLowerCase())) ||
      availableProfiles[0] ||
      DEFAULT_PROFILES[0];

    const editorNotes: EditorNote[] = [];

    // ノート1〜10（キースイッチ）と通常演奏ノートを分離
    const keySwitchEvents: { tick: number; note: number }[] = [];
    const regularNotes: typeof tr.notes = [];

    tr.notes.forEach(n => {
      if (n.midi >= 1 && n.midi <= 10) {
        keySwitchEvents.push({ tick: n.ticks, note: n.midi });
      } else if (n.midi > 10) {
        regularNotes.push(n);
      }
    });

    keySwitchEvents.sort((a, b) => a.tick - b.tick);

    // 演奏ノートにキースイッチ属性（ラッチ型）を適用
    regularNotes.forEach(n => {
      let currentArt = 1;
      for (const ks of keySwitchEvents) {
        if (ks.tick <= n.ticks + 10) {
          currentArt = ks.note;
        } else {
          break;
        }
      }

      editorNotes.push({
        id: crypto.randomUUID(),
        pitch: n.midi,
        startTick: n.ticks,
        durationTicks: n.durationTicks,
        velocity: Math.round(n.velocity * 127),
        channel: tr.channel ?? 0,
        articulationNote: currentArt
      });
    });

    // 既存キースイッチを手動ノートとして保持
    keySwitchEvents.forEach(ks => {
      editorNotes.push({
        id: crypto.randomUUID(),
        pitch: ks.note,
        startTick: ks.tick,
        durationTicks: 24,
        velocity: 100,
        channel: tr.channel ?? 0,
        articulationNote: ks.note
      });
    });

    tracks.push({
      id: crypto.randomUUID(),
      name: trackName,
      channel: tr.channel ?? idx,
      profile: JSON.parse(JSON.stringify(matchedProfile)), // ★ 最新の有効プリセットを正しく注入
      notes: editorNotes
    });
  });

  return tracks;
}

/**
 * 編集後のトラック群をSMF（Standard MIDI File）バイナリとして書き出す
 */
export function exportMidiFile(tracks: EditorTrack[], songTitle: string = 'Midibo_Pro_export') {
  const midi = new Midi();
  midi.header.name = songTitle;

  tracks.forEach(track => {
    const profile = track.profile;
    const sortedNotes = [...track.notes].sort((a, b) => a.startTick - b.startTick);
    if (sortedNotes.length === 0) return;

    // トラック自体の基本チャンネルを使用
    const defaultChannel = track.channel ?? 0;
    const channelGroups = new Map<number, EditorNote[]>();

    // 音域分割（弦スプリット）が有効な場合はチャンネルごとにノートを振り分け
    if (profile.isPitchSplitEnabled && profile.pitchSplitRules.length > 0) {
      sortedNotes.forEach(note => {
        // キースイッチ（ノート1〜10）は基本Chに配置
        if (note.pitch <= 10) {
          if (!channelGroups.has(defaultChannel)) channelGroups.set(defaultChannel, []);
          channelGroups.get(defaultChannel)!.push(note);
          return;
        }

        const rule = profile.pitchSplitRules.find(
          r => note.pitch >= r.minPitch && note.pitch <= r.maxPitch
        );
        const targetCh = rule ? rule.outputChannel : defaultChannel;
        if (!channelGroups.has(targetCh)) channelGroups.set(targetCh, []);
        channelGroups.get(targetCh)!.push(note);
      });
    } else {
      channelGroups.set(defaultChannel, sortedNotes);
    }

    // 各チャンネルごとにMIDIトラックを生成し、配置されているノートを時間順に出力
    channelGroups.forEach((notesInCh, ch) => {
      const midiTrack = midi.addTrack();
      midiTrack.channel = ch;
      midiTrack.name = `${track.name} (Ch ${ch + 1})`;

      notesInCh.forEach(note => {
        midiTrack.addNote({
          midi: note.pitch,
          ticks: note.startTick,
          durationTicks: note.durationTicks,
          velocity: (note.velocity || 100) / 127
        });
      });
    });
  });

  // ダウンロード実行
  const bytes = midi.toArray();
  const blob = new Blob([bytes as any], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${songTitle}.mid`;
  a.click();
  URL.revokeObjectURL(url);
}