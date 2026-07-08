"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Tv, Film, Library, Tag, Users, CreditCard,
  ArrowLeftRight, ImageIcon, Bell, Settings, FileText,
  LogOut, Tv2, Megaphone, Wallet, BarChart2, Shield, Key,
  ClipboardList, User, ChevronLeft, ChevronRight, Radio, Globe, Flag,
  HelpCircle, Activity, MapPin, Trophy, Star, Download, ShieldCheck, FileUp,
  HeartPulse, Trash2, Github,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { apiClient } from "@/lib/axios-client";
import { useApiQuery } from "@/lib/use-api";

// ─── Role-based visibility ──────────────────────────────────────────────────
// Decode the JWT's role claim client-side so we can hide navigation items that
// the current user's role cannot access. This is a UX convenience — real
// enforcement happens API-side. Never trust client-side role checks for security.
async function getAdminRole(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null;
    // Dynamic import to avoid circular deps; getToken is a tiny sync function.
    const authMod = await import('@/lib/auth');
    const token = authMod.getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (payload?.role as string) ?? null;
  } catch {
    return null;
  }
}

// Items only visible to super_admin (system configuration, RBAC management).
const SUPER_ADMIN_ONLY_PATHS = new Set([
  '/roles', '/permissions', '/audit-logs', '/feature-flags', '/geo-block',
  '/settings', '/billing',
]);

// Items visible to admin and above (everything except super_admin exclusives).
const ADMIN_ONLY_PATHS = new Set([
  '/users', '/reports', '/analytics', '/live-users', '/support',
]);

function isNavItemVisible(path: string, role: string | null): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true; // super_admin sees everything
  if (SUPER_ADMIN_ONLY_PATHS.has(path)) return false;
  if (role === 'admin') return true;
  if (ADMIN_ONLY_PATHS.has(path)) return false; // moderator/editor/support can't see these
  return true;
}

const NAV_ITEMS = [
  { label: "Dashboard",      icon: LayoutDashboard, path: "/"              },
  { label: "Channels",       icon: Tv,              path: "/channels"      },
  { label: "Categories",     icon: Tag,             path: "/categories"    },
  { label: "Movies",         icon: Film,            path: "/movies"        },
  { label: "Series",         icon: Library,         path: "/series"        },
  { label: "Advertisements", icon: Megaphone,       path: "/advertisements"},
  { label: "Subscriptions",  icon: CreditCard,      path: "/subscriptions" },
  { label: "Users",          icon: Users,           path: "/users"         },
  { label: "Payments",       icon: ArrowLeftRight,  path: "/payments"      },
  { label: "Billing",        icon: Wallet,          path: "/billing"       },
  { label: "Notifications",  icon: Bell,            path: "/notifications" },
  { label: "Banners",        icon: ImageIcon,       path: "/banners"       },
  { label: "Announcements",  icon: Globe,           path: "/announcements" },
  { label: "EPG",            icon: Radio,           path: "/epg"           },
  { label: "Sports",         icon: Trophy,          path: "/sports"         },
  { label: "Reports",        icon: FileText,        path: "/reports"       },
  { label: "Live Users",     icon: Activity,        path: "/live-users"    },
  { label: "Analytics",      icon: BarChart2,       path: "/analytics"     },
  { label: "Geo Block",      icon: MapPin,          path: "/geo-block"     },
  { label: "Feature Flags",  icon: Flag,            path: "/feature-flags" },
  { label: "Settings",       icon: Settings,        path: "/settings"      },
  { label: "Parental Control", icon: ShieldCheck,   path: "/parental-control" },
  { label: "Roles",          icon: Shield,          path: "/roles"         },
  { label: "Permissions",    icon: Key,             path: "/permissions"   },
  { label: "Audit Logs",     icon: ClipboardList,   path: "/audit-logs"    },
  { label: "Support",        icon: HelpCircle,      path: "/support"       },
  { label: "Reviews",        icon: Star,            path: "/reviews"        },
  { label: "Downloads",      icon: Download,        path: "/downloads"      },
  { label: "M3U Import",     icon: FileUp,          path: "/m3u-import"    },
  { label: "GitHub Sources", icon: Github,           path: "/github-sources" },
  { label: "Channel Health",  icon: HeartPulse,       path: "/channel-health"  },
  { label: "Deleted Channels", icon: Trash2,          path: "/deleted-channels" },
  { label: "Profile",        icon: User,            path: "/profile"       },
];

