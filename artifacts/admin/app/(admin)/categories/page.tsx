"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, ChevronLeft, ChevronRight, Menu, RefreshCw } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  image?: string | null;
  _count?: { channels?: number; movies?: number; series?: number };
}

interface CategoriesResponse {
  data: Category[];
  meta: { total: number; totalPages: number; page: number };
}

const colors = [
  "gradient-blue","gradient-green","gradient-primary","gradient-pink",
  "gradient-orange","gradient-primary","gradient-green","gradient-blue",
  "gradient-pink","gradient-orange",
];

export default function Categories() {
  const [page, setPage]         = useState(1);
  const [showModal, setModal]   = useState(false);
  const [editItem, setEditItem] = useState<Category | null>(null);
  const [submitting, setSub]    = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [newImage, setNewImage]   = useState("");
  const [editImage, setEditImage] = useState("");

  const nameRef     = useRef<HTMLInputElement>(null);
  const iconRef     = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editIconRef = useRef<HTMLInputElement>(null);

  const { data, isLoading: loading, error, refetch } = useApi<CategoriesResponse>(`/v1/categories?page=${page}&limit=20`);
  const { call, loading: actionLoading } = useApiCallState();

  const categories = data?.data ?? [];
  const meta       = data?.meta;
  const total      = meta?.total ?? 0;
  const pages      = meta?.totalPages ?? 1;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      await call("delete", `/v1/categories/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete category";
      alert(typeof msg === "string" ? msg : "Failed to delete category");
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    if (!name) return;
    setSub(true);
    try {
      await call("put", `/v1/categories/${editItem.id}`, {
        name,
        icon: editIconRef.current?.value || undefined,
        image: editImage || undefined,
      });
      setEditItem(null);
      setEditImage("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update category";
      alert(typeof msg === "string" ? msg : "Failed to update category");
    } finally {
      setSub(false);
    }
  };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    if (!name) return;
    setSub(true);
    setMutationError(null);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("post", "/v1/categories", {
        name,
        slug,
        icon: iconRef.current?.value || undefined,
        image: newImage || undefined,
      });
      setModal(false);
      setNewImage("");
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save category";
      setMutationError(typeof msg === "string" ? msg : "Failed to save category");
    } finally {
      setSub(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Categories</h1>
          {total > 0 && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{total}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { setModal(true); setNewImage(""); }} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Add Category
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load categories</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Category Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Channels</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Movies</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Series</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-sm text-[#8B92A5]">No categories found</td></tr>
                  ) : categories.map((cat, i) => (
                    <tr key={cat.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden", colors[i % colors.length])}>
                            {cat.image
                              ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                              : <span className="text-base">{cat.icon || "📺"}</span>
                            }
                          </div>
                          <span className="text-sm font-medium text-white">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{cat._count?.channels ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{cat._count?.movies ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{cat._count?.series ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditItem(cat); setEditImage(cat.image ?? ""); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat.id)}
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
                <span className="text-xs text-[#8B92A5]">Showing {categories.length} of {total}</span>
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

      {/* Edit Category Modal */}
      {editItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Edit Category</h2>
              <button onClick={() => { setEditItem(null); setEditImage(""); }} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Category Name *</label>
                <input ref={editNameRef} defaultValue={editItem.name} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Enter category name" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Icon (emoji)</label>
                <input ref={editIconRef} defaultValue={editItem.icon ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="📺" />
              </div>
              <ImageUpload
                value={editImage}
                onChange={setEditImage}
                uploadPath="/v1/storage/upload/category"
                label="Category Image / Icon"
                previewClass="h-20 w-full"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setEditItem(null); setEditImage(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleUpdate} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Update Category"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Add Category</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Category Name *</label>
                <input ref={nameRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Enter category name" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Icon (emoji)</label>
                <input ref={iconRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="📺" />
              </div>
              <ImageUpload
                value={newImage}
                onChange={setNewImage}
                uploadPath="/v1/storage/upload/category"
                label="Category Image / Icon"
                previewClass="h-20 w-full"
              />
            </div>
            {mutationError && (
              <p className="px-6 pb-2 text-xs text-red-400">{mutationError}</p>
            )}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setModal(false); setMutationError(null); setNewImage(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : "Save Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
