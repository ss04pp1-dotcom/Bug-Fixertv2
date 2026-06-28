"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Megaphone, X, Menu, RefreshCw } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  isActive: boolean;
  targetAll?: boolean;
  createdAt: string;
}

interface AnnouncementsResponse {
  data: Announcement[];
  meta: { total: number };
}

const typeStyles: Record<string, { badge: string; icon: string }> = {
  maintenance: { badge: "bg-yellow-500/15 text-yellow-400", icon: "⚠️" },
  feature:     { badge: "bg-blue-500/15 text-blue-400",     icon: "✨" },
  promo:       { badge: "bg-purple-500/15 text-purple-400", icon: "🎉" },
  update:      { badge: "bg-green-500/15 text-green-400",   icon: "🔄" },
  welcome:     { badge: "bg-pink-500/15 text-pink-400",     icon: "👋" },
};

const statusStyle: Record<string, string> = {
  active:   "bg-green-500/15 text-green-400",
  inactive: "bg-gray-500/15 text-gray-400",
};

export default function Announcements() {
  const [showModal,  setModal]     = useState(false);
  const [editItem,   setEditItem]  = useState<Announcement | null>(null);
  const [submitting, setSub]       = useState(false);

  const titleRef   = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const typeRef    = useRef<HTMLSelectElement>(null);
  const targetRef  = useRef<HTMLSelectElement>(null);

  const { data, isLoading: loading, error, refetch } = useApi<AnnouncementsResponse>("/v1/announcements?page=1&limit=20");
  const { call, loading: actionLoading } = useApiCallState();
  const [actionErr, setActionErr] = useState("");

  const items    = data?.data ?? [];
  const active   = items.filter(a => a.isActive).length;
  const inactive = items.filter(a => !a.isActive).length;

  const openAdd = () => {
    setEditItem(null);
    setModal(true);
  };

  const openEdit = (a: Announcement) => {
    // D-038 fix: previously this used setTimeout(0) to set ref.values after
    // the modal mounted. Inputs are now driven by `defaultValue` + a `key`
    // on the modal content, so React remounts and the values populate without
    // any imperative ref assignment.
    setEditItem(a);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditItem(null);
    if (titleRef.current)   titleRef.current.value   = "";
    if (contentRef.current) contentRef.current.value = "";
    if (typeRef.current)    typeRef.current.value    = "feature";
    if (targetRef.current)  targetRef.current.value  = "all";
  };

  const handleDismiss = async (id: string) => {
    setActionErr("");
    try {
      await call("put", `/v1/announcements/${id}`, { isActive: false });
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to dismiss announcement"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement?")) return;
    setActionErr("");
    try {
      await call("delete", `/v1/announcements/${id}`);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to delete announcement"); }
  };

  const handleSave = async () => {
    const title   = titleRef.current?.value?.trim();
    const message = contentRef.current?.value?.trim();
    if (!title || !message) return;
    setSub(true);
    try {
      const targetVal = targetRef.current?.value || "all";
      const payload = {
        title,
        message,
        type: typeRef.current?.value || "feature",
        targetAll: targetVal === "all",
      };
      if (editItem) {
        await call("put", `/v1/announcements/${editItem.id}`, payload);
      } else {
        await call("post", "/v1/announcements", payload);
      }
      closeModal();
      refetch();
    } catch (e: any) {
      setActionErr(e?.message ?? "Failed to save announcement");
    } finally {
      setSub(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Announcements</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> New Announcement
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        <div className="grid grid-cols-3 gap-3 mb-2">
          {[
            { label: "Active",   value: active,   color: "text-green-400"  },
            { label: "Draft",    value: 0,        color: "text-yellow-400" },
            { label: "Inactive", value: inactive, color: "text-[#8B92A5]"  },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-[#8B92A5]">{s.label}</div>
            </div>
          ))}
        </div>

        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load announcements</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-16 text-sm text-[#8B92A5]">No announcements yet</div>
        )}
        {!loading && !error && items.map(a => {
          const ts = typeStyles[a.type] ?? { badge: "bg-gray-500/15 text-gray-400", icon: "📢" };
          return (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 text-lg">
                {ts.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-sm font-semibold text-white">{a.title}</h3>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", ts.badge)}>{a.type}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium capitalize", a.isActive ? statusStyle.active : statusStyle.inactive)}>{a.isActive ? "active" : "inactive"}</span>
                </div>
                <p className="text-xs text-[#8B92A5] mb-2 line-clamp-2">{a.message}</p>
                <div className="flex items-center gap-3 text-[10px] text-[#8B92A5]">
                  <span>Target: <span className="text-white">{a.targetAll ? "All Users" : "Specific"}</span></span>
                  <span>Created: <span className="text-white">{new Date(a.createdAt).toLocaleDateString()}</span></span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {a.isActive && (
                  <button onClick={() => handleDismiss(a.id)} disabled={actionLoading}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-50"
                    title="Deactivate">
                    <X size={13} className="text-[#8B92A5]" />
                  </button>
                )}
                <button onClick={() => openEdit(a)} disabled={actionLoading}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-50"
                  title="Edit">
                  <Edit size={13} className="text-[#8B92A5]" />
                </button>
                <button onClick={() => handleDelete(a.id)} disabled={actionLoading}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-50">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {/* D-038 fix: `key` changes when editItem changes, so React remounts
              the form and `defaultValue` picks up the new item — no setTimeout
              or imperative ref.value assignment needed. */}
          <div key={editItem?.id ?? "new"} className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Megaphone size={14} className="text-primary" />
                {editItem ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button onClick={closeModal} className="text-[#8B92A5] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Title *</label>
                <input ref={titleRef} defaultValue={editItem?.title ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Announcement title" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Content *</label>
                <textarea ref={contentRef} rows={3} defaultValue={editItem?.message ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5] resize-none" placeholder="Announcement content…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Type</label>
                  <select ref={typeRef} defaultValue={editItem?.type ?? "feature"} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                    <option value="feature">Feature</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="promo">Promo</option>
                    <option value="update">Update</option>
                    <option value="welcome">Welcome</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Target</label>
                  <select ref={targetRef} defaultValue={editItem?.targetAll ? "all" : "specific"} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                    <option value="all">All Users</option>
                    <option value="premium">Premium</option>
                    <option value="free">Free Users</option>
                    <option value="new">New Users</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? "Saving…" : editItem ? "Update" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
