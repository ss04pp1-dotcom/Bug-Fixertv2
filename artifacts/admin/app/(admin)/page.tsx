"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { NoSSR } from "@/components/no-ssr";
import {
  Users, Wifi, Film, Library, DollarSign, TrendingUp,
  CalendarDays, ChevronDown, Menu, RefreshCw,
  Radio, Smartphone, Activity, WifiOff, Globe,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import { usePresenceStats } from "@/lib/use-presence";

// (D-048) Removed hardcoded `countryData` pie chart — it was illustrative
// only and there is no backing API for country breakdown yet. The dashboard
// now shows a "Country breakdown coming soon" placeholder instead.

interface DashboardStats {
  users: { total: number; active: number; premium: number; newToday: number };
  content: { channels: number; movies: number; series: number };
  subscriptions: { active: number };
  revenue: { monthly: number };
}
interface GrowthPoint { date: string; count: number }
interface TopChannel  { id: string; name: string; viewCount: number }
interface UserItem    { id: string; email: string; createdAt: string }
interface PaymentItem {
  id: string; amount: number; status: string; createdAt: string;
  subscription?: { plan?: { name: string } };
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#8B92A5] mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value.toLocaleString()} users</p>
    </div>
  );
};

export default function Dashboard() {
  const router = useRouter();
  const { data: stats, isLoading: statsLoading } = useApi<DashboardStats>("/v1/analytics/dashboard");
  const { data: growthRaw, isLoading: growthLoading } = useApi<GrowthPoint[]>("/v1/analytics/user-growth");
  const { data: topChRaw }     = useApi<TopChannel[]>("/v1/analytics/top-channels");
  const { data: usersPage }    = useApi<{ data: UserItem[] }>("/v1/users?limit=5&sortBy=createdAt&sortOrder=desc");
  const { data: paymentsPage } = useApi<{ data: PaymentItem[] }>("/v1/payments?limit=5&status=completed");

  // Real-time WebSocket presence stats
  const { stats: presence, connected: wsConnected } = usePresenceStats();

  const areaData    = (growthRaw ?? []).map(g => ({ date: g.date.slice(5), users: g.count }));
  const topChannels = (topChRaw ?? []).slice(0, 5);
  const recentUsers = usersPage?.data  ?? [];
  const recentTxns  = paymentsPage?.data ?? [];

  const statCards = [
    { label: "Total Users",     sub: "Registered",  value: stats?.users?.total,      icon: Users,       grad: "gradient-primary" },
    {
      label: "Active Users",
      sub: wsConnected ? "Live (WebSocket)" : "Loading…",
      value: wsConnected ? presence.totalOnline : stats?.users?.active,
      icon: Users,
      grad: "gradient-blue",
      live: wsConnected,
    },
    { label: "Live Channels",   sub: "Channels",    value: stats?.content?.channels, icon: Wifi,        grad: "gradient-green"   },
    { label: "Movies",          sub: "Movies",      value: stats?.content?.movies,   icon: Film,        grad: "gradient-orange"  },
    { label: "Series",          sub: "Series",      value: stats?.content?.series,   icon: Library,     grad: "gradient-pink"    },
    { label: "Monthly Revenue", sub: "Revenue",
      value: stats?.revenue?.monthly != null
        ? `$${Number(stats.revenue.monthly).toLocaleString()}`
        : undefined,
      icon: DollarSign, grad: "gradient-primary" },
  ] as Array<{ label: string; sub: string; value: number | string | undefined; icon: React.FC<{size:number;className?:string}>; grad: string; live?: boolean }>;

  // Real-time presence mini-cards
  const presenceCards = [
    { label: "Online Now",       value: presence.totalOnline,    icon: Activity,   color: "text-green-400",  bg: "bg-green-500/10"  },
    { label: "Watching Live TV", value: presence.watchingLive,   icon: Radio,      color: "text-red-400",    bg: "bg-red-500/10"    },
    { label: "Watching Movies",  value: presence.watchingMovies, icon: Film,       color: "text-blue-400",   bg: "bg-blue-500/10"   },
    { label: "Watching Series",  value: presence.watchingSeries, icon: Library,    color: "text-purple-400", bg: "bg-purple-500/10" },
    { label: "Total Devices",    value: presence.totalDevices,   icon: Smartphone, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Dashboard</h1>
        </div>
        <button className="flex items-center gap-2 text-xs text-[#8B92A5] bg-card border border-border rounded-lg px-3 py-2 hover:bg-white/5 transition-colors">
          <CalendarDays size={13} />
          Last 30 days
          <ChevronDown size={12} />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Main Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {statCards.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[10px] font-medium text-[#8B92A5]">{s.label}</div>
                    <div className="text-[9px] text-[#8B92A5]/60">{s.sub}</div>
                  </div>
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.grad)}>
                    <Icon size={16} className="text-white" />
                  </div>
                </div>
                {statsLoading && !s.live ? (
                  <div className="h-7 w-16 bg-white/10 rounded animate-pulse" />
                ) : (
                  <div className="text-xl font-bold text-white leading-tight">
                    {s.value != null
                      ? typeof s.value === "number" ? s.value.toLocaleString() : s.value
                      : "—"}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1">
                  {s.live
                    ? <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-green-400">LIVE</span></>
                    : <><TrendingUp size={9} className="text-green-400" />
                        <span className="text-[10px] font-semibold text-green-400">Live</span></>
                  }
                </div>
                <div className="text-[9px] text-[#8B92A5]/60 mt-0.5">
                  {s.live ? "WebSocket connected" : "In last 30 days"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-time Presence Strip */}
        <div className="bg-card border border-border rounded-xl px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-green-400" />
              <span className="text-xs font-semibold text-white">Real-time Presence</span>
              <span className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
                wsConnected ? "bg-green-500/15 text-green-400" : "bg-[#8B92A5]/15 text-[#8B92A5]",
              )}>
                {wsConnected
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" /> LIVE</>
                  : <><WifiOff size={8} /> CONNECTING</>
                }
              </span>
            </div>
            <button
              onClick={() => router.push("/live-users")}
              className="text-[10px] text-primary hover:underline"
            >
              View All Users →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {presenceCards.map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2", c.bg)}>
                  <Icon size={16} className={c.color} />
                  <div>
                    <div className={cn("text-lg font-bold leading-tight", c.color)}>
                      {c.value.toLocaleString()}
                    </div>
                    <div className="text-[9px] text-[#8B92A5]">{c.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charts Row */}
        <NoSSR fallback={<div className="h-[260px] bg-card border border-border rounded-xl animate-pulse" />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Users Overview</h2>
                {growthLoading
                  ? <RefreshCw size={12} className="text-primary animate-spin" />
                  : <button className="flex items-center gap-1.5 text-xs text-[#8B92A5] border border-border rounded-lg px-2.5 py-1.5">
                      Last 30 days <ChevronDown size={11} />
                    </button>
                }
              </div>
              <ResponsiveContainer width="100%" height={195}>
                <AreaChart
                  data={areaData.length ? areaData : [{ date: "—", users: 0 }]}
                  margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="users" stroke="#7C3AED" strokeWidth={2} fill="url(#grad)"
                    activeDot={{ r: 5, fill: "#7C3AED", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-white">Top Countries</h2>
                <span className="text-[9px] text-[#8B92A5] bg-white/5 px-1.5 py-0.5 rounded">Coming soon</span>
              </div>
              {/* D-048 fix: the previous pie chart here used hardcoded
                  `countryData` (Bangladesh 45%, India 20%, …) with no real
                  backing API. Replaced with a placeholder so the dashboard
                  doesn't present fabricated metrics as live data. */}
              <div className="flex flex-col items-center justify-center h-[160px] text-center">
                <Globe size={28} className="text-[#8B92A5] mb-2" />
                <p className="text-xs text-[#8B92A5]">Country breakdown</p>
                <p className="text-xs text-[#8B92A5]">coming soon</p>
              </div>
            </div>
          </div>
        </NoSSR>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Users */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-white">Recent Users</h2>
              <button onClick={() => router.push("/users")} className="text-[10px] text-primary hover:underline">View All</button>
            </div>
            <div className="divide-y divide-border">
              {recentUsers.length === 0 && (
                <div className="py-6 text-center text-xs text-[#8B92A5]">No users yet</div>
              )}
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {(u.email?.[0] ?? 'U').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{u.email}</div>
                    <div className="text-[10px] text-[#8B92A5]">
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-white">Recent Transactions</h2>
              <button onClick={() => router.push("/billing")} className="text-[10px] text-primary hover:underline">View All</button>
            </div>
            <div className="divide-y divide-border">
              {recentTxns.length === 0 && (
                <div className="py-6 text-center text-xs text-[#8B92A5]">No transactions</div>
              )}
              {recentTxns.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-primary font-medium">#{t.id.slice(-8).toUpperCase()}</div>
                    <div className="text-[10px] text-[#8B92A5] truncate">
                      {t.subscription?.plan?.name ?? "Subscription"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-white font-semibold">${Number(t.amount).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Channels */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-xs font-semibold text-white">Top Watched Channels</h2>
              <button onClick={() => router.push("/channels")} className="text-[10px] text-primary hover:underline">View All</button>
            </div>
            <div className="divide-y divide-border">
              {topChannels.length === 0 && (
                <div className="py-6 text-center text-xs text-[#8B92A5]">No data yet</div>
              )}
              {topChannels.map((ch, i) => (
                <div key={ch.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{ch.name}</div>
                    <div className="text-[10px] text-[#8B92A5]">{ch.viewCount.toLocaleString()} Views</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
