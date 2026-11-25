import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing } from './utils';
import { Icon } from './icons';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { useI18n } from './i18n';

function defaultCompare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Sortable data table.
 *   <DataTable
 *     columns={[
 *       { key: 'donor', header: 'Donor', sortable: true },
 *       { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => formatETB(row.amount) },
 *     ]}
 *     rows={rows}
 *     rowKey="id"
 *     defaultSort={{ key: 'amount', direction: 'desc' }}
 *     empty={{ title: 'No donations yet' }}
 *   />
 * Column `sortValue(row)` overrides the value used for sorting; `accessor(row)` overrides the raw value.
 * Pass `onSortChange` + `sort` to sort server-side (rows are then rendered as given).
 */
export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  defaultSort,
  sort: controlledSort,
  onSortChange,
  loading = false,
  loadingRows = 5,
  empty,
  onRowClick,
  caption,
  dense = false,
  className,
}) {
  const { t } = useI18n();
  const [internalSort, setInternalSort] = useState(defaultSort || null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const serverSide = controlledSort !== undefined && !!onSortChange;

  const getKey = (row, i) => (typeof rowKey === 'function' ? rowKey(row, i) : row[rowKey] ?? i);
  const rawValue = (col, row) => (col.accessor ? col.accessor(row) : row[col.key]);

  const sortedRows = useMemo(() => {
    if (!sort || serverSide) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const valueOf = col.sortValue || ((row) => (col.accessor ? col.accessor(row) : row[col.key]));
    const dir = sort.direction === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => dir * defaultCompare(valueOf(a), valueOf(b)));
  }, [rows, columns, sort, serverSide]);

  const toggleSort = (key) => {
    let next;
    if (!sort || sort.key !== key) next = { key, direction: 'asc' };
    else if (sort.direction === 'asc') next = { key, direction: 'desc' };
    else next = null;
    if (controlledSort === undefined) setInternalSort(next);
    onSortChange?.(next);
  };

  const cellPad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line bg-surface-2/70">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ariaSort}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      'whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted',
                      cellPad,
                      alignClass(col.align),
                      col.hideOnMobile && 'hidden sm:table-cell',
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        aria-label={typeof col.header === 'string' ? t('table.sortBy', { column: col.header }) : undefined}
                        className={cn(
                          '-mx-1 inline-flex items-center gap-1 rounded px-1 uppercase hover:text-fg',
                          focusRing,
                          col.align === 'right' && 'flex-row-reverse',
                          active && 'text-fg',
                        )}
                      >
                        {col.header}
                        <Icon
                          name={active ? (sort.direction === 'asc' ? 'arrowUp' : 'arrowDown') : 'sortAsc'}
                          size={13}
                          className={active ? 'text-brand-500' : 'opacity-40'}
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: loadingRows }, (_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-line last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className={cn(cellPad, col.hideOnMobile && 'hidden sm:table-cell')}>
                        <Skeleton className={cn('h-4', col.align === 'right' ? 'ml-auto w-16' : 'w-24')} />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row, i) => (
                  <tr
                    key={getKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-line transition-colors last:border-0',
                      onRowClick ? 'cursor-pointer hover:bg-surface-2' : 'hover:bg-surface-2/50',
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'text-fg',
                          cellPad,
                          alignClass(col.align),
                          col.align === 'right' && 'tabular-nums',
                          col.hideOnMobile && 'hidden sm:table-cell',
                          col.className,
                        )}
                      >
                        {col.render ? col.render(row, i) : rawValue(col, row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length === 0 ? (
        <EmptyState compact title={t('common.noData')} {...(empty || {})} />
      ) : null}
    </div>
  );
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.node.isRequired,
      sortable: PropTypes.bool,
      align: PropTypes.oneOf(['left', 'center', 'right']),
      render: PropTypes.func,
      accessor: PropTypes.func,
      sortValue: PropTypes.func,
      width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      hideOnMobile: PropTypes.bool,
      className: PropTypes.string,
    }),
  ).isRequired,
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  rowKey: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  defaultSort: PropTypes.shape({ key: PropTypes.string, direction: PropTypes.oneOf(['asc', 'desc']) }),
  sort: PropTypes.shape({ key: PropTypes.string, direction: PropTypes.oneOf(['asc', 'desc']) }),
  onSortChange: PropTypes.func,
  loading: PropTypes.bool,
  loadingRows: PropTypes.number,
  empty: PropTypes.shape({
    icon: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
    title: PropTypes.node,
    description: PropTypes.node,
    action: PropTypes.node,
  }),
  onRowClick: PropTypes.func,
  caption: PropTypes.string,
  dense: PropTypes.bool,
  className: PropTypes.string,
};
