import { InstrumentProfile, KeySwitchConfig } from '../types/midiboProfile';

export const BASE_KEY_SWITCHES: KeySwitchConfig[] = [
  { note: 1,  standardType: 'Normal',    customName: 'Normal',    isEnabled: true, badgeColor: '#7ECADC', leadTimeTicks: 24, mode: 'latch' },
  { note: 2,  standardType: 'Mute',      customName: 'Mute',      isEnabled: true, badgeColor: '#FFA500', leadTimeTicks: 24, mode: 'latch' },
  { note: 3,  standardType: 'Legato',    customName: 'Legato',    isEnabled: true, badgeColor: '#00D2D3', leadTimeTicks: 24, mode: 'latch' },
  { note: 4,  standardType: 'Slide',     customName: 'Slide',     isEnabled: true, badgeColor: '#54A0FF', leadTimeTicks: 24, mode: 'latch' },
  { note: 5,  standardType: 'Vibrato',   customName: 'Vibrato',   isEnabled: true, badgeColor: '#9B59B6', leadTimeTicks: 24, mode: 'latch' },
  { note: 6,  standardType: 'HalfBend',  customName: 'Half Bend', isEnabled: true, badgeColor: '#FF6B81', leadTimeTicks: 24, mode: 'latch' },
  { note: 7,  standardType: 'FullBend',  customName: 'Full Bend', isEnabled: true, badgeColor: '#FF4757', leadTimeTicks: 24, mode: 'latch' },
  { note: 8,  standardType: 'Trill',     customName: 'Trill',     isEnabled: true, badgeColor: '#2ECC71', leadTimeTicks: 24, mode: 'latch' },
  { note: 9,  standardType: 'Harmonics', customName: 'Harmonics', isEnabled: true, badgeColor: '#E056FD', leadTimeTicks: 24, mode: 'latch' },
  { note: 10, standardType: 'Special',   customName: 'Pick up',   isEnabled: true, badgeColor: '#F368E0', leadTimeTicks: 24, mode: 'latch' },
];

export const DEFAULT_PROFILES: InstrumentProfile[] = [
  {
    schemaVersion: "1.0",
    id: "preset_default",
    name: "Default Preset",
    playableRange: {
      minPitch: 21,
      maxPitch: 108
    },
    keySwitches: BASE_KEY_SWITCHES,
    isPitchSplitEnabled: false,
    pitchSplitRules: []
  },
  {
    schemaVersion: "1.0",
    id: "preset_lead_guitar",
    name: "Lead Guitar (2-Strings)",
    playableRange: {
      minPitch: 50,
      maxPitch: 71
    },
    keySwitches: BASE_KEY_SWITCHES,
    isPitchSplitEnabled: true,
    pitchSplitRules: [
      { id: "split_4th", name: "4弦", minPitch: 50, maxPitch: 54, outputChannel: 1, color: "#00D2D3" },
      { id: "split_3rd", name: "3弦", minPitch: 55, maxPitch: 71, outputChannel: 0, color: "#FF4D4D" },
    ]
  }
];