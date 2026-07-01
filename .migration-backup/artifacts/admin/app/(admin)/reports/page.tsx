"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { NoSSR } from "@/components/no-ssr";
import { Download, Menu, RefreshCw, Users, DollarSign, Play, TrendingUp } from "lucide-react";
import { useApi } from "@/lib/use-api";

const PERIOD_OPTIONS = [
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
];
const PIE_COLORS = ["#6C35D9", "#1A56DB", "#22C55E", "#F59E0B", "#EC4899", "#14B8A6"];

interface OverviewStat {
  totalUsers: number; activeUsers: number; totalRevenue: number;
  activeSubscriptions: number; totalChannels: number; totalMovies: number;
  totalSeries: number; totalPayments: number;
}
interface GrowthPoint   { date: string; count: number; }
interface RevenuePoint  { date: string; revenue: number; }
interface SubBreakdown  { planName: string; count: number; percentage: number; monthlyRevenue: number; }
interface WatchStat     { totalWatched: number; completedWatched: number; completionRate: number; avgProgress: number; }
interface TopChannel    { id: string; name: string; viewCount: number; }
interface TopContent    { id: string; title: string; viewCount: number; }

function StatCard({ title, value, sub, icon: Icon, gradient }: {
  title: string; value: string; sub?: string; icon: React.ElementType; gradient: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", gradient)}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-[#8B92A5] mt-1">{title}</div>
      {sub && <div className="text-xs text-green-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function exportToCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(30);

  const { data: overview, isLoading: ovLoading } = useApi<OverviewStat>("/v1/reports/overview");
  const { data: userGrowth }  = useApi<GrowthPoint[]>(`/v1/reports/user-growth?days=${period}`);
  const { data: revenue }     = useApi<RevenuePoint[]>(`/v1/reports/revenue?days=${period}`);
  const { data: subs }        = useApi<SubBreakdown[]>("/v1/reports/subscriptions");
  const { data: watchStats }  = useApi<WatchStat>("/v1/reports/watch-stats");
  const { data: content }     = useApi<{ topChannels: TopChannel[]; topMovies: TopContent[]; topSeries: TopContent[] }>("/v1/reports/content");

  const fmtNum = (n?: number) => n == null ? "—" : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
  const fmtMoney = (n?: number) => n == null ? "—" : `$${(Number(n) / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  const topChannels = content?.topChannels ?? [];
  const topMovies   = content?.topMovies ?? [];
  const subBreakdown = subs ?? [];

  function handleExportCSV() {
    const rows: string[][] = [["StreamPro Report", `Period: ${period} days`, new Date().toLocaleString()]];
    rows.push([]);
    rows.push(["=== OVERVIEW ==="]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Users",           String(overview?.totalUsers ?? "")]);
    rows.push(["Active Users",          String(overview?.activeUsers ?? "")]);
    rows.push(["Total Revenue ($)",     String(overview?.totalRevenue ?? "")]);
    rows.push(["Active Subscriptions",  String(overview?.activeSubscriptions ?? "")]);
    rows.push(["Total Channels",        String(overview?.totalChannels ?? "")]);
    rows.push(["Total Movies",          String(overview?.totalMovies ?? "")]);
    rows.push(["Total Series",          String(overview?.totalSeries ?? "")]);
    rows.push(["Total Transactions",    String(overview?.totalPayments ?? "")]);
    if (userGrowth?.length) {
      rows.push([]); rows.push(["=== USER GROWTH ==="]);
      rows.push(["Date", "New Users"]);
      userGrowth.forEach(p => rows.push([p.date, String(p.count)]));
    }
    if (revenue?.length) {
      rows.push([]); rows.push(["=== REVENUE ==="]);
      rows.push(["Date", "Revenue ($)"]);
      revenue.forEach(p => rows.push([p.date, String(p.revenue)]));
    }
    if (subs?.length) {
      rows.push([]); rows.push(["=== SUBSCRIPTIONS BY PLAN ==="]);
      rows.push(["Plan", "Count", "Percentage", "Monthly Revenue ($)"]);
      subs.forEach(s => rows.push([s.planName, String(s.count), `${s.percentage}%`, String(s.monthlyRevenue)]));
    }
    exportToCSV(rows, `streampro-report-${period}d-${new Date().toISOString().slice(0,10)}.csv`);
  }

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          {ovLoading && <RefreshCw size={14} className="text-primary animate-spin" />}
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.days} onClick={() => setPeriod(opt.days)}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  period === opt.days ? "bg-primary text-white" : "text-[#8B92A5] hover:text-white"
                )}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white transition-colors">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-57px)]">

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Users" value={fmtNum(overview?.totalUsers)}
            sub={`${fmtNum(overview?.activeUsers)} active`} icon={Users} gradient="gradient-primary" />
          <StatCard title="Total Revenue" value={fmtMoney(overview?.totalRevenue)}
            sub={`${overview?.totalPayments ?? 0} transactions`} icon={DollarSign} gradient="gradient-green" />
          <StatCard title="Active Subscriptions" value={fmtNum(overview?.activeSubscriptions)}
            icon={TrendingUp} gradient="gradient-blue" />
          <StatCard title="Content Library"
            value={fmtNum((overview?.totalChannels ?? 0) + (overview?.totalMovies ?? 0) + (overview?.totalSeries ?? 0))}
            sub={`${overview?.totalChannels ?? 0} ch · ${overview?.totalMovies ?? 0} movies`}
            icon={Play} gradient="gradient-orange" />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">User Growth</h3>
            <NoSSR>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={userGrowth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8B92A5" }}
                    tickFormatter={v => v.slice(5)}
                    interval={Math.max(0, Math.floor((userGrowth?.length ?? 1) / 6) - 1)} />
                  <YAxis tick={{ fontSize: 10, fill: "#8B92A5" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#141824", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" stroke="#6C35D9" strokeWidth={2} dot={false} name="New Users" />
                </LineChart>
              </ResponsiveContainer>
            </NoSSR>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue Over Time</h3>
            <NoSSR>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8B92A5" }}
                    tickFormatter={v => v.slice(5)}
                    interval={Math.max(0, Math.floor((revenue?.length ?? 1) / 6) - 1)} />
                  <YAxis tick={{ fontSize: 10, fill: "#8B92A5" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#141824", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="#22C55E" radius={[3, 3, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </NoSSR>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Subscription Plans</h3>
            {subBreakdown.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-[#8B92A5]">No data</div>
            ) : (
              <NoSSR>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={subBreakdown} dataKey="count" nameKey="planName" cx="50%" cy="50%" outerRadius={60}>
                      {subBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#141824", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </NoSSR>
            )}
            <div className="space-y-2 mt-2">
              {subBreakdown.slice(0, 4).map((s, i) => (
                <div key={s.planName} className="flex justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[#8B92A5]">{s.planName}</span>
                  </div>
                  <span className="text-white font-medium">{s.count} subs</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Top Channels</h3>
            <div className="space-y-3">
              {topChannels.length === 0 ? (
                <div className="text-sm text-[#8B92A5] text-center py-8">No data yet</div>
              ) : topChannels.slice(0, 6).map((ch, i) => {
                const max = topChannels[0]?.viewCount || 1;
                return (
                  <div key={ch.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white truncate max-w-[60%]">{i + 1}. {ch.name}</span>
                      <span className="text-[#8B92A5]">{fmtNum(ch.viewCount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full">
                      <div className="h-1.5 gradient-primary rounded-full" style={{ width: `${(ch.viewCount / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Top Movies</h3>
            <div className="space-y-3">
              {topMovies.length === 0 ? (
                <div className="text-sm text-[#8B92A5] text-center py-8">No data yet</div>
              ) : topMovies.slice(0, 6).map((m, i) => {
                const max = topMovies[0]?.viewCount || 1;
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white truncate max-w-[60%]">{i + 1}. {m.title}</span>
                      <span className="text-[#8B92A5]">{fmtNum(m.viewCount)}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full">
                      <div className="h-1.5 gradient-blue rounded-full" style={{ width: `${(m.viewCount / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Watch Stats */}
        {watchStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Watch Sessions", value: fmtNum(watchStats.totalWatched) },
              { label: "Completed Views",       value: fmtNum(watchStats.completedWatched) },
              { label: "Completion Rate",        value: `${watchStats.completionRate}%` },
              { label: "Avg Progress",           value: `${watchStats.avgProgress}%` },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-[#8B92A5] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
