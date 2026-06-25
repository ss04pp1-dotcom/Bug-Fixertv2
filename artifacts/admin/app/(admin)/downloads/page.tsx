"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Search, ChevronDown, ChevronLeft, ChevronRight,
  Menu, RefreshCw, Download, HardDrive, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";
import { useApi } from "@/lib/use-api";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface DownloadItem {
  id: string;
  userId?: string;
  userEmail?: string;
  title?: string;
  contentType?: string;
  quality?: string;
  size?: string | number;
  progress?: number;
  status?: string;
  createdAt?: string;
}

interface DownloadsResponse {
  data: DownloadItem[];
  meta: { total: number; totalPages: number; page: number };
}

interface DownloadsStatsResponse {
  totalDownloads: number;
  completed: number;
  inProgress: number;
  failed: number;
  storageUsed: string;
}

/* ─── Status helpers ──────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  completed: { color: "bg-green-500/15 text-green-400", icon: CheckCircle2 },
  in_progress: { color: "bg-blue-500/15 text-blue-400", icon: Loader2 },
  downloading: { color: "bg-blue-500/15 text-blue-400", icon: Loader2 },
  pending: { color: "bg-yellow-500/15 text-yellow-400", icon: Loader2 },
  failed: { color: "bg-red-500/15 text-red-400", icon: AlertCircle },
  cancelled: { color: "bg-gray-500/15 text-gray-400", icon: AlertCircle },
};

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function Downloads() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterContentType, setFilterContentType] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Note: Per-user download data is available at GET /v1/downloads (requires user context).
  // For admin overview, a dedicated admin endpoint (e.g., /v1/downloads/admin) would be needed.
  // This page is structured to consume a paginated admin downloads endpoint.
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filterStatus) params.set("status", filterStatus);
  if (filterContentType) params.set("contentType", filterContentType);

  const { data, isLoading: loading, error, refetch } = useApi<DownloadsResponse>(`/v1/downloads/admin?${params}`);
  const { data: statsData } = useApi<DownloadsStatsResponse>("/v1/downloads/admin/stats");

  const downloads = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const stats = statsData ?? {
    totalDownloads: 0,
    completed: 0,
    inProgress: 0,
    failed: 0,
    storageUsed: "0 B",
  };

  const formatSize = (size?: string | number): string => {
    if (!size) return "—";
    if (typeof size === "string") return size;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderProgress = (progress?: number, status?: string) => {
    const p = progress ?? 0;
    const isComplete = status === "completed";
    const isFailed = status === "failed";
    const barColor = isComplete
      ? "bg-green-500"
      : isFailed
        ? "bg-red-500"
        : "bg-blue-500";

    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.min(100, Math.max(0, p))}%` }}
          />
        </div>
        <span className="text-xs text-[#8B92A5] w-9 text-right">{Math.round(p)}%</span>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Downloads</h1>
          {total > 0 && (
            <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total.toLocaleString()}</span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-5">
          {[
            { label: "Total Downloads", value: stats.totalDownloads.toLocaleString(), icon: Download, gradient: "gradient-primary" },
            { label: "Completed", value: stats.completed.toLocaleString(), icon: CheckCircle2, color: "text-green-400" },
            { label: "In Progress", value: stats.inProgress.toLocaleString(), icon: Loader2, color: "text-blue-400" },
            { label: "Failed", value: stats.failed.toLocaleString(), icon: AlertCircle, color: "text-red-400" },
            { label: "Storage Used", value: stats.storageUsed, icon: HardDrive, color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#8B92A5]">{s.label}</p>
                <s.icon size={14} className={s.color ?? "text-primary"} />
              </div>
              <p className={cn("text-xl font-bold", s.gradient ? "bg-clip-text text-transparent " + s.gradient : s.color ?? "text-white")}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search downloads..."
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
          <div className="relative">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="downloading">Downloading</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterContentType}
              onChange={e => { setFilterContentType(e.target.value); setPage(1); }}
              className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
            >
              <option value="">All Content Types</option>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
              <option value="episode">Episode</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load downloads</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">User Email</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Title</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Content Type</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Quality</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Size</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Progress</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Downloaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downloads.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-sm text-[#8B92A5]">No downloads found</td></tr>
                    ) : downloads.map((d, i) => {
                      const statusCfg = STATUS_CONFIG[d.status ?? ""] ?? STATUS_CONFIG.pending;
                      const StatusIcon = statusCfg.icon;
                      return (
                        <tr key={d.id} className="tbl-row border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                          <td className="px-4 py-3 text-sm text-white">{d.userEmail ?? d.userId ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-white max-w-[180px] truncate">{d.title ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-[#8B92A5] font-medium capitalize">
                              {d.contentType ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{d.quality ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{formatSize(d.size)}</td>
                          <td className="px-4 py-3">{renderProgress(d.progress, d.status)}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                              statusCfg.color
                            )}>
                              <StatusIcon size={11} className={d.status === "in_progress" || d.status === "downloading" || d.status === "pending" ? "animate-spin" : ""} />
                              {d.status?.replace(/_/g, " ") ?? "unknown"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">
                            {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-[#8B92A5]">Showing {downloads.length} of {total.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  {(() => {
                    const getPageNumbers = (current: number, totalPages: number) => {
                      const maxVisible = 5;
                      let start = Math.max(1, current - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > totalPages) { end = totalPages; start = Math.max(1, end - maxVisible + 1); }
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    };
                    return getPageNumbers(page, pages).map(pg => (
                      <button
                        key={pg}
                        onClick={() => setPage(() => pg)}
                        className={cn(
                          "w-7 h-7 rounded-md text-xs font-medium",
                          pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5"
                        )}
                      >
                        {pg}
                      </button>
                    ));
                  })()}
                  <button
                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                    disabled={page >= pages}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}