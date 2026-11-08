'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  LayoutGrid,
  Handshake,
  Rocket,
  FileText,
  ShieldCheck,
  PieChart,
  CalendarClock,
  BarChart3,
  Plug,
  Settings,
  Palette,
  LogOut,
  Building2,
  ScrollText,
} from 'lucide-react';
import {
  Sidebar,
  TopNav,
  Avatar,
  useToast,
  type SidebarNavItem,
  type SidebarNavSection,
} from '@revn/ui';
import { Link, useRouter, usePathname as useLocalizedPathname } from '@/src/i18n/navigation';
import { activeNavIdFromPathname } from '@/src/lib/activeNavId';
import { signOut } from '@/src/lib/auth/client';
import { LocaleSwitcherLink } from '@/src/components/LocaleSwitcherLink';
import type { AuthUser } from '@/src/lib/auth/types';
import type { Tenant, MembershipRole } from '@/src/lib/tenant/types';
import { roleLabelKey } from '@/src/lib/tenant/roleLabels';

const ADMIN_ROLES: MembershipRole[] = ['OWNER', 'ADMIN'];

export function AppShell({
  children,
  user,
  tenant,
  role,
}: {
  children: ReactNode;
  user: AuthUser;
  tenant: Tenant;
  role: MembershipRole;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const localizedPathname = useLocalizedPathname();
  // Mobile: the sidebar is an off-canvas drawer, mounted only while open.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Desktop (lg+): the sidebar is always visible, collapsing to an icon rail.
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeId = activeNavIdFromPathname(localizedPathname);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } catch {
      setSigningOut(false);
      toast({
        title: t('auth.signOutErrorTitle'),
        description: t('auth.signOutErrorDescription'),
        variant: 'error',
      });
    }
  };

  const coreItems: SidebarNavItem[] = [
    {
      id: 'command-center',
      label: t('nav.commandCenter'),
      icon: <LayoutGrid className="size-[18px]" />,
      href: '/',
    },
    // PRD §2.3's "Portfolio read" gives Guest only "shared only" access,
    // which depends on the Share Grant mechanism (R1.1, not built) — hidden
    // entirely for Guest rather than showing an item that would always list
    // empty; the API's own RoleGuard denies Guest server-side regardless.
    ...(role !== 'GUEST'
      ? [
          {
            id: 'partnerships',
            label: t('nav.partnerships'),
            icon: <Handshake className="size-[18px]" />,
            href: '/partnerships',
          },
        ]
      : []),
    // PRD §2.3's "Initiatives/actions" row denies Reviewer entirely (unlike
    // "Portfolio read," which gives Reviewer a scoped view) — hidden for
    // both Guest and Reviewer, not just Guest.
    ...(role !== 'GUEST' && role !== 'REVIEWER'
      ? [
          {
            id: 'initiatives',
            label: t('nav.initiatives'),
            icon: <Rocket className="size-[18px]" />,
            href: '/initiatives',
          },
        ]
      : []),
    // §2.3's "Agreements/rules" row denies Guest by default (needs Share
    // Grant, not built — v2 item 16) — same treatment as Partnerships.
    ...(role !== 'GUEST'
      ? [
          {
            id: 'agreements',
            label: t('nav.agreements'),
            icon: <FileText className="size-[18px]" />,
            href: '/agreements',
          },
        ]
      : []),
    // PRD §2.3's "Evidence/outcomes" row is real access for every role but
    // Guest, whose "Contribute if granted" cell needs the Share Grant
    // mechanism (R1.1, not built) — same treatment as Partnerships above.
    // Unlike Initiatives/Reviews, Reviewer is NOT excluded here — their cell
    // is "Verify if assigned," a real (if narrower) capability.
    ...(role !== 'GUEST'
      ? [
          {
            id: 'evidence-outcomes',
            label: t('nav.evidenceOutcomes'),
            icon: <ShieldCheck className="size-[18px]" />,
            href: '/evidence-outcomes',
          },
        ]
      : []),
    {
      id: 'revenue-share',
      label: t('nav.revenueShare'),
      icon: <PieChart className="size-[18px]" />,
      href: '/',
      comingLater: true,
    },
    // Reviews borrows "Initiatives/actions" RBAC (no dedicated matrix row
    // exists for it) — same Guest/Reviewer exclusion as Initiatives.
    ...(role !== 'GUEST' && role !== 'REVIEWER'
      ? [
          {
            id: 'reviews',
            label: t('nav.reviews'),
            icon: <CalendarClock className="size-[18px]" />,
            href: '/reviews',
          },
        ]
      : []),
    {
      id: 'reports',
      label: t('nav.reports'),
      icon: <BarChart3 className="size-[18px]" />,
      href: '/',
      comingLater: true,
    },
  ];

  const isAdmin = ADMIN_ROLES.includes(role);

  const adminItems: SidebarNavItem[] = [
    {
      id: 'integrations',
      label: t('nav.integrations'),
      icon: <Plug className="size-[18px]" />,
      href: '/',
      comingLater: true,
    },
    // Table 10 groups Audit under "Administration" as page *content*, but
    // §2.3's "Audit/export" row gives Executive/Manager/Reviewer real (if
    // scoped) access too — unlike Administration itself, which really is
    // owner/admin only. A real top-level item, not folded into the
    // Administration page the way Partner/Decision were folded into an
    // existing surface whose RBAC actually matched. See docs/DECISIONS.md.
    ...(role !== 'GUEST'
      ? [
          {
            id: 'audit',
            label: t('nav.audit'),
            icon: <ScrollText className="size-[18px]" />,
            href: '/audit',
          },
        ]
      : []),
    // Tenant/configuration (PRD §2.3) is owner/admin only — a Manager,
    // Executive, Reviewer or Guest never sees this item at all, rather than
    // seeing it and hitting a Forbidden page (the route itself still
    // enforces this server-side for anyone linking in directly).
    ...(isAdmin
      ? [
          {
            id: 'administration',
            label: t('nav.administration'),
            icon: <Settings className="size-[18px]" />,
            href: '/administration',
          },
        ]
      : []),
    {
      id: 'design-system',
      label: t('nav.designSystem'),
      icon: <Palette className="size-[18px]" />,
      href: '/design-system',
    },
  ];

  const sections: SidebarNavSection[] = [
    { id: 'core', label: t('nav.sectionCore'), items: coreItems },
    { id: 'admin', label: t('nav.sectionAdmin'), items: adminItems },
  ];

  const roleLabel = t(roleLabelKey(role));

  const footerSlot = (
    <div className={collapsed ? 'flex justify-center' : 'flex items-center gap-2.5 px-1'}>
      {!collapsed && (
        <>
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/50">
              {user.email} · {roleLabel}
            </p>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label={t('common.signOut')}
        title={collapsed ? t('common.signOut') : undefined}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );

  const sidebarProps = {
    activeId,
    comingLaterLabel: t('common.comingLater'),
    linkComponent: Link,
    logoSlot: <RevenMark />,
    sections,
    footerSlot,
  };

  return (
    <div className="bg-canvas flex h-dvh w-full overflow-hidden">
      {/* Desktop — always mounted, collapses to an icon rail in place. */}
      <div className="hidden lg:block">
        <Sidebar
          {...sidebarProps}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
          toggleCollapsedLabel={t('common.toggleNavigation')}
        />
      </div>

      {/* Mobile — off-canvas drawer, mounted only while open, always full width. */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('common.closeNavigation')}
            className="bg-ink/50 absolute inset-0"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 start-0">
            <Sidebar {...sidebarProps} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* A user with more than one membership (a tenant switcher) isn't a
            case this phase's UI handles — see packages/db/prisma/schema.prisma. */}
        <TopNav
          onToggleSidebar={() => setMobileNavOpen((v) => !v)}
          toggleSidebarLabel={t('common.toggleNavigation')}
          tenantSlot={
            <span className="font-body text-ink bg-canvas inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium">
              <Building2 className="text-muted-body size-4" aria-hidden="true" />
              {tenant.name}
            </span>
          }
          userSlot={
            <LocaleSwitcherLink className="font-body text-muted-body hover:bg-canvas hover:text-ink rounded-md px-2 py-1.5" />
          }
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * The brand system defines exactly one wordmark lockup (full "Reven." with
 * its accent chip) and explicitly forbids an icon-only mark (brand doc §03) —
 * so this renders the real wordmark SVG at its native aspect ratio rather
 * than squeezing it into a square icon slot next to a duplicate text label.
 */
function RevenMark() {
  return (
    <Image
      src="/brand/reven-mark-white.svg"
      alt="Reven"
      width={928}
      height={238.5}
      className="h-6 w-auto"
      priority
    />
  );
}
