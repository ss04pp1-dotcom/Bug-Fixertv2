"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight, Menu, RefreshCw, Upload, Download, CheckSquare, Square, XSquare } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { apiClient } from "@/lib/axios-client";
import { ImageUpload } from "@/components/ui/image-upload";
import BulkImportModal from "@/components/channels/bulk-import-modal";

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
  const [page, setPage]         = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const [showModal, setModal] = useState(false);
  const [showImport, setImport] = useState(false);
  const [showExport, setExport] = useState(false);
  const [submitting, setSub]  = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Channel | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [newLogo, setNewLogo]  = useState("");
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

  const params = new URLSearchParams({ page: String(page), limit: "20" });
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected channel(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => apiClient.delete(`/v1/channels/${id}`)));
      setSelectedIds(new Set());
      refetch();
    } catch {
      alert("Some channels could not be deleted. Please try again.");
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
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("post", "/v1/channels", {
        name,
        slug,
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

          {/* Export dropdown */}
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

          <button onClick={() => setImport(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20">
            <Upload size={13} /> Bulk Import
          </button>
          <button onClick={() => { setModal(true); setNewLogo(""); }} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Add Live Channel
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

        {/* Bulk Action Bar */}
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

        <div className="bg-card border border-border rounded-xl overflow-hidden">
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
                          <button onClick={() => { setEditItem(ch); setEditLogo(ch.logo ?? ""); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
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

      {/* Edit Channel Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Edit Channel</h2>
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

      {/* Add Channel Modal */}
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
              <button onClick={() => { setModal(false); setMutationError(null); setNewLogo(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Save Channel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImport && (
        <BulkImportModal
          categories={categories}
          onClose={() => setImport(false)}
          onImported={() => { refetch(); }}
        />
      )}
    </>
  );
}
