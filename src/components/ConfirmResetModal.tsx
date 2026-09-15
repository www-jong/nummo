import React from 'react';

interface ConfirmResetModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

export const ConfirmResetModal: React.FC<ConfirmResetModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  message = '진행 중인 연습이 초기화됩니다.',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-[#1a1a1e] border border-neutral-800 shadow-2xl flex flex-col items-center text-center font-mono">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 text-lg font-bold">
          !
        </div>
        <h3 className="text-base font-bold text-neutral-100 mb-1.5">
          {message}
        </h3>
        <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
          설정을 변경하면 현재까지 타건 중인 세션이 중단되고 처음부터 다시 시작됩니다.
        </p>
        <div className="flex items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 px-3 rounded-xl border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-colors"
          >
            계속 연습
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-neutral-950 transition-colors shadow-lg shadow-amber-500/20"
          >
            초기화 후 변경
          </button>
        </div>
      </div>
    </div>
  );
};
