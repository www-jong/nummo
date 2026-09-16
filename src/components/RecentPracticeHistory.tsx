import React, { useState, useCallback } from 'react';
import { RotateCw, History, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { PRACTICE_MODES } from '../lib/generator.js';
import { usePrefetchPagination } from '../hooks/usePrefetchPagination.js';
import { LoadMoreButton } from './common/LoadMoreButton.js';
import { getClientCache, setClientCache, clearClientCache } from '../lib/clientCache.js';

interface PracticeSessionItem {
  id: number;
  mode: string;
  hand: 'LEFT' | 'RIGHT';
  inputBehavior: 'CONTINUOUS' | 'STRICT';
  problemCount: number;
  kpm: number;
  accuracy: number;
  totalKeys: number;
  correctKeys: number;
  wrongKeys: number;
  durationSeconds: number;
  createdAt: string;
  mistakes: Array<{ targetKey: string; pressedKey: string; count: number }>;
}

interface PracticeHistorySummary {
  totalSessions: number;
  avgKpm: number;
  bestKpm: number;
  avgAccuracy: number;
  totalKeys: number;
  topMistakes: Array<{ targetKey: string; pressedKey: string; count: number }>;
}

interface RecentPracticeHistoryProps {
  refreshTrigger?: number;
}

function formatKST(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const clean = dateStr.replace('T', ' ').replace('Z', '').split('.')[0].trim();
    const parts = clean.split(' ');
    if (parts.length === 2) {
      const [, m, d] = parts[0].split('-');
      const [hh, mm] = parts[1].split(':');
      return `${Number(m)}월 ${Number(d)}일 ${hh}:${mm}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export const RecentPracticeHistory: React.FC<RecentPracticeHistoryProps> = ({ refreshTrigger }) => {
  const [summary, setSummary] = useState<PracticeHistorySummary | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // 페이지별 데이터 로더 (1페이지 로드 시 15초 캐시 및 요약 통계 보관)
  const fetchPage = useCallback(async (page: number, signal?: AbortSignal) => {
    const cacheKey = `nummo_practice_p${page}`;
    if (page === 1) {
      const cached = getClientCache<{
        summary: PracticeHistorySummary;
        items: PracticeSessionItem[];
        hasMore: boolean;
        totalCount: number;
      }>(cacheKey, 15000);

      if (cached) {
        setSummary(cached.summary);
        setErrorBanner(null);
        return {
          items: cached.items,
          hasMore: cached.hasMore,
          totalCount: cached.totalCount,
        };
      }
    }

    const res = await fetch(`/api/practice-sessions/my?page=${page}&limit=10`, { signal });
    if (!res.ok) {
      if (res.status === 429) {
        const errJson = await res.json().catch(() => null);
        const msg = errJson?.message || '요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.';
        setErrorBanner(msg);
      }
      throw new Error(`Failed to fetch practice history: ${res.status}`);
    }
    const data = await res.json();
    setErrorBanner(null);
    if (page === 1 && data.summary) {
      setSummary(data.summary);
      setClientCache(cacheKey, {
        summary: data.summary,
        items: (data.sessions || []) as PracticeSessionItem[],
        hasMore: Boolean(data.pagination?.hasMore),
        totalCount: Number(data.pagination?.totalCount || 0),
      });
    }
    return {
      items: (data.sessions || []) as PracticeSessionItem[],
      hasMore: Boolean(data.pagination?.hasMore),
      totalCount: Number(data.pagination?.totalCount || 0),
    };
  }, []);

  // 분리 모듈 프리페치 페이지네이션 훅 장착
  const {
    items: sessions,
    hasMore,
    totalCount,
    isLoading,
    isLoadingMore,
    loadMore,
    refresh,
  } = usePrefetchPagination<PracticeSessionItem>({
    fetchPage,
    pageSize: 10,
    refreshTrigger,
  });

  const handleManualRefresh = () => {
    clearClientCache('nummo_practice_');
    refresh();
  };

  if (!summary && sessions.length === 0 && !isLoading && !errorBanner) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3.5 sm:p-5 font-mono shadow-sm transition-colors">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          <h3 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100">
            내 연습 기록
          </h3>
          {totalCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              총 {totalCount}회
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            title="새로고침"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-40"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? '펼치기' : '접기'}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 에러 및 429 안내 배너 */}
      {errorBanner && (
        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate">{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="shrink-0 px-2 py-0.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-[10px] transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div className="mt-3 flex flex-col gap-3.5 animate-fade-in">
          {/* 요약 카드 그리드 */}
          {summary && summary.totalSessions > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-medium">평균 타속</span>
                <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400">
                  {summary.avgKpm} <span className="text-[10px] font-normal text-neutral-500">KPM</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-medium">최고 타속</span>
                <span className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {summary.bestKpm} <span className="text-[10px] font-normal text-neutral-500">KPM</span>
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-medium">평균 정확도</span>
                <span className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {summary.avgAccuracy}%
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-medium">누적 타건수</span>
                <span className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {summary.totalKeys.toLocaleString()} <span className="text-[10px] font-normal text-neutral-500">타</span>
                </span>
              </div>
            </div>
          )}

          {/* 취약 키 (자주 틀리는 키 TOP 3) */}
          {summary && summary.topMistakes && summary.topMistakes.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/20 dark:border-amber-400/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>자주 틀리는 키 TOP 3:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {summary.topMistakes.map((m, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-neutral-900 border border-amber-500/30 text-[11px] font-bold text-neutral-800 dark:text-neutral-200"
                  >
                    <span className="text-rose-600 dark:text-rose-400">{m.targetKey}</span>
                    <span className="text-neutral-400 font-normal">→</span>
                    <span className="text-neutral-600 dark:text-neutral-300">{m.pressedKey}</span>
                    <span className="text-[10px] text-neutral-400 font-normal">({m.count}회)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 연습 세션 목록 */}
          {sessions.length === 0 && !isLoading ? (
            <div className="py-6 text-center text-xs text-neutral-400">
              아직 연습 기록이 없습니다. 위에서 연습을 시작해보세요!
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {sessions.map((s) => {
                const modeInfo = PRACTICE_MODES.find((m) => m.id === s.mode);
                const modeName = modeInfo?.name || s.mode;

                return (
                  <div
                    key={s.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs"
                  >
                    {/* 좌측: 종목명, 손, 문항수, 시간 */}
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
                        {modeName}
                      </span>
                      <span className="text-[11px] text-neutral-500 whitespace-nowrap">
                        {s.hand === 'LEFT' ? '왼손' : '오른손'}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700">·</span>
                      <span className="text-[11px] text-neutral-500">
                        {s.problemCount}문항
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-700">·</span>
                      <span className="text-[11px] text-neutral-400">
                        {formatKST(s.createdAt)}
                      </span>
                    </div>

                    {/* 우측: KPM, 정확도, 오타 키 태그 */}
                    <div className="flex items-center gap-2.5 sm:justify-end shrink-0">
                      {s.mistakes && s.mistakes.length > 0 && (
                        <div className="flex items-center gap-1">
                          {s.mistakes.slice(0, 2).map((m, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              title={`목표 [${m.targetKey}] 대신 [${m.pressedKey}] 입력 (${m.count}회)`}
                            >
                              {m.targetKey}→{m.pressedKey}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-amber-600 dark:text-amber-400">
                          {s.kpm} <span className="text-[10px] font-normal text-neutral-500">KPM</span>
                        </span>
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {s.accuracy}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 재사용 더보기 버튼 (프리페치로 0초 즉시 렌더링) */}
          <LoadMoreButton
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onClick={loadMore}
            currentCount={sessions.length}
            totalCount={totalCount}
            label="더보기 (+10)"
          />
        </div>
      )}
    </div>
  );
};
