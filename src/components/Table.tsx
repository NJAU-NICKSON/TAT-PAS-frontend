import { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir } from './useTableControls';

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  sortKey?: string | null;
  sortDir?: SortDir;
  onSort?: (key: string) => void;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        </td>
      ))}
    </tr>
  );
}

export default function Table<T extends object>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found.',
  onRowClick,
  sortKey,
  sortDir,
  onSort,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto" style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-card)' }}>
      <table className="min-w-full">
        <thead style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
          <tr>
            {columns.map((col) => {
              const isSortable = col.sortable && onSort;
              const isActive = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  onClick={isSortable ? () => onSort!(col.key) : undefined}
                  className={`px-4 py-3 text-left text-caption font-semibold uppercase tracking-wider ${isSortable ? 'cursor-pointer select-none' : ''}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {isSortable && (
                      isActive
                        ? (sortDir === 'asc'
                            ? <ChevronUp className="w-3.5 h-3.5" style={{ color: 'var(--clinical-600)' }} />
                            : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--clinical-600)' }} />)
                        : <ChevronsUpDown className="w-3.5 h-3.5" style={{ color: 'var(--text-disabled)' }} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody style={{ background: 'var(--bg-card)' }}>
          {isLoading ? (
            <>
              {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} cols={columns.length} />)}
            </>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{ borderTop: rowIndex === 0 ? 'none' : '1px solid var(--border-default)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
