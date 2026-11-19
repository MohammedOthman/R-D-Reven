'use client';

import { useRef, useState, type ReactNode, type ComponentProps } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  LayoutGrid,
  Handshake,
  Rocket,
  FileText,
  ShieldCheck,
  CalendarClock,
  Settings,
  LogOut,
  Building2,
  ScrollText,
  Network,
  X,
} from 'lucide-react';
import {
  Sidebar,
  TopNav,
  Avatar,
  useToast,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  type SidebarNavItem,
  type SidebarNavSection,
} from '@revn/ui';
import { Link, useRouter, usePathname } from '@/src/i18n/navigation';
import { activeNavIdFromPathname } from '@/src/lib/activeNavId';
import { signOut, switchPilotRole } from '@/src/lib/auth/client';
import { pilotDestination } from '@/src/lib/auth/pilot-destination';
import { LocaleSwitcherLink } from '@/src/components/LocaleSwitcherLink';
import { WorkspaceFormatProvider } from './WorkspaceFormat';
import type { AuthUser } from '@/src/lib/auth/types';
import type { Tenant, MembershipRole } from '@/src/lib/tenant/types';
import { roleLabelKey } from '@/src/lib/tenant/roleLabels';

/** Navigation should not fetch every private workspace before the user opens it. */
function WorkspaceNavLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} />;
}

