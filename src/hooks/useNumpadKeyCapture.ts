import { useEffect, useState, useCallback } from 'react';

// 코드 정규화: 물리 넘패드 키 우선, 일반 키보드 보조 지원
export function normalizeKeyCode(code: string, key: string): { code: string; char: string } | null {
  // 1. 물리 넘패드 키 (W3C 표준 - Windows/Mac/Linux 동일)
  switch (code) {
    case 'Numpad0': return { code, char: '0' };
    case 'Numpad1': return { code, char: '1' };
    case 'Numpad2': return { code, char: '2' };
    case 'Numpad3': return { code, char: '3' };
    case 'Numpad4': return { code, char: '4' };
    case 'Numpad5': return { code, char: '5' };
    case 'Numpad6': return { code, char: '6' };
    case 'Numpad7': return { code, char: '7' };
    case 'Numpad8': return { code, char: '8' };
    case 'Numpad9': return { code, char: '9' };
    case 'NumpadAdd': return { code, char: '+' };
    case 'NumpadSubtract': return { code, char: '-' };
    case 'NumpadMultiply': return { code, char: '*' };
    case 'NumpadDivide': return { code, char: '/' };
    case 'NumpadDecimal': return { code, char: '.' };
    case 'NumpadEnter': return { code, char: '=' }; // 계산식 완료 Enter는 '='와 매핑
    case 'Backspace': return { code, char: 'Backspace' };
  }

  // 2. 일반 상단 키보드 보조 지원 (텐키리스 / 노트북 키보드 사용자)
  if (code.startsWith('Digit')) {
    const num = code.replace('Digit', '');
    return { code: `Numpad${num}`, char: num };
  }
  if (key === '+') return { code: 'NumpadAdd', char: '+' };
  if (key === '-') return { code: 'NumpadSubtract', char: '-' };
  if (key === '*') return { code: 'NumpadMultiply', char: '*' };
  if (key === '/') return { code: 'NumpadDivide', char: '/' };
  if (key === '.') return { code: 'NumpadDecimal', char: '.' };
  if (key === 'Enter' || key === '=') return { code: 'NumpadEnter', char: '=' };

  return null;
}

interface UseNumpadKeyCaptureOptions {
  onKeyPress?: (char: string, code: string) => void;
  enabled?: boolean;
}

export function useNumpadKeyCapture({ onKeyPress, enabled = true }: UseNumpadKeyCaptureOptions = {}) {
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // 브라우저 단축키 및 한글 입력 조합 방지
    if (e.isComposing) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const normalized = normalizeKeyCode(e.code, e.key);
    if (!normalized) return;

    // 넘패드 기능 키 브라우저 기본 동작 방지 (예: '/' 누를 때 브라우저 검색창 열림 방지)
    if (['NumpadDivide', 'Slash'].includes(e.code)) {
      e.preventDefault();
    }

    setActiveCode(normalized.code);
    if (onKeyPress) {
      onKeyPress(normalized.char, normalized.code);
    }
  }, [enabled, onKeyPress]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const normalized = normalizeKeyCode(e.code, e.key);
    if (normalized && normalized.code === activeCode) {
      setActiveCode(null);
    }
  }, [activeCode]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return { activeCode, setActiveCode };
}
