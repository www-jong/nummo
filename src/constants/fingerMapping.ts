import { KeyDefinition, FingerGuide } from '../types/index.js';

// 손가락 기본 정의 (오른손 / 왼손 공통 테마)
export const FINGERS: Record<string, FingerGuide> = {
  THUMB: {
    name: '엄지',
    type: 'thumb',
    color: '#10b981', // emerald-500
    bgBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  INDEX: {
    name: '검지',
    type: 'index',
    color: '#3b82f6', // blue-500
    bgBadge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  MIDDLE: {
    name: '중지',
    type: 'middle',
    color: '#8b5cf6', // violet-500
    bgBadge: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
  },
  RING: {
    name: '약지',
    type: 'ring',
    color: '#f59e0b', // amber-500
    bgBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  PINKY: {
    name: '소지',
    type: 'pinky',
    color: '#f43f5e', // rose-500
    bgBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
};

// 표준 17키 넘패드 정의
export const NUMPAD_KEYS: KeyDefinition[] = [
  // 1행
  {
    code: 'NumLock',
    char: 'NL',
    label: 'NUM',
    gridArea: '1 / 1 / 2 / 2',
    rightFinger: FINGERS.INDEX,
    leftFinger: FINGERS.PINKY,
  },
  {
    code: 'NumpadDivide',
    char: '/',
    label: '/',
    gridArea: '1 / 2 / 2 / 3',
    rightFinger: FINGERS.MIDDLE,
    leftFinger: FINGERS.MIDDLE,
  },
  {
    code: 'NumpadMultiply',
    char: '*',
    label: '*',
    gridArea: '1 / 3 / 2 / 4',
    rightFinger: FINGERS.RING,
    leftFinger: FINGERS.INDEX,
  },
  {
    code: 'NumpadSubtract',
    char: '-',
    label: '-',
    gridArea: '1 / 4 / 2 / 5',
    rightFinger: FINGERS.PINKY,
    leftFinger: FINGERS.INDEX,
  },

  // 2행
  {
    code: 'Numpad7',
    char: '7',
    label: '7',
    gridArea: '2 / 1 / 3 / 2',
    rightFinger: FINGERS.INDEX,
    leftFinger: FINGERS.RING,
  },
  {
    code: 'Numpad8',
    char: '8',
    label: '8',
    gridArea: '2 / 2 / 3 / 3',
    rightFinger: FINGERS.MIDDLE,
    leftFinger: FINGERS.MIDDLE,
  },
  {
    code: 'Numpad9',
    char: '9',
    label: '9',
    gridArea: '2 / 3 / 3 / 4',
    rightFinger: FINGERS.RING,
    leftFinger: FINGERS.INDEX,
  },
  {
    code: 'NumpadAdd',
    char: '+',
    label: '+',
    gridArea: '2 / 4 / 4 / 5', // 2칸 세로
    rightFinger: FINGERS.PINKY,
    leftFinger: FINGERS.INDEX,
  },

  // 3행
  {
    code: 'Numpad4',
    char: '4',
    label: '4',
    gridArea: '3 / 1 / 4 / 2',
    rightFinger: FINGERS.INDEX,
    leftFinger: FINGERS.RING,
  },
  {
    code: 'Numpad5',
    char: '5',
    label: '5',
    gridArea: '3 / 2 / 4 / 3',
    rightFinger: FINGERS.MIDDLE,
    leftFinger: FINGERS.MIDDLE,
  },
  {
    code: 'Numpad6',
    char: '6',
    label: '6',
    gridArea: '3 / 3 / 4 / 4',
    rightFinger: FINGERS.RING,
    leftFinger: FINGERS.INDEX,
  },

  // 4행
  {
    code: 'Numpad1',
    char: '1',
    label: '1',
    gridArea: '4 / 1 / 5 / 2',
    rightFinger: FINGERS.INDEX,
    leftFinger: FINGERS.RING,
  },
  {
    code: 'Numpad2',
    char: '2',
    label: '2',
    gridArea: '4 / 2 / 5 / 3',
    rightFinger: FINGERS.MIDDLE,
    leftFinger: FINGERS.MIDDLE,
  },
  {
    code: 'Numpad3',
    char: '3',
    label: '3',
    gridArea: '4 / 3 / 5 / 4',
    rightFinger: FINGERS.RING,
    leftFinger: FINGERS.INDEX,
  },
  {
    code: 'NumpadEnter',
    char: '=',
    label: 'Enter',
    gridArea: '4 / 4 / 6 / 5', // 2칸 세로
    rightFinger: FINGERS.PINKY,
    leftFinger: FINGERS.INDEX,
  },

  // 5행
  {
    code: 'Numpad0',
    char: '0',
    label: '0',
    gridArea: '5 / 1 / 6 / 3', // 2칸 가로
    rightFinger: FINGERS.THUMB,
    leftFinger: FINGERS.THUMB,
  },
  {
    code: 'NumpadDecimal',
    char: '.',
    label: '.',
    gridArea: '5 / 3 / 6 / 4',
    rightFinger: FINGERS.THUMB,
    leftFinger: FINGERS.THUMB,
  },
];

// 문자(char) -> KeyDefinition 빠른 검색 맵
export const CHAR_TO_KEY_MAP: Record<string, KeyDefinition> = {};
NUMPAD_KEYS.forEach((k) => {
  CHAR_TO_KEY_MAP[k.char] = k;
  if (k.code === 'NumpadEnter') {
    CHAR_TO_KEY_MAP['\n'] = k;
    CHAR_TO_KEY_MAP['Enter'] = k;
  }
});

// W3C code -> KeyDefinition 빠른 검색 맵
export const CODE_TO_KEY_MAP: Record<string, KeyDefinition> = {};
NUMPAD_KEYS.forEach((k) => {
  CODE_TO_KEY_MAP[k.code] = k;
});
