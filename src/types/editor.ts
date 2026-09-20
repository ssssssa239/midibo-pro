import { InstrumentProfile } from './midiboProfile';

export type EditorTool = 'pencil' | 'eraser' | 'brush' | 'select';

export interface EditorNote {
  id: string;
  pitch: number;          // 0〜127 (1〜10はキースイッチ)
  startTick: number;
  durationTicks: number;
  velocity: number;
  channel: number;
  articulationNote: number;
  sourceNoteId?: string;  // 自動生成キースイッチの親ノートID
  isRangeArt?: boolean;   // ★ 範囲選択モードで指定されたかどうか
}

export interface EditorTrack {
  id: string;
  name: string;
  channel: number;
  profile: InstrumentProfile;
  notes: EditorNote[];
}