import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing, Icon } from '../ui';

function pageWindow(currentPage, totalPages, size) {
  const half = Math.floor(size / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + size - 1);
  start = Math.max(1, end - size + 1);
  const pages = [];
  if (start > 1) pages.push(1, ...(start > 2 ? ['…start'] : []));
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < totalPages) pages.push(...(end < totalPages - 1 ? ['…end'] : []), totalPages);
  return pages;
}

const btn = cn(
  'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40',
  focusRing,
);

/** Numbered pager. Renders nothing for a single page. */
export default function Pagination({ pagination, onPageChange }) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!pagination || pagination.totalPages <= 1) return null;
  const { currentPage, totalPages } = pagination;
  const go = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) onPageChange(page);
  };

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-2">
      <button type="button" className={cn(btn, 'text-muted hover:bg-surface-2 hover:text-fg')} onClick={() => go(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page">
        <Icon name="chevronLeft" size={16} />
      </button>
      {pageWindow(currentPage, totalPages, narrow ? 3 : 5).map((p) =>
        typeof p === 'string' ? (
          <span key={p} className="px-1 text-sm text-subtle" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            className={cn(btn, p === currentPage ? 'bg-fg text-canvas' : 'text-muted hover:bg-surface-2 hover:text-fg')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(btn, 'text-muted hover:bg-surface-2 hover:text-fg')} onClick={() => go(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page">
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

Pagination.propTypes = {
  pagination: PropTypes.shape({ currentPage: PropTypes.number, totalPages: PropTypes.number }),
  onPageChange: PropTypes.func.isRequired,
};
