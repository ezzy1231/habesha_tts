import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { cn } from './utils';
import { Icon } from './icons';
import { useI18n } from './i18n';

const ToastContext = createContext(null);

const VARIANT = {
  info: { icon: 'info', accent: 'bg-sky-500', iconClass: 'text-sky-500' },
  success: { icon: 'checkCircle', accent: 'bg-emerald-500', iconClass: 'text-brand-500' },
  warning: { icon: 'alert', accent: 'bg-amber-500', iconClass: 'text-amber-500' },
  error: { icon: 'xCircle', accent: 'bg-red-500', iconClass: 'text-[#e5484d]' },
};

let nextId = 1;

/**
 * Wrap the app once: <ToastProvider><App/></ToastProvider>
 * Then: const toast = useToast();
 *   toast({ title: 'Saved', description: '…', variant: 'success', duration: 4000 })
 *   toast.success('Saved') · toast.error('Failed', { description }) · toast.dismiss(id)
 */
export function ToastProvider({ children, max = 4 }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (opts) => {
      const id = nextId++;
      const toast = { variant: 'info', duration: 4500, ...opts, id };
      setToasts((list) => [...list, toast].slice(-max));
      if (toast.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), toast.duration),
        );
      }
      return id;
    },
    [dismiss, max],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(() => {
    const fn = (opts) => push(opts);
    fn.info = (title, opts) => push({ ...opts, title, variant: 'info' });
    fn.success = (title, opts) => push({ ...opts, title, variant: 'success' });
    fn.warning = (title, opts) => push({ ...opts, title, variant: 'warning' });
    fn.error = (title, opts) => push({ ...opts, title, variant: 'error' });
    fn.dismiss = dismiss;
    return fn;
  }, [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node,
  max: PropTypes.number,
};

function ToastViewport({ toasts, onDismiss }) {
  const { t } = useI18n();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const v = VARIANT[toast.variant] || VARIANT.info;
        return (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto relative flex w-full max-w-sm animate-ui-toast-in items-start gap-3 overflow-hidden rounded-xl border border-line bg-surface py-3 pl-4 pr-2 text-fg shadow-overlay"
          >
            <span className={cn('absolute inset-y-0 left-0 w-1', v.accent)} aria-hidden="true" />
            <Icon name={v.icon} size={20} className={cn('mt-0.5 shrink-0', v.iconClass)} />
            <div className="min-w-0 flex-1">
              {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
              {toast.description ? <p className="mt-0.5 text-sm text-muted">{toast.description}</p> : null}
              {toast.action ? <div className="mt-2">{toast.action}</div> : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              aria-label={t('common.close')}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

ToastViewport.propTypes = {
  toasts: PropTypes.array.isRequired,
  onDismiss: PropTypes.func.isRequired,
};

/** Access the toast API. Must be used under <ToastProvider>. */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
