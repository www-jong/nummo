import React from 'react';
import { HandType } from '../types/index.js';
import { NUMPAD_KEYS, CHAR_TO_KEY_MAP } from '../constants/fingerMapping.js';

interface NumpadVisualizerProps {
  hand: HandType;
  targetChar?: string;
  activeCode?: string | null;
  onKeyClick?: (char: string, code: string) => void;
  showFingerGuide?: boolean;
}

export const NumpadVisualizer: React.FC<NumpadVisualizerProps> = ({
  hand,
  targetChar,
  activeCode,
  onKeyClick,
  showFingerGuide = true,
}) => {
  const targetKeyDef = targetChar ? CHAR_TO_KEY_MAP[targetChar] : undefined;
  const currentFinger = targetKeyDef
    ? hand === 'RIGHT'
      ? targetKeyDef.rightFinger
      : targetKeyDef.leftFinger
    : null;

  return (
    <div className="flex flex-col items-center">
      {/* 상단 현재 손가락 가이드 인디케이터 */}
      {showFingerGuide && currentFinger && (
        <div className="mb-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 text-xs tracking-wider transition-all duration-150 shadow-md">
          <span className="text-neutral-400 font-medium">
            {hand === 'RIGHT' ? '오른손' : '왼손'}
          </span>
          <span
            className="font-bold px-2 py-0.5 rounded-md text-[11px]"
            style={{
              backgroundColor: `${currentFinger.color}18`,
              color: currentFinger.color,
              border: `1px solid ${currentFinger.color}40`,
            }}
          >
            {currentFinger.name}
          </span>
        </div>
      )}

      {/* 가상 넘패드 (17-Key 표준 레이아웃) */}
      <div
        className="grid grid-cols-4 grid-rows-5 gap-2 p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 shadow-2xl backdrop-blur-sm select-none"
        style={{
          width: '270px',
          height: '330px',
        }}
      >
        {NUMPAD_KEYS.map((k) => {
          const isTarget = targetKeyDef?.code === k.code;
          const isPressed = activeCode === k.code;
          const finger = hand === 'RIGHT' ? k.rightFinger : k.leftFinger;

          // 긴 텍스트(NUM, Enter 등)는 작은 폰트 적용
          const isLongLabel = k.label.length >= 3;

          let borderClass = 'border-neutral-800';
          let bgClass = 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300';
          let shadowClass = '';

          if (isPressed) {
            bgClass = 'bg-neutral-700 text-white scale-[0.96]';
            borderClass = 'border-neutral-500';
          } else if (isTarget) {
            bgClass = 'bg-neutral-800 text-white animate-pulse';
            borderClass = 'border-amber-400/90';
            shadowClass = 'shadow-[0_0_14px_rgba(245,158,11,0.4)]';
          }

          return (
            <button
              key={k.code}
              type="button"
              onClick={() => onKeyClick && onKeyClick(k.char, k.code)}
              className={`relative flex flex-col items-center justify-center rounded-xl border font-mono transition-all duration-75 outline-none overflow-hidden ${bgClass} ${borderClass} ${shadowClass}`}
              style={{
                gridArea: k.gridArea,
              }}
            >
              {/* 키 라벨 */}
              <span
                className={`transition-colors ${
                  isLongLabel
                    ? 'text-[11px] font-semibold tracking-tight text-neutral-400'
                    : 'text-base font-medium'
                } ${isTarget ? 'font-bold text-amber-300' : ''}`}
              >
                {k.label}
              </span>

              {/* 5번 키 촉각 돌기 (Home Row Bump) */}
              {k.code === 'Numpad5' && (
                <div className="absolute bottom-2.5 w-2 h-0.5 rounded-full bg-neutral-500" />
              )}

              {/* 손가락 색상 작은 인디케이터 점 */}
              {showFingerGuide && (
                <div
                  className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: finger.color,
                    opacity: isTarget ? 1 : 0.45,
                    transform: isTarget ? 'scale(1.4)' : 'scale(1)',
                  }}
                  title={`${hand === 'RIGHT' ? '오른손' : '왼손'} ${finger.name}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
