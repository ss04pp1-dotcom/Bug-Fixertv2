"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Github, Plus, RefreshCw, Trash2, Edit, ToggleLeft, ToggleRight,
  CheckCircle, XCircle, Clock, Loader2, ExternalLink, ChevronDown, ChevronUp,
  Server, Tv, AlertTriangle, Zap, Activity,
} from "lucide-react";
import { useApiQuery, useApiCallState, useInvalidate, getApiErrorMessage } from "@/lib/use-api";
import { apiClient } from "@/lib/axios-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GitHubSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncStatus: "pending" | "running" | "success" | "failed" | null;
  lastSyncMessage: string | null;
  consecutiveFailures: number;
  isSyncing: boolean;
  channelCount: number;
  serverCount: number;
  createdAt: string;
  syncLogs: SyncLog[];
  _count: { syncLogs: number };
}

interface SyncLog {
  status: string;
  added: number;
  updated: number;
  deleted: number;
  failed: number;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string;
}

const KEY = ["github-sources"];

// Auto-refresh interval for the sources table (so "Last Sync" / "Next Sync" stay current)
const REFRESH_INTERVAL_MS = 20_000; // 20 seconds

function StatusBadge({ status, isSyncing }: { status: string | null; isSyncing: boolean }) {
  if (isSyncing) return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
      <Loader2 size={10} className="animate-spin" /> Syncing
    </span>
  );
  if (!status) return <span className="text-xs text-[#8B92A5]">Never synced</span>;
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    success: { color: "bg-green-500/20 text-green-400", icon: <CheckCircle size={10} />, label: "Success" },
    failed:  { color: "bg-red-500/20 text-red-400",   icon: <XCircle size={10} />,    label: "Failed"  },
    running: { color: "bg-blue-500/20 text-blue-400", icon: <Loader2 size={10} className="animate-spin" />, label: "Running" },
    pending: { color: "bg-yellow-500/20 text-yellow-400", icon: <Clock size={10} />, label: "Pending" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", s.color)}>
      {s.icon} {s.label}
    </span>
  );
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatMs(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function GitHubSourcesPage() {
  const invalidate = useInvalidate();
  const { data: sources = [], isLoading } = useApiQuery<GitHubSource[]>(KEY, "/v1/github-sources", {
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<GitHubSource | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [lastAutoSync, setLastAutoSync] = useState<string | null>(null);

  const nameRef     = useRef<HTMLInputElement>(null);
  const urlRef      = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const autoSyncedRef = useRef<Set<string>>(new Set());

  const openAdd  = () => { setEditItem(null); setModalError(null); setShowModal(true); };
  const openEdit = (s: GitHubSource) => { setEditItem(s); setModalError(null); setShowModal(true); };

  // ── Auto-trigger sync for overdue sources ──────────────────────────────────
  // When the page loads (or after each auto-refresh), any enabled source that
  // is past its sync interval and not already syncing gets triggered automatically.
  // This acts as a client-side fallback if the server-side cron missed a tick
  // (e.g. server was sleeping on Render free tier).
  const triggerOverdue = useCallback(async (sourceList: GitHubSource[]) => {
    const now = Date.now();
    for (const source of sourceList) {
      if (!source.enabled || source.isSyncing) continue;
      if (syncingIds.has(source.id)) continue;
      if (autoSyncedRef.current.has(source.id)) continue;

      const intervalMs = (source.syncIntervalMinutes ?? 10) * 60 * 1000;
      const lastSyncMs = source.lastSyncAt ? new Date(source.lastSyncAt).getTime() : 0;
      const overdue    = now - lastSyncMs >= intervalMs;

      if (overdue) {
        autoSyncedRef.current.add(source.id);
        try {
          await apiClient.post(`/v1/github-sources/${source.id}/sync`);
          setSyncingIds(prev => new Set(prev).add(source.id));
          setLastAutoSync(`Auto-synced: ${source.name} (${new Date().toLocaleTimeString()})`);
          // Remove from syncingIds after 30s
          setTimeout(() => {
            setSyncingIds(prev => { const n = new Set(prev); n.delete(source.id); return n; });
            // Clear so it can be re-triggered on next interval check
            autoSyncedRef.current.delete(source.id);
            invalidate(KEY);
          }, 30_000);
        } catch {
          autoSyncedRef.current.delete(source.id);
        }
      }
    }
  }, [syncingIds, invalidate]);

  useEffect(() => {
    if (!sources || (sources as GitHubSource[]).length === 0) return;
    triggerOverdue(sources as GitHubSource[]);
  }, [sources, triggerOverdue]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);
    const body = {
      name: nameRef.current?.value.trim(),
      url: urlRef.current?.value.trim(),
      syncIntervalMinutes: parseInt(intervalRef.current?.value || "10"),
    };
    try {
      if (editItem) {
        await apiClient.patch(`/v1/github-sources/${editItem.id}`, body);
      } else {
        await apiClient.post("/v1/github-sources", body);
      }
      await invalidate(KEY);
      setShowModal(false);
    } catch (err: any) {
      setModalError(err?.response?.data?.message ?? "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this GitHub source and all its servers?")) return;
    try {
      await apiClient.delete(`/v1/github-sources/${id}`);
      await invalidate(KEY);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to delete GitHub source");
    }
  }

  async function handleToggle(source: GitHubSource) {
    try {
      await apiClient.patch(`/v1/github-sources/${source.id}`, { enabled: !source.enabled });
      await invalidate(KEY);
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to toggle GitHub source");
    }
  }

  async function handleSyncNow(id: string, force = false) {
    setSyncingIds(prev => new Set(prev).add(id));
    try {
      const endpoint = force ? `/v1/github-sources/${id}/force-sync` : `/v1/github-sources/${id}/sync`;
      await apiClient.post(endpoint);
      setTimeout(() => {
        invalidate(KEY);
        setSyncingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }, 2000);
    } catch (e) {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.error(getApiErrorMessage(e) || "Failed to sync GitHub source");
    }
  }

  const totalChannels = (sources as GitHubSource[]).reduce((a, s) => a + s.channelCount, 0);
  const totalServers  = (sources as GitHubSource[]).reduce((a, s) => a + s.serverCount, 0);
  const activeCount   = (sources as GitHubSource[]).filter(s => s.enabled).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Github size={24} className="text-primary" /> GitHub Sources
          </h1>
          <p className="text-sm text-[#8B92A5] mt-1">
            Auto-sync IPTV playlists from GitHub — no health checks, unlimited servers per channel
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> Add Source
        </button>
      </div>

      {/* Auto-sync / keep-alive status bar */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Auto-refresh every 20s
        </div>
        <span className="text-[#374151]">•</span>
        <div className="flex items-center gap-1.5 text-blue-400">
          <Activity size={12} />
          Overdue sources auto-triggered
        </div>
        {lastAutoSync && (
          <>
            <span className="text-[#374151]">•</span>
            <span className="text-[#8B92A5]">{lastAutoSync}</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sources", value: (sources as GitHubSource[]).length, icon: Github },
          { label: "Active Sources", value: activeCount, icon: ToggleRight },
          { label: "Total Channels", value: totalChannels, icon: Tv },
          { label: "Total Servers", value: totalServers, icon: Server },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#8B92A5] text-xs mb-1">
              <Icon size={14} /> {label}
            </div>
            <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (sources as GitHubSource[]).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#8B92A5]">
            <Github size={40} className="mb-3 opacity-30" />
            <p className="text-sm">No GitHub sources yet. Add one to start syncing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="border-b border-border bg-white/[0.02]">
              <tr>
                {["Source", "Status", "Channels", "Servers", "Last Sync", "Next Sync", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-[#8B92A5] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(sources as GitHubSource[]).map(source => {
                const isSyncing = source.isSyncing || syncingIds.has(source.id);
                const expanded  = expandedId === source.id;
                const lastLog   = source.syncLogs?.[0];
                const nextSyncMs = source.lastSyncAt
                  ? new Date(source.lastSyncAt).getTime() + source.syncIntervalMinutes * 60_000 - Date.now()
                  : 0;
                const nextSync = nextSyncMs > 0
                  ? `in ${Math.ceil(nextSyncMs / 60_000)}m`
                  : source.enabled ? "due now" : "disabled";

                return (
                  <React.Fragment key={source.id}>
                    <tr className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expanded ? null : source.id)}
                            className="text-[#8B92A5] hover:text-white"
                          >
                            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <div>
                            <div className="text-white font-medium">{source.name}</div>
                            <a
                              href={source.url} target="_blank" rel="noreferrer"
                              className="text-xs text-[#8B92A5] hover:text-primary flex items-center gap-1 mt-0.5"
                            >
                              {source.url.slice(0, 50)}{source.url.length > 50 ? "…" : ""}
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={source.lastSyncStatus} isSyncing={isSyncing} />
                        {source.consecutiveFailures > 0 && (
                          <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                            <AlertTriangle size={10} /> {source.consecutiveFailures} failures
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{source.channelCount}</td>
                      <td className="px-4 py-3 text-white font-medium">{source.serverCount}</td>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm">{formatRelative(source.lastSyncAt)}</div>
                        {lastLog && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 font-medium">+{lastLog.added}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">↻{lastLog.updated}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-medium">−{lastLog.deleted}</span>
                            {lastLog.failed > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">✕{lastLog.failed}</span>
                            )}
                            <span className="text-[10px] text-[#8B92A5]">{formatMs(lastLog.durationMs)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#8B92A5] text-xs">{nextSync}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggle(source)}
                            className={cn("transition-colors", source.enabled ? "text-green-400 hover:text-green-300" : "text-[#8B92A5] hover:text-white")}
                            title={source.enabled ? "Disable" : "Enable"}
                          >
                            {source.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          <button
                            onClick={() => handleSyncNow(source.id, false)}
                            disabled={isSyncing}
                            className="text-[#8B92A5] hover:text-white disabled:opacity-50 transition-colors"
                            title="Sync now"
                          >
                            <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                          </button>
                          <button
                            onClick={() => handleSyncNow(source.id, true)}
                            disabled={isSyncing}
                            className="text-[#8B92A5] hover:text-yellow-400 disabled:opacity-50 transition-colors"
                            title="Force sync (clears ETag cache — re-processes all channels)"
                          >
                            <Zap size={14} />
                          </button>
                          <button
                            onClick={() => openEdit(source)}
                            className="text-[#8B92A5] hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(source.id)}
                            className="text-[#8B92A5] hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded sync log row */}
                    {expanded && source.syncLogs?.length > 0 && (
                      <tr className="bg-white/[0.015]">
                        <td colSpan={7} className="px-8 py-3">
                          <p className="text-xs text-[#8B92A5] font-medium mb-2">Recent sync logs</p>
                          <div className="space-y-1.5">
                            {source.syncLogs.slice(0, 5).map((log, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                                  log.status === "success" ? "bg-green-500/20 text-green-400"
                                  : log.status === "running"  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-red-500/20 text-red-400"
                                )}>
                                  {log.status}
                                </span>
                                <span className="text-[#8B92A5] shrink-0">{formatRelative(log.startedAt)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">+{log.added} added</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">↻{log.updated} updated</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400">−{log.deleted} removed</span>
                                {log.failed > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">✕{log.failed} failed</span>
                                )}
                                <span className="text-[#8B92A5]">{formatMs(log.durationMs)}</span>
                                {log.errorMessage && (
                                  <span className="text-red-400 truncate max-w-xs">{log.errorMessage}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">
              {editItem ? "Edit GitHub Source" : "Add GitHub Source"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#8B92A5] mb-1.5">Source Name</label>
                <input
                  ref={nameRef}
                  defaultValue={editItem?.name}
                  placeholder="e.g. Toffee Playlist"
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-[#8B92A5] mb-1.5">GitHub Raw URL</label>
                <input
                  ref={urlRef}
                  defaultValue={editItem?.url}
                  placeholder="https://raw.githubusercontent.com/..."
                  required
                  type="url"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-[#8B92A5] mt-1">Supports JSON and M3U formats</p>
              </div>
              <div>
                <label className="block text-xs text-[#8B92A5] mb-1.5">
                  Sync Interval (minutes)
                </label>
                <input
                  ref={intervalRef}
                  defaultValue={editItem?.syncIntervalMinutes ?? 10}
                  type="number"
                  min={1}
                  max={1440}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                />
              </div>
              {modalError && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle size={12} /> {modalError}
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-border text-sm text-[#8B92A5] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin mx-auto" /> : editItem ? "Save Changes" : "Add Source"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
