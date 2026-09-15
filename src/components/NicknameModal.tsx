import React, { useState } from 'react';

interface NicknameModalProps {
  isOpen: boolean;
  onSuccess: (nickname: string) => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ isOpen, onSuccess }) => {
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
        message: '닉네임을 입력해주세요.',
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

  // 닉네임 등록 완료
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkResult.tested || !checkResult.available || !nickname.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/register-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onSuccess(data.nickname);
      } else {
        setCheckResult({
          tested: true,
          available: false,
          message: data.error || '닉네임 등록에 실패했습니다.',
        });
      }
    } catch {
      setCheckResult({
        tested: true,
        available: false,
        message: '등록 중 서버 오류가 발생했습니다.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl bg-[#18181b] border border-neutral-700 shadow-2xl flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-lg font-bold text-neutral-100">NUMMO 닉네임 설정</h2>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            NUMMO는 이메일이나 실명을 일절 저장하지 않습니다.<br />
            기록과 랭킹에 표시될 <strong className="text-neutral-200">고유 닉네임</strong>을 설정해주세요.
          </p>
        </div>

        {/* 닉네임 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="nickname-input" className="text-xs text-neutral-400 font-medium">
              닉네임 (2~12자, 한글/영문/숫자)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="nickname-input"
                type="text"
                value={nickname}
                onChange={handleInputChange}
                placeholder="예: 타짜넘버원"
                maxLength={12}
                autoFocus
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm placeholder-neutral-600 focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                type="button"
                onClick={handleCheckDuplicate}
                disabled={checking || !nickname.trim()}
                className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {checking ? '확인 중...' : '중복 확인'}
              </button>
            </div>

            {/* 중복 확인 피드백 메시지 */}
            {checkResult.tested && (
              <p
                className={`text-xs mt-1 transition-all ${
                  checkResult.available ? 'text-emerald-400 font-semibold' : 'text-rose-400'
                }`}
              >
                {checkResult.available ? '✓ ' : '✗ '}
                {checkResult.message}
              </p>
            )}
          </div>

          {/* 확인 버튼 */}
          <button
            type="submit"
            disabled={!checkResult.tested || !checkResult.available || submitting}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all shadow-lg mt-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
          >
            {submitting ? '등록 중...' : '닉네임 등록 완료'}
          </button>
        </form>
      </div>
    </div>
  );
};
