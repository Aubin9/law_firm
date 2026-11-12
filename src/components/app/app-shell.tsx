"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Scale,
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Inbox,
  Users,
  Briefcase,
  FileText,
  Banknote,
  BarChart3,
  UsersRound,
  GitBranch,
  Database,
  ShieldCheck,
  HardDrive,
  Blocks,
  Search,
  Bell,
  Plus,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User as UserIcon,
  KeyRound,
  Activity,
  Clock,
  LogOut,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchUserNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/server/actions/notification-actions";
import { getActiveGrantsForUserAction } from "@/server/actions/access-grant-actions";
import { globalSearchAction } from "@/server/actions/search-actions";
import type { GlobalSearchResult } from "@/server/services/search-service";

export interface NavItem {
  key: string;
  labelFr: string;
  labelEn: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export interface NavGroup {
  key: string;
  titleFr: string;
  titleEn: string;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    key: "work",
    titleFr: "Espace de travail",
    titleEn: "Work",
    items: [
      {
        key: "dashboard",
        labelFr: "Tableau de bord",
        labelEn: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "tasks",
        labelFr: "Mes tâches",
        labelEn: "My tasks",
        href: "/tasks",
        icon: CheckSquare,
        badge: 4,
      },
      {
        key: "calendar",
        labelFr: "Calendrier",
        labelEn: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
      },
    ],
  },
  {
    key: "practice",
    titleFr: "Pratique",
    titleEn: "Practice",
    items: [
      {
        key: "inquiries",
        labelFr: "Demandes & Prospects",
        labelEn: "Inquiries",
        href: "/inquiries",
        icon: Inbox,
        badge: 2,
      },
      {
        key: "parties",
        labelFr: "Clients & Parties",
        labelEn: "Clients & parties",
        href: "/parties",
        icon: Users,
      },
      {
        key: "matters",
        labelFr: "Dossiers",
        labelEn: "Matters",
        href: "/matters",
        icon: Briefcase,
      },
      {
        key: "conflicts",
        labelFr: "Conflits d'intérêts",
        labelEn: "Conflict checks",
        href: "/conflicts",
        icon: Scale,
      },
      {
        key: "documents",
        labelFr: "Documents",
        labelEn: "Documents",
        href: "/documents",
        icon: FileText,
      },
    ],
  },
  {
    key: "finance",
    titleFr: "Finance",
    titleEn: "Finance",
    items: [
      {
        key: "finance",
        labelFr: "Facturation & Fonds",
        labelEn: "Billing & Funds",
        href: "/finance",
        icon: Banknote,
      },
    ],
  },
  {
    key: "insight",
    titleFr: "Pilotage",
    titleEn: "Insight",
    items: [
      {
        key: "reports",
        labelFr: "Rapports & Indicateurs",
        labelEn: "Reports",
        href: "/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    key: "admin",
    titleFr: "Administration",
    titleEn: "Administration",
    items: [
      {
        key: "users",
        labelFr: "Utilisateurs & Rôles",
        labelEn: "Users & roles",
        href: "/admin/users",
        icon: UsersRound,
      },
      {
        key: "workflows",
        labelFr: "Workflows",
        labelEn: "Workflows",
        href: "/admin/workflows",
        icon: GitBranch,
      },
      {
        key: "roles",
        labelFr: "Rôles & Permissions",
        labelEn: "Roles & permissions",
        href: "/admin/roles",
        icon: Database,
      },
      {
        key: "audit",
        labelFr: "Journal d'audit",
        labelEn: "Audit trail",
        href: "/admin/audit",
        icon: ShieldCheck,
      },
      {
        key: "accessGrants",
        labelFr: "Accès exceptionnels",
        labelEn: "Access grants",
        href: "/admin/access-grants",
        icon: KeyRound,
      },
      {
        key: "system",
        labelFr: "Supervision système",
        labelEn: "System supervision",
        href: "/admin/system",
        icon: Activity,
      },
    ],
  },
];

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface AppShellProps {
  children: React.ReactNode;
  locale?: "fr" | "en";
  breadcrumbs?: BreadcrumbItem[];
  userName?: string;
  userRoleLabel?: string;
  firmName?: string;
}

export function AppShell({
  children,
  locale = "fr",
  breadcrumbs,
  userName = "Me Jean-Paul Mbarga",
  userRoleLabel = locale === "en" ? "Managing Partner" : "Associé Gérant",
  firmName = "Cabinet Mbarga & Associés",
}: AppShellProps) {
  const pathname = usePathname() || `/${locale}/dashboard`;
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [searchModalOpen, setSearchModalOpen] = React.useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<GlobalSearchResult>({
    matters: [],
    parties: [],
    documents: [],
    tasks: [],
  });
  const [isSearching, setIsSearching] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [realNotifications, setRealNotifications] = React.useState<any[]>([]);
  const [activeGrants, setActiveGrants] = React.useState<any[]>([]);

  React.useEffect(() => {
    getActiveGrantsForUserAction()
      .then((grants) => {
        if (grants && grants.length > 0) {
          setActiveGrants(grants);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults({ matters: [], parties: [], documents: [], tasks: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await globalSearchAction(searchQuery);
        if (res.success && res.data) {
          setSearchResults(res.data);
        }
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadNotifications = React.useCallback(async () => {
    try {
      const res = await fetchUserNotificationsAction();
      if (res.success) {
        setRealNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setUnreadCount(0);
    setRealNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
    );
  };

  const handleMarkOneRead = async (id: string) => {
    await markNotificationReadAction(id);
    setRealNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const quickCreateRef = React.useRef<HTMLDivElement>(null);
  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl/Cmd + K for Global Search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setSearchModalOpen(false);
        setQuickCreateOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close popovers on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        quickCreateRef.current &&
        !quickCreateRef.current.contains(e.target as Node)
      ) {
        setQuickCreateOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildHref = (path: string) => `/${locale}${path}`;

  const switchLocaleHref = React.useMemo(() => {
    const targetLocale = locale === "fr" ? "en" : "fr";
    if (pathname.startsWith("/fr/") || pathname === "/fr") {
      return pathname.replace(/^\/fr/, `/${targetLocale}`);
    }
    if (pathname.startsWith("/en/") || pathname === "/en") {
      return pathname.replace(/^\/en/, `/${targetLocale}`);
    }
    return `/${targetLocale}/dashboard`;
  }, [pathname, locale]);

  const isItemActive = (itemHref: string) => {
    const localized = buildHref(itemHref);
    return pathname === localized || pathname.startsWith(`${localized}/`);
  };

  const quickCreateActions = [
    {
      key: "inquiry",
      labelFr: "Nouvelle demande / prospect",
      labelEn: "New inquiry / prospect",
      href: buildHref("/inquiries"),
    },
    {
      key: "party",
      labelFr: "Nouvelle partie / client",
      labelEn: "New party / client",
      href: buildHref("/parties"),
    },
    {
      key: "matter",
      labelFr: "Ouvrir un dossier",
      labelEn: "Open a matter",
      href: buildHref("/matters"),
    },
    {
      key: "task",
      labelFr: "Créer une tâche",
      labelEn: "Create a task",
      href: buildHref("/tasks"),
    },
    {
      key: "event",
      labelFr: "Planifier audience / échéance",
      labelEn: "Schedule hearing / deadline",
      href: buildHref("/calendar"),
    },
  ];

  const sampleNotifications = [
    {
      id: "n1",
      group: locale === "en" ? "Today" : "Aujourd'hui",
      title:
        locale === "en"
          ? "Hearing tomorrow at 08:30 - TGI Douala-Bonanjo"
          : "Audience demain à 08h30 - TGI Douala-Bonanjo",
      meta: "DOS-2026-0014 · SABC c/ État du Cameroun",
      time: "Il y a 25 min",
    },
    {
      id: "n2",
      group: locale === "en" ? "Today" : "Aujourd'hui",
      title:
        locale === "en"
          ? "Procedural deadline awaiting validation"
          : "Échéance procédurale en attente de validation",
      meta: "DOS-2026-0008 · Mémoire en défense",
      time: "Il y a 2 h",
    },
    {
      id: "n3",
      group: locale === "en" ? "Yesterday" : "Hier",
      title:
        locale === "en"
          ? "Conflict check cleared by Partner"
          : "Vérification de conflit levée par l'Associé",
      meta: "INQ-2026-0041 · Groupe Fokou SA",
      time: "Hier · 16:40",
    },
  ];

  const renderSidebarNavigation = (isMobile = false) => (
    <div className="flex h-full flex-col bg-surface text-foreground">
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-14 items-center justify-between border-b border-border px-3.5",
          collapsed && !isMobile && "justify-center px-2",
        )}
      >
        <a
          href={buildHref("/dashboard")}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-card border border-accent/40">
            <Scale className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="truncate font-serif text-body-sm font-semibold text-primary">
                {firmName}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Douala · Cameroun
              </p>
            </div>
          )}
        </a>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label={locale === "en" ? "Close menu" : "Fermer le menu"}
            className="rounded-lg p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav
        aria-label={
          locale === "en" ? "Main navigation" : "Navigation principale"
        }
        className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5"
      >
        {NAVIGATION_GROUPS.map((group) => (
          <div key={group.key} className="space-y-1">
            {(!collapsed || isMobile) && (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {locale === "en" ? group.titleEn : group.titleFr}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              const label = locale === "en" ? item.labelEn : item.labelFr;

              return (
                <a
                  key={item.key}
                  href={buildHref(item.href)}
                  title={collapsed && !isMobile ? label : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (isMobile) setMobileDrawerOpen(false);
                  }}
                  className={cn(
                    "group relative flex min-h-[40px] items-center justify-between gap-3 rounded-r-lg px-2.5 py-2 text-body-sm transition-colors",
                    collapsed && !isMobile && "justify-center px-0 rounded-lg",
                    active
                      ? "border-l-[3px] border-accent bg-primary-soft font-semibold text-primary"
                      : "border-l-[3px] border-transparent text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                      aria-hidden="true"
                    />
                    {(!collapsed || isMobile) && (
                      <span className="truncate">{label}</span>
                    )}
                  </div>

                  {(!collapsed || isMobile) && item.badge !== undefined && (
                    <span
                      className={cn(
                        "rounded-chip px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-muted text-muted-foreground",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        ))}

        {/* Dev Component Gallery Link (Development only) */}
        {process.env.NODE_ENV !== "production" && (
          <div className="pt-2 border-t border-border">
            <a
              href={buildHref("/dev/components")}
              title="Design System Gallery"
              className={cn(
                "flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-caption font-medium transition-colors",
                pathname.includes("/dev/components")
                  ? "bg-accent-soft text-primary font-semibold border border-accent/40"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
                collapsed && !isMobile && "justify-center px-0",
              )}
            >
              <Sparkles
                className="h-4 w-4 shrink-0 text-accent"
                aria-hidden="true"
              />
              {(!collapsed || isMobile) && (
                <span className="truncate">
                  {locale === "en"
                    ? "Design System (/dev)"
                    : "Galerie UI (/dev)"}
                </span>
              )}
            </a>
          </div>
        )}
      </nav>

      {/* Collapse Toggle Footer (Desktop only) */}
      {!isMobile && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={
              collapsed
                ? locale === "en"
                  ? "Expand sidebar"
                  : "Déplier la barre latérale"
                : locale === "en"
                  ? "Collapse sidebar"
                  : "Replier la barre latérale"
            }
            className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-caption font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1 text-left">
                  {locale === "en" ? "Collapse menu" : "Réduire le menu"}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar (248px or 64px) */}
      <aside
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col border-r border-border transition-all duration-200",
          collapsed ? "lg:w-[64px]" : "lg:w-[248px]",
        )}
      >
        {renderSidebarNavigation(false)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-[1px]"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-[272px] max-w-[85vw] flex-col border-r border-border bg-surface shadow-popover">
            {renderSidebarNavigation(true)}
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div
        className={cn(
          "flex flex-1 flex-col min-w-0 pb-16 lg:pb-0 transition-all duration-200",
          collapsed ? "lg:pl-[64px]" : "lg:pl-[248px]",
        )}
      >
        {/* Top Bar (56px) */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/95 px-3 sm:px-6 backdrop-blur-sm">
          {/* Left: Mobile Drawer Trigger + Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label={
                locale === "en"
                  ? "Open navigation drawer"
                  : "Ouvrir le menu de navigation"
              }
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-foreground hover:bg-surface-muted lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 truncate text-body-sm"
            >
              <a
                href={buildHref("/dashboard")}
                className="font-medium text-muted-foreground hover:text-primary transition-colors hidden sm:inline"
              >
                {locale === "en" ? "Workspace" : "Espace cabinet"}
              </a>
              {breadcrumbs && breadcrumbs.length > 0 ? (
                breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    <span
                      className="text-muted-foreground/50 hidden sm:inline"
                      aria-hidden="true"
                    >
                      /
                    </span>
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="truncate text-muted-foreground hover:text-primary transition-colors"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="truncate font-semibold text-foreground">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <>
                  <span
                    className="text-muted-foreground/50 hidden sm:inline"
                    aria-hidden="true"
                  >
                    /
                  </span>
                  <span className="truncate font-semibold text-foreground">
                    {locale === "en" ? "Overview" : "Vue d'ensemble"}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Center: Global Search Command Palette Trigger */}
          <div className="flex flex-1 justify-center max-w-md mx-2">
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              aria-label={
                locale === "en"
                  ? "Search matters, parties, documents (Ctrl+K)"
                  : "Rechercher dossiers, parties, documents (Ctrl+K)"
              }
              className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-caption text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {locale === "en"
                    ? "Search matters, parties, documents..."
                    : "Rechercher un dossier, une partie, un acte..."}
                </span>
              </span>
              <kbd className="hidden sm:inline-block rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right: Quick Create, Notifications, Locale Switch, User Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Active Grant Countdown Pill */}
            {activeGrants.length > 0 && (
              <a
                href="/admin/access-grants"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition"
                title={`Accès exceptionnel actif sur ${activeGrants[0].matterReference}`}
              >
                <Clock className="h-3.5 w-3.5 animate-pulse text-amber-600" />
                <span>Accès {activeGrants[0].matterReference}</span>
              </a>
            )}

            {/* Quick Create (+) */}
            <div ref={quickCreateRef} className="relative hidden sm:block">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setQuickCreateOpen((prev) => !prev)}
                aria-expanded={quickCreateOpen}
                aria-haspopup="menu"
                aria-label={
                  locale === "en" ? "Quick create" : "Création rapide"
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="hidden md:inline">
                  {locale === "en" ? "Create" : "Créer"}
                </span>
              </Button>

              {quickCreateOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-1.5 w-60 rounded-lg border border-border bg-surface p-1.5 shadow-popover"
                >
                  <p className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {locale === "en" ? "Quick create" : "Création rapide"}
                  </p>
                  {quickCreateActions.map((act) => (
                    <a
                      key={act.key}
                      href={act.href}
                      role="menuitem"
                      onClick={() => setQuickCreateOpen(false)}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-body-sm text-foreground hover:bg-surface-muted transition-colors"
                    >
                      <Plus
                        className="h-3.5 w-3.5 text-accent"
                        aria-hidden="true"
                      />
                      <span>{locale === "en" ? act.labelEn : act.labelFr}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications Bell */}
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                aria-label={
                  locale === "en"
                    ? `Notifications (${unreadCount} unread)`
                    : `Notifications (${unreadCount} non lues)`
                }
                aria-expanded={notificationsOpen}
                className="relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-foreground hover:bg-surface-muted transition-colors"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-chip bg-danger px-1 font-mono text-[10px] font-semibold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 z-40 mt-1.5 w-80 sm:w-96 rounded-lg border border-border bg-surface shadow-popover"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-body-sm font-semibold text-primary">
                      {locale === "en" ? "Notifications" : "Notifications"}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:underline"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>
                          {locale === "en"
                            ? "Mark all as read"
                            : "Tout marquer comme lu"}
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {realNotifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        {locale === "en" ? "No new notifications" : "Aucune notification"}
                      </div>
                    ) : (
                      realNotifications.map((item) => {
                        const isUnread = !item.readAt;
                        const payload = item.payload || {};
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleMarkOneRead(item.id)}
                            className={`px-4 py-3 hover:bg-surface-muted/60 transition-colors cursor-pointer ${
                              isUnread ? "bg-amber-500/5 font-semibold" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span className="font-semibold uppercase tracking-wider text-accent">
                                {item.type}
                              </span>
                              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="mt-1 text-xs text-foreground">
                              {payload.title || "Notification"}
                            </p>
                            {payload.matterReference && (
                              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                {payload.matterReference}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Language Switcher (FR | EN) */}
            <a
              href={switchLocaleHref}
              aria-label={
                locale === "fr"
                  ? "Switch language to English"
                  : "Passer l'interface en français"
              }
              title={
                locale === "fr"
                  ? "Switch to English (EN)"
                  : "Passer en Français (FR)"
              }
              className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-caption font-semibold text-foreground hover:bg-surface-muted transition-colors"
            >
              <span
                className={cn(
                  locale === "fr"
                    ? "text-primary font-bold"
                    : "text-muted-foreground",
                )}
              >
                FR
              </span>
              <span className="text-border" aria-hidden="true">
                |
              </span>
              <span
                className={cn(
                  locale === "en"
                    ? "text-primary font-bold"
                    : "text-muted-foreground",
                )}
              >
                EN
              </span>
            </a>

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-label={locale === "en" ? "User menu" : "Menu utilisateur"}
                className="flex min-h-[40px] items-center gap-2 rounded-lg border border-transparent px-2 py-1 hover:border-border hover:bg-surface-muted transition-colors"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground">
                  JM
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-caption font-semibold text-foreground leading-tight">
                    {userName}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {userRoleLabel}
                  </p>
                </div>
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-1.5 w-60 rounded-lg border border-border bg-surface p-1.5 shadow-popover"
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="text-body-sm font-semibold text-foreground">
                      {userName}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {userRoleLabel}
                    </p>
                  </div>
                  <div className="py-1">
                    <a
                      href={buildHref("/settings/security")}
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-body-sm text-foreground hover:bg-surface-muted"
                    >
                      <UserIcon
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>
                        {locale === "en" ? "My Account" : "Mon compte"}
                      </span>
                    </a>
                    <a
                      href={buildHref("/settings/security")}
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-body-sm text-foreground hover:bg-surface-muted"
                    >
                      <KeyRound
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>
                        {locale === "en"
                          ? "Security & 2FA (TOTP)"
                          : "Sécurité & Double facteur"}
                      </span>
                    </a>
                  </div>
                  <div className="border-t border-border pt-1">
                    <a
                      href={buildHref("/login")}
                      role="menuitem"
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-body-sm font-medium text-danger hover:bg-danger-soft"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {locale === "en" ? "Sign out" : "Se déconnecter"}
                      </span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main View Area */}
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< lg) - DESIGN.md Section 3.1 */}
      <nav
        aria-label={
          locale === "en" ? "Mobile quick navigation" : "Navigation mobile"
        }
        className="fixed bottom-0 inset-x-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface px-2 shadow-popover lg:hidden"
      >
        <a
          href={buildHref("/dashboard")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 text-[11px] font-medium",
            isItemActive("/dashboard")
              ? "text-primary font-semibold"
              : "text-muted-foreground",
          )}
        >
          <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          <span>{locale === "en" ? "Home" : "Accueil"}</span>
        </a>

        <a
          href={buildHref("/tasks")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 text-[11px] font-medium",
            isItemActive("/tasks")
              ? "text-primary font-semibold"
              : "text-muted-foreground",
          )}
        >
          <CheckSquare className="h-5 w-5" aria-hidden="true" />
          <span>{locale === "en" ? "Tasks" : "Tâches"}</span>
        </a>

        <button
          type="button"
          onClick={() => setSearchModalOpen(true)}
          aria-label={locale === "en" ? "Quick create" : "Création rapide"}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card border-2 border-accent"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>

        <a
          href={buildHref("/calendar")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 text-[11px] font-medium",
            isItemActive("/calendar")
              ? "text-primary font-semibold"
              : "text-muted-foreground",
          )}
        >
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
          <span>{locale === "en" ? "Calendar" : "Agenda"}</span>
        </a>

        <a
          href={buildHref("/matters")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 text-[11px] font-medium",
            isItemActive("/matters")
              ? "text-primary font-semibold"
              : "text-muted-foreground",
          )}
        >
          <Briefcase className="h-5 w-5" aria-hidden="true" />
          <span>{locale === "en" ? "Matters" : "Dossiers"}</span>
        </a>
      </nav>

      {/* Command Palette Modal (Ctrl/Cmd + K) */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={
            locale === "en" ? "Global command search" : "Recherche globale"
          }
        >
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-[1px]"
            onClick={() => setSearchModalOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-xl rounded-dialog border border-border bg-surface shadow-popover overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                placeholder={
                  locale === "en"
                    ? "Search matters (DOS-...), parties, documents, tasks..."
                    : "Rechercher un dossier (DOS-...), une partie, un document, une tâche..."
                }
                className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="rounded border border-border bg-surface-muted px-2 py-0.5 font-mono text-caption text-muted-foreground hover:text-foreground"
              >
                Esc
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-3 space-y-4">
              {isSearching ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {locale === "en" ? "Searching across firm records..." : "Recherche dans les dossiers du cabinet..."}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                searchResults.matters.length === 0 &&
                searchResults.parties.length === 0 &&
                searchResults.documents.length === 0 &&
                searchResults.tasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    {locale === "en"
                      ? `No results found for "${searchQuery}"`
                      : `Aucun résultat trouvé pour "${searchQuery}"`}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Matters */}
                    {searchResults.matters.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {locale === "en" ? "Matters" : "Dossiers"}
                        </p>
                        <div className="space-y-1">
                          {searchResults.matters.map((m) => (
                            <a
                              key={m.id}
                              href={buildHref(`/matters/${m.id}`)}
                              onClick={() => setSearchModalOpen(false)}
                              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-body-sm hover:bg-surface-muted transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-caption font-semibold text-primary border border-border">
                                  {m.reference}
                                </span>
                                <span className="truncate font-medium text-foreground">
                                  {m.title}
                                </span>
                              </div>
                              {m.category && (
                                <span className="text-caption text-muted-foreground shrink-0 ml-2">
                                  {m.category}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Parties */}
                    {searchResults.parties.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {locale === "en" ? "Clients & Parties" : "Clients & Parties"}
                        </p>
                        <div className="space-y-1">
                          {searchResults.parties.map((p) => (
                            <a
                              key={p.id}
                              href={buildHref(`/parties/${p.id}`)}
                              onClick={() => setSearchModalOpen(false)}
                              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-body-sm hover:bg-surface-muted transition-colors"
                            >
                              <span className="truncate font-medium text-foreground">
                                {p.displayName}
                              </span>
                              <span className="text-caption text-muted-foreground shrink-0 ml-2">
                                {p.clientStatus} ({p.type})
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Documents */}
                    {searchResults.documents.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {locale === "en" ? "Documents" : "Documents"}
                        </p>
                        <div className="space-y-1">
                          {searchResults.documents.map((d) => (
                            <a
                              key={d.id}
                              href={buildHref(d.matterId ? `/matters/${d.matterId}?tab=documents` : `/matters`)}
                              onClick={() => setSearchModalOpen(false)}
                              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-body-sm hover:bg-surface-muted transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate font-medium text-foreground">
                                  {d.title}
                                </span>
                              </div>
                              {d.matterReference && (
                                <span className="font-mono text-caption text-primary shrink-0 ml-2">
                                  {d.matterReference}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tasks */}
                    {searchResults.tasks.length > 0 && (
                      <div>
                        <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {locale === "en" ? "Tasks" : "Tâches"}
                        </p>
                        <div className="space-y-1">
                          {searchResults.tasks.map((t) => (
                            <a
                              key={t.id}
                              href={buildHref(t.matterId ? `/matters/${t.matterId}?tab=tasks` : `/matters`)}
                              onClick={() => setSearchModalOpen(false)}
                              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-body-sm hover:bg-surface-muted transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate font-medium text-foreground">
                                  {t.title}
                                </span>
                              </div>
                              <span className="text-caption text-muted-foreground shrink-0 ml-2">
                                {t.status}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div>
                  <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {locale === "en" ? "Quick Actions" : "Actions rapides"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {quickCreateActions.map((act) => (
                      <a
                        key={act.key}
                        href={act.href}
                        onClick={() => setSearchModalOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-body-sm text-foreground hover:bg-surface-muted"
                      >
                        <Plus
                          className="h-4 w-4 text-accent shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {locale === "en" ? act.labelEn : act.labelFr}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
