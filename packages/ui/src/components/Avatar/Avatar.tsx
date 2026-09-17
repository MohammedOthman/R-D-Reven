import { cn } from '../../lib/cn';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Initials avatar. Swap for a photo `<img>` once profile pictures exist. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={cn(
        'bg-accent/15 font-label text-accent-deep flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm',
        className,
      )}
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
