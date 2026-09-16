import React from 'react';
import { SessionResult } from '../types/index.js';

interface ResultModalProps {
  isOpen: boolean;
  result: SessionResult | null;
  onClose: () => void;
  isRecordMode?: boolean;
  isSaved?: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  result,
  onClose,
  isRecordMode = false,
  isSaved = false,
}) => {
  if (!isOpen || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 dark:bg-black/75 backdrop-blur-sm p-3 sm:p-4 animate-fade-in font-mono">
      <div className="w-full max-w-md p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col items-center select-none transition-colors">
        {/* 모달 타이틀 */}
        <div className="text-center mb-5">
          <span className="text-[11px] uppercase tracking-widest text-neutral-500 font-semibold">
            {isRecordMode ? '공식 기록 측정 완료' : '연습 완료'}
          </span>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">결과 요약</h2>
          {isRecordMode && (
            <div className="mt-1.5 flex flex-col items-center gap-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
                {isSaved ? '✓ 기록 저장 완료' : '저장 중...'}
              </div>
              {isSaved && result.accuracy < 90 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  ※ 정확도 90% 미만으로 주간 랭킹 집계에서는 제외됩니다.
                </span>
              )}
            </div>
          )}
        </div>

        {/* 핵심 수치 그리드 */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3 w-full mb-5">
          <div className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-500">타속 (KPM)</span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {result.kpm}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-500">정확도</span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {result.accuracy}%
            </span>
          </div>
          <div className="flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] text-neutral-500">시간</span>
            <span className="text-xl sm:text-2xl font-extrabold text-neutral-800 dark:text-neutral-200 mt-0.5">
              {result.durationSeconds}s
            </span>
          </div>
        </div>

        {/* 세부 통계 */}
        <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800/60 text-xs text-neutral-600 dark:text-neutral-400 mb-5">
          <span>총 입력: <b className="text-neutral-900 dark:text-neutral-200">{result.totalKeys}</b></span>
          <span>정타: <b className="text-emerald-600 dark:text-emerald-400">{result.correctKeys}</b></span>
          <span>오타: <b className="text-rose-600 dark:text-rose-400">{result.wrongKeys}</b></span>
        </div>

        {/* 오타가 잦은 키 TOP 3 */}
        {result.mistakes && result.mistakes.length > 0 && (
          <div className="w-full mb-5">
            <span className="text-[11px] text-neutral-500 block mb-1.5">
              자주 틀린 키 분석
            </span>
            <div className="flex flex-wrap gap-2">
              {result.mistakes.slice(0, 3).map((m, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs"
                >
                  <span className="text-neutral-800 dark:text-neutral-300 font-bold">{m.targetKey}</span>
                  <span className="text-neutral-500">→</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{m.pressedKey}</span>
                  <span className="text-[10px] text-neutral-500">({m.count}회)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 닫기 / 다시하기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs tracking-wider transition-all shadow-lg shadow-amber-400/20"
        >
          확인 및 다시하기
        </button>
      </div>
    </div>
  );
};
