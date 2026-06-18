import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from './useTableControls';

interface TablePaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
}

export default function TablePagination({
  page, pageCount, pageSize, total, rangeStart, rangeEnd, setPage, setPageSize,
}: TablePaginationProps) {
  return (
    <div
      className="flex items-center justify-between gap-4 flex-wrap px-4 py-3"
      style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-card)' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-caption" style={{ color: 'var(--text-muted)' }}>Rows per page</span>
        <select
          value={pageSize}
          onChange={e => setPageSize(Number(e.target.value))}
          className="px-2 py-1 text-sm rounded-lg outline-none"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
        >
          {PAGE_SIZE_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {rangeStart}-{rangeEnd} of {total}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-base)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-caption tabular-nums px-1.5" style={{ color: 'var(--text-secondary)' }}>
            Page {page} / {pageCount}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
            className="p-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-base)]"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
