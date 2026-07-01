"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity, Wifi, WifiOff, AlertTriangle, Clock, RefreshCw,
  Search, Loader2, ChevronLeft, ChevronRight, Zap,
  ShieldAlert, Radio, BarChart3, Shield,
} from "lucide-react";
import { useApiQuery, useApiCallState, useInvalidate, getApiErrorMessage } from "@/lib/use-api";
import { toast } from "sonner";

/* ─── Types ──────────────────────────────────────────── */

interface HealthStats {
  total: number;
  active: number;
  offline: number;
  failed: number;
  pending: number;
  checking: number;
  lastScanTime: string | null;
}

interface ImportHistoryItem {
  id: string;
  filename: string;
  status: string;
  totalChannels: number;
  activeChannels: number;
  failedChannels: number;
  createdAt: string;
  completedAt: string | null;
}

type HealthOverride = "AUTO" | "FORCE_HEALTHY" | "FORCE_OFFLINE";

interface UserPlayback {
  total: number;
  successRate: number | null;
  health: "healthy" | "unstable" | "offline" | "no_data";
}

interface FailedChannel {
  id: string;
  name: string;
  primaryStreamUrl: string | null;
  streamStatus: string;
  healthOverride: HealthOverride;
  updatedAt: string;
  userPlayback?: UserPlayback;
}

interface FailedChannelsResponse {
  data: FailedChannel[];
  meta: { total: number; totalPages: number; page: number; limit: number; hasNext: boolean; hasPrev: boolean };
}

/* ─── Stat Card ──────────────────────────────────────── */

function StatCard({ icon: Icon, label, value, color, bgColor, sub }: {
  icon: any; label: string; value: number | string; color: string; bgColor: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-[#555B70] uppercase tracking-wider font-medium">{label}</p>
          <p className={cn("text-2xl font-bold mt-1", color)}>{typeof value === "number" ? value.toLocaleString() : value}</p>
          {sub && <p className="text-[10px] text-[#555B70] mt-0.5">{sub}</p>}
        </div>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bgColor)}>
          <Icon size={18} className={color} />
        </div>
      </div>
    </div>
  );
}

/* ─── Health Ring ─────────────────────────────────────── */

