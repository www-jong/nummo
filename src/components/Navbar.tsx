import React from 'react';
import { Sun, Moon } from 'lucide-react';

export type MainTab = 'PRACTICE' | 'RECORDS';

interface NavbarProps {
  currentTab: MainTab | null;
  onSelectTab: (tab: MainTab) => void;
  currentUser?: string;
  isLoggedIn?: boolean;
  onLogout?: () => void;
  isPracticing?: boolean;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  isLoggedIn = false,
  onLogout,
  isPracticing = false,
  theme = 'dark',
  onToggleTheme,
}) => {
  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google/login';
  };

  return (
    <nav
      className={`sticky top-0 md:static z-40 w-full max-w-2xl grid grid-cols-[auto_1fr] md:flex items-center md:justify-between gap-x-3 gap-y-2 py-2.5 sm:py-3 px-2 sm:px-4 bg-white/90 dark:bg-[#121214]/95 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-b border-neutral-200 dark:border-neutral-800/80 transition-opacity duration-300 ${
        isPracticing ? 'md:opacity-20 md:pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* 로고 */}
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-widest text-neutral-900 dark:text-neutral-100 font-mono">
          NUMMO
        </span>
      </div>

      {/* 대메뉴 탭: 연습 모드 vs 기록 모드 */}
      <div className="order-3 col-span-2 md:order-none md:col-span-1 grid grid-cols-2 md:flex items-center w-full md:w-auto p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl font-mono text-xs">
        <button
          type="button"
          onClick={() => onSelectTab('PRACTICE')}
          className={`min-h-9 px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
            currentTab === 'PRACTICE'
              ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-300 font-bold shadow-sm border border-neutral-200 dark:border-neutral-700'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          연습 모드
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('RECORDS')}
          className={`min-h-9 px-3 sm:px-4 py-1.5 rounded-lg transition-all ${
            currentTab === 'RECORDS'
              ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-300 font-bold shadow-sm border border-neutral-200 dark:border-neutral-700'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          기록 모드
        </button>
      </div>

      {/* 우측 사용자 / 로그인 상태 & 테마 토글 */}
      <div className="justify-self-end min-w-0 text-xs font-mono flex items-center gap-2 sm:gap-2.5">
        {/* 테마 토글 버튼 */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? '라이트 모드로 변경' : '다크 모드로 변경'}
            aria-label="테마 전환"
            className="min-h-9 p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:text-amber-500 dark:hover:text-amber-300 transition-all active:scale-95 shadow-sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-600" />
            )}
          </button>
        )}

        {isLoggedIn ? (
          <div className="min-w-0 flex items-center gap-2">
            <span className="max-w-28 sm:max-w-40 truncate text-amber-600 dark:text-amber-300 font-bold bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-800">
              {currentUser}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 text-[11px] underline underline-offset-2 transition-colors"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="min-h-9 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 border border-neutral-300 dark:border-neutral-700 text-xs font-medium whitespace-nowrap transition-all shadow-sm active:scale-95"
          >
            {/* Google SVG Icon */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.43 7.37 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.28 2.57 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
              />
            </svg>
            <span>Google 로그인</span>
          </button>
        )}
      </div>
    </nav>
  );
};
