import type { ReactNode, Ref } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface TopNavProps {
  /** Opens/closes the off-canvas mobile drawer. Hidden at `lg`+ — the desktop
   *  collapse toggle lives inside the Sidebar itself. */
  onToggleSidebar?: () => void;
  /** Localized label for the sidebar toggle button — this component doesn't own copy. */
  toggleSidebarLabel?: string;
  sidebarOpen?: boolean;
  toggleButtonRef?: Ref<HTMLButtonElement>;
  tenantSlot?: ReactNode;
  userSlot?: ReactNode;
  className?: string;
}

export function TopNav({
  onToggleSidebar,
  toggleSidebarLabel = 'Toggle navigation',
  sidebarOpen = false,
  toggleButtonRef,
  tenantSlot,
  userSlot,
  className,
}: TopNavProps) {
  return (
    <header
      data-slot="topnav"
      className={cn(
        'bg-card flex h-[var(--shell-topbar-height)] shrink-0 items-center justify-between gap-4 border-b border-[var(--border-default)] px-4 sm:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onToggleSidebar && (
          <button
            ref={toggleButtonRef}
            type="button"
            onClick={onToggleSidebar}
            aria-label={toggleSidebarLabel}
            aria-expanded={sidebarOpen}
            aria-controls="mobile-navigation"
            className="text-muted-body hover:bg-canvas flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        )}
        {tenantSlot}
      </div>
      {userSlot && <div className="flex items-center gap-3">{userSlot}</div>}
    </header>
  );
}
