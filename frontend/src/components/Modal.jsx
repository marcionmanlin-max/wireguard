import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * Reusable modal for alerts and confirmations.
 * 
 * Props:
 *   open       - boolean, show/hide
 *   onClose    - called on backdrop click, X, or Cancel
 *   onConfirm  - if provided, shows Confirm + Cancel buttons (confirm mode)
 *                 if omitted, shows single OK button (alert mode)
 *   title      - header text (default: 'Alert')
 *   message    - body text
 *   type       - 'danger' | 'warning' | 'info' (colors the icon/buttons)
 *   confirmText - custom confirm button label
 *   cancelText  - custom cancel button label
 */
export default function Modal({ open, onClose, onConfirm, title = 'Alert', message = '', type = 'info', confirmText, cancelText = 'Cancel' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && open) onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const isConfirm = typeof onConfirm === 'function';
  const colors = {
    danger:  { icon: 'text-red-400', bg: 'bg-red-400/10', btn: 'bg-red-600 hover:bg-red-700' },
    warning: { icon: 'text-yellow-400', bg: 'bg-yellow-400/10', btn: 'bg-yellow-600 hover:bg-yellow-700' },
    info:    { icon: 'text-primary-400', bg: 'bg-primary-400/10', btn: 'bg-primary-600 hover:bg-primary-700' },
  };
  const c = colors[type] || colors.info;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        className="bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm animate-in fade-in zoom-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-xl ${c.bg} shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${c.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-base">{title}</h3>
            <p className="text-dark-300 text-sm mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-800 text-dark-500 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 justify-end">
          {isConfirm ? (
            <>
              <button onClick={onClose} className="px-4 py-2 bg-dark-800 text-dark-300 rounded-xl text-sm hover:bg-dark-700 hover:text-white transition-colors">
                {cancelText}
              </button>
              <button onClick={() => { onConfirm(); onClose(); }} className={`px-4 py-2 text-white rounded-xl text-sm transition-colors ${c.btn}`}>
                {confirmText || (type === 'danger' ? 'Delete' : 'Confirm')}
              </button>
            </>
          ) : (
            <button onClick={onClose} className={`px-5 py-2 text-white rounded-xl text-sm transition-colors ${c.btn}`}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
