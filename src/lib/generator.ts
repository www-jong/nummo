import { PracticeCategory } from '../types/index.js';

// 임의의 정수 반환 (min ~ max)
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 임의의 소수점 1~2자리 반환
function randFloat(min: number, max: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
}

// 1. 기본 사칙연산 (+, -, *, /)
function generateCalcBasic(): string {
  const ops = ['+', '-', '*', '/'];
  const op = ops[randInt(0, ops.length - 1)];

  switch (op) {
    case '+': {
      const a = randInt(10, 999);
      const b = randInt(10, 999);
      return `${a}+${b}=`;
    }
    case '-': {
      const a = randInt(50, 999);
      const b = randInt(10, a);
      return `${a}-${b}=`;
    }
    case '*': {
      const a = randInt(12, 199);
      const b = randInt(2, 25);
      return `${a}*${b}=`;
    }
    case '/': {
      const b = randInt(2, 25);
      const a = b * randInt(3, 40);
      return `${a}/${b}=`;
    }
    default:
      return '100+200=';
  }
}

// 2. 소수점 & 정산/회계 연산 (*, /, ., +, - 골고루)
function generateCalcDecimal(): string {
  const types = ['add', 'sub', 'mul', 'div'];
  const type = types[randInt(0, types.length - 1)];

  switch (type) {
    case 'add': {
      const a = randFloat(10, 500, randInt(1, 2));
      const b = randFloat(5, 500, randInt(1, 2));
      return `${a}+${b}=`;
    }
    case 'sub': {
      const a = randFloat(50, 800, randInt(1, 2));
      const b = randFloat(5, a - 5, randInt(1, 2));
      return `${a}-${b}=`;
    }
    case 'mul': {
      const a = randFloat(5, 99, 1);
      const b = randInt(2, 15);
      return `${a}*${b}=`;
    }
    case 'div': {
      const a = randFloat(20, 200, 1);
      const b = randInt(2, 8);
      return `${a}/${b}=`;
    }
    default:
      return '12.5*4=';
  }
}

// 2-2. 소수점 + 사칙연산 복합 종합 (. + - * /)
function generateCalcMixed(): string {
  const pattern = randInt(1, 4);
  switch (pattern) {
    case 1: {
      // 소수점 곱셈 + 소수점 덧셈/뺄셈
      const a = randFloat(10, 99, 1);
      const b = randInt(2, 8);
      const c = randFloat(10, 99, 1);
      const op = Math.random() > 0.5 ? '+' : '-';
      return `${a}*${b}${op}${c}=`;
    }
    case 2: {
      // 나눗셈 + 소수점 연산
      const b = randInt(2, 6);
      const a = b * randInt(10, 40);
      const c = randFloat(5, 50, 1);
      const d = randInt(2, 5);
      return `${a}/${b}+${c}*${d}=`;
    }
    case 3: {
      // 소수점 덧셈/뺄셈 + 나눗셈/곱셈 복합
      const a = randFloat(100, 500, 2);
      const b = randFloat(20, 99, 1);
      const c = randInt(2, 5);
      return `${a}-${b}*${c}=`;
    }
    case 4: {
      // 3항 연속 복합 소수점 사칙연산
      const a = randFloat(10, 80, 1);
      const b = randInt(2, 4);
      const c = randFloat(15, 60, 1);
      const d = randFloat(5, 25, 1);
      return `${a}*${b}+${c}-${d}=`;
    }
    default:
      return '15.5*4+250.25-18.5=';
  }
}

// 3. 복합 전표/영수증 연속 연산 (긴 수식)
function generateCalcReceipt(): string {
  const template = randInt(1, 3);
  if (template === 1) {
    // 수량 * 단가 + 수량 * 단가
    const q1 = randInt(2, 9);
    const p1 = randInt(10, 90) * 10;
    const q2 = randInt(2, 9);
    const p2 = randInt(10, 90) * 10;
    return `${p1}*${q1}+${p2}*${q2}=`;
  } else if (template === 2) {
    // 합계 - 할인 + 세금/소수점
    const total = randInt(100, 999) * 10;
    const discount = randInt(10, 90) * 5;
    const extra = randFloat(5, 50, 1);
    return `${total}-${discount}+${extra}=`;
  } else {
    // 연속 사칙연산
    const a = randInt(100, 500);
    const b = randInt(10, 90);
    const c = randInt(2, 9);
    const d = randInt(10, 50);
    return `${a}+${b}*${c}-${d}=`;
  }
}