export function AppShell({
  children,
  user,
  tenant,
  role,
  pilotMode = false,
}: {
  children: ReactNode;
  user: AuthUser;
  tenant: Tenant;
  role: MembershipRole;
  pilotMode?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavTrigger = useRef<HTMLButtonElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const activeId = activeNavIdFromPathname(pathname);
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const isInternal = role !== 'GUEST';
  const canExecute = isInternal && role !== 'REVIEWER';

  const coreItems: SidebarNavItem[] = [
    {
      id: 'command-center',
      label: t('nav.commandCenter'),
      icon: <LayoutGrid className="size-[18px]" />,
      href: '/workspace',
    },
    ...(isInternal
      ? [
          {
            id: 'partnerships',
            label: t('nav.partnerships'),
            icon: <Handshake className="size-[18px]" />,
            href: '/partnerships',
          },
          {
            id: 'ecosystem',
            label: t('nav.ecosystem'),
            icon: <Network className="size-[18px]" />,
            href: '/ecosystem',
          },
        ]
      : []),
    ...(canExecute
      ? [
          {
            id: 'initiatives',
            label: t('nav.initiatives'),
            icon: <Rocket className="size-[18px]" />,
            href: '/initiatives',
          },
        ]
      : []),
    ...(canExecute
      ? [
          {
            id: 'reviews',
            label: t('nav.reviews'),
            icon: <CalendarClock className="size-[18px]" />,
            href: '/reviews',
          },
        ]
      : []),
    ...(isInternal
      ? [
          {
            id: 'agreements',
            label: t('nav.agreements'),
            icon: <FileText className="size-[18px]" />,
            href: '/agreements',
          },
          {
            id: 'evidence-outcomes',
            label: t('nav.evidenceOutcomes'),
            icon: <ShieldCheck className="size-[18px]" />,
            href: '/evidence-outcomes',
          },
        ]
      : []),
  ];
  const adminItems: SidebarNavItem[] = [
    ...(isInternal
      ? [
          {
            id: 'audit',
            label: t('nav.audit'),
            icon: <ScrollText className="size-[18px]" />,
            href: '/audit',
          },
        ]
      : []),
    ...(isAdmin && !pilotMode
      ? [
          {
            id: 'administration',
            label: t('nav.administration'),
            icon: <Settings className="size-[18px]" />,
            href: '/administration',
          },
        ]
      : []),
  ];
  const sections: SidebarNavSection[] = [
    { id: 'core', label: t('nav.sectionCore'), items: coreItems },
    ...(adminItems.length
      ? [{ id: 'admin', label: t('nav.sectionAdmin'), items: adminItems }]
      : []),
  ];
  const currentPage =
    [...coreItems, ...adminItems].find((item) => item.id === activeId)?.label ??
    t('nav.sectionCore');

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
      router.refresh();
    } catch {
      setSigningOut(false);
      toast({
        title: t('auth.signOutErrorTitle'),
        description: t('auth.signOutErrorDescription'),
        variant: 'error',
      });
    }
  };

  const handlePilotRole = async (nextRole: string) => {
    if (!['OWNER', 'EXECUTIVE', 'REVIEWER'].includes(nextRole)) return;
    setSwitchingRole(true);
    try {
      await switchPilotRole(nextRole as 'OWNER' | 'EXECUTIVE' | 'REVIEWER');
      const destination = pilotDestination(pathname, nextRole as MembershipRole);
      router.replace(destination, { scroll: destination !== pathname });
      router.refresh();
    } catch {
      toast({ title: t('pilot.switchError'), variant: 'error' });
    } finally {
      setSwitchingRole(false);
    }
  };

  const footerSlot = (
    <div className={collapsed ? 'flex justify-center' : 'flex items-center gap-2.5'}>
      {!collapsed && (
        <>
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {pilotMode ? t('pilot.label') : user.name}
            </p>
            <p className="truncate text-[13px] text-white/65">
              {pilotMode
                ? t('pilot.personaRole', { role: t(roleLabelKey(role)) })
                : t(roleLabelKey(role))}
            </p>
          </div>
        </>
      )}
      {!pilotMode && (
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label={t('common.signOut')}
          title={t('common.signOut')}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none disabled:opacity-50"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
        </button>
      )}
    </div>
  );
  const sidebarProps = {
    activeId,
    comingLaterLabel: t('common.comingLater'),
    navigationLabel: t('common.navigation'),
    linkComponent: WorkspaceNavLink,
    logoSlot: (
      <Image
        src="/brand/reven-mark-white.svg"
        alt="Reven"
        width={928}
        height={239}
        className="h-7 w-auto"
        priority
      />
    ),
    sections,
    footerSlot,
  };

  return (
    <WorkspaceFormatProvider timezone={tenant.timezone}>
      <div className="rv-workspace flex h-dvh w-full overflow-hidden">
        <a href="#main-content" className="skip-link">
          {t('common.skipToContent')}
        </a>
        <div className="rv-desktop-sidebar hidden lg:block">
          <Sidebar
            {...sidebarProps}
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            toggleCollapsedLabel={t('common.toggleNavigation')}
          />
        </div>
        <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <DialogContent
            id="mobile-navigation"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              mobileNavTrigger.current?.focus();
            }}
            showClose={false}
            className="rv-mobile-drawer bg-navy inset-y-0 start-0 end-auto top-0 left-0 h-dvh max-h-dvh w-[min(20rem,100vw)] max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 rtl:left-auto"
          >
            <DialogTitle className="sr-only">{t('common.navigation')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('common.navigationDescription')}
            </DialogDescription>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label={t('common.closeNavigation')}
              className="absolute end-3 top-2.5 z-10 flex size-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <div
              className="h-full"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a')) setMobileNavOpen(false);
              }}
            >
              <Sidebar {...sidebarProps} collapsed={false} className="!w-full" />
            </div>
          </DialogContent>
        </Dialog>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            toggleButtonRef={mobileNavTrigger}
            onToggleSidebar={() => setMobileNavOpen(true)}
            sidebarOpen={mobileNavOpen}
            toggleSidebarLabel={t('common.toggleNavigation')}
            tenantSlot={
              <div className="flex min-w-0 items-center gap-3">
                <Building2
                  className="text-muted-body hidden size-4 shrink-0 sm:block"
                  aria-hidden="true"
                />
                <span className="text-ink max-w-[38vw] truncate text-sm font-semibold sm:max-w-64">
                  {tenant.name}
                </span>
                <span className="text-muted-body hidden border-s border-[var(--border-default)] ps-3 text-sm md:block">
                  {currentPage}
                </span>
              </div>
            }
            userSlot={
              <LocaleSwitcherLink className="text-muted-body hover:bg-canvas hover:text-ink inline-flex min-h-11 items-center rounded-md px-3 text-sm" />
            }
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
          >
            <div className="rv-workspace-content mx-auto w-full max-w-[1600px] p-4 pb-12 sm:p-8 sm:pb-12">
              {pilotMode && (
                <aside
                  aria-label={t('pilot.label')}
                  aria-busy={switchingRole}
                  className="rv-pilot-strip"
                >
                  <div className="rv-pilot-copy">
                    <p className="text-ink font-semibold">{t('pilot.bannerTitle')}</p>
                    <p className="text-ink mt-1 leading-relaxed">{t('pilot.bannerDescription')}</p>
                  </div>
                  <div className="rv-pilot-persona flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label htmlFor="pilot-role" className="text-ink font-medium">
                      {t('pilot.tryAs')}
                    </label>
                    <select
                      id="pilot-role"
                      value={role}
                      disabled={switchingRole}
                      onChange={(event) => void handlePilotRole(event.target.value)}
                      className="text-ink bg-surface min-h-11 rounded-md border border-[var(--border-default)] px-3 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring-accent)] focus-visible:outline-none disabled:opacity-50"
                    >
                      {(['OWNER', 'EXECUTIVE', 'REVIEWER'] as const).map((value) => (
                        <option key={value} value={value}>
                          {t(roleLabelKey(value))}
                        </option>
                      ))}
                    </select>
                    <p role="status" className="text-muted-body rv-pilot-hint text-[13px]">
                      {switchingRole ? t('pilot.switchingRole') : t('pilot.roleHint')}
                    </p>
                  </div>
                </aside>
              )}
              <div key={pathname} className="rv-route-content">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </WorkspaceFormatProvider>
  );
}
