"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight,
  Menu, RefreshCw, Upload, Download, CheckSquare, Square, XSquare, Settings2, GitMerge, AlertTriangle,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { apiClient } from "@/lib/axios-client";
import { ImageUpload } from "@/components/ui/image-upload";
import BulkImportModal from "@/components/channels/bulk-import-modal";
import { ChannelDetailModal } from "@/components/channels/channel-detail-modal";
import { MergeDuplicatesModal } from "@/components/channels/merge-duplicates-modal";

interface Channel {
  id: string;
  name: string;
  logo?: string | null;
  streamType: string;
  primaryStreamUrl: string;
  epgChannelId?: string | null;
  isActive: boolean;
  category?: { name: string } | null;
}

interface ChannelsResponse {
  data: Channel[];
  meta: { total: number; totalPages: number; page: number };
}

interface Category { id: string; name: string }
interface CategoriesResponse { data: Category[] }

const gradColors = [
  "gradient-primary","gradient-blue","gradient-green",
  "gradient-orange","gradient-pink","gradient-primary",
  "gradient-blue","gradient-green","gradient-orange","gradient-pink",
];

export default function Channels() {
  const [search, setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]           = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const [showModal,  setModal]   = useState(false);
  const [showImport, setImport]  = useState(false);
  const [showExport, setExport]  = useState(false);
  const [submitting, setSub]     = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editItem,   setEditItem]   = useState<Channel | null>(null);
  const [manageId,   setManageId]   = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [fixingQuality, setFixingQuality] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const [newLogo,  setNewLogo]  = useState("");
  const [editLogo, setEditLogo] = useState("");

  const nameRef      = useRef<HTMLInputElement>(null);
  const categoryRef  = useRef<HTMLSelectElement>(null);
  const streamRef    = useRef<HTMLSelectElement>(null);
  const urlRef       = useRef<HTMLInputElement>(null);
  const tvgRef       = useRef<HTMLInputElement>(null);
  const editNameRef  = useRef<HTMLInputElement>(null);
  const editUrlRef   = useRef<HTMLInputElement>(null);
  const editStreamRef = useRef<HTMLSelectElement>(null);
  const editTvgRef   = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams({ page: String(page), limit: "100" });
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading: loading, error, refetch } = useApi<ChannelsResponse>(`/v1/channels?${params}`);
  const { data: catData } = useApi<CategoriesResponse>("/v1/categories?limit=200");
  const { call, loading: actionLoading } = useApiCallState();

  const channels   = data?.data ?? [];
  const categories = catData?.data ?? [];
  const meta       = data?.meta;
  const total      = meta?.total ?? 0;
  const pages      = meta?.totalPages ?? 1;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this channel?")) return;
    try {
      await call("delete", `/v1/channels/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete channel";
      alert(typeof msg === "string" ? msg : "Failed to delete channel");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === channels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(channels.map(c => c.id)));
    }
  };


  const handleDeleteAll = async () => {
    const answer = prompt(
      '⚠️ সব চ্যানেল ও সার্ভার একবারে মুছে যাবে!\n\nনিশ্চিত করতে নিচে  DELETE ALL  টাইপ করুন:'
    );
    if (answer?.trim() !== 'DELETE ALL') {
      if (answer !== null) alert('বাতিল — সঠিক টেক্সট লেখা হয়নি।');
      return;
    }
    setDeletingAll(true);
    try {
      const res = await apiClient.delete<{ deletedChannels: number; deletedServers: number }>('/v1/channels/delete-all');
      const d = res.data;
      alert(`✅ সব মুছে গেছে!\nChannels: ${d?.deletedChannels ?? 0}\nServers: ${d?.deletedServers ?? 0}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Delete failed';
      alert('❌ ' + (typeof msg === 'string' ? msg : 'Delete failed'));
    } finally {
      setDeletingAll(false);
    }
  };

  const handleCleanupBadNames = async () => {
    if (!confirm("এটি image URL-এর মতো ভুল নামের চ্যানেলগুলো ডিলিট করবে। GitHub re-sync করলে সঠিক নামে ফিরে আসবে। চালিয়ে যাবেন?")) return;
    setCleaning(true);
    try {
      const res = await apiClient.post<any>("/v1/channels/cleanup-bad-names");
      const result = res.data?.data ?? res.data;
      alert(`Cleaned: ${result?.deleted ?? 0} channels deleted, ${result?.preserved ?? 0} preserved`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Cleanup failed";
      alert(typeof msg === "string" ? msg : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  const handleFixQualityNames = async () => {
    if (!confirm(
      "এটি সব চ্যানেলের নাম থেকে (HD), (720p), (1080p), (4K), (1), (2), (a), (b) ইত্যাদি suffix সরিয়ে দেবে।\n" +
      "একই নামের চ্যানেল থাকলে merge হয়ে যাবে।\n\nচালিয়ে যাবেন?"
    )) return;
    setFixingQuality(true);
    try {
      const res = await apiClient.post<any>("/v1/channels/fix-quality-names");
      const result = res.data?.data ?? res.data;
      const examples = (result?.examples ?? []).slice(0, 5).join("\n");
      alert(
        `✅ Done!\nRenamed: ${result?.renamed ?? 0}\nMerged: ${result?.merged ?? 0}\nUnchanged: ${result?.unchanged ?? 0}` +
        (examples ? `\n\nExamples:\n${examples}` : "")
      );
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Fix failed";
      alert(typeof msg === "string" ? msg : "Fix failed");
    } finally {
      setFixingQuality(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected channel(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    // D-010 fix: process in chunks of 5 so we don't fan out hundreds of
    // simultaneous DELETEs and overload the API or trip rate limits.
    const ids = [...selectedIds];
    const failed: string[] = [];
    try {
      while (ids.length > 0) {
        const chunk = ids.splice(0, 5);
        await Promise.all(chunk.map(async (id) => {
          try { await apiClient.delete(`/v1/channels/${id}`); }
          catch { failed.push(id); }
        }));
      }
      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} channel(s). They may have already been removed.`);
      }
      setSelectedIds(new Set());
      refetch();
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    const url  = editUrlRef.current?.value?.trim();
    if (!name || !url) return;
    setSub(true);
    try {
      await call("put", `/v1/channels/${editItem.id}`, {
        name,
        streamType: editStreamRef.current?.value || editItem.streamType,
        primaryStreamUrl: url,
        epgChannelId: editTvgRef.current?.value || undefined,
        logo: editLogo || undefined,
      });
      setEditItem(null);
      setEditLogo("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update channel";
      alert(typeof msg === "string" ? msg : "Failed to update channel");
    } finally {
      setSub(false);
    }
  };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    const url  = urlRef.current?.value?.trim();
    if (!name || !url) return;
    setSub(true);
    setMutationError(null);
    try {
      // D-033 fix: don't generate a slug client-side — the server derives it
      // from the name and guarantees uniqueness. Sending our own slug can
      // cause collisions and bypass server validation.
      await call("post", "/v1/channels", {
        name,
        logo: newLogo || undefined,
        categoryId: categoryRef.current?.value || undefined,
        streamType: streamRef.current?.value || "HLS",
        primaryStreamUrl: url,
        epgChannelId: tvgRef.current?.value || undefined,
      });
      setModal(false);
      setNewLogo("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save channel";
      setMutationError(typeof msg === "string" ? msg : "Failed to save channel");
    } finally {
      setSub(false);
    }
  };

  const handleExport = async (fmt: "json" | "csv" | "m3u") => {
    setExport(false);
    try {
      const res = await apiClient.get(`/v1/channels/export?format=${fmt}`, { responseType: "blob" });
      const blob = new Blob([res.data as BlobPart]);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `channels.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Channels</h1>
          {total > 0 && (
            <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total.toLocaleString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>

          <div className="relative">
            <button onClick={() => setExport(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">
              <Download size={12} /> Export <ChevronDown size={10} />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-2xl z-20 min-w-[130px] overflow-hidden">
                {(["json","csv","m3u"] as const).map(f => (
                  <button key={f} onClick={() => handleExport(f)}
                    className="w-full px-4 py-2.5 text-xs text-left text-[#8B92A5] hover:bg-white/5 hover:text-white">
                    Export as .{f.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowMergeModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold hover:bg-orange-500/20"
            title="Preview and selectively merge duplicate channels"
          >
            <GitMerge size={13} />
            Merge Duplicates
          </button>
          <button
            onClick={handleCleanupBadNames}
            disabled={cleaning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50"
            title="Remove channels with image-URL names (broken M3U parse artifacts)"
          >
            <RefreshCw size={13} className={cleaning ? "animate-spin" : ""} />
            {cleaning ? "Cleaning…" : "Fix Bad Names"}
          </button>
          <button
            onClick={handleFixQualityNames}
            disabled={fixingQuality}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-semibold hover:bg-purple-500/20 disabled:opacity-50"
            title="Strip (HD), (720p), (1), (a) etc. from channel names and merge duplicates"
          >
            <Settings2 size={13} className={fixingQuality ? "animate-spin" : ""} />
            {fixingQuality ? "Fixing…" : "Fix Quality Names"}
          </button>
          <button onClick={() => setImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20">
            <Upload size={13} /> Bulk Import
          </button>
          <button onClick={() => { setModal(true); setNewLogo(""); }} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Add Live Channel
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={deletingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-700/40 bg-red-900/20 text-red-400 text-xs font-semibold hover:bg-red-900/40 disabled:opacity-50"
            title="সব চ্যানেল ও সার্ভার একবারে মুছে ফেলুন"
          >
            <AlertTriangle size={13} className={deletingAll ? "animate-pulse" : ""} />
            {deletingAll ? "Deleting…" : "Delete All Channels"}
          </button>
        </div>
      </div>

      {showExport && <div className="fixed inset-0 z-10" onClick={() => setExport(false)} />}

      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search channels…"
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 border border-primary/20 rounded-xl mb-3">
            <CheckSquare size={15} className="text-primary shrink-0" />
            <span className="text-sm text-white font-medium">{selectedIds.size} channel{selectedIds.size !== 1 ? "s" : ""} selected</span>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={12} />
              {bulkDeleting ? "Deleting…" : "Delete Selected"}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-[#8B92A5] text-xs hover:bg-white/10 transition-colors ml-auto"
            >
              <XSquare size={12} /> Deselect All
            </button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load channels</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 w-10">
                      <button onClick={toggleSelectAll} className="flex items-center justify-center text-[#8B92A5] hover:text-primary transition-colors">
                        {channels.length > 0 && selectedIds.size === channels.length
                          ? <CheckSquare size={15} className="text-primary" />
                          : <Square size={15} />}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Channel Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Stream Type</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-sm text-[#8B92A5]">No channels found</td></tr>
                  ) : channels.map((ch, i) => (
                    <tr key={ch.id} className={cn("tbl-row border-b border-border/50 last:border-0", selectedIds.has(ch.id) && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(ch.id)} className="flex items-center justify-center text-[#8B92A5] hover:text-primary transition-colors">
                          {selectedIds.has(ch.id) ? <CheckSquare size={15} className="text-primary" /> : <Square size={15} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {ch.logo ? (
                            <img src={ch.logo} alt={ch.name} className="w-8 h-8 rounded-lg object-contain bg-black/20 border border-border/50" />
                          ) : (
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0", gradColors[i % gradColors.length])}>
                              {ch.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-white">{ch.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{ch.category?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 font-medium">{ch.streamType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                          ch.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        )}>{ch.isActive ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Manage (Detail Modal) */}
                          <button
                            onClick={() => setManageId(ch.id)}
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-primary/10 transition-colors"
                            title="Manage channel — overrides, servers, GitHub details"
                          >
                            <Settings2 size={13} className="text-primary" />
                          </button>
                          {/* Quick edit */}
                          <button
                            onClick={() => { setEditItem(ch); setEditLogo(ch.logo ?? ""); }}
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10"
                            title="Quick edit"
                          >
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(ch.id)}
                            disabled={actionLoading}
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10"
                          >
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-[#8B92A5]">Showing {channels.length} of {total.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
                    <ChevronLeft size={13} />
                  </button>
                  {(() => {
                    const getPageNumbers = (current: number, total: number) => {
                      const maxVisible = 5;
                      let start = Math.max(1, current - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > total) { end = total; start = Math.max(1, end - maxVisible + 1); }
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    };
                    return getPageNumbers(page, pages).map(pg => (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={cn("w-7 h-7 rounded-md text-xs font-medium", pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>
                        {pg}
                      </button>
                    ));
                  })()}
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

      {/* ── Channel Detail Modal (Manage) ──────────────────────────────── */}
      {manageId && (
        <ChannelDetailModal
          channelId={manageId}
          categories={categories}
          onClose={() => setManageId(null)}
          onSaved={() => refetch()}
        />
      )}

      {/* ── Quick Edit Modal ───────────────────────────────────────────── */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Quick Edit — {editItem.name}</h2>
              <button onClick={() => { setEditItem(null); setEditLogo(""); }} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Channel Name *</label>
                <input ref={editNameRef} defaultValue={editItem.name} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Stream Type</label>
                <div className="relative">
                  <select ref={editStreamRef} defaultValue={editItem.streamType} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer">
                    {["HLS","M3U","RTMP","DASH"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Stream URL *</label>
                <input ref={editUrlRef} defaultValue={editItem.primaryStreamUrl} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="https://example.com/stream.m3u8" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">TVG ID (EPG)</label>
                <input ref={editTvgRef} defaultValue={editItem.epgChannelId ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Enter TVG ID (optional)" />
              </div>
              <ImageUpload
                value={editLogo}
                onChange={setEditLogo}
                uploadPath="/v1/storage/upload/logo"
                label="Channel Logo"
                previewClass="h-20 w-full"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setEditItem(null); setEditLogo(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleUpdate} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Update Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Channel Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Add Live Channel</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Channel Name *</label>
                <input ref={nameRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Channel name" />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Category</label>
                  <div className="relative">
                    <select ref={categoryRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer">
                      <option value="">No category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Stream Type</label>
                <div className="relative">
                  <select ref={streamRef} defaultValue="HLS" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer">
                    {["HLS","M3U","RTMP","DASH"].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Stream URL *</label>
                <input ref={urlRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="https://example.com/stream.m3u8" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">TVG ID (EPG)</label>
                <input ref={tvgRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Enter TVG ID (optional)" />
              </div>
              <ImageUpload
                value={newLogo}
                onChange={setNewLogo}
                uploadPath="/v1/storage/upload/logo"
                label="Channel Logo"
                previewClass="h-20 w-full"
              />
            </div>
            {mutationError && (
              <p className="px-6 pb-2 text-xs text-red-400">{mutationError}</p>
            )}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setModal(false); setNewLogo(""); setMutationError(null); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Add Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <BulkImportModal categories={categories} onClose={() => setImport(false)} onImported={() => { setImport(false); refetch(); }} />
      )}

      {showMergeModal && (
        <MergeDuplicatesModal
          onClose={() => setShowMergeModal(false)}
          onMerged={() => refetch()}
        />
      )}
    </>
  );
}
