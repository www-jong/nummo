import React, { useState, useEffect, useCallback } from 'react';
import { HandType, PracticeCategory, RecordItem } from '../types/index.js';

interface RecordsViewProps {
  currentUser: string;
  isLoggedIn?: boolean;
  currentHand?: HandType;
  onSelectUser: (user: string) => void;
  onStartRecordSession: (hand: HandType, mode: PracticeCategory, count: number) => void;
}

// 3대 종목 정의 (담백한 용어로 통일)
const OFFICIAL_MODES: Array<{
  id: PracticeCategory;
  name: string;
  badge: string;
  desc: string;
  example: string;
}> = [
  {
    id: 'CALC_MIXED',
    name: '소수점 사칙연산',
    badge: '표준',
    desc: '소수점과 사칙연산이 섞인 복합 수식',
    example: '15.5*4+250.25-18.5=',
  },
  {
    id: 'CALC_BASIC',
    name: '기본 사칙연산',
    badge: '스피드',
    desc: '정수 사칙연산 수식 타건',
    example: '450*12-85+240/6=',
  },
  {
    id: 'CALC_RECEIPT',
    name: '복합 전표',
    badge: '긴 수식',
    desc: '큰 숫자와 긴 수식 타건',
    example: '125000*0.1+4500-1200=',
  },
];

