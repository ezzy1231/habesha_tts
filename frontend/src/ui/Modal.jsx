import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { cn } from './utils';
import { Button } from './Button';
import { Icon } from './icons';
import { useI18n } from './i18n';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openCount = 0;

/**
 * Accessible dialog: portal, focus trap, Escape to close, focus restore,
 * body scroll lock.
 *   <Modal open={open} onClose={() => setOpen(false)} title="Ban donor?" footer={<…buttons/>}>…</Modal>
 * Set `dismissible={false}` to block Escape / backdrop close (e.g. while saving).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  initialFocusRef,
  className,
}) {
  const { t } = useI18n();
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    openCount += 1;
    document.body.style.overflow = 'hidden';

    const focusTarget =
      initialFocusRef?.current || panelRef.current?.querySelector(FOCUSABLE) || panelRef.current;
    focusTarget?.focus();

    return () => {
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = '';
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && dismissible) {
      e.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (nodes.length === 0) {
      e.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <div
        className="absolute inset-0 animate-ui-fade-in bg-black/60 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={dismissible ? () => onCloseRef.current?.() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90vh] w-full animate-ui-pop-in flex-col overflow-hidden border border-line bg-surface text-fg shadow-overlay focus:outline-none',
          'rounded-t-2xl sm:rounded-2xl',
          widths[size],
          className,
        )}
      >
        {title || dismissible ? (
          <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6">
            <div className="min-w-0">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold leading-tight">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')} onClick={() => onCloseRef.current?.()} className="-mr-2 -mt-1 text-muted">
                <Icon name="close" size={18} />
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  title: PropTypes.node,
  description: PropTypes.node,
  children: PropTypes.node,
  footer: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  dismissible: PropTypes.bool,
  initialFocusRef: PropTypes.shape({ current: PropTypes.any }),
  className: PropTypes.string,
};

/** Alias — some pages prefer the "Dialog" name. */
export const Dialog = Modal;