interface AdminProfile {
  id: string;
  identifier: string;
  role?: { name: string };
}

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}

function NavItem({ item, collapsed }: { item: (typeof NAV_ITEMS)[0]; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
  const Icon = item.icon;

  return (
    <Link href={item.path}>
      <div className={cn(
        "flex items-center gap-3 mx-2 rounded-lg cursor-pointer transition-all duration-150 text-sm group relative",
        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
        isActive
          ? "bg-primary text-white font-medium shadow-lg shadow-primary/20"
          : "text-[#8B92A5] hover:bg-white/5 hover:text-white"
      )}>
        <Icon size={16} className="shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && (
          <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-[#141B2D] border border-border rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none shadow-xl">
            {item.label}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const router = useRouter();
  // Decode JWT role claim for client-side nav filtering. Refreshed on mount.
  const [adminRole, setAdminRole] = React.useState<string | null>(null);
  React.useEffect(() => { getAdminRole().then(setAdminRole); }, []);
  // D-008: same query key as DashboardLayout — React Query dedupes the
  // in-flight request so we don't fetch /v1/auth/profile twice on mount.
  const { data: profile } = useApiQuery<AdminProfile>(
    ["/v1/auth/profile"],
    "/v1/auth/profile",
    { retry: false },
  );

  const displayName = profile?.identifier ?? "Admin";
  const roleLabel   = profile?.role?.name ?? "Super Admin";
  const initial     = displayName[0]?.toUpperCase() ?? "A";

  // D-009: also notify the server so the session is revoked.
  const handleLogout = async () => {
    try { await apiClient.post("/v1/auth/logout"); } catch {}
    clearToken();
    router.push("/login");
  };

  return (
    <aside className={cn(
      "h-screen flex flex-col fixed top-0 left-0 z-30 border-r border-border bg-sidebar transition-all duration-300 ease-in-out",
      collapsed ? "w-[60px]" : "w-56"
    )}>
      <div className={cn(
        "flex items-center gap-2.5 border-b border-border shrink-0",
        collapsed ? "px-3 py-[15px] justify-center" : "px-4 py-[15px]"
      )}>
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Tv2 size={15} className="text-white" />
        </div>
        {!collapsed && (
          <>
            <span className="text-sm font-bold text-white truncate flex-1">StreamPro</span>
            <button onClick={() => onCollapse(true)} className="text-[#8B92A5] hover:text-white transition-colors p-0.5 rounded">
              <ChevronLeft size={14} />
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={() => onCollapse(false)}
            className="absolute -right-3 top-4 w-6 h-6 rounded-full bg-[#141B2D] border border-border flex items-center justify-center text-[#8B92A5] hover:text-white transition-colors shadow-md">
            <ChevronRight size={11} />
          </button>
        )}
      </div>

      <div className={cn(
        "flex items-center border-b border-border shrink-0",
        collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3"
      )}>
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white">
            {initial}
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border-2 border-sidebar" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{displayName}</div>
            <div className="text-[10px] text-[#8B92A5] truncate">{roleLabel}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {NAV_ITEMS.filter(item => isNavItemVisible(item.path, adminRole)).map(item => <NavItem key={item.path} item={item} collapsed={collapsed} />)}
      </nav>

      <div className="border-t border-border p-2 shrink-0">
        <button onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm w-full",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
          )}>
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
