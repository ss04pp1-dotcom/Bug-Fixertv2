"use client";

import { useState } from "react";
import { Trash2, RefreshCw, Loader2, ChevronLeft, ChevronRight, AlertCircle, Clock, Tv } from "lucide-react";
import { useApiQuery } from "@/lib/use-api";
import { apiClient } from "@/lib/axios-client";

interface DeletedChannelLog {
  id: string;
  channelName: string;
  streamUrl: string | null;
  logo: string | null;
  categoryName: string | null;
  deleteReason: string;
  deletedAt: string;
}

interface LogsResponse {
  data: DeletedChannelLog[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  inactive_7_days: { label: "7 Days Inactive", color: "text-orange-400 bg-orange-400/10" },
  duplicate_replaced_by_working: { label: "Replaced by Working", color: "text-blue-400 bg-blue-400/10" },
  manual: { label: "Manual Delete", color: "text-zinc-400 bg-zinc-400/10" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DeletedChannelsPage() {
  const [page, setPage] = useState(1);
  const [clearing, setClearing] = useState(false);

  const { data, isLoading, refetch } = useApiQuery<LogsResponse>(
    ["deleted-channel-logs", page],
    `/v1/m3u-import/deleted-channels?page=${page}&limit=50`,
  );

  const logs = data?.data ?? [];
  const meta = data?.meta;

  async function handleClear() {
    if (!confirm("All deleted channel log entries will be removed. Continue?")) return;
    setClearing(true);
    try {
      await apiClient.delete("/v1/m3u-import/deleted-channels");
      setPage(1);
      refetch();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Trash2 size={20} className="text-red-400" />
            Deleted Channels Log
          </h1>
          <p className="text-[12px] text-[#555B70] mt-0.5">
            Channels removed by auto-cleanup (7-day inactive) or duplicate resolution
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            onClick={handleClear}
            disabled={clearing || logs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Clear All Logs
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {meta && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-6">
          <div>
            <p className="text-[11px] text-[#555B70] uppercase tracking-wider font-medium">Total Deleted</p>
            <p className="text-2xl font-bold text-red-400">{meta.total.toLocaleString()}</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-[12px] text-[#555B70] space-y-0.5">
            <p>• Channels are <strong className="text-orange-400">auto-deleted</strong> when inactive for 7+ days</p>
            <p>• Offline duplicates are replaced when a <strong className="text-blue-400">working version</strong> is imported</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-muted-foreground mb-3" />
            <p className="text-foreground font-medium">No deleted channels yet</p>
            <p className="text-[12px] text-[#555B70] mt-1">Logs will appear here when channels are auto-deleted</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#555B70] uppercase tracking-wider">Channel</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#555B70] uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#555B70] uppercase tracking-wider">Reason</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#555B70] uppercase tracking-wider hidden lg:table-cell">Stream URL</th>
                  <th className="text-left px-4 py-3 text-[11px] font-medium text-[#555B70] uppercase tracking-wider">Deleted At</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const reason = REASON_LABELS[log.deleteReason] ?? { label: log.deleteReason, color: "text-zinc-400 bg-zinc-400/10" };
                  return (
                    <tr key={log.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {log.logo ? (
                            <img src={log.logo} alt="" className="w-7 h-7 rounded object-cover bg-muted flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Tv size={12} className="text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[160px]">{log.channelName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-[#555B70] text-[12px]">{log.categoryName || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${reason.color}`}>
                          {reason.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {log.streamUrl ? (
                          <span className="text-[11px] text-[#555B70] font-mono truncate block max-w-[200px]">{log.streamUrl}</span>
                        ) : (
                          <span className="text-[#555B70]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-[#555B70] flex items-center gap-1">
                          <Clock size={11} />
                          {formatDate(log.deletedAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-[12px] text-[#555B70]">
                  Page {meta.page} of {meta.totalPages} · {meta.total} total
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={meta.page <= 1}
                    className="p-1.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                    disabled={meta.page >= meta.totalPages}
                    className="p-1.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
