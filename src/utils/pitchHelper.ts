const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * ヤマハ方式 (C3 = 60, A3 = 440Hz) の音名表記を取得
 */
export function pitchToNoteName(pitch: number): string {
  const noteIndex = ((pitch % 12) + 12) % 12;
  const octave = Math.floor(pitch / 12) - 2; // 60 / 12 = 5, 5 - 2 = 3 (C3)
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * 黒鍵かどうかを判定
 */
export function isBlackKey(pitch: number): boolean {
  const noteIndex = ((pitch % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(noteIndex);
}

/**
 * プロファイルの音域内にあるかどうかを判定
 */
export function isPitchInPlayableRange(pitch: number, minPitch: number, maxPitch: number): boolean {
  return pitch >= minPitch && pitch <= maxPitch;
}