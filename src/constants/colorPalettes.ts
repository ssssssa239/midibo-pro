/**
 * Ch 1〜16 のノート内側カラー (16種類)
 */
export const CHANNEL_INNER_COLORS: string[] = [
  '#4A6984', // Ch 1 : スレートブルー
  '#457B75', // Ch 2 : ティール
  '#488258', // Ch 3 : フォレストグリーン
  '#658248', // Ch 4 : オリーブ
  '#828048', // Ch 5 : モスアンバー
  '#846D45', // Ch 6 : ウォームトープ
  '#845645', // Ch 7 : テラコッタ
  '#84454E', // Ch 8 : ダスティローズ
  '#844572', // Ch 9 : マルベリー
  '#774584', // Ch 10: ディープオーキッド
  '#564584', // Ch 11: アイリスパープル
  '#455284', // Ch 12: ミッドナイトブルー
  '#3D6E88', // Ch 13: スティールシアン
  '#417865', // Ch 14: ジェードグリーン
  '#786B4D', // Ch 15: カーキ
  '#645D78', // Ch 16: スレートグレー
];

/**
 * 奏法 (Note 1〜10) の枠線カラー (10種類)
 */
export const ARTICULATION_BORDER_COLORS: Record<number, string> = {
  1: 'transparent', // Note 1: 通常奏法 (枠線なし)
  2: '#FFA500',    // Note 2: Mute (オレンジ)
  3: '#00E5FF',    // Note 3: Legato (シアン)
  4: '#389BFF',    // Note 4: Slide (ブルー)
  5: '#B366FF',    // Note 5: Vibrato (パープル)
  6: '#FF5E7E',    // Note 6: HalfBend (ローズ)
  7: '#FF3344',    // Note 7: FullBend (レッド)
  8: '#00FF7F',    // Note 8: Trill (スプリンググリーン)
  9: '#FFD700',    // Note 9: Harmonics (ゴールド)
  10: '#FF69B4',   // Note 10: Special (ホットピンク)
};