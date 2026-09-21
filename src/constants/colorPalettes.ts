/**
 * Ch 1〜16 のノート内側カラー (16種類)
 * - Ch 1〜10 : 隣り合うChが同時に使われても一目で見分けられるよう、
 *              グラデーションではなく補色・対照色を交互に配置
 *              （枠線を引き立たせ、黒文字の視認性も保てる中間トーン）
 * - Ch 11〜16: 滅多に使われないため、識別不要なグレー〜オフホワイト系
 */
export const CHANNEL_INNER_COLORS: string[] = [
  // --- よく使われるメインチャンネル (Ch 1〜10) ---
  '#4A729A', // Ch 1
  '#A25E43', // Ch 24A729A
  '#4E8752', // Ch 3
  '#994D6E', // Ch 4
  '#9A803B', // Ch 5
  '#3C848C', // Ch 6
  '#785694', // Ch 7
  '#74853E', // Ch 8
  '#9B4848', // Ch 9
  '#54598C', // Ch 10

  // --- サブ・予備チャンネル (Ch 11〜16) ---
  '#5A5D64', // Ch 11: ミディアムグレー
  '#6E727A', // Ch 12: クールグレー
  '#848992', // Ch 13: スレートグレー
  '#9DA2AC', // Ch 14: ペールグレー
  '#B5BAC4', // Ch 15: シルバーグレー
  '#D0D4DC', // Ch 16: オフホワイト
];

/**
 * 奏法 (Note 1〜10) の枠線カラー (10種類)
 * - Note 1 (通常奏法) は枠線なし (transparent)
 */
export const ARTICULATION_BORDER_COLORS: Record<number, string> = {
  1: 'transparent', // Note 1: 通常奏法 (枠線なし)
  2: '#FFA500',    // Note 2: Mute (オレンジ)
  3: '#00E5FF',    // Note 3: Legato (シアン)
  4: '#389BFF',    // Note 4: Slide (ブルー)
  5: '#a851ff',    // Note 5: Vibrato (パープル)
  6: '#FF5E7E',    // Note 6: HalfBend (ローズ)
  7: '#FF3344',    // Note 7: FullBend (レッド)
  8: '#00FF7F',    // Note 8: Trill (スプリンググリーン)
  9: '#FFD700',    // Note 9: Harmonics (ゴールド)
  10: '#FF69B4',   // Note 10: Special (ホットピンク)
};