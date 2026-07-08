import React from 'react';

export function NoticeModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-[92%] max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"
      >
        {title && <h3 className="mb-2 text-lg font-semibold text-ink-50">{title}</h3>}
        <div className="mb-4 text-sm text-ink-300">{children}</div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-white/[0.06] px-3 py-2 text-sm font-medium text-ink-100 hover:bg-white/[0.08]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default NoticeModal;
