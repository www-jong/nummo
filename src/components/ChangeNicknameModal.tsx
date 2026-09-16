import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface ChangeNicknameModalProps {
  isOpen: boolean;
  currentNickname: string;
  onClose: () => void;
  onSuccess: (newNickname: string) => void;
}

export const ChangeNicknameModal: React.FC<ChangeNicknameModalProps> = ({
  isOpen,
  currentNickname,
  onClose,
  onSuccess,
}) => {
  const [nickname, setNickname] = useState('');
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    tested: boolean;
    available: boolean;
    message: string;
  }>({
    tested: false,
    available: false,
    message: '',
  });

  // 모달 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setNickname('');
      setChecking(false);
      setSubmitting(false);
      setCheckResult({ tested: false, available: false, message: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 닉네임 입력 변경 시 중복 검사 상태 리셋
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    setNickname(val);
    setCheckResult({ tested: false, available: false, message: '' });
  };

  // 중복 체크 실행
  const handleCheckDuplicate = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setCheckResult({
        tested: true,
        available: false,
        message: '변경할 닉네임을 입력해주세요.',
      });
      return;
    }

    if (trimmed === currentNickname) {
      setCheckResult({
        tested: true,
        available: false,
        message: '현재 사용 중인 닉네임과 동일합니다.',
      });
      return;
    }

    const validRegex = /^[a-zA-Z0-9가-힣]{2,12}$/;
    if (!validRegex.test(trimmed)) {
      setCheckResult({
        tested: true,
        available: false,
        message: '2~12자의 한글, 영문, 숫자만 사용할 수 있습니다.',
      });
      return;
    }

    setChecking(true);
    try {
      const res = await fetch(`/api/auth/check-nickname?nickname=${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        setCheckResult({
          tested: true,
          available: !!data.available,
          message: data.message || (data.available ? '사용 가능한 닉네임입니다.' : '이미 사용 중인 닉네임입니다.'),
        });
      } else {
        setCheckResult({
          tested: true,
          available: false,
          message: '중복 확인 중 오류가 발생했습니다.',
        });
      }
    } catch {
      setCheckResult({
        tested: true,
        available: false,
        message: '서버 연결에 실패했습니다.',
      });
    } finally {
      setChecking(false);
    }
  };

  // 닉네임 변경 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkResult.tested || !checkResult.available || !nickname.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.nickname);
        onClose();
      } else {
        setCheckResult({
          tested: true,
          available: false,
          message: data.error || '닉네임 변경에 실패했습니다.',
        });
      }
    } catch {
      setCheckResult({
        tested: true,
        available: false,
        message: '변경 중 서버 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 font-mono animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#18181b] border border-neutral-200 dark:border-neutral-700 shadow-2xl flex flex-col gap-5 relative">
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          title="닫기"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 헤더 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">닉네임 변경</h2>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            닉네임을 변경하면 기존 기록과 순위표의 닉네임도 새 닉네임으로 자동 반영됩니다.
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            <span>현재 닉네임:</span>
            <span className="font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
              {currentNickname}
            </span>
          </div>
        </div>

        {/* 닉네임 변경 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="new-nickname-input" className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
              새 닉네임 (2~12자, 한글/영문/숫자)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="new-nickname-input"
                type="text"
                value={nickname}
                onChange={handleInputChange}
                placeholder="새 닉네임 입력"
                maxLength={12}
                autoFocus
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={handleCheckDuplicate}
                disabled={checking || !nickname.trim()}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-amber-700 dark:text-amber-300 border border-neutral-300 dark:border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {checking ? '확인 중...' : '중복 확인'}
              </button>
            </div>

            {/* 피드백 메시지 */}
            {checkResult.tested && (
              <p
                className={`text-xs mt-1 transition-all ${
                  checkResult.available ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {checkResult.available ? '✓ ' : '✗ '}
                {checkResult.message}
              </p>
            )}
          </div>

          {/* 버튼 영역 */}
          <div className="flex items-center gap-2.5 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!checkResult.tested || !checkResult.available || submitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 disabled:text-neutral-400 dark:disabled:text-neutral-500 disabled:cursor-not-allowed"
            >
              {submitting ? '변경 중...' : '닉네임 변경 완료'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
