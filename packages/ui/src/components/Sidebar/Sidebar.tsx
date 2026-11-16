import type { ElementType, ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  href: string;
  /** Reserved for a future feature — rendered disabled with a "Coming later" badge. */
  comingLater?: boolean;
}

export interface SidebarNavSection {
  id: string;
  label?: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  sections: SidebarNavSection[];
  activeId?: string;
  /** Localized label for the `comingLater` badge — this component doesn't own copy. */
  comingLaterLabel: string;
  /** Icon-rail mode: labels, section headers and badges hide; only icons show. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Localized label for the collapse/expand button. */
  toggleCollapsedLabel?: string;
  logoSlot: ReactNode;
  footerSlot?: ReactNode;
  /** Defaults to a plain anchor. Pass next/link's `Link` for client-side navigation. */
  linkComponent?: ElementType<{ href: string; className?: string; children?: ReactNode }>;
  className?: string;
  navigationLabel?: string;
}

/**
 * The collapse toggle lives inside the sidebar itself (next to the logo, or
 * alone once collapsed) rather than in the top bar — collapsing is this
 * component's own concern. The brand system defines exactly one wordmark
 * lockup and explicitly forbids an icon-only mark (brand doc §03), so the
 * logo slot is simply hidden once collapsed rather than shrunk into
 * something the brand doesn't define.
 */
export function Sidebar({
  sections,
  activeId,
  comingLaterLabel,
  collapsed = false,
  onToggleCollapsed,
  toggleCollapsedLabel = 'Toggle sidebar',
  logoSlot,
  footerSlot,
  linkComponent: LinkComponent = 'a',
  className,
  navigationLabel = 'Primary navigation',
}: SidebarProps) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        'bg-navy flex h-full flex-col text-white transition-[width] duration-200',
        className,
      )}
      style={{
        width: collapsed ? 'var(--shell-sidebar-collapsed-width)' : 'var(--shell-sidebar-width)',
      }}
      aria-label={navigationLabel}
    >
      <div
        className={cn(
          'flex h-[var(--shell-topbar-height)] shrink-0 items-center',
          collapsed ? 'justify-center px-2' : 'justify-between px-5',
        )}
      >
        {!collapsed && logoSlot}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={toggleCollapsedLabel}
            aria-pressed={collapsed}
            title={collapsed ? toggleCollapsedLabel : undefined}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none"
          >
            <PanelLeft className="size-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.id} className="mb-6 last:mb-0">
            {section.label && !collapsed && (
              <p className="mb-2 px-2 text-[13px] font-medium text-white/60">{section.label}</p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeId;
                const content = (
                  <>
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.comingLater && (
                      <span className="rounded-pill font-label shrink-0 bg-white/10 px-2 py-0.5 text-[10px] tracking-[var(--tracking-label)] text-white/50 uppercase">
                        {comingLaterLabel}
                      </span>
                    )}
                  </>
                );
                const sharedClasses = cn(
                  'flex min-h-11 items-center gap-3 rounded-md px-2.5 py-2 font-body text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)]',
                  collapsed && 'justify-center',
                  isActive
                    ? 'bg-white/15 text-white shadow-[inset_3px_0_0_var(--color-accent)] rtl:shadow-[inset_-3px_0_0_var(--color-accent)]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                  item.comingLater && 'pointer-events-none opacity-50',
                );
                const itemTitle = collapsed
                  ? item.comingLater
                    ? `${item.label} — ${comingLaterLabel}`
                    : item.label
                  : undefined;

                return (
                  <li key={item.id}>
                    {item.comingLater ? (
                      <span className={sharedClasses} aria-disabled="true" title={itemTitle}>
                        {content}
                      </span>
                    ) : (
                      <LinkComponent
                        href={item.href}
                        className={sharedClasses}
                        aria-current={isActive ? 'page' : undefined}
                        title={itemTitle}
                        aria-label={item.label}
                      >
                        {content}
                      </LinkComponent>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footerSlot && (
        <div className="shrink-0 border-t border-[var(--border-on-navy)] p-3">{footerSlot}</div>
      )}
    </aside>
  );
}
