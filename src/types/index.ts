export type HandType = 'RIGHT' | 'LEFT';

export type FingerType = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export type InputBehavior = 'CONTINUOUS' | 'STRICT'; // CONTINUOUS: 오타도 입력 후 전진, STRICT: 정타만 전진

export interface FingerGuide {
  name: string; // '엄지', '검지', '중지', '약지', '소지'
  type: FingerType;
  color: string;
  bgBadge: string;
}

export interface KeyDefinition {
  code: string; // W3C event.code (e.g., 'Numpad7')
  char: string; // 표시 문자 (e.g., '7')
  label: string;
  gridArea?: string;
  rightFinger: FingerGuide;
  leftFinger: FingerGuide;
}

export type PracticeCategory =
  | 'CALC_BASIC'       // 기본 연산 (+, -, *, /)
  | 'CALC_ADVANCED'    // 소수점/단가 계산 (.)
  | 'CALC_MIXED'       // 소수점 + 사칙연산 복합 종합 (. + - * /)
  | 'CALC_RECEIPT'     // 전표/계산식 긴 수식
  | 'ROW_HOME'         // 4 5 6 기본자리
  | 'ROW_BOTTOM'       // 1 2 3
  | 'ROW_TOP'          // 7 8 9
  | 'NUM_RANDOM';      // 무작위 수열

export interface TypedChar {
  target: string;
  typed: string;
  isError: boolean;
}

export interface SessionResult {
  mode: PracticeCategory;
  kpm: number;
  accuracy: number;
  totalKeys: number;
  correctKeys: number;
  wrongKeys: number;
  durationSeconds: number;
  mistakes: Array<{ targetKey: string; pressedKey: string; count: number }>;
}

export interface RecordItem {
  id: number;
  user_name: string;
  hand: HandType;
  mode: string;
  kpm: number;
  accuracy: number;
  total_keys: number;
  correct_keys: number;
  wrong_keys: number;
  duration_seconds: number;
  created_at: string;
}
