import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { cn } from './utils';
import { Button } from './Button';
import { Icon } from './icons';
import { useI18n } from './i18n';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

/**
 * Read-only value with Copy (and Show/Hide when `secret`).
 *   <CopyField label="Overlay URL" value={url} />
 *   <CopyField label="Overlay key" value={key} secret hint="Never share this on stream." />
 * Secrets stay masked until the user presses Show; Copy works while masked.
 */
export function CopyField({ label, value, secret = false, hint, onCopy, className }) {
  const { t } = useI18n();
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const masked = secret && !revealed;
  const display = masked ? '•'.repeat(Math.min(Math.max(String(value).length, 12), 32)) : value;

  const handleCopy = async () => {
    try {
      await copyText(String(value));
      setCopied(true);
      onCopy?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <span id={`${id}-label`} className="text-sm font-medium text-fg">
          {label}
        </span>
      ) : null}
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            'flex h-10 min-w-0 flex-1 items-center rounded-lg border border-line bg-surface-2 px-3 font-mono text-sm',
            masked ? 'tracking-widest text-muted' : 'text-fg',
          )}
          aria-labelledby={label ? `${id}-label` : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
        >
          <span className="truncate" aria-hidden={masked || undefined}>
            {display}
          </span>
          {masked ? <span className="sr-only">hidden</span> : null}
        </div>
        {secret ? (
          <Button
            variant="secondary"
            onClick={() => setRevealed((r) => !r)}
            aria-pressed={revealed}
            leftIcon={<Icon name={revealed ? 'eyeOff' : 'eye'} size={16} />}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{revealed ? t('common.hide') : t('common.show')}</span>
            <span className="sr-only sm:hidden">{revealed ? t('common.hide') : t('common.show')}</span>
          </Button>
        ) : null}
        <Button
          variant={copied ? 'secondary' : 'primary'}
          onClick={handleCopy}
          leftIcon={<Icon name={copied ? 'check' : 'copy'} size={16} />}
          className="shrink-0"
        >
          <span className="hidden sm:inline">{copied ? t('common.copied') : t('common.copy')}</span>
          <span className="sr-only sm:hidden">{copied ? t('common.copied') : t('common.copy')}</span>
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t('common.copied') : ''}
      </span>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

CopyField.propTypes = {
  label: PropTypes.node,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  secret: PropTypes.bool,
  hint: PropTypes.node,
  onCopy: PropTypes.func,
  className: PropTypes.string,
};
