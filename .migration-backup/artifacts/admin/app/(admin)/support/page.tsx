"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle, Clock, AlertCircle, Plus, X, RefreshCw, Menu, Trash2 } from "lucide-react";
import { useApi, useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { toast } from "sonner";

interface Ticket {
  id: string;
  ticketNo: string;
  userEmail: string;
  subject: string;
  description?: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface TicketStats { open: number; pending: number; resolved: number; total: number; }
interface TicketsResponse { data: Ticket[]; meta: { total: number; totalPages: number; page: number } }

const priorityStyle: Record<string, string> = {
  High:   "bg-red-500/15 text-red-400",
  Medium: "bg-yellow-500/15 text-yellow-400",
  Low:    "bg-green-500/15 text-green-400",
};
const statusStyle: Record<string, string> = {
  Open:     "bg-blue-500/15 text-blue-400",
  Pending:  "bg-yellow-500/15 text-yellow-400",
  Resolved: "bg-green-500/15 text-green-400",
  Closed:   "bg-[#8B92A5]/15 text-[#8B92A5]",
};

export default function Support() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState("Medium");

  const emailRef   = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const descRef    = useRef<HTMLTextAreaElement>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data: stats, refetch: refetchStats } = useApi<TicketStats>("/v1/support/stats");
  const { data, isLoading, refetch } = useApi<TicketsResponse>(`/v1/support?${params}`);
  const { call, loading: mutating } = useApiCallState();

  const tickets = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  const refetchAll = () => { refetch(); refetchStats(); };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const [actionErr, setActionErr] = useState("");

  const createTicket = async () => {
    const userEmail = emailRef.current?.value?.trim();
    const subject   = subjectRef.current?.value?.trim();
    if (!userEmail || !subject) return;
    if (!EMAIL_RE.test(userEmail)) {
      alert("Please enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setActionErr("");
    try {
      await call("post", "/v1/support", { userEmail, subject, description: descRef.current?.value || undefined, priority });
      setShowCreate(false);
      refetchAll();
    } catch (e) {
      setActionErr(getApiErrorMessage(e) || "Failed to create ticket");
      toast.error(getApiErrorMessage(e) || "Failed to create ticket");
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setActionErr("");
    try {
      await call("put", `/v1/support/${id}`, { status });
      refetchAll();
    } catch (e) {
      setActionErr(getApiErrorMessage(e) || "Failed to update status");
      toast.error(getApiErrorMessage(e) || "Failed to update status");
    }
  };

  const deleteTicket = async (id: string) => {
    if (!confirm("Delete this ticket?")) return;
    setActionErr("");
    try {
      await call("delete", `/v1/support/${id}`, undefined);
      refetchAll();
    } catch (e) {
      setActionErr(getApiErrorMessage(e) || "Failed to delete ticket");
      toast.error(getApiErrorMessage(e) || "Failed to delete ticket");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Support Tickets</h1>
          {stats && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{stats.total} total</span>}
        </div>
        <div className="flex items-center gap-2">
          {actionErr && <span className="text-xs text-red-400 mr-2 truncate max-w-[200px]">{actionErr}</span>}
          <button onClick={refetchAll} disabled={isLoading}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-medium">
            <Plus size={13} /> New Ticket
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5 overflow-y-auto h-[calc(100vh-57px)]">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Open",     value: stats?.open     ?? 0, icon: AlertCircle, color: "gradient-primary" },
            { label: "Pending",  value: stats?.pending  ?? 0, icon: Clock,       color: "gradient-orange"  },
            { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle, color: "gradient-green"   },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
                  <Icon size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-xs text-[#8B92A5]">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5 w-fit">
          {["all","Open","Pending","Resolved","Closed"].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-white" : "text-[#8B92A5] hover:text-white"
              )}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#0d1525]">
                {["Ticket","User","Subject","Priority","Status","Date",""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-10">
                  <RefreshCw size={16} className="text-primary animate-spin mx-auto" />
                </td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-sm text-[#8B92A5]">No tickets found</td></tr>
              ) : tickets.map(t => (
                <tr key={t.id} className="tbl-row border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 text-xs font-semibold text-primary">#{t.ticketNo}</td>
                  <td className="px-4 py-3 text-sm text-white max-w-[140px] truncate">{t.userEmail}</td>
                  <td className="px-4 py-3 text-sm text-[#8B92A5] max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", priorityStyle[t.priority] ?? "bg-white/5 text-white")}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} disabled={mutating}
                      className="text-xs rounded-full font-medium border-0 outline-none cursor-pointer bg-transparent text-blue-400">
                      {["Open","Pending","Resolved","Closed"].map(s => (
                        <option key={s} value={s} className="bg-[#141824] text-white">{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#8B92A5]">
                    {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteTicket(t.id)} disabled={mutating}
                      className="text-[#8B92A5] hover:text-red-400 transition-colors disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-40">
              Previous
            </button>
            <span className="text-xs text-[#8B92A5]">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">New Support Ticket</h3>
              <button onClick={() => setShowCreate(false)} className="text-[#8B92A5] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1 block">User Email</label>
                <input ref={emailRef} type="email" placeholder="user@example.com"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1 block">Subject</label>
                <input ref={subjectRef} placeholder="Brief description of the issue"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1 block">Description</label>
                <textarea ref={descRef} rows={3} placeholder="More details…"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5] resize-none" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1 block">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  {["Low","Medium","High"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">
                Cancel
              </button>
              <button onClick={createTicket} disabled={mutating}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-sm font-medium text-white disabled:opacity-50">
                {mutating ? "Creating…" : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