// 4. 기초 자리 연습 (456, 789, 123)
function generateRowKeys(keys: string[], length: number = 5): string {
  let res = '';
  for (let i = 0; i < length; i++) {
    res += keys[randInt(0, keys.length - 1)];
  }
  return res + '=';
}

// 5. 무작위 수열
function generateRandomNumbers(length: number = 6): string {
  let res = '';
  for (let i = 0; i < length; i++) {
    res += String(randInt(0, 9));
  }
  return res + '=';
}

// 모드별 단일 수식 생성기
export function generateFormula(mode: PracticeCategory): string {
  switch (mode) {
    case 'CALC_BASIC':
      return generateCalcBasic();
    case 'CALC_ADVANCED':
      return generateCalcDecimal();
    case 'CALC_MIXED':
      return generateCalcMixed();
    case 'CALC_RECEIPT':
      return generateCalcReceipt();
    case 'ROW_HOME':
      return generateRowKeys(['4', '5', '6'], randInt(5, 7));
    case 'ROW_TOP':
      return generateRowKeys(['7', '8', '9'], randInt(5, 7));
    case 'ROW_BOTTOM':
      return generateRowKeys(['1', '2', '3'], randInt(5, 7));
    case 'NUM_RANDOM':
      return generateRandomNumbers(randInt(5, 8));
    default:
      return generateCalcBasic();
  }
}

// 문제 세트 생성
export function generateProblemSet(mode: PracticeCategory, count: number = 10): string[] {
  const problems: string[] = [];
  for (let i = 0; i < count; i++) {
    problems.push(generateFormula(mode));
  }
  return problems;
}

// 모드 메타데이터
export interface ModeMeta {
  id: PracticeCategory;
  name: string;
  badge: string;
  description: string;
  example: string; // 문제 미리보기 예시
  isRealCalc: boolean;
}

export const PRACTICE_MODES: ModeMeta[] = [
  {
    id: 'CALC_BASIC',
    name: '기본 사칙연산',
    badge: '+ - * /',
    description: '정수 사칙연산 실전 타건',
    example: '145*8+230-15=',
    isRealCalc: true,
  },
  {
    id: 'CALC_MIXED',
    name: '소수점 사칙연산',
    badge: '. + - * /',
    description: '소수점과 사칙연산이 모두 섞인 종합 수식',
    example: '15.5*4+250.25-18.5=',
    isRealCalc: true,
  },
  {
    id: 'CALC_ADVANCED',
    name: '소수점/정산',
    badge: '. * / +',
    description: '소수점(.) 및 단가/할인 계산',
    example: '350.75+12.25*4=',
    isRealCalc: true,
  },
  {
    id: 'CALC_RECEIPT',
    name: '복합 전표수식',
    badge: '긴 수식',
    description: '회계 장부 및 다단계 연속 전표',
    example: '1200*3+450*2-150=',
    isRealCalc: true,
  },
  {
    id: 'ROW_HOME',
    name: '홈 행 (4 5 6)',
    badge: '기초',
    description: '넘패드 중심자리 기본기',
    example: '4565456=',
    isRealCalc: false,
  },
  {
    id: 'ROW_TOP',
    name: '상단 행 (7 8 9)',
    badge: '기초',
    description: '넘패드 윗줄 확장 타건',
    example: '7898798=',
    isRealCalc: false,
  },
  {
    id: 'ROW_BOTTOM',
    name: '하단 행 (1 2 3)',
    badge: '기초',
    description: '넘패드 아랫줄 확장 타건',
    example: '1232132=',
    isRealCalc: false,
  },
  {
    id: 'NUM_RANDOM',
    name: '무작위 수열',
    badge: '0-9',
    description: '인증번호/전화번호 형태 난수',
    example: '8492015=',
    isRealCalc: false,
  },
];
