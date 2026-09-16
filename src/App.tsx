import { useState, useEffect, useCallback } from 'react';
import { HandType, PracticeCategory, InputBehavior, SessionResult } from './types/index.js';
import { Navbar, MainTab } from './components/Navbar.js';
import { PracticeConfigBar } from './components/PracticeConfigBar.js';
import { TypingArena } from './components/TypingArena.js';
import { NumpadVisualizer } from './components/NumpadVisualizer.js';
import { RecordsView } from './components/RecordsView.js';
import { ResultModal } from './components/ResultModal.js';
import { ConfirmResetModal } from './components/ConfirmResetModal.js';
import { NicknameModal } from './components/NicknameModal.js';
import { ChangeNicknameModal } from './components/ChangeNicknameModal.js';
import { RecentPracticeHistory } from './components/RecentPracticeHistory.js';
import { useNumpadKeyCapture } from './hooks/useNumpadKeyCapture.js';
import { PRACTICE_MODES } from './lib/generator.js';

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>('PRACTICE');
  const [viewPhase, setViewPhase] = useState<'CONFIG' | 'TYPING'>('CONFIG'); // CONFIG: 설정 단계, TYPING: 타이핑 집중 단계

  // 테마 모드 ('dark' | 'light')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('nummo_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nummo_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 사용자 정보 & 로그인 상태
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('nummo_user') || '게스트';
  });
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState<boolean>(false);
  const [isChangeNicknameModalOpen, setIsChangeNicknameModalOpen] = useState<boolean>(false);
  const [practiceHistoryRefresh, setPracticeHistoryRefresh] = useState<number>(0);

  // 세션 확인 및 구글 로그인 콜백 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginStatus = params.get('login');
    const loginError = params.get('login_error');

    if (loginStatus === 'needs_nickname') {
      setIsNicknameModalOpen(true);
    }

    // 서버에 세션 유효성 검사 (쿠키 포함)
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn && data.nickname) {
          setIsLoggedIn(true);
          setUserName(data.nickname);
          localStorage.setItem('nummo_user', data.nickname);
          setIsNicknameModalOpen(false);
          setPracticeHistoryRefresh((prev) => prev + 1);
        } else if (data.needsNickname) {
          setIsNicknameModalOpen(true);
        } else {
          setIsLoggedIn(false);
        }
      })
      .catch((err) => console.error('Failed to check auth:', err))
      .finally(() => {
        if (loginStatus || loginError) {
          setTimeout(() => {
            window.history.replaceState({}, '', window.location.pathname);
          }, 300);
        }
      });
  }, []);

  // 로그아웃 처리 (서버 세션 해제 및 클린 페이지 이동)
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('nummo_user');
    window.location.href = '/';
  };

  // 닉네임 등록 성공
  const handleNicknameSuccess = (newNickname: string) => {
    setIsNicknameModalOpen(false);
    setIsLoggedIn(true);
    setUserName(newNickname);
    localStorage.setItem('nummo_user', newNickname);
    setPracticeHistoryRefresh((prev) => prev + 1);
  };

  // 닉네임 변경 성공
  const handleChangeNicknameSuccess = (newNickname: string) => {
    setUserName(newNickname);
    localStorage.setItem('nummo_user', newNickname);
  };

  // 연습 설정
  const [hand, setHand] = useState<HandType>('RIGHT');
  const [behavior, setBehavior] = useState<InputBehavior>('CONTINUOUS'); // '실전' 모드 기본
  const [mode, setMode] = useState<PracticeCategory>('CALC_BASIC');
  const [problemCount, setProblemCount] = useState<number>(5);

  // 타이핑 & 넘패드 인터랙션 상태
  const [targetChar, setTargetChar] = useState<string>('');
  const [lastPressed, setLastPressed] = useState<{ char: string; code: string } | null>(null);

  // 세션 진행 및 결과
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [isRecordModeActive, setIsRecordModeActive] = useState<boolean>(false); // 기록 측정 중인지 여부
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState<boolean>(false);
  const [isSavedToDb, setIsSavedToDb] = useState<boolean>(false);


  // 키보드 캡처 (모달 열려있거나 일시정지 중이면 비활성화)
  const isModalOpen = pendingAction !== null || isResultModalOpen || isNicknameModalOpen;
  const { activeCode, setActiveCode } = useNumpadKeyCapture({
    enabled: !isModalOpen && !isPaused,
    onKeyPress: (char, code) => {
      setLastPressed({ char, code });
    },
  });

  // ESC 키 누르면 타이핑 화면에서 설정 화면으로 복귀
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewPhase === 'TYPING') {
        setViewPhase('CONFIG');
        setIsPracticing(false);
        setResetTrigger((prev) => prev + 1);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [viewPhase]);

  // 설정 변경 가드 (연습 중이면 경고)
  const guardChange = useCallback(
    (action: () => void) => {
      if (isPracticing) {
        setPendingAction(() => () => {
          action();
          setResetTrigger((prev) => prev + 1);
          setIsPracticing(false);
          setViewPhase('CONFIG');
        });
      } else {
        action();
        setResetTrigger((prev) => prev + 1);
        setViewPhase('CONFIG');
      }
    },
    [isPracticing]
  );

  // 세션 완료 처리
  const handleCompleteSession = useCallback(
    async (result: SessionResult) => {
      setSessionResult(result);
      setIsPracticing(false);
      setIsResultModalOpen(true);

      // '기록 모드'에서 진행된 세션인 경우 홈서버 MySQL에 자동 저장
      if (isRecordModeActive) {
        setIsSavedToDb(false);
        try {
          const res = await fetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hand,
              mode: result.mode,
              kpm: result.kpm,
              accuracy: result.accuracy,
              totalKeys: result.totalKeys,
              correctKeys: result.correctKeys,
              wrongKeys: result.wrongKeys,
              durationSeconds: result.durationSeconds,
              mistakes: result.mistakes,
            }),
          });
          if (res.ok) {
            setIsSavedToDb(true);
          }
        } catch (err) {
          console.error('Failed to save record to MySQL:', err);
        }
      } else {
        try {
          const res = await fetch('/api/practice-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              hand,
              mode: result.mode,
              inputBehavior: behavior,
              problemCount,
              kpm: result.kpm,
              accuracy: result.accuracy,
              totalKeys: result.totalKeys,
              correctKeys: result.correctKeys,
              wrongKeys: result.wrongKeys,
              durationSeconds: result.durationSeconds,
              mistakes: result.mistakes,
            }),
          });
          if (res.ok) {
            setPracticeHistoryRefresh((prev) => prev + 1);
          } else {
            console.error('Failed to save practice session:', res.status);
          }
        } catch (err) {
          console.error('Failed to save practice session:', err);
        }
      }
    },
    [isRecordModeActive, userName, hand, behavior, problemCount]
  );

  // 연습 모드 시작
  const startPracticeSession = () => {
    setIsRecordModeActive(false);
    setViewPhase('TYPING');
    setResetTrigger((prev) => prev + 1);
  };

  // 기록 모드에서 공식 챌린지 시작 (20문항 고정)
  const startRecordSession = (selectedHand: HandType, selectedMode: PracticeCategory) => {
    setIsRecordModeActive(true);
    setHand(selectedHand);
    setMode(selectedMode);
    setProblemCount(20);
    setViewPhase('TYPING');
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <div className={`${viewPhase === 'TYPING' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen min-h-[100dvh] overflow-x-clip'} bg-neutral-100 dark:bg-[#121214] text-neutral-800 dark:text-neutral-200 flex flex-col items-center justify-between p-0 sm:p-4 select-none font-mono transition-colors duration-200`}>
      {/* 1. 상단 네비바 */}
      <Navbar
        currentTab={mainTab}
        onSelectTab={(tab) => {
          guardChange(() => {
            setMainTab(tab);
            setIsRecordModeActive(tab === 'RECORDS');
            setViewPhase('CONFIG');
          });
        }}
        currentUser={userName}
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
        isPracticing={viewPhase === 'TYPING' && isPracticing}
        theme={theme}
        onToggleTheme={toggleTheme}
        onChangeNickname={() => setIsChangeNicknameModalOpen(true)}
      />

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="min-h-0 w-full flex-1 flex flex-col items-center justify-start sm:justify-center px-2 sm:px-0 my-2 sm:my-4">
        {/* [A] 타이핑 집중 단계 (TYPING) -> 진짜 넘패드와 문제창, 정확도만 표시되는 극강의 미니멀 뷰 */}
        {viewPhase === 'TYPING' ? (
          <div className="h-full min-h-0 w-full flex flex-col items-center justify-center gap-2 sm:gap-4 animate-fade-in">
            {/* 공식 기록 모드 뱃지 */}
            {isRecordModeActive && (
              <div className="max-w-full px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs text-center font-semibold flex items-center gap-2">
                <span className="truncate">★ 공식 기록 측정 중 ({userName} · {hand === 'LEFT' ? '왼손' : '오른손'} · {problemCount}문항)</span>
              </div>
            )}

            {/* 상단 현재 선택된 설정 요약 뱃지 바 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full max-w-xl px-1 sm:px-2 py-1 text-xs font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-amber-300 font-bold text-[11px]">
                  {PRACTICE_MODES.find((m) => m.id === mode)?.name || mode}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-neutral-300 font-medium text-[11px]">
                  {behavior === 'CONTINUOUS' ? '실전 모드' : '교정 모드'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-neutral-300 font-medium text-[11px]">
                  {hand === 'LEFT' ? '왼손' : '오른손'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-neutral-900/90 border border-neutral-800 text-neutral-400 text-[11px]">
                  {problemCount}문항
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2">
                {/* 일시정지 버튼 */}
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                    isPaused
                      ? 'bg-amber-400 text-neutral-950 border-amber-400 font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isPaused ? '계속하기 ▶' : '일시정지 ❚❚'}
                </button>

                {/* 연습 중지 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    setViewPhase('CONFIG');
                    setIsPracticing(false);
                    setIsPaused(false);
                    setResetTrigger((prev) => prev + 1);
                  }}
                  className="min-h-8 px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
                  title="연습을 중지하고 설정 화면으로 돌아가기"
                >
                  연습 중지
                </button>
              </div>
            </div>

            {/* 수식 문제창 & 정확도/KPM */}
            <TypingArena
              mode={mode}
              problemCount={problemCount}
              inputBehavior={behavior}
              onTargetKeyChange={setTargetChar}
              onCompleteSession={handleCompleteSession}
              onPracticeStateChange={setIsPracticing}
              lastPressedKey={lastPressed}
              resetTrigger={resetTrigger}
              isPaused={isPaused}
              onResume={() => setIsPaused(false)}
            />

            {/* 가상 넘패드 */}
            <NumpadVisualizer
              hand={hand}
              targetChar={targetChar}
              activeCode={activeCode}
              onKeyClick={(char, code) => {
                if (isModalOpen) return;
                setActiveCode(code);
                setLastPressed({ char, code });
                setTimeout(() => setActiveCode(null), 120);
              }}
            />
          </div>
        ) : (
          /* [B] 설정 단계 (CONFIG) -> 상단 모드 누르면 방식/손/문항/모드 선택 패널 표시 */
          <div className="w-full flex justify-center animate-fade-in">
            {mainTab === 'RECORDS' ? (
              <RecordsView
                currentUser={userName}
                isLoggedIn={isLoggedIn}
                currentHand={hand}
                onStartRecordSession={startRecordSession}
              />
            ) : (
              <div className="flex flex-col items-center gap-4 w-full max-w-2xl">
                <PracticeConfigBar
                  hand={hand}
                  onChangeHand={(h) => setHand(h)}
                  behavior={behavior}
                  onChangeBehavior={(b) => setBehavior(b)}
                  mode={mode}
                  onChangeMode={(m) => setMode(m)}
                  problemCount={problemCount}
                  onChangeProblemCount={(c) => setProblemCount(c)}
                  onStart={startPracticeSession}
                  isVisible={true}
                />
                <RecentPracticeHistory refreshTrigger={practiceHistoryRefresh} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 3. 하단 푸터 (불필요한 글자 완전 제거, 빈 공간 유지) */}
      {viewPhase !== 'TYPING' && <footer className="h-4" />}

      {/* 4. 세션 완료 결과 모달 */}
      <ResultModal
        isOpen={isResultModalOpen}
        result={sessionResult}
        isRecordMode={isRecordModeActive}
        isSaved={isSavedToDb}
        onClose={() => {
          setIsResultModalOpen(false);
          setViewPhase('CONFIG');
          setResetTrigger((prev) => prev + 1);
          setPracticeHistoryRefresh((prev) => prev + 1);
        }}
      />

      {/* 5. 연습 중단 확인 모달 */}
      <ConfirmResetModal
        isOpen={pendingAction !== null}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
      />

      {/* 6. 구글 로그인 신규 닉네임 설정 모달 (중복 체크 필수) */}
      <NicknameModal
        isOpen={isNicknameModalOpen}
        onSuccess={handleNicknameSuccess}
      />

      {/* 7. 로그인 유저 닉네임 변경 모달 */}
      <ChangeNicknameModal
        isOpen={isChangeNicknameModalOpen}
        currentNickname={userName}
        onClose={() => setIsChangeNicknameModalOpen(false)}
        onSuccess={handleChangeNicknameSuccess}
      />
    </div>
  );
}
