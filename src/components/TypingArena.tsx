import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PracticeCategory, InputBehavior, TypedChar, SessionResult } from '../types/index.js';
import { generateProblemSet } from '../lib/generator.js';

interface TypingArenaProps {
  mode: PracticeCategory;
  problemCount: number;
  inputBehavior: InputBehavior;
  onTargetKeyChange?: (targetChar: string) => void;
  onCompleteSession: (result: SessionResult) => void;
  onPracticeStateChange?: (isPracticing: boolean) => void;
  lastPressedKey?: { char: string; code: string } | null;
  resetTrigger?: number; // 부모에서 강제 리셋 트리거
  isPaused?: boolean;
  onResume?: () => void;
}

export const TypingArena: React.FC<TypingArenaProps> = ({
  mode,
  problemCount,
  inputBehavior,
  onTargetKeyChange,
  onCompleteSession,
  onPracticeStateChange,
  lastPressedKey,
  resetTrigger = 0,
  isPaused = false,
  onResume,
}) => {
  const [problems, setProblems] = useState<string[]>([]);
  const [problemIndex, setProblemIndex] = useState<number>(0);
  const [typedHistory, setTypedHistory] = useState<TypedChar[]>([]);

  // 통계 누적치
  const [totalKeystrokes, setTotalKeystrokes] = useState<number>(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState<number>(0);
  const [wrongKeystrokes, setWrongKeystrokes] = useState<number>(0);
  const mistakesMapRef = useRef<Record<string, Record<string, number>>>({});

  const startTimeRef = useRef<number | null>(null);
  const lastKeyProcessedRef = useRef<{ char: string; code: string } | null>(null);

  // 일시정지 시간 추적
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedDurationRef = useRef<number>(0);

  // 일시정지 토글 시 시간 보정
  useEffect(() => {
    if (isPaused) {
      pauseStartTimeRef.current = Date.now();
    } else if (pauseStartTimeRef.current) {
      totalPausedDurationRef.current += Date.now() - pauseStartTimeRef.current;
      pauseStartTimeRef.current = null;
    }
  }, [isPaused]);

  // 실시간 KPM
  const [currentKpm, setCurrentKpm] = useState<number>(0);

  // 연습 초기화
  const resetPractice = useCallback(() => {
    const newProblems = generateProblemSet(mode, problemCount);
    setProblems(newProblems);
    setProblemIndex(0);
    setTypedHistory([]);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
    setWrongKeystrokes(0);
    setCurrentKpm(0);
    mistakesMapRef.current = {};
    startTimeRef.current = null;
    pauseStartTimeRef.current = null;
    totalPausedDurationRef.current = 0;
    if (onPracticeStateChange) {
      onPracticeStateChange(false);
    }
    if (newProblems.length > 0 && onTargetKeyChange) {
      onTargetKeyChange(newProblems[0][0]);
    }
  }, [mode, problemCount, onTargetKeyChange, onPracticeStateChange]);

  useEffect(() => {
    resetPractice();
  }, [resetPractice, resetTrigger]);

  const currentFormula = problems[problemIndex] || '';
  const currentIndex = typedHistory.length;
  const currentTargetChar = currentFormula[currentIndex] || '';

  // 타겟 키 변경 알림 (가상 넘패드 동기화)
  useEffect(() => {
    if (currentTargetChar && onTargetKeyChange) {
      onTargetKeyChange(currentTargetChar);
    }
  }, [currentTargetChar, onTargetKeyChange]);

  // 실시간 KPM 계산 (0.5초 후부터 갱신, 일시정지 중에는 정지)
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (startTimeRef.current && correctKeystrokes > 0) {
        const netDurationMs = Date.now() - startTimeRef.current - totalPausedDurationRef.current;
        const elapsedSec = netDurationMs / 1000;
        if (elapsedSec > 0.5) {
          const kpm = Math.round((correctKeystrokes / elapsedSec) * 60);
          setCurrentKpm(kpm);
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [correctKeystrokes, isPaused]);

  // 키 입력 처리
  useEffect(() => {
    if (isPaused) return; // 일시정지 중에는 키 입력 무시
    if (!lastPressedKey) return;
    if (lastKeyProcessedRef.current === lastPressedKey) return;
    lastKeyProcessedRef.current = lastPressedKey;

    const { char } = lastPressedKey;

    // 백스페이스 처리
    if (char === 'Backspace') {
      if (typedHistory.length > 0) {
        setTypedHistory((prev) => prev.slice(0, -1));
      }
      return;
    }

    if (!currentTargetChar) return;

    // 첫 타건 시 시작 시간 기록 및 연습 진행 상태 통보
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      if (onPracticeStateChange) {
        onPracticeStateChange(true);
      }
    }

    const inputChar = char === 'Enter' ? '=' : char;
    const isCorrect = inputChar === currentTargetChar;

    setTotalKeystrokes((prev) => prev + 1);

    if (isCorrect) {
      setCorrectKeystrokes((prev) => prev + 1);
    } else {
      setWrongKeystrokes((prev) => prev + 1);
      if (!mistakesMapRef.current[currentTargetChar]) {
        mistakesMapRef.current[currentTargetChar] = {};
      }
      mistakesMapRef.current[currentTargetChar][inputChar] =
        (mistakesMapRef.current[currentTargetChar][inputChar] || 0) + 1;
    }

    // STRICT(교정) 모드: 오타 시 전진 차단
    if (!isCorrect && inputBehavior === 'STRICT') {
      return;
    }

    // 전진 (정타이거나 CONTINUOUS(실전) 모드)
    const newEntry: TypedChar = {
      target: currentTargetChar,
      typed: inputChar,
      isError: !isCorrect,
    };
    const nextHistory = [...typedHistory, newEntry];

    // 현재 수식 완료 검사
    if (nextHistory.length >= currentFormula.length) {
      if (problemIndex + 1 < problems.length) {
        // 다음 수식으로 이동
        setProblemIndex((prev) => prev + 1);
        setTypedHistory([]);
      } else {
        // 전체 세션 완료!
        if (onPracticeStateChange) {
          onPracticeStateChange(false);
        }
        const netDurationMs = Date.now() - (startTimeRef.current || Date.now()) - totalPausedDurationRef.current;
        const durationSec = Math.max(1, Math.round(netDurationMs / 1000));
        const finalTotal = totalKeystrokes + 1;
        const finalCorrect = isCorrect ? correctKeystrokes + 1 : correctKeystrokes;
        const finalWrong = isCorrect ? wrongKeystrokes : wrongKeystrokes + 1;
        const finalKpm = Math.round((finalCorrect / durationSec) * 60);
        const finalAccuracy = Math.round((finalCorrect / finalTotal) * 1000) / 10;

        const mistakesList: Array<{ targetKey: string; pressedKey: string; count: number }> = [];
        Object.entries(mistakesMapRef.current).forEach(([target, pressedMap]) => {
          Object.entries(pressedMap).forEach(([pressed, count]) => {
            mistakesList.push({ targetKey: target, pressedKey: pressed, count });
          });
        });

        onCompleteSession({
          mode,
          kpm: finalKpm,
          accuracy: finalAccuracy,
          totalKeys: finalTotal,
          correctKeys: finalCorrect,
          wrongKeys: finalWrong,
          durationSeconds: durationSec,
          mistakes: mistakesList,
        });
      }
    } else {
      setTypedHistory(nextHistory);
    }
  }, [
    lastPressedKey,
    currentTargetChar,
    currentFormula,
    typedHistory,
    problemIndex,
    problems,
    inputBehavior,
    totalKeystrokes,
    correctKeystrokes,
    wrongKeystrokes,
    mode,
    onCompleteSession,
    onPracticeStateChange,
  ]);

  const accuracy =
    totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 1000) / 10 : 100;

  return (
    <div className="w-full max-w-xl sm:max-w-2xl flex flex-col items-center gap-2 select-none">
      {/* 상태 바 */}
      <div className="flex items-center justify-between gap-2 w-full px-1 sm:px-4 mb-2 sm:mb-3 text-xs font-mono text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-3 sm:gap-5">
          <div>
            <span className="text-neutral-400 dark:text-neutral-500">KPM </span>
            <span className="text-amber-500 dark:text-amber-400 font-bold text-sm">{currentKpm}</span>
          </div>
          <div>
            <span className="text-neutral-400 dark:text-neutral-500">정확도 </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{accuracy}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-neutral-400 dark:text-neutral-500 font-medium">
            {problemIndex + 1} / {problems.length}
          </span>
          <button
            type="button"
            onClick={resetPractice}
            className="min-h-8 text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-700 bg-white dark:bg-transparent transition-colors shadow-sm"
          >
            다시 시작
          </button>
        </div>
      </div>

      {/* 수식 타이핑 디스플레이 */}
      <div className="relative w-full px-2 sm:px-6 py-4 sm:py-6 rounded-2xl bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center min-h-[76px] sm:min-h-[90px] shadow-xl dark:shadow-2xl backdrop-blur-sm overflow-hidden transition-colors">
        {/* 일시정지 오버레이 */}
        {isPaused && (
          <div className="absolute inset-0 z-20 bg-neutral-900/80 dark:bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center gap-4 animate-fade-in">
            <span className="text-xs font-bold text-white dark:text-neutral-300 tracking-wider">
              일시정지됨
            </span>
            <button
              type="button"
              onClick={onResume}
              className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-400/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <span>계속하기</span>
              <span className="text-[10px]">▶</span>
            </button>
          </div>
        )}

        <div className="max-w-full text-[clamp(1.15rem,6.4vw,1.875rem)] font-mono tracking-[0.1em] sm:tracking-widest flex items-center whitespace-nowrap select-none">
          {currentFormula.split('').map((targetChar, idx) => {
            const isTyped = idx < typedHistory.length;
            const isCurrent = idx === typedHistory.length;
            const typedItem = isTyped ? typedHistory[idx] : null;

            let charDisplay = targetChar;
            let colorClass = 'text-neutral-300 dark:text-neutral-600'; // 미입력

            if (isTyped && typedItem) {
              if (typedItem.isError) {
                charDisplay = typedItem.typed;
                colorClass = 'text-rose-600 dark:text-rose-500 font-bold underline underline-offset-4 decoration-rose-500/80';
              } else {
                colorClass = 'text-neutral-800 dark:text-neutral-100';
              }
            } else if (isCurrent) {
              colorClass = 'text-amber-500 dark:text-amber-300 font-bold';
            }

            return (
              <span key={idx} className="relative flex flex-col items-center">
                <span className={`transition-colors duration-75 ${colorClass}`}>
                  {charDisplay}
                </span>
                {isCurrent && (
                  <span className="absolute -bottom-1.5 w-4/5 h-0.5 bg-amber-500 dark:bg-amber-400 animate-pulse rounded-full" />
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
