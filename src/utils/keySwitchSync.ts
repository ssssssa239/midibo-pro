import { EditorNote } from '../types/editor';
import { InstrumentProfile } from '../types/midiboProfile';

/**
 * 各キースイッチ固有の制御方式 (ラッチ/ワンショット) とリードタイムに基づいて自動同期
 */
export function syncAutoKeySwitches(
  notes: EditorNote[],
  defaultChannel: number = 0,
  profile?: InstrumentProfile
): EditorNote[] {
  const manualKsNotes = notes.filter(n => n.pitch <= 10 && !n.sourceNoteId);
  const audibleNotes = notes.filter(n => n.pitch > 10).sort((a, b) => a.startTick - b.startTick);
  const keySwitches = profile?.keySwitches || [];

  const autoKsNotes: EditorNote[] = [];

  // 通常復帰 Normal (note 1) の設定を取得
  const normalKsConfig = keySwitches.find(k => k.note === 1);
  const normalLeadTime = normalKsConfig?.leadTimeTicks ?? 24;

  // 連続するラッチ型グループの抽出用
  const latchGroups: EditorNote[][] = [];
  let currentGroup: EditorNote[] = [];

  for (let i = 0; i < audibleNotes.length; i++) {
    const note = audibleNotes[i];

    // 通常音 (Normal: 1)
    if (note.articulationNote <= 1) {
      if (currentGroup.length > 0) {
        latchGroups.push(currentGroup);
        currentGroup = [];
      }
      continue;
    }

    const ksConfig = keySwitches.find(k => k.note === note.articulationNote);
    const ksMode = ksConfig?.mode ?? 'latch';
    const leadTime = ksConfig?.leadTimeTicks ?? 24;

    // ★ ワンショット型が指定された奏法: その音の直前のみに個別配置 (Normal復帰は不要)
    if (ksMode === 'oneshot') {
      if (currentGroup.length > 0) {
        latchGroups.push(currentGroup);
        currentGroup = [];
      }
      autoKsNotes.push({
        id: crypto.randomUUID(),
        pitch: note.articulationNote,
        startTick: Math.max(0, note.startTick - leadTime),
        durationTicks: leadTime,
        velocity: 100,
        channel: note.channel ?? defaultChannel,
        articulationNote: note.articulationNote,
        sourceNoteId: note.id
      });
      continue;
    }

    // ★ ラッチ型が指定された奏法: グルーピングして始点と次音直前Normalを生成
    if (note.isRangeArt) {
      if (currentGroup.length > 0) {
        const prev = currentGroup[currentGroup.length - 1];
        if (prev.isRangeArt && prev.articulationNote === note.articulationNote) {
          currentGroup.push(note);
        } else {
          latchGroups.push(currentGroup);
          currentGroup = [note];
        }
      } else {
        currentGroup = [note];
      }
    } else {
      if (currentGroup.length > 0) {
        latchGroups.push(currentGroup);
      }
      currentGroup = [note];
      latchGroups.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    latchGroups.push(currentGroup);
  }

  // ラッチ型グループの配置処理
  for (const grp of latchGroups) {
    if (grp.length === 0) continue;
    const firstNote = grp[0];
    const lastNote = grp[grp.length - 1];
    const art = firstNote.articulationNote;
    const ch = firstNote.channel ?? defaultChannel;

    const ksConfig = keySwitches.find(k => k.note === art);
    const leadTime = ksConfig?.leadTimeTicks ?? 24;

    // (A) フレーズ開始前のキースイッチON
    autoKsNotes.push({
      id: crypto.randomUUID(),
      pitch: art,
      startTick: Math.max(0, firstNote.startTick - leadTime),
      durationTicks: leadTime,
      velocity: 100,
      channel: ch,
      articulationNote: art,
      sourceNoteId: firstNote.id
    });

    // (B) フレーズ末尾：次音先行予約 Normal(1) の位置決定
    const followingNotes = audibleNotes.filter(n => n.startTick > lastNote.startTick);
    const nextNote = followingNotes[0];

    let resetStartTick: number;
    if (nextNote) {
      if (nextNote.articulationNote === 1) {
        // 次が通常音：Normalのリードタイム手前に配置 (直前ノートの演奏中)
        resetStartTick = Math.max(0, nextNote.startTick - normalLeadTime);
      } else {
        // 次が別の特殊奏法の場合は次のキースイッチが上書きするためNormalはスキップ
        continue;
      }
    } else {
      // 後続がない場合
      resetStartTick = lastNote.startTick + lastNote.durationTicks;
    }

    autoKsNotes.push({
      id: crypto.randomUUID(),
      pitch: 1,
      startTick: resetStartTick,
      durationTicks: normalLeadTime,
      velocity: 100,
      channel: ch,
      articulationNote: 1,
      sourceNoteId: lastNote.id
    });
  }

  return [...audibleNotes, ...manualKsNotes, ...autoKsNotes];
}