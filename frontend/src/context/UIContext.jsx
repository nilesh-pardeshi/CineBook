import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import Modal from '../components/Modal';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const push = useCallback((type, message) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const toast = useMemo(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push]
  );

  const confirm = useCallback(
    (message, opts = {}) => new Promise((resolve) => setDialog({ message, ...opts, resolve })),
    []
  );

  const close = (value) => {
    dialog.resolve(value);
    setDialog(null);
  };

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
      {dialog && (
        <Modal
          title={dialog.title || 'Please confirm'}
          onClose={() => close(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {dialog.cancelText || 'Keep it'}
              </button>
              <button className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {dialog.confirmText || 'Confirm'}
              </button>
            </>
          }
        >
          <p className="confirm-text">{dialog.message}</p>
        </Modal>
      )}
    </UICtx.Provider>
  );
}
