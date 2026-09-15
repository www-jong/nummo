import React from 'react';
import { PracticeCategory } from '../types/index.js';
import { PRACTICE_MODES } from '../lib/generator.js';

interface ModeSelectorProps {
  currentMode: PracticeCategory;
  onSelectMode: (mode: PracticeCategory) => void;
  problemCount: number;
  onSelectCount: (count: number) => void;
  disabled?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  problemCount,
  onSelectCount,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xl">
      {/* 1. 모드 탭 (실전 계산 모드 강조) */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl">
        {PRACTICE_MODES.map((m) => {
          const isSelected = currentMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMode(m.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-100 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-neutral-800 text-amber-300 shadow-md border border-neutral-700 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span>{m.name}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {m.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. 문제 수 선택 (5, 10, 20) */}
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>문항 수:</span>
        {[5, 10, 20].map((cnt) => (
          <button
            key={cnt}
            type="button"
            disabled={disabled}
            onClick={() => onSelectCount(cnt)}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              problemCount === cnt
                ? 'text-amber-400 font-bold bg-neutral-800 border border-neutral-700'
                : 'hover:text-neutral-300'
            }`}
          >
            {cnt}
          </button>
        ))}
      </div>
    </div>
  );
};
