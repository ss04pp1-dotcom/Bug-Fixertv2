"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { NoSSR } from "@/components/no-ssr";
import { Users, TrendingUp, Eye, Clock, ArrowUpRight, Download, Menu, RefreshCw, Info } from "lucide-react";
import { useApi } from "@/lib/use-api";

interface DashboardStats {
  users?: { total: number; active: number; premium: number; newToday: number };
  content?: { channels: number; movies: number; series: number };
  subscriptions?: { active: number };
  revenue?: { monthly: number };
  announcements?: { active: number };
}
interface GrowthPoint  { date: string; count: number; }
interface TopChannel   { id: string; name: string; viewCount?: number; logo?: string }
interface TopMovie     { id: string; title: string; viewCount?: number; rating?: number }
interface DeviceRow    { name: string; value: number; color: string; }
interface RetentionRow { week: string; rate: number; }

const PERIOD_MAP: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

const DEVICE_FALLBACK: DeviceRow[] = [
  { name: "Mobile",  value: 62, color: "#7C3AED" },
  { name: "TV App",  value: 21, color: "#3B82F6" },
  { name: "Desktop", value: 11, color: "#10B981" },
  { name: "Tablet",  value: 6,  color: "#F59E0B" },
];

const RETENTION_FALLBACK: RetentionRow[] = [
  { week: "W1", rate: 100 }, { week: "W2", rate: 82 }, { week: "W3", rate: 71 },
  { week: "W4", rate: 64 }, { week: "W5", rate: 58 }, { week: "W6", rate: 54 },
  { week: "W7", rate: 51 }, { week: "W8", rate: 49 },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-[#8B92A5] mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value?.toLocaleString()}</p>
    </div>
  );
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtMoney(dollars: number): string {
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default function Analytics() {
  const [period, setPeriod] = useState("7d");
  const days = PERIOD_MAP[period] ?? 7;

  const { data: dashData, isLoading: dashLoading, refetch } = useApi<DashboardStats>("/v1/analytics/dashboard");
  const { data: growthData } = useApi<GrowthPoint[]>(`/v1/analytics/user-growth?days=${days}`);
  const { data: topChannels, isLoading: channelsLoading } = useApi<TopChannel[]>("/v1/analytics/top-channels?limit=6");
  const { data: topMovies,   isLoading: moviesLoading   } = useApi<TopMovie[]>("/v1/analytics/top-movies?limit=6");
  const { data: deviceApiData } = useApi<DeviceRow[]>("/v1/analytics/devices");
  const { data: retentionApiData } = useApi<RetentionRow[]>("/v1/analytics/retention");

  const deviceData    = (deviceApiData    && deviceApiData.length    > 0) ? deviceApiData    : DEVICE_FALLBACK;
  const retentionData = (retentionApiData && retentionApiData.length > 0) ? retentionApiData : RETENTION_FALLBACK;
  const usingFallback = !deviceApiData?.length || !retentionApiData?.length;

  const totalUsers = dashData?.users?.total ?? 0;
  const activeSubs = dashData?.subscriptions?.active ?? 0;
  const monthlyRev = dashData?.revenue?.monthly ?? 0;
  const newToday   = dashData?.users?.newToday ?? 0;

  const stats = dashData ? [
    { label: "New Users",      value: fmt(newToday),   change: "Today",     color: "gradient-primary", icon: Eye       },
    { label: "Total Users",    value: fmt(totalUsers), change: "",          color: "gradient-blue",    icon: Users     },
    { label: "Monthly Revenue",value: fmtMoney(monthlyRev), change: "",    color: "gradient-green",   icon: Clock     },
    { label: "Active Subs",    value: fmt(activeSubs), change: "",          color: "gradient-orange",  icon: TrendingUp },
  ] : [];

  // Convert growth data to chart format
  const chartGrowth = (growthData ?? []).map(p => ({
    day: p.date?.slice(5) ?? p.date ?? '', // MM-DD
    views: p.count,
  }));

  const topContentLoading = channelsLoading || moviesLoading;
  const topContent = [
    ...(topChannels ?? []).map(c => ({ title: c.name, type: "Channel", views: fmt(c.viewCount ?? 0), rating: 0 })),
    ...(topMovies ?? []).map(m => ({ title: m.title, type: "Movie",   views: fmt(m.viewCount ?? 0), rating: m.rating ?? 0 })),
  ].slice(0, 8);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          {["7d","30d","90d"].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                period === p ? "gradient-primary text-white" : "bg-card border border-border text-[#8B92A5] hover:bg-white/5"
              )}>
              {p}
            </button>
          ))}
          <button onClick={() => refetch()} disabled={dashLoading}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={13} className={dashLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              const rows = [
                ...((topChannels ?? []).map(c => ({ type: "Channel", title: c.name, views: c.viewCount ?? 0 }))),
                ...((topMovies ?? []).map(m => ({ type: "Movie",   title: m.title, views: m.viewCount ?? 0 }))),
              ];
              if (!rows.length) return;
              const headers = Object.keys(rows[0]).join(",");
              const body = rows.map(r => Object.values(r).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([headers + "\n" + body], { type: "text/csv" });
              const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = `analytics-${period}.csv`; a.click(); URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto h-[calc(100vh-57px)]">
        {/* Fallback data notice */}
        {usingFallback && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2.5 text-xs text-blue-400">
            <Info size={14} className="shrink-0" />
            <span>Showing sample data — connect your analytics API to see real metrics.</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {dashLoading ? Array.from({length:4}).map((_,i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-[100px] animate-pulse" />
          )) : stats.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                    <Icon size={16} className="text-white" />
                  </div>
                  {s.change && (
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <ArrowUpRight size={12} />{s.change}
                    </div>
                  )}
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-[#8B92A5] mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Views + Device Split */}
        <NoSSR fallback={<div className="h-[260px] bg-card border border-border rounded-xl animate-pulse" />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-1">User Registrations — Last {days} Days</h2>
              <p className="text-xs text-[#8B92A5] mb-4">New users registered per day</p>
              {chartGrowth.length === 0 ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-[#8B92A5]">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartGrowth} margin={{ top: 5, right: 4, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(chartGrowth.length / 7) - 1)} />
                    <YAxis tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="views" name="New Users" stroke="#7C3AED" strokeWidth={2}
                      fill="url(#aGrad)" activeDot={{ r: 5, fill: "#7C3AED", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Device Breakdown</h2>
              <div className="flex justify-center mb-3">
                <PieChart width={150} height={150}>
                  <Pie data={deviceData} cx={75} cy={75} innerRadius={42} outerRadius={65}
                    paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {deviceData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </div>
              <div className="space-y-2">
                {deviceData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-[#8B92A5] flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-white">{d.value}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#8B92A5] mt-3 text-center">Illustrative breakdown</p>
            </div>
          </div>
        </NoSSR>

        {/* Retention */}
        <NoSSR fallback={<div className="h-[200px] bg-card border border-border rounded-xl animate-pulse" />}>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">User Retention Curve</h2>
              <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">Illustrative</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={retentionData} margin={{ top: 5, right: 4, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8B92A5", fontSize: 10 }} axisLine={false} tickLine={false} width={32}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" fill="#7C3AED" radius={[4,4,0,0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </NoSSR>

        {/* Top Content */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-white">Top Performing Content</h3>
            {topContentLoading && <RefreshCw size={12} className="text-primary animate-spin" />}
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#0d1525]">
                {["#","Content","Type","Views","Rating"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topContentLoading ? (
                <tr><td colSpan={5} className="text-center py-8"><RefreshCw size={16} className="text-primary animate-spin mx-auto" /></td></tr>
              ) : topContent.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-sm text-[#8B92A5]">No content data available</td></tr>
              ) : topContent.map((c, i) => (
                <tr key={`${c.type}-${i}`} className="tbl-row border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-sm text-[#8B92A5]">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white max-w-[200px] truncate">{c.title}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                      c.type === "Channel" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"
                    )}>{c.type}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{c.views}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-yellow-400">
                    {c.rating > 0 ? `★ ${c.rating}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
