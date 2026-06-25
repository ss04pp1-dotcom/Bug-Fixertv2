"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Edit, Trash2, ChevronLeft, ChevronRight, Crown, Zap, Star, Infinity,
  Tag, RefreshCw, DollarSign, Users, TrendingUp, Check, X, Search,
  Download, Gift,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

type SubTab = "plans" | "subscriptions" | "coupons" | "transactions" | "renewals";

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  price: number;
  features: string[];
  trialDays?: number;
  isPopular?: boolean;
  _count?: { subscriptions?: number };
}

interface Subscription {
  id: string;
  user?: { email?: string; name?: string };
  plan?: { name?: string; price?: number };
  status: string;
  endsAt?: string;
  renewedAt?: string;
}

interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minPurchase?: number;
  usedCount?: number;
  maxUses?: number;
  expiresAt?: string;
  isActive: boolean;
}

interface Payment {
  id: string;
  user?: { email?: string; name?: string };
  subscription?: { plan?: { name?: string } };
  amount: number;
  gateway?: string;
  status: string;
  createdAt: string;
}

interface ListResponse<T> {
  data: T[];
  meta: { total: number; totalPages: number; page: number };
}

const planGradients = ["gradient-blue","gradient-primary","gradient-orange","gradient-primary","gradient-orange","gradient-green"];
const planIcons = [Zap, Star, TrendingUp, Crown, Infinity, Zap];

const STATUS_COLORS: Record<string, string> = {
  active:    "bg-green-500/15 text-green-400",
  trial:     "bg-blue-500/15 text-blue-400",
  expired:   "bg-gray-500/15 text-gray-400",
  cancelled: "bg-red-500/15 text-red-400",
  pending:   "bg-yellow-500/15 text-yellow-400",
  success:   "bg-green-500/15 text-green-400",
  failed:    "bg-red-500/15 text-red-400",
  refunded:  "bg-orange-500/15 text-orange-400",
};

