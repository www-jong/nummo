import React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

interface LoadMoreButtonProps {
  hasMore: boolean;
  isLoading: boolean;
  onClick: () => void;
  currentCount?: number;
  totalCount?: number;
  label?: string;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  hasMore,
  isLoading,
  onClick,
  currentCount,
  totalCount,
  label = '더보기 (+10)',
}) => {
  if (!hasMore) return null;

  return (
    <div className="pt-2 flex justify-center w-full">
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="w-full py-2 px-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50 shadow-sm"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            <span>불러오는 중...</span>
          </>
        ) : (
          <>
            <span>{label}</span>
            {currentCount !== undefined && totalCount !== undefined && (
              <span className="text-[10px] text-neutral-400 font-normal">
                ({currentCount} / {totalCount})
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          </>
        )}
      </button>
    </div>
  );
};
