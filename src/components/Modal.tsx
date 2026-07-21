import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${width} surface shadow-2xl animate-pop`}
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-0)' }}>{title}</h2>
          <button onClick={onClose} className="btn-ghost !p-1.5" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t px-5 py-3.5" style={{ borderColor: 'var(--border-soft)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--error)', color: '#fff' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{message}</p>
    </Modal>
  );
}