export default function Subscriptions() {
  const [tab, setTab]               = useState<SubTab>("plans");
  const [showPlanModal, setShowPlanModal]     = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editPlan, setEditPlan]               = useState<Plan | null>(null);
  const [editCoupon, setEditCoupon]           = useState<Coupon | null>(null);
  const [viewSub, setViewSub]                 = useState<Subscription | null>(null);
  const [searchQ, setSearchQ]       = useState("");
  const [subsPage, setSubsPage]     = useState(1);

  const planNameRef     = useRef<HTMLInputElement>(null);
  const planPriceRef    = useRef<HTMLInputElement>(null);
  const planDurationRef = useRef<HTMLInputElement>(null);
  const planDaysRef     = useRef<HTMLInputElement>(null);
  const planTrialRef    = useRef<HTMLInputElement>(null);
  const planFeaturesRef = useRef<HTMLTextAreaElement>(null);

  const couponCodeRef    = useRef<HTMLInputElement>(null);
  const couponValueRef   = useRef<HTMLInputElement>(null);
  const couponMinRef     = useRef<HTMLInputElement>(null);
  const couponMaxRef     = useRef<HTMLInputElement>(null);
  const couponExpiryRef  = useRef<HTMLInputElement>(null);
  const couponTypeRef    = useRef<HTMLSelectElement>(null);

  const { data: plansData, isLoading: plansLoading, refetch: refetchPlans } = useApi<ListResponse<Plan>>("/v1/subscriptions/plans?limit=20");
  const { data: subsData,  isLoading: subsLoading,  refetch: refetchSubs  } = useApi<ListResponse<Subscription>>(`/v1/subscriptions?page=${subsPage}&limit=20&search=${encodeURIComponent(searchQ)}`);
  const { data: couponsData, isLoading: couponsLoading, refetch: refetchCoupons } = useApi<ListResponse<Coupon>>("/v1/subscriptions/coupons?limit=50");
  const { data: paymentsData, isLoading: paymentsLoading } = useApi<ListResponse<Payment>>("/v1/payments?limit=20");

  const { call: mutate, loading: mutating } = useApiCallState();

  const plans    = plansData?.data   ?? [];
  const subs     = subsData?.data    ?? [];
  const subsTotal      = subsData?.meta?.total      ?? 0;
  const subsTotalPages = subsData?.meta?.totalPages ?? 1;
  const coupons  = couponsData?.data  ?? [];
  const payments = paymentsData?.data ?? [];

  const TABS: { id: SubTab; label: string; icon: typeof Crown }[] = [
    { id: "plans",         label: "Plans",        icon: Crown      },
    { id: "subscriptions", label: "Subscribers",  icon: Users      },
    { id: "coupons",       label: "Coupons",      icon: Tag        },
    { id: "transactions",  label: "Transactions", icon: DollarSign },
    { id: "renewals",      label: "Auto Renewal", icon: RefreshCw  },
  ];

  const handleSavePlan = async () => {
    const name = planNameRef.current?.value?.trim();
    const price = planPriceRef.current?.value;
    if (!name || !price) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const body = {
      name,
      slug,
      price: parseFloat(price),
      durationDays: planDaysRef.current?.value ? Number(planDaysRef.current.value) : 30,
      trialDays: planTrialRef.current?.value ? Number(planTrialRef.current.value) : 0,
      features: planFeaturesRef.current?.value?.split("\n").filter(Boolean) ?? [],
    };
    if (editPlan) {
      await mutate("put", `/v1/subscriptions/plans/${editPlan.id}`, body);
    } else {
      await mutate("post", "/v1/subscriptions/plans", body);
    }
    setShowPlanModal(false);
    setEditPlan(null);
    refetchPlans();
  };

  const handleEditPlan = (p: Plan) => {
    setEditPlan(p);
    setShowPlanModal(true);
    setTimeout(() => {
      if (planNameRef.current) planNameRef.current.value = p.name;
      if (planPriceRef.current) planPriceRef.current.value = String(p.price);
      if (planDaysRef.current) planDaysRef.current.value = String(p.durationDays);
      if (planTrialRef.current) planTrialRef.current.value = String(p.trialDays ?? 0);
      if (planFeaturesRef.current) planFeaturesRef.current.value = (p.features ?? []).join("\n");
    }, 50);
  };

  const exportSubsCSV = () => {
    if (!subs.length) return;
    const rows = subs.map(s => ({
      user: s.user?.email ?? s.user?.name ?? '',
      plan: s.plan?.name ?? '',
      status: s.status,
      price: s.plan?.price ?? '',
      renewed: s.renewedAt ? new Date(s.renewedAt).toLocaleDateString() : '',
      expires: s.endsAt ? new Date(s.endsAt).toLocaleDateString() : '',
    }));
    const headers = "User,Plan,Status,Price,Renewed,Expires";
    const data = rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + data], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "subscriptions.csv"; a.click();
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm("Delete this plan?")) return;
    await mutate("delete", `/v1/subscriptions/plans/${id}`);
    refetchPlans();
  };

  const handleEditCoupon = (c: Coupon) => {
    setEditCoupon(c);
    setShowCouponModal(true);
    setTimeout(() => {
      if (couponCodeRef.current)   couponCodeRef.current.value   = c.code;
      if (couponTypeRef.current)   couponTypeRef.current.value   = c.discountType;
      if (couponValueRef.current)  couponValueRef.current.value  = String(c.discountValue);
      if (couponMinRef.current)    couponMinRef.current.value    = String(c.minPurchase ?? 0);
      if (couponMaxRef.current)    couponMaxRef.current.value    = c.maxUses != null ? String(c.maxUses) : "";
      if (couponExpiryRef.current) couponExpiryRef.current.value = c.expiresAt ? c.expiresAt.slice(0, 10) : "";
    }, 50);
  };

  const handleSaveCoupon = async () => {
    const code = couponCodeRef.current?.value?.trim();
    if (!code) return;
    const body = {
      code,
      discountType: couponTypeRef.current?.value || "percentage",
      discountValue: couponValueRef.current?.value ? Number(couponValueRef.current.value) : 0,
      minPurchase: couponMinRef.current?.value ? Number(couponMinRef.current.value) : 0,
      maxUses: couponMaxRef.current?.value ? Number(couponMaxRef.current.value) : undefined,
      expiresAt: couponExpiryRef.current?.value || undefined,
    };
    if (editCoupon) {
      await mutate("put", `/v1/subscriptions/coupons/${editCoupon.id}`, body);
    } else {
      await mutate("post", "/v1/subscriptions/coupons", body);
    }
    setShowCouponModal(false);
    setEditCoupon(null);
    refetchCoupons();
  };

  const handleToggleCoupon = async (id: string, isActive: boolean) => {
    await mutate("put", `/v1/subscriptions/coupons/${id}`, { isActive: !isActive });
    refetchCoupons();
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Crown size={18} className="text-primary" />
          <div>
            <h1 className="text-sm font-bold text-white">Subscriptions & Monetization</h1>
            <p className="text-[10px] text-[#8B92A5]">Plans, coupons, payments, and revenue</p>
          </div>
        </div>
        {tab === "plans" && (
          <button onClick={() => setShowPlanModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> Add Plan
          </button>
        )}
        {tab === "coupons" && (
          <button onClick={() => { setEditCoupon(null); setShowCouponModal(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={13} /> New Coupon
          </button>
        )}
      </div>

      {/* Stats — sourced from live API data */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
        {[
          {
            icon: Users,
            label: "Total Subscribers",
            value: subsData?.meta?.total != null ? subsData.meta.total.toLocaleString() : "—",
            sub: "active subscriptions",
            color: "gradient-primary",
          },
          {
            icon: DollarSign,
            label: "Total Transactions",
            value: paymentsData?.meta?.total != null
              ? paymentsData.meta.total.toLocaleString()
              : "—",
            sub: "payment records",
            color: "gradient-green",
          },
          {
            icon: Crown,
            label: "Active Plans",
            value: plansData?.data?.length != null ? String(plansData.data.length) : "—",
            sub: "subscription plans",
            color: "gradient-orange",
          },
          {
            icon: TrendingUp,
            label: "Active Coupons",
            value: couponsData?.data?.length != null ? String(couponsData.data.length) : "—",
            sub: "discount codes",
            color: "gradient-blue",
          },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", s.color)}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-[#8B92A5] mt-0.5">{s.label}</div>
              <div className="text-xs text-[#8B92A5] mt-1">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 border-b border-border">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors",
                tab === t.id ? "border-primary text-white" : "border-transparent text-[#8B92A5] hover:text-white"
              )}>
              <Icon size={12} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-6 space-y-6 overflow-y-auto">

        {/* PLANS */}
        {tab === "plans" && (
          <>
            {plansLoading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
            {!plansLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.length === 0 && (
                  <div className="col-span-3 text-center py-12 text-sm text-[#8B92A5]">No plans found. Add your first plan.</div>
                )}
                {plans.map((p, i) => {
                  const Icon = planIcons[i % planIcons.length];
                  const grad = planGradients[i % planGradients.length];
                  return (
                    <div key={p.id} className={cn("bg-card border border-border rounded-xl p-5 relative", p.isPopular && "border-primary/50")}>
                      {p.isPopular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 gradient-primary rounded-full text-[10px] font-semibold text-white whitespace-nowrap">
                          Most Popular
                        </div>
                      )}
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", grad)}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="text-xl font-bold text-white">${p.price}
                        <span className="text-xs text-[#8B92A5] font-normal ml-1">/{p.durationDays} days</span>
                      </div>
                      <div className="text-sm font-semibold text-white mt-0.5 mb-1">{p.name}</div>
                      {(p.trialDays ?? 0) > 0 && (
                        <div className="text-xs text-blue-400 mb-2 flex items-center gap-1">
                          <Gift size={10} /> {p.trialDays}-day free trial
                        </div>
                      )}
                      <div className="text-xs text-[#8B92A5] mb-3">{(p._count?.subscriptions ?? 0).toLocaleString()} subscribers</div>
                      <div className="space-y-1.5 mb-4">
                        {(p.features ?? []).map(f => (
                          <div key={f} className="flex items-center gap-2 text-xs text-[#8B92A5]">
                            <Check size={10} className="text-green-400 shrink-0" />{f}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditPlan(p)} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] flex items-center justify-center gap-1 hover:bg-white/5">
                          <Edit size={11} /> Edit
                        </button>
                        <button
                          onClick={() => handleDeletePlan(p.id)}
                          disabled={mutating}
                          className="py-1.5 px-3 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* SUBSCRIPTIONS */}
        {tab === "subscriptions" && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
                <Search size={14} className="text-[#8B92A5]" />
                <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setSubsPage(1); }} placeholder="Search by email or plan…" className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1" />
              </div>
              <button onClick={() => refetchSubs()} disabled={subsLoading} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
                <RefreshCw size={13} className={subsLoading ? "animate-spin" : ""} />
              </button>
              <button onClick={exportSubsCSV} disabled={!subs.length} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-40">
                <Download size={13} /> Export
              </button>
            </div>
            {subsLoading && <div className="flex items-center justify-center py-12"><RefreshCw size={18} className="text-primary animate-spin" /></div>}
            {!subsLoading && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["User","Plan","Status","Price","Renewed","Expires","Action"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subs.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-sm text-[#8B92A5]">No subscriptions found</td></tr>
                    ) : subs.map(s => (
                      <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs text-white max-w-[140px] truncate">{s.user?.email ?? s.user?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{s.plan?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_COLORS[s.status] ?? "bg-gray-500/15 text-gray-400")}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-white">{s.plan?.price != null ? `$${s.plan.price}` : "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5]">{s.renewedAt ? new Date(s.renewedAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{s.endsAt ? new Date(s.endsAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setViewSub(s)} className="text-xs text-primary hover:underline">Manage</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-[#8B92A5]">Showing {subs.length} of {subsTotal.toLocaleString()}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setSubsPage(p => Math.max(1, p - 1))} disabled={subsPage === 1}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-40">
                      <ChevronLeft size={13} />
                    </button>
                    {Array.from({ length: Math.min(5, subsTotalPages) }, (_, i) => {
                      const pg = Math.max(1, Math.min(subsPage - 2, subsTotalPages - 4)) + i;
                      return (
                        <button key={pg} onClick={() => setSubsPage(pg)}
                          className={cn("w-7 h-7 rounded-md text-xs font-medium", pg === subsPage ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>
                          {pg}
                        </button>
                      );
                    })}
                    <button onClick={() => setSubsPage(p => Math.min(subsTotalPages, p + 1))} disabled={subsPage >= subsTotalPages}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-40">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* COUPONS */}
        {tab === "coupons" && (
          <>
            {couponsLoading && <div className="flex items-center justify-center py-12"><RefreshCw size={18} className="text-primary animate-spin" /></div>}
            {!couponsLoading && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Code","Type","Value","Min. Purchase","Used / Max","Expires","Status","Action"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-sm text-[#8B92A5]">No coupons found</td></tr>
                    ) : coupons.map(c => (
                      <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded">{c.code}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5] capitalize">{c.discountType}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-primary">
                          {c.discountType === "percentage" ? `${c.discountValue}%` : `$${c.discountValue}`}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5]">${c.minPurchase ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5]">{c.usedCount ?? 0} / {c.maxUses ?? "∞"}</td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", c.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                            {c.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleEditCoupon(c)} className="text-xs text-[#8B92A5] hover:text-white"><Edit size={12} /></button>
                            <button
                              onClick={() => handleToggleCoupon(c.id, c.isActive)}
                              disabled={mutating}
                              className={cn("text-xs disabled:opacity-50", c.isActive ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300")}
                            >
                              {c.isActive ? <X size={12} /> : <Check size={12} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* TRANSACTIONS */}
        {tab === "transactions" && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
                <Search size={14} className="text-[#8B92A5]" />
                <input placeholder="Search transactions..." className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1" />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    {["Txn ID","User","Plan","Amount","Gateway","Status","Date"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paymentsLoading ? (
                    <tr><td colSpan={7} className="text-center py-12"><RefreshCw size={16} className="text-primary animate-spin mx-auto" /></td></tr>
                  ) : payments.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No transactions found</td></tr>
                  ) : payments.map(t => (
                    <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-mono text-xs text-[#8B92A5]">{t.id.slice(0,8).toUpperCase()}</td>
                      <td className="px-4 py-3 text-xs text-white truncate max-w-[130px]">{t.user?.email ?? t.user?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">{t.subscription?.plan?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs font-bold text-white">${t.amount}</td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5]">{t.gateway ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize", STATUS_COLORS[t.status] ?? "bg-gray-500/15 text-gray-400")}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8B92A5] whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* RENEWALS */}
        {tab === "renewals" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-white">Auto Renewal Settings</h3>
              </div>
              {[
                { label: "Enable Auto Renewal",   input: false },
                { label: "Grace Period (days)",   input: true, val: "3" },
                { label: "Retry Failed Renewals", input: false },
                { label: "Notify Before Expiry",  input: true, val: "7" },
              ].map(item => (
                <div key={item.label} className="py-3 border-b border-border last:border-0 flex items-center justify-between">
                  <span className="text-xs text-white">{item.label}</span>
                  {item.input
                    ? <input defaultValue={item.val} className="w-14 bg-background border border-border rounded px-2 py-1 text-xs text-white text-center outline-none focus:border-primary" />
                    : <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer"><div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full" /></div>
                  }
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Upcoming Renewals</h3>
              <div className="space-y-3">
                {[
                  { user: "john.doe@gmail.com",  plan: "Yearly",    date: "Dec 31, 2026", amount: "$79.99" },
                  { user: "maria.i@gmail.com",   plan: "Monthly",   date: "Jul 1, 2026",  amount: "$9.99"  },
                  { user: "sara.k@gmail.com",    plan: "Monthly",   date: "Jul 8, 2026",  amount: "$9.99"  },
                  { user: "tanvir.a@gmail.com",  plan: "Quarterly", date: "Sep 14, 2026", amount: "$24.99" },
                ].map(r => (
                  <div key={r.user} className="flex items-center gap-3 p-2.5 bg-background/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white">
                      {r.user[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white truncate">{r.user}</div>
                      <div className="text-[10px] text-[#8B92A5]">{r.plan} · {r.date}</div>
                    </div>
                    <span className="text-xs font-semibold text-white">{r.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">Renewal Stats</h3>
              {[
                { label: "Renewal Rate",     value: "94.2%", color: "text-green-400"  },
                { label: "Failed Renewals",  value: "58",    color: "text-red-400"    },
                { label: "Recovered",        value: "41",    color: "text-blue-400"   },
                { label: "Expiring 30 Days", value: "312",   color: "text-yellow-400" },
                { label: "Grace Period",     value: "3 days",color: "text-[#8B92A5]"  },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <span className="text-xs text-[#8B92A5]">{s.label}</span>
                  <span className={cn("text-sm font-bold", s.color)}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">{editPlan ? "Edit Plan" : "Add Subscription Plan"}</h2>
              <button onClick={() => { setShowPlanModal(false); setEditPlan(null); }} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Plan Name</label>
                <input ref={planNameRef} type="text" placeholder="e.g. Monthly" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Price (USD)</label>
                <input ref={planPriceRef} type="number" placeholder="9.99" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Duration</label>
                <input ref={planDurationRef} type="text" placeholder="monthly / yearly / lifetime" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Duration Days</label>
                <input ref={planDaysRef} type="number" placeholder="30" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Free Trial Days</label>
                <input ref={planTrialRef} type="number" placeholder="0" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Features (one per line)</label>
                <textarea ref={planFeaturesRef} rows={4} placeholder={"HD Streaming\n500+ Channels\n2 Devices"} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowPlanModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSavePlan} disabled={mutating} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {mutating ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Detail Modal */}
      {viewSub && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewSub(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Subscription Details</h2>
              <button onClick={() => setViewSub(null)} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-2">
              {[
                { label: "User",    value: viewSub.user?.email ?? viewSub.user?.name ?? "—" },
                { label: "Plan",    value: viewSub.plan?.name ?? "—" },
                { label: "Status",  value: viewSub.status },
                { label: "Price",   value: viewSub.plan?.price != null ? `$${viewSub.plan.price}` : "—" },
                { label: "Renewed", value: viewSub.renewedAt ? new Date(viewSub.renewedAt).toLocaleString() : "—" },
                { label: "Expires", value: viewSub.endsAt    ? new Date(viewSub.endsAt).toLocaleString()    : "—" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-xs text-[#8B92A5]">{r.label}</span>
                  <span className="text-xs text-white font-medium capitalize">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setViewSub(null)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Close</button>
              <button onClick={async () => { if (!confirm("Cancel this subscription?")) return; await mutate("put", `/v1/subscriptions/${viewSub.id}`, { status: "cancelled" }); setViewSub(null); refetchSubs(); }} disabled={mutating || viewSub.status === "cancelled"} className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                Cancel Sub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Create Coupon</h2>
              <button onClick={() => setShowCouponModal(false)} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-3">
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Coupon Code</label>
                <input ref={couponCodeRef} type="text" placeholder="SAVE20" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Discount Type</label>
                <select ref={couponTypeRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Discount Value</label>
                <input ref={couponValueRef} type="number" placeholder="20" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Minimum Purchase ($)</label>
                <input ref={couponMinRef} type="number" placeholder="0" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Max Uses</label>
                <input ref={couponMaxRef} type="number" placeholder="100" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Expiry Date</label>
                <input ref={couponExpiryRef} type="date" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowCouponModal(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSaveCoupon} disabled={mutating} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {mutating ? "Saving…" : "Create Coupon"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
