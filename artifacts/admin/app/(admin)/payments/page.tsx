"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronLeft, ChevronRight, ChevronDown, Menu, RefreshCw, Eye } from "lucide-react";
import { useApi, useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400",
  pending:   "bg-yellow-500/15 text-yellow-400",
  failed:    "bg-red-500/15 text-red-400",
  refunded:  "bg-orange-500/15 text-orange-400",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Success", pending: "Pending", failed: "Failed", refunded: "Refunded",
};

const ALL_STATUSES = ["all", "completed", "pending", "failed", "refunded"];

interface Payment {
  id: string;
  invoiceNumber?: string | null;
  amount: number;
  currency?: string | null;
  status: string;
  gateway?: string | null;
  gatewayTxId?: string | null;
  createdAt: string;
  paidAt?: string | null;
  user?: { email?: string; name?: string } | null;
  subscription?: { plan?: { name?: string } | null } | null;
  metadata?: { planName?: string } | null;
}

interface PaymentsMeta {
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

export default function Payments() {
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [page, setPage]           = useState(1);
  const [detail, setDetail]       = useState<Payment | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data, isLoading: loading, error, refetch } = useApi<{ data: Payment[]; meta: PaymentsMeta }>(
    `/v1/payments?${params.toString()}`
  );
  const { call: mutate, loading: mutLoading } = useApiCallState();

  const filtered = data?.data ?? [];
  const meta     = data?.meta;

  const handleVerify = async (id: string) => {
    // D-024 / D-043 fix: confirm before completing a payment
    if (!confirm("Verify this payment? This will mark it as completed and grant access.")) return;
    // NOTE: useApiCallState already manages `mutLoading` internally — no manual setter needed.
    try {
      await mutate("post", `/v1/payments/${id}/verify`);
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to verify payment");
    }
  };

  const handleRefund = async (id: string) => {
    if (!confirm("Are you sure you want to refund this payment?")) return;
    try {
      await mutate("post", `/v1/payments/${id}/refund`, { reason: "Admin initiated refund" });
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to refund payment");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Payments</h1>
          {meta && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{meta.total} total</span>}
        </div>
        <button onClick={() => refetch()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by email, invoice, gateway..."
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="appearance-none bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-[#8B92A5] outline-none focus:border-primary cursor-pointer">
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s === "all" ? "All Status" : STATUS_LABELS[s] || s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
            Failed to load payments: {error.message}
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#0d1525]">
                {["Invoice","User","Plan","Amount","Gateway","Status","Date","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8B92A5]">
                  {error ? "Could not load payments." : "No payments found."}
                </td></tr>
              )}
              {!loading && filtered.map(t => (
                <tr key={t.id} className="tbl-row border-b border-border/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{t.invoiceNumber || "—"}</td>
                  <td className="px-4 py-3 text-xs text-white max-w-[140px] truncate">{t.user?.email || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">
                    {t.subscription?.plan?.name || t.metadata?.planName || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-white">
                    {t.currency || "$"}{typeof t.amount === "number" ? t.amount.toFixed(2) : t.amount}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8B92A5] capitalize">{t.gateway}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_STYLE[t.status] || "bg-white/10 text-white")}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setDetail(t)} className="text-xs text-[#8B92A5] hover:text-white"><Eye size={13} /></button>
                      {t.status === "pending" && (
                        <button onClick={() => handleVerify(t.id)} disabled={mutLoading}
                          className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">Verify</button>
                      )}
                      {t.status === "completed" && (
                        <button onClick={() => handleRefund(t.id)} disabled={mutLoading}
                          className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-50">Refund</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-[#8B92A5]">
              {meta ? `Showing ${((page-1)*20)+1}–${Math.min(page*20, meta.total)} of ${meta.total}` : `${filtered.length} entries`}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] disabled:opacity-30">
                <ChevronLeft size={13} />
              </button>
              {meta && (() => {
                const getPageNumbers = (current: number, total: number) => {
                  const maxVisible = 5;
                  let start = Math.max(1, current - Math.floor(maxVisible / 2));
                  let end = start + maxVisible - 1;
                  if (end > total) { end = total; start = Math.max(1, end - maxVisible + 1); }
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                };
                return getPageNumbers(page, meta.totalPages || 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={cn("w-7 h-7 rounded-md text-xs font-medium", page === p ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => setPage(p => p + 1)} disabled={!meta || page >= meta.totalPages}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] disabled:opacity-30">
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Payment Detail</h2>
              <button onClick={() => setDetail(null)} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                ["Invoice", detail.invoiceNumber],
                ["User", detail.user?.email],
                ["Plan", detail.subscription?.plan?.name || detail.metadata?.planName],
                ["Amount", `${detail.currency || "USD"} ${detail.amount}`],
                ["Gateway", detail.gateway],
                ["Gateway Tx ID", detail.gatewayTxId || "—"],
                ["Status", detail.status],
                ["Created", new Date(detail.createdAt).toLocaleString()],
                ["Paid At", detail.paidAt ? new Date(detail.paidAt).toLocaleString() : "—"],
              ].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-xs text-[#8B92A5]">{label}</span>
                  <span className="text-xs text-white font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setDetail(null)} className="w-full py-2.5 rounded-xl border border-border text-sm text-[#8B92A5] hover:bg-white/5">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