// 한국 시간(KST) 완벽 포맷팅
function formatKST(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    // 1) ISO 문자열 (e.g. 2026-09-15T07:36:00.000Z)
    if (dateStr.includes('T') || dateStr.endsWith('Z')) {
      const d = new Date(dateStr);
      return d.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    // 2) 일반 날짜시간 문자열 (e.g. 2026-09-15 16:36:00)
    const parts = dateStr.split(' ');
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

export const RecordsView: React.FC<RecordsViewProps> = ({
  currentUser,
  isLoggedIn = false,
  currentHand = 'RIGHT',
  onSelectUser,
  onStartRecordSession,
}) => {
  // 기록 측정 설정
  const [selectedHand, setSelectedHand] = useState<HandType>(currentHand);
  const [selectedMode, setSelectedMode] = useState<PracticeCategory>('CALC_MIXED');
  const [selectedCount, setSelectedCount] = useState<number>(20); // 기본 20문항

  // 뷰 모드: 전체 순위(RANKING) vs 최근 기록(LATEST)
  const [viewTab, setViewTab] = useState<'RANKING' | 'LATEST'>('RANKING');

  // 필터
  const [filterHand, setFilterHand] = useState<'ALL' | HandType>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | PracticeCategory>('CALC_MIXED');

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [nameInput, setNameInput] = useState<string>(currentUser);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 기록/순위 불러오기
  const fetchRecords = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      // 랭킹 탭에서는 전체 순위를 조회하므로 user 필터 제외, 최근 기록 탭에서는 내 기록 중심
      if (viewTab === 'LATEST' && currentUser) {
        params.set('user', currentUser);
      }
      if (viewTab === 'RANKING') {
        params.set('sort', 'ranking');
      } else {
        params.set('sort', 'latest');
      }
      if (filterHand !== 'ALL') params.set('hand', filterHand);
      if (filterMode !== 'ALL') params.set('mode', filterMode);
      if (forceRefresh) params.set('refresh', 'true');

      const res = await fetch(`/api/records?${params.toString()}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (!signal?.aborted) setRecords(data);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Failed to fetch records:', e);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [currentUser, viewTab, filterHand, filterMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRecords(false, controller.signal);
    return () => controller.abort();
  }, [fetchRecords]);

  useEffect(() => {
    setNameInput(currentUser);
  }, [currentUser]);

  const handleApplyUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onSelectUser(nameInput.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center gap-6 p-6 font-mono animate-fade-in">
      {/* 1. 사용자 계정 카드 */}
      <div className="w-full p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">기록자</span>
          <span className="text-base font-bold text-amber-400">
            {currentUser || '게스트'}
          </span>
          {isLoggedIn ? (
            <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              인증됨
            </span>
          ) : (
            <span className="text-[11px] text-neutral-500">
              (로그인 시 고유 닉네임으로 저장)
            </span>
          )}
        </div>

        {!isLoggedIn && (
          <form onSubmit={handleApplyUser} className="flex items-center gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="임시 닉네임"
              maxLength={20}
              className="px-2.5 py-1 text-xs rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-400 w-32"
            />
            <button
              type="submit"
              className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
            >
              변경
            </button>
          </form>
        )}
      </div>

      {/* 2. 공식 기록 측정 카드 */}
      <div className="w-full flex flex-col gap-4 p-6 rounded-2xl bg-gradient-to-b from-neutral-900/90 to-neutral-900/50 border border-neutral-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
              <span className="text-amber-400">★</span> 공식 기록 측정
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              표준 규격으로 기록을 측정합니다.
            </p>
          </div>

          {/* (1) 손 선택: [왼손] [오른손] */}
          <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setSelectedHand('LEFT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedHand === 'LEFT'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              왼손
            </button>
            <button
              type="button"
              onClick={() => setSelectedHand('RIGHT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedHand === 'RIGHT'
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-md'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              오른손
            </button>
          </div>
        </div>

        {/* (2) 종목 선택 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-neutral-400 font-medium">종목 선택</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {OFFICIAL_MODES.map((m) => {
              const isSelected = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMode(m.id)}
                  className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-neutral-800/90 border-amber-400/80 shadow-lg shadow-amber-400/10'
                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-neutral-200'}`}>
                      {m.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border ${
                      isSelected ? 'bg-amber-400/10 border-amber-400/30 text-amber-300 font-semibold' : 'border-neutral-800 text-neutral-500'
                    }`}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed mb-2">
                    {m.desc}
                  </p>
                  <span className="text-[10px] text-neutral-500 font-mono truncate bg-neutral-900/80 px-1.5 py-0.5 rounded border border-neutral-800/80 mt-auto">
                    {m.example}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* (3) 문항수 선택 & 시작 버튼 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">문항수:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCount(20)}
                className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                  selectedCount === 20
                    ? 'bg-neutral-800 text-amber-300 font-bold border-amber-400/60'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                20문항
              </button>
              <button
                type="button"
                onClick={() => setSelectedCount(30)}
                className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                  selectedCount === 30
                    ? 'bg-neutral-800 text-amber-300 font-bold border-amber-400/60'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                30문항
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStartRecordSession(selectedHand, selectedMode, selectedCount)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs tracking-wider transition-all shadow-xl shadow-amber-400/20 hover:scale-105 active:scale-95"
          >
            [{selectedHand === 'LEFT' ? '왼손' : '오른손'} · {selectedCount}문항] 측정 시작 ▶
          </button>
        </div>
      </div>

      {/* 3. 전체 순위(랭킹) & 최근 기록 테이블 */}
      <div className="w-full flex flex-col gap-3">
        {/* 상단 탭: 전체 순위 vs 최근 기록 + 필터 */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
          {/* 순위 vs 최근기록 탭 */}
          <div className="flex items-center p-1 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setViewTab('RANKING');
                if (filterMode === 'ALL') setFilterMode('CALC_MIXED');
              }}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'RANKING'
                  ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>🏆</span>
              <span>종목별 순위</span>
            </button>
            <button
              type="button"
              onClick={() => setViewTab('LATEST')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewTab === 'LATEST'
                  ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span>⏱</span>
              <span>최근 기록</span>
            </button>
          </div>

          {/* 손 필터 & 새로고침 */}
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950 p-0.5">
              <button
                type="button"
                onClick={() => setFilterHand('ALL')}
                className={`px-2 py-0.5 rounded ${filterHand === 'ALL' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-500'}`}
              >
                손 전체
              </button>
              <button
                type="button"
                onClick={() => setFilterHand('LEFT')}
                className={`px-2 py-0.5 rounded ${filterHand === 'LEFT' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-500'}`}
              >
                왼손
              </button>
              <button
                type="button"
                onClick={() => setFilterHand('RIGHT')}
                className={`px-2 py-0.5 rounded ${filterHand === 'RIGHT' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-500'}`}
              >
                오른손
              </button>
            </div>

            <button
              type="button"
              onClick={() => fetchRecords(true)}
              className="text-neutral-500 hover:text-neutral-300 text-[11px] underline"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 종목별 순위/기록 필터 */}
        <div className="flex flex-col gap-2 px-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-neutral-500">
              {viewTab === 'RANKING' ? '사용자별 최고 기록 기준' : '종목 필터'}
            </span>
          </div>
          <div className={`grid grid-cols-2 ${viewTab === 'RANKING' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950 p-1`}>
            {viewTab === 'LATEST' && (
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                  filterMode === 'ALL'
                    ? 'bg-neutral-800 text-amber-300 font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                전체 종목
              </button>
            )}
            {OFFICIAL_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setFilterMode(mode.id)}
                className={`px-2 py-1.5 rounded-lg text-[11px] transition-all ${
                  filterMode === mode.id
                    ? 'bg-neutral-800 text-amber-300 font-bold'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {mode.name}
              </button>
            ))}
          </div>
        </div>

        {/* 테이블 */}
        <div className="w-full overflow-x-auto rounded-2xl border border-neutral-800/80 bg-neutral-900/50">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wider text-neutral-500 border-b border-neutral-800 bg-neutral-950/40">
              <tr>
                {viewTab === 'RANKING' && <th className="py-2.5 px-3 w-14 text-center">순위</th>}
                <th className="py-2.5 px-3">날짜 (한국시간)</th>
                <th className="py-2.5 px-3">사용자</th>
                <th className="py-2.5 px-3">손</th>
                <th className="py-2.5 px-3">종목</th>
                <th className="py-2.5 px-3 text-right">KPM</th>
                <th className="py-2.5 px-3 text-right">정확도</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {isLoading ? (
                <tr>
                  <td colSpan={viewTab === 'RANKING' ? 7 : 6} className="py-6 text-center text-neutral-500 text-xs">
                    불러오는 중...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={viewTab === 'RANKING' ? 7 : 6} className="py-6 text-center text-neutral-500 text-xs">
                    해당 조건의 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const modeLabel = OFFICIAL_MODES.find((m) => m.id === r.mode)?.name || r.mode;
                  const rank = idx + 1;
                  return (
                    <tr key={r.id} className="hover:bg-neutral-800/30 transition-colors">
                      {/* 순위 컬럼 (랭킹 탭) */}
                      {viewTab === 'RANKING' && (
                        <td className="py-2.5 px-3 text-center font-bold">
                          {rank === 1 ? (
                            <span className="text-amber-400 text-sm" title="1위">🥇 1</span>
                          ) : rank === 2 ? (
                            <span className="text-neutral-300 text-sm" title="2위">🥈 2</span>
                          ) : rank === 3 ? (
                            <span className="text-amber-600 text-sm" title="3위">🥉 3</span>
                          ) : (
                            <span className="text-neutral-500 text-xs">{rank}</span>
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                        {formatKST(r.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-neutral-200">
                        {r.user_name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded border ${
                          r.hand === 'LEFT'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {r.hand === 'LEFT' ? '왼손' : '오른손'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-300 text-[11px] font-medium">{modeLabel}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">{r.kpm}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                        {r.accuracy}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
