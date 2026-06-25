"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, Download, Shield, Menu, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useApi } from "@/lib/use-api";

interface AuditLog {
  id: string;
  userId?: string;
  user?: { email?: string; name?: string };
  action: string;
  resource?: string;
  level: string;
  ipAddress?: string;
  createdAt: string;
}

interface AuditLogsResponse {
  data: AuditLog[];
  meta: { total: number; totalPages: number; page: number };
}

const levelStyles: Record<string, string> = {
  info:     "bg-blue-500/15 text-blue-400",
  warning:  "bg-yellow-500/15 text-yellow-400",
  critical: "bg-red-500/15 text-red-400",
  error:    "bg-red-500/15 text-red-400",
};

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [level, setLevel]   = useState("all");
  const [page, setPage]     = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (level !== "all") params.set("level", level);
  if (search) params.set("search", search);

  const { data, isLoading: loading, error, refetch } = useApi<AuditLogsResponse>(`/v1/audit?${params}`);

  const logs   = data?.data ?? [];
  const meta   = data?.meta;
  const total  = meta?.total ?? 0;
  const pages  = meta?.totalPages ?? 1;

  const infoCount     = logs.filter(l => l.level === "info").length;
  const warningCount  = logs.filter(l => l.level === "warning").length;
  const criticalCount = logs.filter(l => l.level === "critical" || l.level === "error").length;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Audit Logs</h1>
          {total > 0 && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total.toLocaleString()} total</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => {
              if (!logs.length) return;
              const header = "Date,Level,Action,Resource,User,IP";
              const rows = logs.map(l =>
                [
                  new Date(l.createdAt).toISOString(),
                  l.level,
                  `"${(l.action ?? '').replace(/"/g, '""')}"`,
                  `"${(l.resource ?? '').replace(/"/g, '""')}"`,
                  `"${(l.user?.email ?? l.userId ?? '').replace(/"/g, '""')}"`,
                  l.ipAddress ?? '',
                ].join(',')
              );
              const csv = [header, ...rows].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `audit-logs-${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5"
          >
            <Download size={13} /> Export Logs
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Info Events",     value: infoCount,     color: "bg-blue-500/15 text-blue-400"     },
            { label: "Warning Events",  value: warningCount,  color: "bg-yellow-500/15 text-yellow-400" },
            { label: "Critical Events", value: criticalCount, color: "bg-red-500/15 text-red-400"       },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
                <Shield size={16} />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-[#8B92A5]">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by user, action, or resource…"
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
          <div className="relative">
            <select
              value={level}
              onChange={e => { setLevel(e.target.value); setPage(1); }}
              className="appearance-none bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-[#8B92A5] outline-none cursor-pointer pr-8"
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load audit logs</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    {["#","User","Action","Resource","Level","IP Address","Time"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No audit logs found</td></tr>
                  ) : logs.map((l, i) => (
                    <tr key={l.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3 text-xs text-white">{l.user?.email ?? l.user?.name ?? l.userId ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-medium text-white">{l.action}</td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] max-w-[150px] truncate">{l.resource ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", levelStyles[l.level] ?? "bg-gray-500/15 text-gray-400")}>
                          {l.level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-[#8B92A5]">{l.ipAddress ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-[#8B92A5]">Showing {logs.length} of {total.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
                    <ChevronLeft size={13} />
                  </button>
                  {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                    const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={cn("w-7 h-7 rounded-md text-xs font-medium", pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
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
