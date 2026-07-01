"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Send, Bell, Menu, RefreshCw } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

interface Notification {
  id: string;
  title: string;
  body: string;
  targetAll?: boolean;
  scheduledAt?: string | null;
  sentAt?: string | null;
  isActive: boolean;
  createdAt: string;
}

function notifStatus(n: Notification): string {
  if (n.sentAt) return "sent";
  if (n.scheduledAt) return "scheduled";
  return "draft";
}

interface NotifsResponse {
  data: Notification[];
  meta: { total: number };
}

const statusStyle: Record<string, string> = {
  sent:      "bg-green-500/15 text-green-400",
  draft:     "bg-yellow-500/15 text-yellow-400",
  scheduled: "bg-blue-500/15 text-blue-400",
};

export default function Notifications() {
  const [showModal, setModal] = useState(false);
  const [submitting, setSub]  = useState(false);
  const [editNotif, setEditNotif] = useState<Notification | null>(null);

  const titleRef  = useRef<HTMLInputElement>(null);
  const bodyRef   = useRef<HTMLTextAreaElement>(null);
  const targetRef = useRef<HTMLSelectElement>(null);

  const { data, isLoading: loading, error, refetch } = useApi<NotifsResponse>("/v1/notifications?page=1&limit=20");
  const { call, loading: actionLoading } = useApiCallState();
  const [actionErr, setActionErr] = useState("");

  const notifications = data?.data ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notification?")) return;
    setActionErr("");
    try {
      await call("delete", `/v1/notifications/${id}`);
      refetch();
    } catch (e: any) {
      setActionErr(e?.message ?? "Failed to delete notification");
    }
  };

  const handleSend = async (id: string) => {
    setActionErr("");
    try {
      await call("post", `/v1/notifications/${id}/send`);
      refetch();
    } catch (e: any) {
      setActionErr(e?.message ?? "Failed to send notification");
    }
  };

  const openEdit = (n: Notification) => {
    // D-038 fix: previously this used setTimeout(50) to set ref.values after
    // the modal mounted. We now drive the inputs with `defaultValue` and a
    // `key` on the modal that changes per edit target, so no setTimeout needed.
    setEditNotif(n);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false);
    setEditNotif(null);
  };

  const handleSave = async () => {
    const title = titleRef.current?.value?.trim();
    const body  = bodyRef.current?.value?.trim();
    if (!title || !body) return;
    setSub(true);
    try {
      const targetVal = targetRef.current?.value || "all";
      if (editNotif) {
        await call("put", `/v1/notifications/${editNotif.id}`, { title, body, targetAll: targetVal === "all" });
      } else {
        await call("post", "/v1/notifications", { title, body, targetAll: targetVal === "all" });
      }
      closeModal();
      refetch();
    } finally {
      setSub(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => { setEditNotif(null); setModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Send Notification
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {actionErr && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {actionErr}
          </div>
        )}
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load notifications</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && notifications.length === 0 && (
          <div className="text-center py-16 text-sm text-[#8B92A5]">No notifications yet</div>
        )}
        {!loading && !error && notifications.map(n => (
          <div key={n.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-primary/30 transition-colors">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Bell size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusStyle[notifStatus(n)] ?? "bg-gray-500/15 text-gray-400")}>
                  {notifStatus(n)}
                </span>
              </div>
              <p className="text-xs text-[#8B92A5] mb-2 line-clamp-1">{n.body}</p>
              <div className="flex items-center gap-3 text-[10px] text-[#8B92A5]">
                {n.targetAll && <span>Target: <span className="text-white capitalize">All Users</span></span>}
                {n.sentAt && <span>Sent: <span className="text-white">{new Date(n.sentAt).toLocaleDateString()}</span></span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              {notifStatus(n) === "draft" && (
                <button
                  onClick={() => handleSend(n.id)}
                  disabled={actionLoading}
                  className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-primary/10"
                >
                  <Send size={12} className="text-primary" />
                </button>
              )}
              <button onClick={() => openEdit(n)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                <Edit size={13} className="text-[#8B92A5]" />
              </button>
              <button
                onClick={() => handleDelete(n.id)}
                disabled={actionLoading}
                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10"
              >
                <Trash2 size={13} className="text-red-400" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          {/* D-038 fix: `key` changes when editNotif changes, so React remounts
              the form and `defaultValue` picks up the new item — no setTimeout
              or imperative ref.value assignment needed. */}
          <div key={editNotif?.id ?? "new"} className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">{editNotif ? "Edit Notification" : "Send Notification"}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Title *</label>
                <input ref={titleRef} defaultValue={editNotif?.title ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Notification title" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Message *</label>
                <textarea ref={bodyRef} rows={3} defaultValue={editNotif?.body ?? ""} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5] resize-none" placeholder="Notification message…" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Target Audience</label>
                <select ref={targetRef} defaultValue={editNotif?.targetAll ? "all" : "premium"} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="all">All Users</option>
                  <option value="premium">Premium Users</option>
                  <option value="free">Free Users</option>
                  <option value="new">New Users</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {submitting ? (editNotif ? "Saving…" : "Sending…") : (editNotif ? "Save Changes" : "Send Now")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
