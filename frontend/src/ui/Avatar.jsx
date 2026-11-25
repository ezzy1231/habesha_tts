import { useState } from 'react';
import PropTypes from 'prop-types';
import { cn } from './utils';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

const TINTS = [
  'bg-brand-600 text-white',
  'bg-amber-500 text-black',
  'bg-rose-600 text-white',
  'bg-sky-600 text-white',
  'bg-violet-600 text-white',
  'bg-teal-600 text-white',
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  // Array.from keeps Ethiopic syllables (single code points) intact.
  const first = Array.from(parts[0])[0] || '';
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return (first + second).toUpperCase();
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** <Avatar name="Abebe Kebede" src={url} size="md" status="live" /> — falls back to initials. */
export function Avatar({ src, name = '', size = 'md', status, className }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold ring-2 ring-surface',
          SIZES[size],
          !showImage && TINTS[hash(name) % TINTS.length],
        )}
        role="img"
        aria-label={name || undefined}
      >
        {showImage ? (
          <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <span aria-hidden="true">{initials(name)}</span>
        )}
      </span>
      {status ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-surface',
            size === 'xs' || size === 'sm' ? 'h-2 w-2' : 'h-3 w-3',
            status === 'live' ? 'bg-flag-red' : status === 'online' ? 'bg-brand-500' : 'bg-subtle',
          )}
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
  status: PropTypes.oneOf(['live', 'online', 'offline']),
  className: PropTypes.string,
};
