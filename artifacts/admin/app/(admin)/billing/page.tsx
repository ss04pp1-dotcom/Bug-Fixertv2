"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  CreditCard, DollarSign, TrendingUp, AlertCircle, RefreshCw, BarChart2,
  Settings, FileText, Shield, XCircle, Download, Eye, Edit,
  ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Percent, Webhook,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

type BillingTab = "overview" | "gateways" | "invoices" | "refunds" | "tax" | "settings" | "reports";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/15 text-green-400",
  paid:      "bg-green-500/15 text-green-400",
  pending:   "bg-yellow-500/15 text-yellow-400",
  refunded:  "bg-orange-500/15 text-orange-400",
  failed:    "bg-red-500/15 text-red-400",
  approved:  "bg-green-500/15 text-green-400",
  rejected:  "bg-red-500/15 text-red-400",
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={cn("transition-colors", on ? "text-primary" : "text-[#8B92A5]")}>
      {on ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
    </button>
  );
}

function Skeleton({ rows = 3, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          {[...Array(cols)].map((_, j) => (
            <td key={j} className="px-4 py-3"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function Billing() {
  const [tab, setTab]               = useState<BillingTab>("overview");
  const [editGateway, setEditGateway] = useState<any | null>(null);
  const [gwForm, setGwForm]         = useState<Record<string, string>>({});
  const [taxValues, setTaxValues]   = useState<Record<string, number>>({});
  const [taxEnabled, setTaxEnabled] = useState<Record<string, boolean>>({});
  const [billForm, setBillForm]     = useState<Record<string, string>>({});
  const [saved, setSaved]           = useState("");
  const [invPage, setInvPage]       = useState(1);
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);

  const { data: stats,    isLoading: statsLoading, refetch: refetchStats }      = useApi<any>("/v1/payments/stats");
  const { data: gwData,   isLoading: gwLoading,    refetch: refetchGw }         = useApi<any[]>("/v1/payments/gateways");
  const { data: payments, isLoading: pyLoading,    refetch: refetchPay }        = useApi<any>("/v1/payments?limit=50");
  const { data: taxSetting, refetch: refetchTax }                               = useApi<any>("/v1/settings/billing_tax");
  const { data: billSetting, refetch: refetchBill }                             = useApi<any>("/v1/settings/billing_config");

  const { call: mutate, loading: mutLoading } = useApiCallState();

  const gateways = gwData ?? [];
  const allPayments: any[] = payments?.data ?? [];
  const invoices  = allPayments;
  const refunds   = allPayments.filter(p => p.status === "refunded");

  useEffect(() => {
    if (taxSetting?.value) {
      const v = taxSetting.value;
      setTaxValues({ vat: v.vat ?? 15, gst: v.gst ?? 10, service: v.service ?? 2.5, processing: v.processing ?? 1.5 });
      setTaxEnabled({ vat: v.vatEnabled ?? true, gst: v.gstEnabled ?? false, service: v.serviceEnabled ?? true, processing: v.processingEnabled ?? true });
    } else {
      setTaxValues({ vat: 15, gst: 10, service: 2.5, processing: 1.5 });
      setTaxEnabled({ vat: true, gst: false, service: true, processing: true });
    }
  }, [taxSetting]);

  useEffect(() => {
    if (billSetting?.value) {
      setBillForm(billSetting.value);
    } else {
      setBillForm({ invoicePrefix: "INV", companyName: "SOL TV", companyEmail: "billing@soltv.com", autoInvoice: "true", emailInvoice: "true", emailReceipt: "true" });
    }
  }, [billSetting]);

  const openEditGateway = (g: any) => {
    setGwForm({ publicKey: g.publicKey || "", secretKey: "", webhookSecret: "" });
    setEditGateway(g);
  };

  const [mutErr, setMutErr] = useState("");

  const saveGateway = async () => {
    if (!editGateway) return;
    setMutErr("");
    try {
      await mutate("put", `/v1/payments/gateways/${editGateway.id}`, {
        publicKey: gwForm.publicKey || undefined,
        secretKey: gwForm.secretKey || undefined,
        webhookSecret: gwForm.webhookSecret || undefined,
      });
      setEditGateway(null);
      refetchGw();
    } catch (err: any) {
      setMutErr(err?.message ?? "Failed to save gateway");
    }
  };

  const toggleGateway = async (g: any) => {
    try {
      await mutate("put", `/v1/payments/gateways/${g.id}`, { isActive: !g.isActive });
      refetchGw();
    } catch { /* silently ignore toggle failure */ }
  };

  const setDefault = async (g: any) => {
    try {
      await mutate("put", `/v1/payments/gateways/${g.id}`, { isDefault: true });
      refetchGw();
    } catch { /* silently ignore */ }
  };

  const handleRefundApprove = async (paymentId: string) => {
    try {
      await mutate("post", `/v1/payments/${paymentId}/refund`, { reason: "Admin approved refund" });
      refetchPay();
    } catch (err: any) {
      setMutErr(err?.message ?? "Refund failed");
    }
  };

  const saveTax = async () => {
    try {
      await mutate("post", "/v1/settings/bulk", {
        settings: [
          { key: "billing_tax", value: { vat: taxValues.vat, gst: taxValues.gst, service: taxValues.service, processing: taxValues.processing, vatEnabled: taxEnabled.vat, gstEnabled: taxEnabled.gst, serviceEnabled: taxEnabled.service, processingEnabled: taxEnabled.processing }, description: "Tax and fee configuration" },
        ],
      });
      refetchTax();
      setSaved("tax");
      setTimeout(() => setSaved(""), 2000);
    } catch (err: any) {
      setMutErr(err?.message ?? "Failed to save tax settings");
    }
  };

  const saveBilling = async () => {
    try {
      await mutate("post", "/v1/settings/bulk", {
        settings: [{ key: "billing_config", value: billForm, description: "Billing configuration" }],
      });
      refetchBill();
      setSaved("billing");
      setTimeout(() => setSaved(""), 2000);
    } catch (err: any) {
      setMutErr(err?.message ?? "Failed to save billing settings");
    }
  };

  const INV_PER_PAGE   = 10;
  const pagedInvoices  = invoices.slice((invPage - 1) * INV_PER_PAGE, invPage * INV_PER_PAGE);
  const invTotalPages  = Math.max(1, Math.ceil(invoices.length / INV_PER_PAGE));

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  const totalRevenue    = stats?.totalRevenue ?? 0;
  const todayRevenue    = stats?.dailyRevenue ?? 0;
  const pendingCount    = stats?.pendingCount ?? allPayments.filter(p => p.status === "pending").length;
  const refundCount     = refunds.length;
  const successCount    = stats?.totalTransactions ?? allPayments.filter(p => p.status === "completed").length;
  const totalCount      = (stats?.totalTransactions ?? 0) + (stats?.failedTransactions ?? 0) + (stats?.refundedTransactions ?? 0) || allPayments.length;
  const successRate     = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : "0.0";
  const avgOrder        = successCount > 0 && totalRevenue > 0 ? (totalRevenue / successCount).toFixed(2) : "0.00";

  const gatewayDist = gateways.map((g: any) => ({
    name: g.name,
    slug: g.slug,
    total: allPayments.filter(p => p.gateway === g.slug && p.status === "completed").reduce((s: number, p: any) => s + (p.amount || 0), 0),
  })).filter((g: any) => g.total > 0);
  const maxGw = Math.max(1, ...gatewayDist.map((g: any) => g.total));

  const TABS: { id: BillingTab; label: string; icon: any }[] = [
    { id: "overview",  label: "Overview",   icon: BarChart2  },
    { id: "gateways",  label: "Gateways",   icon: CreditCard },
    { id: "invoices",  label: "Invoices",   icon: FileText   },
    { id: "refunds",   label: "Refunds",    icon: RefreshCw  },
    { id: "tax",       label: "Tax & Fees", icon: Percent    },
    { id: "settings",  label: "Settings",   icon: Settings   },
    { id: "reports",   label: "Reports",    icon: TrendingUp },
  ];

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <DollarSign size={18} className="text-primary" />
          <div>
            <h1 className="text-sm font-bold text-white">Payment & Billing</h1>
            <p className="text-[10px] text-[#8B92A5]">Gateways, invoices, refunds, tax and revenue</p>
          </div>
        </div>
        <button onClick={() => { refetchStats(); refetchGw(); refetchPay(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">
          <RefreshCw size={13} className={statsLoading || gwLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {mutErr && (
        <div className="mx-6 mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0" /> {mutErr}
          <button onClick={() => setMutErr("")} className="ml-auto text-red-400 hover:text-red-300">✕</button>
        </div>
      )}
      <div className="flex gap-0 px-6 border-b border-border overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === t.id ? "border-primary text-white" : "border-transparent text-[#8B92A5] hover:text-white")}>
              <Icon size={12} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: DollarSign,  label: "Today's Revenue",  value: `$${todayRevenue.toFixed(2)}`,  sub: "Real-time",         color: "bg-green-500/15 text-green-400"  },
                { icon: TrendingUp,  label: "Total Revenue",    value: `$${totalRevenue.toFixed(2)}`,  sub: "All time",           color: "bg-primary/15 text-primary"      },
                { icon: AlertCircle, label: "Pending Payments", value: String(pendingCount),            sub: "Awaiting verify",   color: "bg-yellow-500/15 text-yellow-400"},
                { icon: XCircle,     label: "Refunds",          value: String(refundCount),             sub: "Refunded payments", color: "bg-red-500/15 text-red-400"      },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", s.color)}>
                      <Icon size={16} />
                    </div>
                    {statsLoading ? <div className="h-7 bg-white/5 rounded animate-pulse mb-1" /> : <div className="text-xl font-bold text-white">{s.value}</div>}
                    <div className="text-xs text-[#8B92A5] mt-0.5">{s.label}</div>
                    <div className="text-xs text-[#8B92A5]/70 mt-1">{s.sub}</div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Gateway Revenue Distribution</h3>
                {gwLoading || pyLoading ? (
                  <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-6 bg-white/5 rounded animate-pulse" />)}</div>
                ) : gatewayDist.length === 0 ? (
                  <p className="text-xs text-[#8B92A5] text-center py-6">No revenue data yet</p>
                ) : gatewayDist.map((g: any) => (
                  <div key={g.slug} className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#8B92A5] capitalize">{g.name}</span>
                      <span className="text-xs text-white font-semibold">${g.total.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(g.total / maxGw) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
                {[
                  { label: "Total Revenue",      value: `$${totalRevenue.toFixed(2)}`,       color: "text-green-400"  },
                  { label: "Total Transactions", value: String(totalCount),                  color: "text-white"      },
                  { label: "Success Rate",       value: `${successRate}%`,                   color: "text-green-400"  },
                  { label: "Avg Order Value",    value: `$${avgOrder}`,                      color: "text-white"      },
                  { label: "Pending Payments",   value: String(pendingCount),                color: "text-yellow-400" },
                  { label: "Total Refunds",      value: String(refundCount),                 color: "text-red-400"    },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-xs text-[#8B92A5]">{s.label}</span>
                    {statsLoading ? <div className="h-4 w-16 bg-white/5 rounded animate-pulse" /> : <span className={cn("text-sm font-bold", s.color)}>{s.value}</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* GATEWAYS */}
        {tab === "gateways" && (
          <>
            {gwLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-border rounded-xl h-44 animate-pulse" />)}
              </div>
            ) : gateways.length === 0 ? (
              <div className="text-center py-16 text-sm text-[#8B92A5]">No payment gateways configured yet.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {gateways.map((g: any) => (
                  <div key={g.id} className={cn("bg-card border rounded-xl p-4 transition-all", g.isActive ? "border-border hover:border-primary/40" : "border-border opacity-60")}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white", g.isActive ? "gradient-primary" : "bg-white/5")}>
                        {g.name?.[0] || "G"}
                      </div>
                      <div className="flex items-center gap-2">
                        {g.isTestMode && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Test</span>}
                        <Toggle on={g.isActive} onChange={() => toggleGateway(g)} />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{g.name}</h3>
                    <div className="text-xs text-[#8B92A5] mb-1">{g.feePercent}% fee · {(g.currencies || []).join(", ")}</div>
                    <div className="text-xs text-[#8B92A5] mb-3">{(g.countries || []).join(", ") || "Global"}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditGateway(g)} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] flex items-center justify-center gap-1 hover:bg-white/5">
                        <Edit size={11} /> Configure
                      </button>
                      {g.isActive && (
                        <button onClick={() => setDefault(g)} className="flex-1 py-1.5 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10">
                          Set Default
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* INVOICES */}
        {tab === "invoices" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-[#0d1525]">
                  {["Invoice #","User","Plan","Total","Gateway","Status","Date","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pyLoading && <Skeleton rows={5} cols={8} />}
                {!pyLoading && invoices.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-[#8B92A5]">No invoices found.</td></tr>
                )}
                {!pyLoading && pagedInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-primary">{inv.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-xs text-white truncate max-w-[130px]">{inv.user?.email || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{inv.subscription?.plan?.name || inv.metadata?.planName || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold text-white">{inv.currency || "USD"} {Number(inv.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-[#8B92A5] capitalize">{inv.gateway}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_COLORS[inv.status] || "bg-white/10 text-white")}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => setViewInvoice(inv)} title="View Invoice" className="text-[#8B92A5] hover:text-white"><Eye size={12} /></button>
                        <button onClick={() => exportCSV([{ id: inv.id, invoice: inv.invoiceNumber || '—', user: inv.user?.email || '—', amount: inv.amount, currency: inv.currency, status: inv.status, gateway: inv.gateway, date: new Date(inv.createdAt).toLocaleDateString() }], `invoice-${inv.invoiceNumber || inv.id}.csv`)} title="Export Invoice" className="text-[#8B92A5] hover:text-white"><Download size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-[#8B92A5]">{invoices.length} invoices</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1} className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-40"><ChevronLeft size={13} /></button>
                {Array.from({ length: Math.min(5, invTotalPages) }, (_, i) => {
                  const pg = Math.max(1, Math.min(invPage - 2, invTotalPages - 4)) + i;
                  return (
                    <button key={pg} onClick={() => setInvPage(pg)} className={cn("w-7 h-7 rounded-md text-xs font-medium", pg === invPage ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>{pg}</button>
                  );
                })}
                <button onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))} disabled={invPage >= invTotalPages} className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-40"><ChevronRight size={13} /></button>
              </div>
            </div>
          </div>
        )}

        {/* REFUNDS */}
        {tab === "refunds" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-[#0d1525]">
                  {["User","Invoice","Amount","Reason","Status","Date","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pyLoading && <Skeleton rows={3} cols={7} />}
                {!pyLoading && refunds.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-[#8B92A5]">No refunded payments.</td></tr>
                )}
                {!pyLoading && refunds.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-white truncate max-w-[120px]">{r.user?.email || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary">{r.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-xs font-bold text-white">{r.currency || "USD"} {Number(r.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-[#8B92A5] max-w-[150px] truncate">{r.refundReason || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", STATUS_COLORS[r.status] || "bg-white/10 text-white")}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{new Date(r.refundedAt || r.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {r.status === "completed" && (
                        <button onClick={() => handleRefundApprove(r.id)} disabled={mutLoading}
                          className="text-xs text-orange-400 hover:underline disabled:opacity-50">Re-refund</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAX */}
        {tab === "tax" && (
          <div className="max-w-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Tax & Fee Configuration</h3>
            {[
              { key: "vat",        label: "VAT",             desc: "Value Added Tax" },
              { key: "gst",        label: "GST",             desc: "Goods & Services Tax" },
              { key: "service",    label: "Service Charge",  desc: "Platform service charge" },
              { key: "processing", label: "Processing Fee",  desc: "Payment processing fee" },
            ].map(t => (
              <div key={t.key} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{t.label}</div>
                  <div className="text-xs text-[#8B92A5]">{t.desc}</div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    value={taxValues[t.key] ?? ""}
                    onChange={e => setTaxValues(prev => ({ ...prev, [t.key]: Number(e.target.value) }))}
                    type="number" step="0.1" min="0"
                    className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-primary"
                  />
                  <span className="text-xs text-[#8B92A5]">%</span>
                  <button onClick={() => setTaxEnabled(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                    className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", taxEnabled[t.key] ? "bg-primary" : "bg-white/10")}>
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", taxEnabled[t.key] ? "ml-auto" : "")} />
                  </button>
                </div>
              </div>
            ))}
            <button onClick={saveTax} disabled={mutLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {saved === "tax" ? "✓ Saved!" : "Save Tax Settings"}
            </button>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="max-w-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white">Billing Settings</h3>
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              {[
                { key: "invoicePrefix",  label: "Invoice Prefix",  ph: "INV" },
                { key: "companyName",    label: "Company Name",    ph: "SOL TV" },
                { key: "companyEmail",   label: "Company Email",   ph: "billing@soltv.com" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">{f.label}</label>
                  <input
                    value={billForm[f.key] || ""}
                    onChange={e => setBillForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.ph}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
              ))}
              {[
                { key: "autoInvoice",  label: "Auto Generate Invoices", desc: "Create invoice on each successful payment" },
                { key: "emailInvoice", label: "Send Invoice via Email",  desc: "Email invoice PDF to customer" },
                { key: "emailReceipt", label: "Send Payment Receipt",    desc: "Email receipt for every payment" },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between py-2 border-t border-border">
                  <div>
                    <div className="text-xs font-medium text-white">{s.label}</div>
                    <div className="text-[11px] text-[#8B92A5]">{s.desc}</div>
                  </div>
                  <button onClick={() => setBillForm(prev => ({ ...prev, [s.key]: prev[s.key] === "true" ? "false" : "true" }))}
                    className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", billForm[s.key] === "true" ? "bg-primary" : "bg-white/10")}>
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", billForm[s.key] === "true" ? "ml-auto" : "")} />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-xs font-semibold text-white flex items-center gap-2 mb-4">
                <Webhook size={14} className="text-primary" /> Webhook Endpoints
              </h3>
              {gateways.filter((g: any) => g.isActive).length === 0 && (
                <p className="text-xs text-[#8B92A5]">No active gateways configured.</p>
              )}
              {gateways.filter((g: any) => g.isActive).map((g: any) => (
                <div key={g.id} className="flex items-center gap-3 p-2.5 bg-background rounded-lg mb-2 last:mb-0">
                  <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                  <span className="text-xs font-medium text-white w-24 capitalize">{g.name}</span>
                  <span className="font-mono text-xs text-[#8B92A5] flex-1 truncate">/api/v1/payments/webhook</span>
                  <button onClick={() => mutate("post", "/v1/payments/webhook", { event: "test", gateway: g.slug, transactionId: `test-${Date.now()}` }).then(() => alert(`Webhook test sent for ${g.name}`))} className="text-xs text-primary hover:underline">Test</button>
                </div>
              ))}
            </div>

            <button onClick={saveBilling} disabled={mutLoading}
              className="w-full py-2.5 rounded-xl gradient-primary text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saved === "billing" ? "✓ Saved!" : "Save Billing Settings"}
            </button>
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: "Total Revenue",  value: `$${totalRevenue.toFixed(2)}` },
                { label: "Transactions",   value: String(totalCount)            },
                { label: "Success Rate",   value: `${successRate}%`             },
                { label: "Avg Order",      value: `$${avgOrder}`                },
                { label: "Total Refunds",  value: String(refundCount)           },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                  {statsLoading ? <div className="h-6 bg-white/5 rounded animate-pulse mb-1" /> : <div className="text-lg font-bold text-white">{s.value}</div>}
                  <div className="text-xs text-[#8B92A5] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">All Payments</h3>
                <div className="flex gap-2">
                  <button onClick={() => exportCSV(allPayments.map(p => ({ invoice: p.invoiceNumber || '—', user: p.user?.email || '—', amount: p.amount, currency: p.currency, gateway: p.gateway, status: p.status, date: new Date(p.createdAt).toLocaleDateString() })), "payments.csv")} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">
                      <Download size={11} /> CSV
                    </button>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    {["Invoice","User","Amount","Gateway","Status","Date"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pyLoading && <Skeleton rows={5} cols={6} />}
                  {!pyLoading && allPayments.slice(0, 20).map((p: any) => (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-primary">{p.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3 text-xs text-white truncate max-w-[130px]">{p.user?.email || "—"}</td>
                      <td className="px-4 py-3 text-xs font-bold text-green-400">{p.currency || "USD"} {Number(p.amount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] capitalize">{p.gateway}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_COLORS[p.status] || "bg-white/10 text-white")}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!pyLoading && allPayments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8B92A5]">No payments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewInvoice(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Invoice {viewInvoice.invoiceNumber || viewInvoice.id.slice(0, 8)}</h2>
              <button onClick={() => setViewInvoice(null)} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: "User",     value: viewInvoice.user?.email || viewInvoice.user?.name || "—" },
                { label: "Plan",     value: viewInvoice.subscription?.plan?.name || viewInvoice.metadata?.planName || "—" },
                { label: "Amount",   value: `${viewInvoice.currency || "USD"} ${Number(viewInvoice.amount || 0).toFixed(2)}` },
                { label: "Gateway",  value: viewInvoice.gateway || "—" },
                { label: "Status",   value: viewInvoice.status  || "—" },
                { label: "Date",     value: viewInvoice.createdAt ? new Date(viewInvoice.createdAt).toLocaleString() : "—" },
                { label: "Tx ID",    value: viewInvoice.gatewayTxId || viewInvoice.id },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-xs text-[#8B92A5]">{r.label}</span>
                  <span className="text-xs text-white font-medium capitalize">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setViewInvoice(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Close</button>
              <button onClick={() => exportCSV([{ id: viewInvoice.id, invoice: viewInvoice.invoiceNumber || '—', user: viewInvoice.user?.email || '—', amount: viewInvoice.amount, currency: viewInvoice.currency, status: viewInvoice.status, gateway: viewInvoice.gateway, date: new Date(viewInvoice.createdAt).toLocaleDateString() }], `invoice-${viewInvoice.invoiceNumber || viewInvoice.id}.csv`)} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 flex items-center justify-center gap-2">
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Gateway Modal */}
      {editGateway && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditGateway(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Configure: {editGateway.name}</h2>
              <button onClick={() => setEditGateway(null)} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              {[
                { field: "publicKey",     label: "Public Key / Client ID", type: "text",     ph: "pk_test_..." },
                { field: "secretKey",     label: "Secret Key",             type: "password", ph: "sk_test_..." },
                { field: "webhookSecret", label: "Webhook Secret",         type: "password", ph: "whsec_..."   },
              ].map(f => (
                <div key={f.field}>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">{f.label}</label>
                  <input type={f.type} placeholder={f.ph}
                    value={gwForm[f.field] || ""}
                    onChange={e => setGwForm(prev => ({ ...prev, [f.field]: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  />
                </div>
              ))}
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Shield size={13} className="text-yellow-400 shrink-0" />
                <p className="text-[11px] text-yellow-400">Keys are encrypted at rest. Never share your secret key.</p>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setEditGateway(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={saveGateway} disabled={mutLoading}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {mutLoading ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
