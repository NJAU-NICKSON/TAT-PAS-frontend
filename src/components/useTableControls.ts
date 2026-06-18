import { useState, useMemo, useEffect } from 'react';

export type SortDir = 'asc' | 'desc';

export const PAGE_SIZE_OPTIONS = [10, 50, 100, 500, 1000] as const;

interface UseTableControlsOptions<T> {
  data: T[];
  initialPageSize?: number;
  initialSortKey?: string | null;
  initialSortDir?: SortDir;
  getSortValue?: (row: T, key: string) => unknown;
}

export interface TableControls<T> {
  pageRows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  rangeStart: number;
  rangeEnd: number;
  sortKey: string | null;
  sortDir: SortDir;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  toggleSort: (key: string) => void;
}

function defaultGetSortValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const da = Date.parse(String(a));
  const db = Date.parse(String(b));
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function useTableControls<T>({
  data,
  initialPageSize = 10,
  initialSortKey = null,
  initialSortDir = 'asc',
  getSortValue = defaultGetSortValue,
}: UseTableControlsOptions<T>): TableControls<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((ra, rb) => {
      const cmp = compareValues(getSortValue(ra, sortKey), getSortValue(rb, sortKey));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir, getSortValue]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const rangeStart = total === 0 ? 0 : start + 1;
  const rangeEnd = Math.min(start + pageSize, total);

  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setPage(1);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return {
    pageRows,
    total,
    page: safePage,
    pageSize,
    pageCount,
    rangeStart,
    rangeEnd,
    sortKey,
    sortDir,
    setPage,
    setPageSize,
    toggleSort,
  };
}
