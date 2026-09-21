export type KeySwitchStandardType =
  | 'Normal'
  | 'Mute'
  | 'Legato'
  | 'Slide'
  | 'Vibrato'
  | 'HalfBend'
  | 'FullBend'
  | 'Trill'
  | 'Harmonics'
  | 'Special';

export type KeySwitchMode = 'latch' | 'oneshot';

export interface KeySwitchConfig {
  note: number;
  standardType: KeySwitchStandardType;
  customName: string;
  isEnabled: boolean;
  badgeColor: string;
  leadTimeTicks?: number;
  mode?: KeySwitchMode;
}

export interface PitchSplitRule {
  id: string;
  name: string;
  minPitch: number;
  maxPitch: number;
  outputChannel: number;
  // ★ color を削除
}

export interface InstrumentProfile {
  schemaVersion: "1.0";
  id: string;
  name: string;
  playableRange: {
    minPitch: number;
    maxPitch: number;
  };
  keySwitches: KeySwitchConfig[];
  isPitchSplitEnabled: boolean;
  pitchSplitRules: PitchSplitRule[];
}

export type ArticulationPreset = InstrumentProfile;