import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';
import { inputVariants } from '../../lib/inputStyles';
import { cn } from '../../lib/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => (
    <div className="relative w-full">
      <Search
        className="text-muted-tertiary pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        role="searchbox"
        value={value}
        className={cn(inputVariants({}), 'ps-9', value && onClear ? 'pe-9' : '', className)}
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="text-muted-tertiary hover:text-ink absolute end-2.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
