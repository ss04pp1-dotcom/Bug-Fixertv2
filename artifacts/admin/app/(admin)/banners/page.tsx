"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, ImageIcon, Menu, X, RefreshCw } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Banner {
  id: string;
  title: string;
  imageUrl?: string | null;
  link?: string | null;
  position: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

interface BannersResponse {
  data: Banner[];
  meta: { total: number };
}

const POSITIONS = [
  { value: "home_hero",    label: "Home Hero" },
  { value: "movies_page",  label: "Movies Page" },
  { value: "home_banner",  label: "Home Banner" },
  { value: "kids_section", label: "Kids Section" },
  { value: "live_tv",      label: "Live TV" },
];

const positionLabel = (p: string) => POSITIONS.find(x => x.value === p)?.label ?? p;
const gradients = ["gradient-primary","gradient-blue","gradient-green","gradient-orange","gradient-pink"];
const emptyForm = { title: "", position: "home_hero", link: "", imageUrl: "", priority: 0 };

export default function Banners() {
  const { data, isLoading: loading, error, refetch } = useApi<BannersResponse>("/v1/banners?page=1&limit=50");
  const { call, loading: actionLoading } = useApiCallState();
  const [actionErr, setActionErr] = useState("");

  const [showModal, setShowModal]   = useState(false);
  const [editBanner, setEditBanner] = useState<Banner | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [imageUrl, setImageUrl]     = useState("");
  const [deleteId, setDeleteId]     = useState<string | null>(null);

  const banners = data?.data ?? [];

  const openAdd = () => {
    setEditBanner(null);
    setForm(emptyForm);
    setImageUrl("");
    setShowModal(true);
  };

  const openEdit = (b: Banner) => {
    setEditBanner(b);
    setForm({ title: b.title, position: b.position, link: b.link ?? "", imageUrl: b.imageUrl ?? "", priority: b.priority });
    setImageUrl(b.imageUrl ?? "");
    setShowModal(true);
  };

  const isValidUrl = (url: string) => {
    if (!url) return true;
    try { new URL(url); return true; } catch { return false; }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (form.link && !isValidUrl(form.link)) {
      alert("Link URL is invalid. Please enter a valid URL (e.g. https://example.com).");
      return;
    }
    if (imageUrl && !isValidUrl(imageUrl)) {
      alert("Image URL is invalid. Please enter a valid URL.");
      return;
    }
    const payload = {
      title: form.title.trim(),
      position: form.position,
      link: form.link || undefined,
      imageUrl: imageUrl || undefined,
      priority: Number(form.priority) || 0,
    };
    setActionErr("");
    try {
      if (editBanner) await call("put", `/v1/banners/${editBanner.id}`, payload);
      else             await call("post", "/v1/banners", payload);
      setShowModal(false);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to save banner"); }
  };

  const handleToggle = async (b: Banner) => {
    setActionErr("");
    try {
      await call("put", `/v1/banners/${b.id}`, { isActive: !b.isActive });
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to update banner"); }
  };

  const handleDelete = async (id: string) => {
    setActionErr("");
    try {
      await call("delete", `/v1/banners/${id}`);
      setDeleteId(null);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to delete banner"); }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Banners</h1>
          {loading && <RefreshCw size={12} className="text-[#8B92A5] animate-spin" />}
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
          <Plus size={13} /> Add Banner
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Banners", value: banners.length },
            { label: "Active",        value: banners.filter(b => b.isActive).length },
            { label: "Inactive",      value: banners.filter(b => !b.isActive).length },
          ].map((s, i) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", gradients[i])}>
                <ImageIcon size={15} className="text-white" />
              </div>
              <div className="text-lg font-bold text-white">{s.value}</div>
              <div className="text-xs text-[#8B92A5]">{s.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
            Failed to load banners. Check that the API server is running and the database is migrated.
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-white">{banners.length} Banner{banners.length !== 1 ? "s" : ""}</h3>
          </div>
          {loading && banners.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-xs text-[#8B92A5]">Loading…</div>
          ) : banners.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ImageIcon size={32} className="text-[#8B92A5]" />
              <p className="text-xs text-[#8B92A5]">No banners yet. Click &quot;Add Banner&quot; to create one.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {banners.map((b, i) => (
                <div key={b.id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className={cn("w-14 h-10 rounded-lg flex items-center justify-center shrink-0 overflow-hidden", gradients[i % gradients.length])}>
                    {b.imageUrl
                      ? <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                      : <ImageIcon size={16} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{b.title}</div>
                    <div className="text-[10px] text-[#8B92A5]">{positionLabel(b.position)}{b.link ? ` · ${b.link}` : ""} · Priority {b.priority}</div>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    b.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                  )}>
                    {b.isActive ? "Active" : "Inactive"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleToggle(b)}
                      className="text-[10px] text-[#8B92A5] hover:text-white border border-border px-2 py-1 rounded-md transition-colors">
                      {b.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => openEdit(b)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-border hover:bg-white/5 transition-colors">
                      <Edit size={12} className="text-[#8B92A5]" />
                    </button>
                    <button onClick={() => setDeleteId(b.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e1324] border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{editBanner ? "Edit Banner" : "New Banner"}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#8B92A5] hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[#8B92A5] mb-1.5">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Summer Sports Live"
                  className="w-full bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-[#8B92A5] focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="block text-[10px] text-[#8B92A5] mb-1.5">Position</label>
                <select value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  className="w-full bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50">
                  {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                uploadPath="/v1/storage/upload/banner"
                label="Banner Image"
                previewClass="h-28 w-full"
              />
              <div>
                <label className="block text-[10px] text-[#8B92A5] mb-1.5">Link URL</label>
                <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                  placeholder="/movies or https://..."
                  className="w-full bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs text-white placeholder-[#8B92A5] focus:outline-none focus:border-primary/50" />
              </div>
              <div>
                <label className="block text-[10px] text-[#8B92A5] mb-1.5">Priority (higher = shown first)</label>
                <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
                  min={0}
                  className="w-full bg-[#1a2235] border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary/50" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={actionLoading || !form.title.trim()}
                className="flex-1 py-2 rounded-lg gradient-primary text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                {actionLoading ? "Saving…" : editBanner ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#0e1324] border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h2 className="text-sm font-bold text-white">Delete Banner?</h2>
            <p className="text-xs text-[#8B92A5]">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteId!)} disabled={actionLoading}
                className="flex-1 py-2 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                {actionLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
