"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Plus, Search, Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight, Film, Menu, RefreshCw } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Movie {
  id: string;
  title: string;
  duration?: number | null;
  status: string;
  category?: { name: string } | null;
  year?: number | null;
  streamUrl?: string | null;
  poster?: string | null;
  banner?: string | null;
}

interface MoviesResponse {
  data: Movie[];
  meta: { total: number; totalPages: number; page: number };
}

const gradients = [
  "gradient-primary","gradient-blue","gradient-green",
  "gradient-orange","gradient-pink","gradient-primary",
];

function fmtDuration(mins?: number | null) {
  if (!mins) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Movies() {
  const [search, setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]         = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const [showModal, setModal] = useState(false);
  const [submitting, setSub]  = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Movie | null>(null);

  const [newPoster, setNewPoster]       = useState("");
  const [newBanner, setNewBanner]       = useState("");
  const [editPoster, setEditPoster]     = useState("");
  const [editBanner, setEditBanner]     = useState("");
  const [newCategoryId, setNewCategoryId]   = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  const titleRef    = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const yearRef     = useRef<HTMLInputElement>(null);
  const videoRef    = useRef<HTMLInputElement>(null);
  const eTitleRef   = useRef<HTMLInputElement>(null);
  const eDurRef     = useRef<HTMLInputElement>(null);
  const eYearRef    = useRef<HTMLInputElement>(null);
  const eVideoRef   = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data, isLoading: loading, error, refetch } = useApi<MoviesResponse>(`/v1/movies?${params}`);
  const { data: categoriesData } = useApi<{ data: { id: string; name: string }[] }>("/v1/categories?limit=200");
  const categories = categoriesData?.data ?? [];
  const { call, loading: actionLoading } = useApiCallState();

  const movies = data?.data ?? [];
  const meta   = data?.meta;
  const total  = meta?.total ?? 0;
  const pages  = meta?.totalPages ?? 1;

  const handleUpdate = async () => {
    if (!editItem) return;
    const title = eTitleRef.current?.value?.trim();
    if (!title) return;
    setSub(true);
    try {
      await call("put", `/v1/movies/${editItem.id}`, {
        title,
        duration: eDurRef.current?.value ? Number(eDurRef.current.value) : undefined,
        year: eYearRef.current?.value ? Number(eYearRef.current.value) : undefined,
        streamUrl: eVideoRef.current?.value || undefined,
        poster: editPoster || undefined,
        banner: editBanner || undefined,
        categoryId: editCategoryId || undefined,
      });
      setEditItem(null);
      setEditPoster("");
      setEditBanner("");
      setEditCategoryId("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update movie";
      alert(typeof msg === "string" ? msg : "Failed to update movie");
    } finally { setSub(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this movie?")) return;
    try {
      await call("delete", `/v1/movies/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete movie";
      alert(typeof msg === "string" ? msg : "Failed to delete movie");
    }
  };

  const handleSave = async () => {
    const title = titleRef.current?.value?.trim();
    if (!title) return;
    setSub(true);
    setMutationError(null);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("post", "/v1/movies", {
        title,
        slug,
        duration: durationRef.current?.value ? Number(durationRef.current.value) : undefined,
        year: yearRef.current?.value ? Number(yearRef.current.value) : undefined,
        streamUrl: videoRef.current?.value || undefined,
        poster: newPoster || undefined,
        banner: newBanner || undefined,
        categoryId: newCategoryId || undefined,
      });
      setModal(false);
      setNewPoster("");
      setNewBanner("");
      setNewCategoryId("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save movie";
      setMutationError(typeof msg === "string" ? msg : "Failed to save movie");
    } finally {
      setSub(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Movies</h1>
          {total > 0 && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total.toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { setModal(true); setNewPoster(""); setNewBanner(""); }} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Add Movie
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search movies…"
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load movies</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Poster</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Title</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Category</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Duration</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {movies.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No movies found</td></tr>
                  ) : movies.map((m, i) => (
                    <tr key={m.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        {m.poster ? (
                          <img src={m.poster} alt={m.title} className="w-14 h-9 rounded-lg object-cover bg-black/20" />
                        ) : (
                          <div className={cn("w-14 h-9 rounded-lg flex items-center justify-center", gradients[i % gradients.length])}>
                            <Film size={14} className="text-white/70" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">{m.title}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{m.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtDuration(m.duration)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium",
                          m.status === "published" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"
                        )}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditItem(m); setEditPoster(m.poster ?? ""); setEditBanner(m.banner ?? ""); setEditCategoryId(""); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
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
                <span className="text-xs text-[#8B92A5]">Showing {movies.length} of {total.toLocaleString()}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
                    <ChevronLeft size={13} />
                  </button>
                  {(() => {
                    const getPageNumbers = (cur: number, tot: number) => {
                      const maxVisible = 5;
                      let start = Math.max(1, cur - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > tot) { end = tot; start = Math.max(1, end - maxVisible + 1); }
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

      {/* Edit Movie Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Edit Movie</h2>
              <button onClick={() => { setEditItem(null); setEditPoster(""); setEditBanner(""); }} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Title *</label>
                <input ref={eTitleRef} defaultValue={editItem.title} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Category</label>
                <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="">— None —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Duration (min)</label>
                  <input ref={eDurRef} type="number" defaultValue={editItem.duration ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
                </div>
                <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Year</label>
                  <input ref={eYearRef} type="number" defaultValue={editItem.year ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Video URL</label>
                <input ref={eVideoRef} defaultValue={editItem.streamUrl ?? ""} placeholder="https://…/video.mp4" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <ImageUpload
                value={editPoster}
                onChange={setEditPoster}
                uploadPath="/v1/storage/upload/poster"
                label="Movie Poster"
                previewClass="h-32 w-full"
              />
              <ImageUpload
                value={editBanner}
                onChange={setEditBanner}
                uploadPath="/v1/storage/upload/banner"
                label="Movie Banner"
                previewClass="h-24 w-full"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setEditItem(null); setEditPoster(""); setEditBanner(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleUpdate} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Update Movie"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Movie Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Add Movie</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Title *</label>
                  <input ref={titleRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Movie title" />
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Category</label>
                  <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                    <option value="">— None —</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Duration (min)</label>
                  <input ref={durationRef} type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="131" />
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Release Year</label>
                  <input ref={yearRef} type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="2024" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Video URL</label>
                  <input ref={videoRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="https://…" />
                </div>
              </div>
              <ImageUpload
                value={newPoster}
                onChange={setNewPoster}
                uploadPath="/v1/storage/upload/poster"
                label="Movie Poster"
                previewClass="h-32 w-full"
              />
              <ImageUpload
                value={newBanner}
                onChange={setNewBanner}
                uploadPath="/v1/storage/upload/banner"
                label="Movie Banner"
                previewClass="h-24 w-full"
              />
            </div>
            {mutationError && (
              <p className="px-6 pb-2 text-xs text-red-400">{mutationError}</p>
            )}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setModal(false); setMutationError(null); setNewPoster(""); setNewBanner(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Save Movie"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
