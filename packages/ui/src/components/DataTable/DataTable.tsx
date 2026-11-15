import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';
import { TableSkeleton } from '../LoadingState';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'start' | 'end' | 'center';
  width?: string;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string) => void;
  className?: string;
}

const alignClass: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  start: 'text-start',
  end: 'text-end',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  errorMessage,
  emptyTitle = 'No records yet',
  emptyDescription,
  emptyAction,
  onRowClick,
  sortKey,
  sortDirection,
  onSortChange,
  className,
}: DataTableProps<T>) {
  if (errorMessage) {
    return <ErrorState description={errorMessage} />;
  }

  return (
    <div
      className={cn(
        'bg-card overflow-x-auto rounded-lg border border-[var(--border-default)]',
        className,
      )}
    >
      <table className="font-body w-full border-collapse text-sm">
        <thead>
          <tr className="bg-canvas/60 border-b border-[var(--border-default)]">
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              const SortIcon = !isSorted
                ? ChevronsUpDown
                : sortDirection === 'asc'
                  ? ChevronUp
                  : ChevronDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={
                    column.sortable
                      ? isSorted
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'text-muted-body px-4 py-3 text-[13px] font-semibold whitespace-nowrap',
                    alignClass[column.align ?? 'start'],
                  )}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(column.key)}
                      className="hover:text-ink inline-flex min-h-11 items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
                    >
                      {column.header}
                      <SortIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="p-4">
                <TableSkeleton columns={columns.length} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={emptyAction}
                  className="border-0"
                />
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={getRowId(row)}
                onClick={
                  onRowClick
                    ? (event) => {
                        if (
                          !(event.target as HTMLElement).closest('a,button,input,select,textarea')
                        )
                          onRowClick(row);
                      }
                    : undefined
                }
                className={cn(
                  'border-b border-[var(--border-subtle)] transition-colors last:border-0',
                  onRowClick && 'hover:bg-canvas cursor-pointer',
                )}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key}
                    className={cn(
                      'text-ink px-4 py-3.5 align-middle',
                      alignClass[column.align ?? 'start'],
                    )}
                  >
                    {onRowClick && columnIndex === 0 ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="text-accent-deep min-h-11 w-full rounded-sm text-start font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
                      >
                        {column.render
                          ? column.render(row)
                          : String((row as Record<string, unknown>)[column.key] ?? '—')}
                      </button>
                    ) : column.render ? (
                      column.render(row)
                    ) : (
                      String((row as Record<string, unknown>)[column.key] ?? '—')
                    )}
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