function HealthRing({ stats }: { stats: HealthStats }) {
  const total = stats.total || 1;
  const activePct = (stats.active / total) * 100;
  const offlinePct = (stats.offline / total) * 100;
  const failedPct = (stats.failed / total) * 100;
  const otherPct = 100 - activePct - offlinePct - failedPct;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const activeLen = (activePct / 100) * circumference;
  const offlineLen = (offlinePct / 100) * circumference;
  const failedLen = (failedPct / 100) * circumference;

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-6">
      <div className="relative shrink-0">
        <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
          {/* Background ring */}
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#1A2340" strokeWidth="10" />
          {/* Active */}
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#22C55E" strokeWidth="10"
            strokeDasharray={`${activeLen} ${circumference - activeLen}`} strokeLinecap="round" />
          {/* Offline */}
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#F59E0B" strokeWidth="10"
            strokeDasharray={`${offlineLen} ${circumference - offlineLen}`}
            strokeDashoffset={`-${activeLen}`} strokeLinecap="round" />
          {/* Failed */}
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#EF4444" strokeWidth="10"
            strokeDasharray={`${failedLen} ${circumference - failedLen}`}
            strokeDashoffset={`-${activeLen + offlineLen}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</span>
          <span className="text-[10px] text-[#555B70]">Channels</span>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">Active</span>
              <span className="text-xs text-green-400 font-bold">{stats.active.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-[#1A2340] rounded-full mt-1">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${activePct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">Offline</span>
              <span className="text-xs text-yellow-400 font-bold">{stats.offline.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-[#1A2340] rounded-full mt-1">
              <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${offlinePct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white font-medium">Failed</span>
              <span className="text-xs text-red-400 font-bold">{stats.failed.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-[#1A2340] rounded-full mt-1">
              <div className="h-full bg-red-500 rounded-full transition-all" style={{ width: `${failedPct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Failed Channels Table ──────────────────────────── */

function OverrideBadge({ value }: { value: HealthOverride }) {
  if (value === "FORCE_HEALTHY") return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-400 border border-green-500/25">
      <Shield size={9} /> Forced Healthy
    </span>
  );
  if (value === "FORCE_OFFLINE") return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/25">
      <Shield size={9} /> Forced Offline
    </span>
  );
  return null;
}

function FailedChannelsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useApiQuery<FailedChannelsResponse>(
    ["failed-channels", page, search],
    `/v1/m3u-import/health-check/failed-channels?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    { enabled: true, refetchInterval: 8000 },
  );

  const { call: recheckCall, loading: rechecking } = useApiCallState();
  const { call: overrideCall } = useApiCallState();
  const invalidate = useInvalidate();

  const recheckSingle = async (channelId: string) => {
    try {
      await recheckCall("post", `/v1/m3u-import/health-check/recheck/${channelId}`);
      invalidate(["failed-channels"]);
      setTimeout(() => refetch(), 5000);
    } catch (e) {
      // D-049 fix: surface the failure instead of swallowing it silently.
      toast.error(getApiErrorMessage(e) || "Failed to recheck channel");
    }
  };

  const setOverride = async (channelId: string, override: HealthOverride) => {
    try {
      await overrideCall("put", `/v1/channels/${channelId}/health-override`, { override });
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to set health override");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-red-400" />
          <h3 className="text-sm font-semibold text-white">Failed & Offline Channels</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555B70]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search channels..."
              className="bg-[#0D1321] border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-[#555B70] focus:outline-none focus:border-primary w-48"
            />
          </div>
          <button onClick={() => refetch()} className="p-1.5 text-[#8B92A5] hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={20} className="text-primary animate-spin" /></div>
      ) : !data || data.data.length === 0 ? (
        <div className="text-center py-10">
          <WifiOff size={32} className="text-[#2A3450] mx-auto mb-2" />
          <p className="text-xs text-[#555B70]">No failed or offline channels</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">Channel</th>
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">Stream URL</th>
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">Server Status</th>
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">User Reports (24h)</th>
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">Override</th>
                  <th className="text-left py-2.5 px-3 text-[#555B70] font-medium">Last Checked</th>
                  <th className="text-right py-2.5 px-3 text-[#555B70] font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.data.map((ch) => (
                  <tr key={ch.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-3 text-white font-medium">
                      <div>{ch.name}</div>
                      <OverrideBadge value={ch.healthOverride} />
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[#555B70] truncate block max-w-[200px]" title={ch.primaryStreamUrl ?? ""}>
                        {ch.primaryStreamUrl}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                        ch.streamStatus === "offline"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      )}>
                        {ch.streamStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {!ch.userPlayback || ch.userPlayback.total === 0 ? (
                        <span className="text-[#555B70] text-[10px]">No data</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium border",
                            ch.userPlayback.health === "healthy"
                              ? "bg-green-500/15 text-green-400 border-green-500/25"
                              : ch.userPlayback.health === "unstable"
                              ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/25"
                              : "bg-red-500/15 text-red-400 border-red-500/25"
                          )}>
                            {ch.userPlayback.successRate}%
                          </span>
                          <span className="text-[#555B70] text-[10px]">{ch.userPlayback.total} reports</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={ch.healthOverride ?? "AUTO"}
                        onChange={e => setOverride(ch.id, e.target.value as HealthOverride)}
                        className="bg-[#0D1321] border border-border rounded px-2 py-1 text-xs text-white outline-none cursor-pointer focus:border-primary"
                      >
                        <option value="AUTO">Auto</option>
                        <option value="FORCE_HEALTHY">Force Healthy</option>
                        <option value="FORCE_OFFLINE">Force Offline</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-[#8B92A5]">
                      {new Date(ch.updatedAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => recheckSingle(ch.id)}
                        disabled={rechecking}
                        className="flex items-center gap-1 ml-auto px-2.5 py-1 text-[11px] text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20"
                      >
                        <RefreshCw size={11} className={rechecking ? "animate-spin" : ""} />
                        Recheck
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <span className="text-[11px] text-[#555B70]">
                Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={!data.meta.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-[#8B92A5]"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(data.meta.totalPages, 5) }, (_, i) => {
                  const p = Math.max(1, Math.min(data.meta.page - 2, data.meta.totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs transition-colors",
                        p === data.meta.page ? "gradient-primary text-white" : "text-[#8B92A5] hover:bg-white/5"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  disabled={!data.meta.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-[#8B92A5]"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ACTIVE_STATUSES = ["pending", "parsing", "validating", "completing"];

/* ─── Import History Mini ────────────────────────────── */

function ImportHistoryMini() {
  const { data: history, isLoading } = useApiQuery<ImportHistoryItem[]>(
    ["import-history"],
    "/v1/m3u-import/import-history",
    {
      refetchInterval: (query) => {
        const data = query.state.data as ImportHistoryItem[] | undefined;
        if (Array.isArray(data) && data.some((j) => ACTIVE_STATUSES.includes(j.status))) return 3000;
        return 15_000;
      },
    },
  );

  if (isLoading) return <div className="bg-card border border-border rounded-xl p-5"><Loader2 size={18} className="text-primary animate-spin mx-auto" /></div>;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-white">Recent Imports</h3>
      </div>
      {(!history || history.length === 0) ? (
        <p className="text-xs text-[#555B70] text-center py-4">No import history yet</p>
      ) : (
        <div className="space-y-2">
          {history.slice(0, 8).map((job) => {
            const successRate = job.totalChannels > 0 ? Math.round((job.activeChannels / job.totalChannels) * 100) : 0;
            return (
              <div key={job.id} className="flex items-center gap-3 p-2.5 bg-[#0D1321] rounded-lg border border-border/50">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  job.status === "completed" ? "bg-green-500/10" : job.status === "failed" ? "bg-red-500/10" : "bg-blue-500/10"
                )}>
                  {job.status === "completed" ? <Wifi size={14} className="text-green-400" /> :
                   job.status === "failed" ? <AlertTriangle size={14} className="text-red-400" /> :
                   <Loader2 size={14} className="text-blue-400 animate-spin" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{job.filename}</p>
                  <p className="text-[10px] text-[#555B70]">
                    {job.activeChannels}/{job.totalChannels} active · {new Date(job.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-sm font-bold", successRate >= 80 ? "text-green-400" : successRate >= 50 ? "text-yellow-400" : "text-red-400")}>
                    {successRate}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function ChannelHealthPage() {
  const { data: stats, isLoading, refetch } = useApiQuery<HealthStats>(
    ["channel-health-stats"],
    "/v1/m3u-import/health-check/stats",
    {
      refetchInterval: (query) => {
        const d = query.state.data as HealthStats | undefined;
        return (d && d.checking > 0) ? 3000 : 5000;
      },
    },
  );

  const { call, loading: actionLoading } = useApiCallState();
  const invalidate = useInvalidate();

  const recheckAll = async (offlineOnly: boolean) => {
    try {
      await call("post", "/v1/m3u-import/health-check/recheck-all", { offlineOnly });
      invalidate(["channel-health-stats"]);
      setTimeout(() => refetch(), 3000);
    } catch (e) {
      // D-049 fix: surface the failure instead of swallowing it silently.
      toast.error(getApiErrorMessage(e) || "Failed to trigger recheck");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">Channel Health Monitor</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] text-green-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <p className="text-xs text-[#8B92A5]">
              Monitor stream health · Auto-checks every 6 hours
              {stats?.lastScanTime && (
                <> · Last scan: {new Date(stats.lastScanTime).toLocaleString()}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => recheckAll(true)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <WifiOff size={13} />}
            Recheck Offline
          </button>
          <button
            onClick={() => recheckAll(false)}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white gradient-primary rounded-lg transition-opacity disabled:opacity-50"
          >
            {actionLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Recheck All
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="text-primary animate-spin" /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Radio} label="Total" value={stats.total} color="text-white" bgColor="bg-white/5" />
            <StatCard icon={Wifi} label="Active" value={stats.active} color="text-green-400" bgColor="bg-green-500/10" />
            <StatCard icon={WifiOff} label="Offline" value={stats.offline} color="text-yellow-400" bgColor="bg-yellow-500/10" />
            <StatCard icon={AlertTriangle} label="Failed" value={stats.failed} color="text-red-400" bgColor="bg-red-500/10" />
            <StatCard icon={Zap} label="Checking" value={stats.checking} color="text-blue-400" bgColor="bg-blue-500/10" />
            <StatCard
              icon={Clock}
              label="Last Scan"
              value={stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Never"}
              color="text-[#8B92A5]"
              bgColor="bg-[#1A2340]"
              sub={stats.lastScanTime ? new Date(stats.lastScanTime).toLocaleDateString() : undefined}
            />
          </div>

          {/* Health ring */}
          <HealthRing stats={stats} />

          {/* Bottom section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <FailedChannelsTable />
            </div>
            <div>
              <ImportHistoryMini />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}