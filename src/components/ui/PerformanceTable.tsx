interface Column<T> {
  key: keyof T;
  label: string;
  format?: (value: any) => string;
}

interface PerformanceTableProps<T> {
  data: T[];
  columns: Column<T>[];
}

export function PerformanceTable<T extends Record<string, any>>({ data, columns }: PerformanceTableProps<T>) {
  if (data.length === 0) {
    return <p className="text-center text-text-muted py-4">No data available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-surface-3">
            {columns.map((col) => (
              <th key={col.key as string} className="text-left py-3 px-4 text-xs font-semibold text-text-muted uppercase">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b last:border-b-0 hover:bg-surface-1">
              {columns.map((col) => (
                <td key={col.key as string} className="py-3 px-4 text-sm text-text-primary">
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
