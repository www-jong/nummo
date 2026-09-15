import React, { useState, useEffect } from 'react';
import { HandType, PracticeCategory, InputBehavior } from '../types/index.js';
import { PRACTICE_MODES } from '../lib/generator.js';

interface PracticeConfigBarProps {
  hand: HandType;
  onChangeHand: (hand: HandType) => void;
  behavior: InputBehavior;
  onChangeBehavior: (behavior: InputBehavior) => void;
  mode: PracticeCategory;
  onChangeMode: (mode: PracticeCategory) => void;
  problemCount: number;
  onChangeProblemCount: (count: number) => void;
  onStart: () => void;
  isVisible: boolean;
}

export const PracticeConfigBar: React.FC<PracticeConfigBarProps> = ({
  hand,
  onChangeHand,
  behavior,
  onChangeBehavior,
  mode,
  onChangeMode,
  problemCount,
  onChangeProblemCount,
  onStart,
  isVisible,
}) => {
  const [customInput, setCustomInput] = useState<string>(String(problemCount));

  useEffect(() => {
    setCustomInput(String(problemCount));
  }, [problemCount]);

  if (!isVisible) return null;

  // 현재 선택된 모드 메타데이터
  const selectedModeMeta = PRACTICE_MODES.find((m) => m.id === mode) || PRACTICE_MODES[0];

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 sm:gap-5 p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-2xl backdrop-blur-md font-mono animate-fade-in select-none">
      {/* 타이틀 및 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-800/80 pb-3.5">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            연습 세션 설정
          </h2>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            원하는 타건 모드와 손을 선택한 후 연습을 시작하세요.
          </p>
        </div>
        <div className="text-[11px] text-amber-400/90 px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 font-medium">
          자유 연습 모드
        </div>
      </div>

      {/* 1. 방식 & 손 선택 (2열 그리드) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* 입력 방식 (실전 vs 교정) */}
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-[11px] font-semibold text-neutral-400">입력 방식</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeBehavior('CONTINUOUS')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                behavior === 'CONTINUOUS'
                  ? 'bg-neutral-800 border-amber-400/80 shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${behavior === 'CONTINUOUS' ? 'text-amber-300' : 'text-neutral-300'}`}>
                  실전 모드
                </span>
                {behavior === 'CONTINUOUS' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </div>
              <span className="text-[10px] text-neutral-500 leading-tight">
                오타 시 붉은색 표시 후 계속 전진
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeBehavior('STRICT')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                behavior === 'STRICT'
                  ? 'bg-neutral-800 border-amber-400/80 shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${behavior === 'STRICT' ? 'text-amber-300' : 'text-neutral-300'}`}>
                  교정 모드
                </span>
                {behavior === 'STRICT' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </div>
              <span className="text-[10px] text-neutral-500 leading-tight">
                정타를 누를 때까지 정지
              </span>
            </button>
          </div>
        </div>

        {/* 손가락 가이드 (왼손 vs 오른손) */}
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
          <span className="text-[11px] font-semibold text-neutral-400">손 선택</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeHand('LEFT')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                hand === 'LEFT'
                  ? 'bg-neutral-800 border-white/60 shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${hand === 'LEFT' ? 'text-white' : 'text-neutral-300'}`}>
                  왼손
                </span>
                {hand === 'LEFT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-[10px] text-neutral-500 leading-tight">
                검지 6·3·Enter, 약지 4·1
              </span>
            </button>

            <button
              type="button"
              onClick={() => onChangeHand('RIGHT')}
              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                hand === 'RIGHT'
                  ? 'bg-neutral-800 border-white/60 shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${hand === 'RIGHT' ? 'text-white' : 'text-neutral-300'}`}>
                  오른손
                </span>
                {hand === 'RIGHT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-[10px] text-neutral-500 leading-tight">
                표준 4·5·6 중심, 소지 Enter
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 연산 모드 선택 (칩 그리드) */}
      <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-[11px] font-semibold text-neutral-400">연습 테마</span>
          <span className="text-[11px] text-neutral-500">
            {selectedModeMeta.description}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
          {PRACTICE_MODES.map((m) => {
            const isSelected = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangeMode(m.id)}
                className={`py-2 px-2.5 rounded-xl text-left border transition-all flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-neutral-800 border-amber-400/90 shadow-sm'
                    : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${isSelected ? 'text-amber-300' : 'text-neutral-300'}`}>
                    {m.name}
                  </span>
                </div>
                <span className={`text-[10px] ${isSelected ? 'text-amber-400/70' : 'text-neutral-600'}`}>
                  {m.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* 선택된 모드의 실시간 문제 예시 미리보기 박스 */}
        <div className="mt-2.5 p-3 rounded-xl bg-neutral-900/90 border border-neutral-800/90 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
              예시 문제
            </span>
            <span className="text-sm font-bold text-amber-300 tracking-wider font-mono">
              {selectedModeMeta.example}
            </span>
          </div>
          <span className="text-[10px] text-neutral-500">
            실제 출제 형태
          </span>
        </div>
      </div>

      {/* 3. 문항 수 선택 & 연습 시작 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
        {/* 문항 수 */}
        <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-neutral-400 font-medium">문항 수:</span>
          <div className="w-full min-[390px]:w-auto flex flex-wrap items-center gap-2">
            {/* 5, 10, 20 프리셋 (h-9 통일) */}
            <div className="h-9 flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-xl">
              {[5, 10, 20].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChangeProblemCount(cnt)}
                  className={`h-full px-3 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                    problemCount === cnt
                      ? 'bg-neutral-800 text-amber-300 shadow-sm border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>

            {/* 수동 직접 입력 (h-9 통일, 자유 편집 지원) */}
            <div className="h-9 flex flex-1 min-[390px]:flex-none items-center justify-center gap-1.5 px-2.5 sm:px-3 rounded-xl bg-neutral-950 border border-neutral-800">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customInput}
                onChange={(e) => {
                  const valStr = e.target.value.replace(/[^0-9]/g, '');
                  setCustomInput(valStr);
                  if (valStr !== '') {
                    const num = parseInt(valStr, 10);
                    if (!isNaN(num) && num >= 1) {
                      onChangeProblemCount(Math.min(100, num));
                    }
                  }
                }}
                onBlur={() => {
                  if (!customInput || parseInt(customInput, 10) < 1) {
                    setCustomInput('5');
                    onChangeProblemCount(5);
                  } else {
                    const num = Math.min(100, Math.max(1, parseInt(customInput, 10)));
                    setCustomInput(String(num));
                    onChangeProblemCount(num);
                  }
                }}
                placeholder="문항"
                className="w-8 bg-transparent text-center text-xs font-bold text-amber-300 focus:outline-none"
              />
              <span className="text-[10px] text-neutral-500">문항 (최대 100)</span>
            </div>
          </div>
        </div>

        {/* 연습 시작 버튼 */}
        <button
          type="button"
          onClick={onStart}
          className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-sm tracking-wider transition-all shadow-xl shadow-amber-400/20 active:scale-95 flex items-center justify-center gap-2"
        >
          <span>연습 시작</span>
          <span className="text-[10px] text-neutral-800 font-normal">↵</span>
        </button>
      </div>
    </div>
  );
};
