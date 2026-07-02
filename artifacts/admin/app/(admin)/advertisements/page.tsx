"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Trash2, BarChart2, TrendingUp, DollarSign, Eye,
  Menu, RefreshCw, Save, Check, X, ChevronRight, Zap,
  Settings, BookOpen, Shield, Clock, ToggleLeft, Wifi,
  Database, Activity,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

type AdTab = "overview" | "providers" | "placements" | "frequency" | "analytics" | "docs";

interface AdProvider {
  id: string; name: string; slug: string;
  appId?: string; apiKey?: string;
  adUnitBanner?: string; adUnitInterstitial?: string;
  adUnitRewarded?: string; adUnitNative?: string; adUnitAppOpen?: string;
  isActive?: boolean; isSelected?: boolean; isTestMode?: boolean;
  createdAt?: string; updatedAt?: string;
}
interface AdPlacement {
  id: string; name: string; slug?: string; type?: string;
  screen?: string; frequency?: number; cooldownSeconds?: number;
  skipAfterSeconds?: number; isEnabled?: boolean;
}
interface AdAnalytics {
  summary: { totalImpressions: number; totalClicks: number; ctr: string; totalRevenue: number; ecpm: string };
  byPlacement: { placement: string; _sum: { revenue: number; impressions: number; clicks: number } }[];
  byProvider:  { providerId: string; _sum: { revenue: number; impressions: number; clicks: number } }[];
}
interface AdSettings {
  maxAdsPerSession: number; maxAdsPerDay: number; cooldownSeconds: number;
  minIntervalSeconds: number; interstitialEveryNScreens: number;
  interstitialEveryNMinutes: number; rewardedCooldownSeconds: number;
  isEnabled: boolean;
}

const TABS: { id: AdTab; label: string }[] = [
  { id: "overview",   label: "Overview"   },
  { id: "providers",  label: "Providers"  },
  { id: "placements", label: "Placements" },
  { id: "frequency",  label: "Freq. Cap"  },
  { id: "analytics",  label: "Analytics"  },
  { id: "docs",       label: "Docs"       },
];

const PROVIDER_META: Record<string, { color: string; icon: string; description: string; supportedTypes: string[] }> = {
  admob:      { color: "from-[#4285F4] to-[#34A853]", icon: "G",  description: "Google's mobile advertising platform — largest reach globally", supportedTypes: ["Banner","Interstitial","Rewarded","Native","App Open"] },
  applovin:   { color: "from-[#E63946] to-[#F4A261]", icon: "A",  description: "AppLovin MAX — mediation + in-app bidding powerhouse",           supportedTypes: ["Banner","Interstitial","Rewarded","Native","App Open"] },
  adsterra:   { color: "from-[#0075FF] to-[#00C2FF]", icon: "AD", description: "Adsterra — high-fill display network with popunder & banner formats", supportedTypes: ["Banner","Interstitial","Rewarded","Popunder"] },
  unity:      { color: "from-[#222222] to-[#444444]", icon: "U",  description: "Unity Ads — top choice for gaming audiences",                    supportedTypes: ["Interstitial","Rewarded","Banner"] },
  ironsource: { color: "from-[#F72585] to-[#7209B7]", icon: "IS", description: "IronSource — mediation & advanced waterfall management",          supportedTypes: ["Banner","Interstitial","Rewarded","Offerwall"] },
  meta:       { color: "from-[#1877F2] to-[#42B72A]", icon: "M",  description: "Meta Audience Network — Facebook's premium ad inventory",         supportedTypes: ["Banner","Interstitial","Rewarded","Native"] },
  startio:    { color: "from-[#00B4D8] to-[#0077B6]", icon: "S",  description: "Start.io — programmatic advertising with strong eCPMs",           supportedTypes: ["Banner","Interstitial","Rewarded","Native"] },
  pangle:     { color: "from-[#010101] to-[#2D2D2D]", icon: "P",  description: "Pangle by TikTok — access TikTok For Business ad ecosystem",     supportedTypes: ["Banner","Interstitial","Rewarded","Native"] },
  amazon:     { color: "from-[#FF9900] to-[#146EB4]", icon: "AZ", description: "Amazon Publisher Services — first-party data targeting advantage", supportedTypes: ["Banner","Interstitial","Rewarded"] },
  custom:     { color: "from-[#6C757D] to-[#343A40]", icon: "C",  description: "Custom Ad Network — integrate your own or a niche provider",      supportedTypes: ["Banner","Interstitial","Rewarded","Native","App Open"] },
};

const AD_UNIT_FIELDS = [
  { key: "adUnitBanner",        label: "Banner Ad Unit ID",        placeholder: "e.g. ca-app-pub-xxx/yyy" },
  { key: "adUnitInterstitial",  label: "Interstitial Ad Unit ID",  placeholder: "e.g. ca-app-pub-xxx/yyy" },
  { key: "adUnitRewarded",      label: "Rewarded Ad Unit ID",      placeholder: "e.g. ca-app-pub-xxx/yyy" },
  { key: "adUnitNative",        label: "Native Ad Unit ID",        placeholder: "e.g. ca-app-pub-xxx/yyy" },
  { key: "adUnitAppOpen",       label: "App Open Ad Unit ID",      placeholder: "e.g. ca-app-pub-xxx/yyy" },
] as const;

function fmtNum(n?: number) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtMoney(dollars?: number) {
  if (dollars == null) return "$0";
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "w-10 h-5 rounded-full flex items-center px-0.5 transition-colors duration-200",
        on ? "bg-primary" : "bg-white/10",
        disabled && "opacity-40 pointer-events-none",
      )}
    >
      <div className={cn("w-4 h-4 rounded-full bg-white transition-transform duration-200", on ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

export default function Advertisements() {
  const [tab, setTab] = useState<AdTab>("overview");
  const [showModal, setShowModal] = useState(false);
  const [freqForm, setFreqForm] = useState<Partial<AdSettings>>({});
  const [freqSaved, setFreqSaved] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AdProvider | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdProvider>>({});
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [editPlacement, setEditPlacement] = useState<AdPlacement | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [analyticsSeedLoading, setAnalyticsSeedLoading] = useState(false);

  // ── House Ads quick-create state ──────────────────────────────────────────
  const [quickAdForm, setQuickAdForm] = useState({ title: "", imageUrl: "", targetUrl: "", type: "interstitial" });
  const [quickAdSaving, setQuickAdSaving] = useState(false);
  const [quickAdResult, setQuickAdResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [analyticsSeedResult, setAnalyticsSeedResult] = useState<string | null>(null);
  const [analyticsResetLoading, setAnalyticsResetLoading] = useState(false);

  const placementNameRef   = useRef<HTMLInputElement>(null);
  const placementFreqRef   = useRef<HTMLInputElement>(null);
  const placementTypeRef   = useRef<HTMLSelectElement>(null);
  const placementScreenRef = useRef<HTMLSelectElement>(null);

  const { data: providersData, isLoading: providersLoading, refetch: refetchProviders } =
    useApi<AdProvider[]>("/v1/advertisements/providers");
  const { data: placementsData, isLoading: placementsLoading, refetch: refetchPlacements } =
    useApi<AdPlacement[] | { data: AdPlacement[] }>("/v1/advertisements/placements");
  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } =
    useApi<AdAnalytics>("/v1/advertisements/analytics");
  const { data: settingsData, refetch: refetchSettings } =
    useApi<AdSettings>("/v1/advertisements/settings");
  const { call, loading: mutating } = useApiCallState();

  const providers  = (Array.isArray(providersData) ? providersData : (providersData as unknown as { data?: AdProvider[] })?.data) ?? [];
  const placements = (Array.isArray(placementsData) ? placementsData : (placementsData as unknown as { data?: AdPlacement[] })?.data) ?? [];
  const summary    = analytics?.summary;
  const byPlacement = analytics?.byPlacement ?? [];

  useEffect(() => { if (settingsData) setFreqForm(settingsData); }, [settingsData]);

  const openEdit = useCallback((p: AdProvider) => {
    setEditingProvider(p);
    setEditForm({
      appId: p.appId ?? "",
      apiKey: p.apiKey ?? "",
      adUnitBanner: p.adUnitBanner ?? "",
      adUnitInterstitial: p.adUnitInterstitial ?? "",
      adUnitRewarded: p.adUnitRewarded ?? "",
      adUnitNative: p.adUnitNative ?? "",
      adUnitAppOpen: p.adUnitAppOpen ?? "",
      isActive: p.isActive ?? true,
      isTestMode: p.isTestMode ?? true,
    });
    setProviderSaved(false);
  }, []);

  const handleSeedProviders = async () => {
    setSeedLoading(true);
    await call("post", "/v1/advertisements/providers/seed", {});
    setSeedLoading(false);
    refetchProviders();
  };

  const handleSeedDemoAnalytics = async () => {
    setAnalyticsSeedResult(null);
    setAnalyticsSeedLoading(true);
    const res = await call("post", "/v1/advertisements/analytics/seed-demo", {});
    setAnalyticsSeedLoading(false);
    if (res && typeof res === "object" && "error" in res) {
      setAnalyticsSeedResult(`⚠ ${(res as { error: string }).error}`);
    } else if (res && typeof res === "object") {
      const r = res as { revenueRowsInserted?: number; eventRowsInserted?: number; daysSeeded?: number; providersUsed?: number };
      setAnalyticsSeedResult(`✓ Seeded ${r.revenueRowsInserted?.toLocaleString()} revenue rows + ${r.eventRowsInserted?.toLocaleString()} events across ${r.daysSeeded} days / ${r.providersUsed} providers`);
    }
    refetchAnalytics();
  };

  const handleQuickAdSave = async () => {
    if (!quickAdForm.title.trim()) {
      setQuickAdResult({ ok: false, msg: "Ad title is required" });
      return;
    }
    setQuickAdSaving(true);
    setQuickAdResult(null);
    try {
      await call("post", "/v1/advertisements", {
        title: quickAdForm.title.trim(),
        imageUrl: quickAdForm.imageUrl.trim() || undefined,
        targetUrl: quickAdForm.targetUrl.trim() || undefined,
        type: quickAdForm.type,
        isActive: true,
      });
      setQuickAdResult({ ok: true, msg: "Ad created and activated ✓" });
      setQuickAdForm({ title: "", imageUrl: "", targetUrl: "", type: "interstitial" });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create ad";
      setQuickAdResult({ ok: false, msg: Array.isArray(msg) ? msg.join(", ") : String(msg) });
    } finally {
      setQuickAdSaving(false);
    }
  };

  const handleResetAnalytics = async () => {
    if (!confirm("This will permanently delete ALL analytics data (impressions, clicks, revenue). Continue?")) return;
    setAnalyticsResetLoading(true);
    setAnalyticsSeedResult(null);
    const res = await call("delete", "/v1/advertisements/analytics/reset");
    setAnalyticsResetLoading(false);
    if (res && typeof res === "object") {
      const r = res as { deletedEvents?: number; deletedRevenueRows?: number };
      setAnalyticsSeedResult(`🗑 Reset complete — deleted ${r.deletedEvents?.toLocaleString()} events and ${r.deletedRevenueRows?.toLocaleString()} revenue rows`);
    }
    refetchAnalytics();
  };

  const handleSaveProvider = async () => {
    if (!editingProvider) return;
    setProviderSaving(true);
    try {
      const clean: Partial<AdProvider> = {};
      for (const k of Object.keys(editForm) as (keyof AdProvider)[]) {
        const v = editForm[k];
        if (typeof v === "string") clean[k] = (v.trim() || undefined) as never;
        else clean[k] = v as never;
      }
      await call("put", `/v1/advertisements/providers/${editingProvider.id}`, clean);
      setProviderSaved(true);
      refetchProviders();
      setTimeout(() => setProviderSaved(false), 2500);
    } finally {
      setProviderSaving(false);
    }
  };

  const handleActivateProvider = async (id: string) => {
    await call("post", `/v1/advertisements/providers/${id}/activate`, {});
    refetchProviders();
    if (editingProvider?.id === id) {
      setEditingProvider(prev => prev ? { ...prev, isSelected: true } : null);
    }
  };

  const handleTogglePlacement = async (id: string, isEnabled: boolean) => {
    await call("put", `/v1/advertisements/placements/${id}`, { isEnabled: !isEnabled });
    refetchPlacements();
  };
  const handleDeletePlacement = async (id: string) => {
    if (!confirm("Delete this placement?")) return;
    await call("delete", `/v1/advertisements/placements/${id}`);
    refetchPlacements();
  };
  const openEditPlacement = (p: AdPlacement) => {
    setEditPlacement(p);
    setPlacementError(null);
    setShowModal(true);
    setTimeout(() => {
      if (placementNameRef.current)   placementNameRef.current.value   = p.name;
      if (placementTypeRef.current)   placementTypeRef.current.value   = p.type   ?? "banner";
      if (placementScreenRef.current) placementScreenRef.current.value = p.screen ?? "home";
      if (placementFreqRef.current)   placementFreqRef.current.value   = p.frequency != null ? String(p.frequency) : "";
    }, 50);
  };

  const handleSavePlacement = async () => {
    const name = placementNameRef.current?.value?.trim();
    if (!name) { setPlacementError("Name is required"); return; }
    setPlacementError(null);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const body = {
      name, slug,
      type:   placementTypeRef.current?.value || "banner",
      screen: placementScreenRef.current?.value || "home",
      frequency: placementFreqRef.current?.value ? Number(placementFreqRef.current.value) : undefined,
    };
    try {
      if (editPlacement) {
        await call("put", `/v1/advertisements/placements/${editPlacement.id}`, body);
      } else {
        await call("post", "/v1/advertisements/placements", body);
      }
      setShowModal(false);
      setEditPlacement(null);
      setPlacementError(null);
      refetchPlacements();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed to save placement";
      setPlacementError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    }
  };
  const handleSaveFrequency = async () => {
    await call("put", "/v1/advertisements/settings", freqForm);
    setFreqSaved(true);
    setTimeout(() => setFreqSaved(false), 2500);
    refetchSettings();
  };

  const statCards = [
    { label: "Total Revenue",      value: fmtMoney(summary?.totalRevenue),  icon: DollarSign, color: "from-violet-600 to-violet-800" },
    { label: "Total Impressions",  value: fmtNum(summary?.totalImpressions), icon: Eye,        color: "from-blue-600 to-blue-800"    },
    { label: "Click-Through Rate", value: summary?.ctr ?? "0.00%",           icon: TrendingUp, color: "from-emerald-600 to-emerald-800" },
    { label: "eCPM",               value: summary?.ecpm ?? "$0.00",          icon: BarChart2,  color: "from-orange-600 to-orange-800" },
  ];

  const barMax = byPlacement.length > 0 ? Math.max(...byPlacement.map(p => p._sum?.revenue ?? 0)) : 1;
  const activeProvider = providers.find(p => p.isSelected);

  return (
    <>
      {/* HEADER */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Advertisements</h1>
          {(providersLoading || analyticsLoading) && <RefreshCw size={12} className="text-[#8B92A5] animate-spin" />}
          {activeProvider && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold">
              Active: {activeProvider.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tab === "placements" && (
            <button onClick={() => { setEditPlacement(null); setPlacementError(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90">
              <Plus size={13} /> Add Placement
            </button>
          )}
          {tab === "providers" && (
            <button
              onClick={handleSeedProviders} disabled={seedLoading || mutating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white hover:bg-white/5 disabled:opacity-50"
            >
              {seedLoading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              Initialize All Providers
            </button>
          )}
          {tab === "overview" && (
            <button onClick={() => { refetchAnalytics(); refetchProviders(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white hover:bg-white/5">
              <RefreshCw size={12} /> Refresh
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-0 px-6 border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("px-4 py-3 text-xs font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-white" : "border-transparent text-[#8B92A5] hover:text-white"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className={cn("p-6 space-y-6 overflow-y-auto flex-1 transition-all", editingProvider ? "pr-0" : "")}>

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(s => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br", s.color)}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="text-xl font-bold text-white">{analyticsLoading ? "…" : s.value}</div>
                      <div className="text-xs text-[#8B92A5] mt-0.5">{s.label}</div>
                      <div className="text-[10px] text-[#8B92A5] mt-1">Last 30 days</div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Revenue by Placement</h3>
                {analyticsLoading ? (
                  <div className="flex items-center justify-center h-36"><RefreshCw size={16} className="text-primary animate-spin" /></div>
                ) : byPlacement.length === 0 ? (
                  <div className="flex items-center justify-center h-36 text-xs text-[#8B92A5]">
                    No ad revenue tracked yet — will populate as impressions are logged
                  </div>
                ) : (
                  <div className="flex items-end gap-3 h-36">
                    {byPlacement.slice(0, 8).map(d => {
                      const rev = d._sum?.revenue ?? 0;
                      const pct = barMax > 0 ? (rev / barMax) * 100 : 0;
                      return (
                        <div key={d.placement} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-[#8B92A5]">{fmtMoney(rev)}</span>
                          <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[9px] text-[#8B92A5] truncate w-full text-center">{d.placement}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── House Ads Quick-Create ─────────────────────────────────────────── */}
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold text-white">House Ads — Quick Add</h3>
                </div>
                <p className="text-[11px] text-[#8B92A5] mb-4">
                  Create an in-app ad instantly. It shows to all free users on the placement you choose (channel switch, sports match, home banner, etc.).
                  No ad network account needed.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Ad Title *</label>
                    <input
                      type="text"
                      value={quickAdForm.title}
                      onChange={e => setQuickAdForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Watch StreamPro Premium"
                      className="w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5] focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Ad Type</label>
                    <select
                      value={quickAdForm.type}
                      onChange={e => setQuickAdForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      <option value="interstitial">Interstitial — full-screen (channel switch, sports match, app open)</option>
                      <option value="banner">Banner — strip at bottom (home, movies, sports)</option>
                      <option value="rewarded">Rewarded — user watches to unlock content</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Image URL (optional)</label>
                    <input
                      type="url"
                      value={quickAdForm.imageUrl}
                      onChange={e => setQuickAdForm(f => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="https://… (jpg, png, webp)"
                      className="w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5] focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Click URL (optional)</label>
                    <input
                      type="url"
                      value={quickAdForm.targetUrl}
                      onChange={e => setQuickAdForm(f => ({ ...f, targetUrl: e.target.value }))}
                      placeholder="https://… (where tapping the ad goes)"
                      className="w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5] focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleQuickAdSave}
                    disabled={quickAdSaving || !quickAdForm.title.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {quickAdSaving ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                    Create & Activate Ad
                  </button>
                  {quickAdResult && (
                    <span className={cn("text-xs font-medium", quickAdResult.ok ? "text-emerald-400" : "text-red-400")}>
                      {quickAdResult.msg}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#8B92A5] mt-3">
                  💡 <strong className="text-white/60">Tip:</strong> Interstitial ads show on channel switches (every 3rd switch) and sports match opens (30 seconds). Banner ads show on home &amp; movies screens. To disable an ad type entirely, go to <strong className="text-white/60">Placements</strong> tab and toggle off the placement.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border"><h3 className="text-xs font-semibold text-white">Provider Status</h3></div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Provider","Status","Runtime","Impressions","Clicks","Mode"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {providersLoading ? (
                      <tr><td colSpan={6} className="text-center py-8"><RefreshCw size={16} className="text-primary animate-spin mx-auto" /></td></tr>
                    ) : providers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-sm text-[#8B92A5]">No providers — go to Providers tab and click "Initialize All Providers"</td></tr>
                    ) : providers.map(p => {
                      const meta = PROVIDER_META[p.slug] ?? PROVIDER_META.custom;
                      const pStats = analytics?.byProvider?.find(b => b.providerId === p.id);
                      return (
                        <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-white/2">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-br", meta.color)}>{meta.icon}</div>
                              <span className="text-sm font-medium text-white">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", p.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                              {p.isActive ? "Enabled" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {p.isSelected
                              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">● Active</span>
                              : <span className="text-[10px] text-[#8B92A5]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(pStats?._sum?.impressions)}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(pStats?._sum?.clicks)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", p.isTestMode ? "bg-yellow-500/15 text-yellow-400" : "bg-emerald-500/15 text-emerald-400")}>
                              {p.isTestMode ? "🧪 Test" : "🟢 Live"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── PROVIDERS ── */}
          {tab === "providers" && (
            <>
              {providers.length === 0 && !providersLoading && (
                <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
                  <Zap size={32} className="text-primary mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white mb-1">No Providers Yet</h3>
                  <p className="text-xs text-[#8B92A5] mb-4">Click "Initialize All Providers" above to seed all 9 ad networks.</p>
                  <button onClick={handleSeedProviders} disabled={seedLoading}
                    className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                    {seedLoading ? "Seeding…" : "Initialize All Providers"}
                  </button>
                </div>
              )}
              {providersLoading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
              {!providersLoading && providers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {providers.map(p => {
                    const meta = PROVIDER_META[p.slug] ?? PROVIDER_META.custom;
                    const isEditing = editingProvider?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "bg-card border rounded-xl p-5 transition-all cursor-pointer group",
                          isEditing ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-white/20",
                          !p.isActive && "opacity-60",
                        )}
                        onClick={() => openEdit(p)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br", meta.color)}>
                            {meta.icon}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {p.isSelected && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold">ACTIVE</span>
                            )}
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-semibold", p.isTestMode ? "bg-yellow-500/15 text-yellow-400" : "bg-emerald-500/15 text-emerald-400")}>
                              {p.isTestMode ? "TEST" : "LIVE"}
                            </span>
                          </div>
                        </div>

                        <h3 className="text-sm font-semibold text-white mb-1">{p.name}</h3>
                        <p className="text-[11px] text-[#8B92A5] leading-relaxed mb-3">{meta.description}</p>

                        <div className="flex flex-wrap gap-1 mb-4">
                          {meta.supportedTypes.map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[#8B92A5] border border-white/5">{t}</span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[11px]">
                            <div className={cn("w-1.5 h-1.5 rounded-full", p.isActive ? "bg-green-400" : "bg-red-400")} />
                            <span className="text-[#8B92A5]">{p.isActive ? "Enabled" : "Disabled"}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <Settings size={11} /> Configure <ChevronRight size={11} />
                          </div>
                        </div>

                        {(p.appId || p.adUnitBanner) && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-[10px] text-[#8B92A5]">
                              {p.appId && <span>App ID: <span className="text-white/60 font-mono">{p.appId.length > 20 ? p.appId.slice(0, 20) + "…" : p.appId}</span></span>}
                              {!p.appId && <span className="text-yellow-400/70">⚠ App ID not configured</span>}
                            </p>
                          </div>
                        )}
                        {!p.appId && !p.adUnitBanner && (
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <p className="text-[10px] text-yellow-400/70">⚠ Not configured — click to set up</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── PLACEMENTS ── */}
          {tab === "placements" && (
            <>
              <div className="bg-card border border-border rounded-xl p-4 text-[11px] text-[#8B92A5] leading-relaxed">
                <strong className="text-white">Placements</strong> define where in the app each ad type appears and how often.
                The mobile app checks these settings on every launch via the remote config API — no app update needed to enable/disable a placement.
              </div>
              {placementsLoading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
              {!placementsLoading && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-[#0d1525]">
                        {["Placement","Type","Screen","Frequency","Cooldown","Enabled","Actions"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {placements.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No placements yet — click "Add Placement"</td></tr>
                      ) : placements.map(p => (
                        <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-white/2">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-white">{p.name}</div>
                            {p.slug && <div className="text-[10px] text-[#8B92A5] font-mono">{p.slug}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 capitalize">{p.type ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5] capitalize">{p.screen ?? "—"}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">
                            {p.frequency ? `Every ${p.frequency} views` : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">
                            {p.cooldownSeconds ? `${p.cooldownSeconds}s` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Toggle on={p.isEnabled ?? false} onChange={() => handleTogglePlacement(p.id, p.isEnabled ?? false)} disabled={mutating} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => openEditPlacement(p)} disabled={mutating}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-50">
                                <Settings size={12} className="text-[#8B92A5]" />
                              </button>
                              <button onClick={() => handleDeletePlacement(p.id)} disabled={mutating}
                                className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-50">
                                <Trash2 size={13} className="text-red-400" />
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

          {/* ── FREQUENCY CAP ── */}
          {tab === "frequency" && (
            <div className="max-w-xl space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 text-[11px] text-[#8B92A5] leading-relaxed">
                These settings are pushed to the mobile app via <span className="text-white font-mono">/v1/ads/config</span> and enforced client-side.
                Changes take effect on the next app launch or config refresh — no app update required.
              </div>
              <h3 className="text-sm font-semibold text-white">Frequency Cap Settings</h3>
              <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                {([
                  { key: "maxAdsPerSession",          label: "Max Ads Per Session",            desc: "Maximum total ads shown per user session" },
                  { key: "maxAdsPerDay",              label: "Max Ads Per Day",                desc: "Maximum total ads shown to a user per day" },
                  { key: "minIntervalSeconds",        label: "Min Gap Between Ads (seconds)",  desc: "Minimum seconds between any two ad displays" },
                  { key: "interstitialEveryNScreens", label: "Interstitial Every N Screens",   desc: "Show a full-screen interstitial after this many screen navigations" },
                  { key: "interstitialEveryNMinutes", label: "Interstitial Every N Minutes",   desc: "Minimum minutes between two interstitial ads" },
                  { key: "rewardedCooldownSeconds",   label: "Rewarded Ad Cooldown (seconds)", desc: "Seconds before the rewarded ad button can be shown again" },
                ] as { key: keyof AdSettings; label: string; desc: string }[]).map(item => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-white">{item.label}</label>
                      <input
                        type="number" min={0}
                        value={freqForm[item.key] as number ?? ""}
                        onChange={e => setFreqForm(prev => ({ ...prev, [item.key]: Number(e.target.value) }))}
                        className="w-20 bg-background border border-border rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:border-primary"
                      />
                    </div>
                    <p className="text-[11px] text-[#8B92A5]">{item.desc}</p>
                  </div>
                ))}

                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-white">Ads Globally Enabled</label>
                      <p className="text-[11px] text-[#8B92A5] mt-0.5">Master switch — turn off to suppress all ads immediately</p>
                    </div>
                    <Toggle
                      on={freqForm.isEnabled ?? true}
                      onChange={v => setFreqForm(prev => ({ ...prev, isEnabled: v }))}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveFrequency} disabled={mutating}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50",
                  freqSaved ? "bg-green-600 text-white" : "bg-primary text-white hover:opacity-90"
                )}
              >
                {freqSaved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Frequency Settings</>}
              </button>
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {tab === "analytics" && (
            <>
              {/* Action bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleSeedDemoAnalytics}
                  disabled={analyticsSeedLoading || analyticsResetLoading || mutating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {analyticsSeedLoading
                    ? <><RefreshCw size={13} className="animate-spin" /> Seeding…</>
                    : <><Zap size={13} /> Seed 30-Day Demo Data</>}
                </button>
                <button
                  onClick={handleResetAnalytics}
                  disabled={analyticsSeedLoading || analyticsResetLoading || mutating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50 transition-all"
                >
                  {analyticsResetLoading
                    ? <><RefreshCw size={13} className="animate-spin" /> Resetting…</>
                    : <><Trash2 size={13} /> Reset All Data</>}
                </button>
                {analyticsSeedResult && (
                  <span className={cn(
                    "text-xs px-3 py-2 rounded-lg border",
                    analyticsSeedResult.startsWith("✓")
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : analyticsSeedResult.startsWith("🗑")
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                      : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                  )}>
                    {analyticsSeedResult}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Total Impressions",  value: analyticsLoading ? "…" : fmtNum(summary?.totalImpressions) },
                  { label: "Total Clicks",       value: analyticsLoading ? "…" : fmtNum(summary?.totalClicks) },
                  { label: "Click-Through Rate", value: analyticsLoading ? "…" : (summary?.ctr ?? "0.00%") },
                  { label: "eCPM",               value: analyticsLoading ? "…" : (summary?.ecpm ?? "$0.00") },
                ].map(s => (
                  <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                    <div className="text-xl font-bold text-white">{s.value}</div>
                    <div className="text-xs text-[#8B92A5] mt-0.5">{s.label}</div>
                    <div className="text-[10px] text-[#8B92A5] mt-1">Last 30 days</div>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-white">Performance by Placement</h3>
                  <button onClick={() => refetchAnalytics()} className="flex items-center gap-1 text-[10px] text-[#8B92A5] hover:text-white">
                    <RefreshCw size={11} /> Refresh
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Placement","Impressions","Clicks","CTR","Revenue"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsLoading ? (
                      <tr><td colSpan={5} className="text-center py-8"><RefreshCw size={16} className="text-primary animate-spin mx-auto" /></td></tr>
                    ) : byPlacement.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-sm text-[#8B92A5]">No placement data yet — will appear as the mobile app logs ad events</td></tr>
                    ) : byPlacement.map(r => {
                      const impr = r._sum?.impressions ?? 0;
                      const clicks = r._sum?.clicks ?? 0;
                      const ctr = impr > 0 ? `${((clicks / impr) * 100).toFixed(2)}%` : "0.00%";
                      return (
                        <tr key={r.placement} className="border-b border-border/50 last:border-0 hover:bg-white/2">
                          <td className="px-4 py-3 text-sm font-medium text-white capitalize">{r.placement}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(impr)}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(clicks)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-primary">{ctr}</td>
                          <td className="px-4 py-3 text-sm font-bold text-white">{fmtMoney(r._sum?.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border"><h3 className="text-xs font-semibold text-white">Performance by Provider</h3></div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Provider","Impressions","Clicks","Revenue"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.byProvider ?? []).length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-sm text-[#8B92A5]">No provider data yet</td></tr>
                    ) : (analytics?.byProvider ?? []).map(r => {
                      const prov = providers.find(p => p.id === r.providerId);
                      return (
                        <tr key={r.providerId} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 text-sm font-medium text-white">{prov?.name ?? r.providerId}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(r._sum?.impressions)}</td>
                          <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtNum(r._sum?.clicks)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-white">{fmtMoney(r._sum?.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── DOCS ── */}
          {tab === "docs" && <DocsTab />}

        </div>

        {/* ── PROVIDER CONFIG SLIDE PANEL ── */}
        {editingProvider && (
          <div className="w-[360px] shrink-0 border-l border-border bg-card overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const meta = PROVIDER_META[editingProvider.slug] ?? PROVIDER_META.custom;
                  return (
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br", meta.color)}>
                      {meta.icon}
                    </div>
                  );
                })()}
                <div>
                  <h2 className="text-sm font-bold text-white leading-none">{editingProvider.name}</h2>
                  <span className="text-[10px] text-[#8B92A5] font-mono">{editingProvider.slug}</span>
                </div>
              </div>
              <button onClick={() => setEditingProvider(null)} className="text-[#8B92A5] hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {editingProvider.isSelected && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-primary/20 text-primary font-bold">● Currently Active Runtime Provider</span>
                )}
                <span className={cn("text-[10px] px-2 py-1 rounded-full font-semibold", editForm.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                  {editForm.isActive ? "Enabled" : "Disabled"}
                </span>
                <span className={cn("text-[10px] px-2 py-1 rounded-full font-semibold", editForm.isTestMode ? "bg-yellow-500/15 text-yellow-400" : "bg-emerald-500/15 text-emerald-400")}>
                  {editForm.isTestMode ? "🧪 Test Mode" : "🟢 Production"}
                </span>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Enable Provider</p>
                    <p className="text-[10px] text-[#8B92A5]">Allow this provider to serve ads</p>
                  </div>
                  <Toggle on={editForm.isActive ?? true} onChange={v => setEditForm(p => ({ ...p, isActive: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Test Mode</p>
                    <p className="text-[10px] text-[#8B92A5]">Show test ads (no real revenue)</p>
                  </div>
                  <Toggle on={editForm.isTestMode ?? true} onChange={v => setEditForm(p => ({ ...p, isTestMode: v }))} />
                </div>
              </div>

              <hr className="border-border" />

              {/* App ID + API Key */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#8B92A5] mb-1.5 block">App ID</label>
                  <input
                    type="text"
                    value={editForm.appId ?? ""}
                    onChange={e => setEditForm(p => ({ ...p, appId: e.target.value }))}
                    placeholder={editingProvider.slug === "admob" ? "ca-app-pub-XXXXXXXX" : "Your App ID"}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]/50 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8B92A5] mb-1.5 block">API Key / SDK Key <span className="text-[#8B92A5]/50">(optional)</span></label>
                  <input
                    type="password"
                    value={editForm.apiKey ?? ""}
                    onChange={e => setEditForm(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]/50"
                  />
                </div>
              </div>

              <hr className="border-border" />

              {/* Ad Unit IDs */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-white">Ad Unit IDs</h3>
                {AD_UNIT_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-[11px] text-[#8B92A5] mb-1 block">{f.label}</label>
                    <input
                      type="text"
                      value={(editForm[f.key] as string) ?? ""}
                      onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary placeholder:text-[#8B92A5]/50 font-mono"
                    />
                  </div>
                ))}
              </div>

              <hr className="border-border" />

              {/* Supported types info */}
              <div>
                <p className="text-[11px] text-[#8B92A5] mb-2">Supported Ad Types</p>
                <div className="flex flex-wrap gap-1">
                  {(PROVIDER_META[editingProvider.slug] ?? PROVIDER_META.custom).supportedTypes.map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#8B92A5] border border-white/5">{t}</span>
                  ))}
                </div>
              </div>

              <hr className="border-border" />

              {/* Action buttons */}
              <div className="space-y-2.5 pb-4">
                <button
                  onClick={handleSaveProvider}
                  disabled={providerSaving || mutating}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50",
                    providerSaved ? "bg-green-600 text-white" : "bg-primary text-white hover:opacity-90"
                  )}
                >
                  {providerSaving ? <RefreshCw size={14} className="animate-spin" /> : providerSaved ? <Check size={14} /> : <Save size={14} />}
                  {providerSaving ? "Saving…" : providerSaved ? "Saved!" : "Save Configuration"}
                </button>

                {!editingProvider.isSelected && (
                  <button
                    onClick={() => handleActivateProvider(editingProvider.id)}
                    disabled={mutating || !editForm.isActive}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border border-primary text-primary hover:bg-primary/10 transition-all disabled:opacity-40"
                  >
                    <Zap size={14} /> Set as Active Runtime Provider
                  </button>
                )}
                {editingProvider.isSelected && (
                  <div className="text-center text-[11px] text-primary/70 py-1">
                    ✓ This is the currently active provider — mobile app is using it
                  </div>
                )}
                <p className="text-[10px] text-[#8B92A5] text-center">
                  Only one provider can be active at runtime. Switching takes effect on the next app launch.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADD PLACEMENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{editPlacement ? "Edit Placement" : "Add Ad Placement"}</h2>
              <button onClick={() => setShowModal(false)} className="text-[#8B92A5] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Placement Name</label>
                <input ref={placementNameRef} type="text" placeholder="e.g. Home Banner"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Ad Type</label>
                <select ref={placementTypeRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="banner">Banner</option>
                  <option value="interstitial">Interstitial</option>
                  <option value="rewarded">Rewarded</option>
                  <option value="native">Native</option>
                  <option value="app_open">App Open</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Screen</label>
                <select ref={placementScreenRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="home">Home</option>
                  <option value="live">Live TV</option>
                  <option value="search">Search</option>
                  <option value="channel">Channel Detail</option>
                  <option value="player">Player</option>
                  <option value="movies">Movies</option>
                  <option value="series">Series</option>
                  <option value="profile">Profile</option>
                  <option value="settings">Settings</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Show every N views (frequency)</label>
                <input ref={placementFreqRef} type="number" min={1} placeholder="e.g. 3"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              {placementError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <X size={12} className="mt-0.5 shrink-0" />
                  {placementError}
                </div>
              )}
              <button onClick={handleSavePlacement} disabled={mutating}
                className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {mutating ? (editPlacement ? "Saving…" : "Adding…") : (editPlacement ? "Save Changes" : "Add Placement")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DocSection({ icon: Icon, title, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Icon size={15} className="text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="text-[12px] text-[#8B92A5] leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-[10px] bg-black/40 text-primary/90 px-1.5 py-0.5 rounded font-mono">{children}</code>;
}

function DocsTab() {
  return (
    <div className="max-w-3xl space-y-4 pb-8">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen size={20} className="text-primary" />
        <h2 className="text-base font-bold text-white">Ad System Documentation</h2>
      </div>

      <DocSection icon={Eye} title="1 — Supported Ad Types">
        <p>StreamPro supports five industry-standard ad formats, each with different use cases:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {[
            { type: "Banner",        desc: "Persistent strip (320×50 or 300×250) pinned at the top or bottom of a screen" },
            { type: "Interstitial",  desc: "Full-screen takeover shown between natural content transitions" },
            { type: "Rewarded",      desc: "Opt-in video — user watches in exchange for in-app benefit (e.g. unlock content)" },
            { type: "Native",        desc: "Blends into the content feed (e.g. sponsored channel card in the grid)" },
            { type: "App Open",      desc: "Full-screen ad shown when the user cold-launches or foregrounds the app" },
          ].map(a => (
            <div key={a.type} className="bg-black/20 rounded-lg p-3 border border-white/5">
              <div className="text-white font-semibold text-xs mb-1">{a.type}</div>
              <div className="text-[11px]">{a.desc}</div>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection icon={Activity} title="2 — Ad Placement Per Screen">
        <p>Each placement is a named slot defined in the admin Placements tab and stored in the database. The mobile app reads them at launch. Current default mapping:</p>
        <div className="space-y-1.5 mt-2">
          {[
            { screen: "App Launch",     types: ["App Open"]                  },
            { screen: "Home",           types: ["Banner (bottom)","Native card every 3rd row"] },
            { screen: "Live TV",        types: ["Banner (top)","Interstitial on channel switch"] },
            { screen: "Search",         types: ["Banner (bottom)"]            },
            { screen: "Channel Detail", types: ["Banner","Interstitial on play"] },
            { screen: "Player",         types: ["Pre-roll Interstitial"]      },
            { screen: "Movies / Series",types: ["Banner","Interstitial on back"] },
            { screen: "Profile",        types: ["Banner (bottom)"]            },
          ].map(r => (
            <div key={r.screen} className="flex items-start gap-3 text-[11px]">
              <span className="text-white font-medium w-36 shrink-0">{r.screen}</span>
              <span>{r.types.join(" · ")}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-yellow-400/80">Add or remove placements at any time from the Placements tab — no app update needed.</p>
      </DocSection>

      <DocSection icon={Clock} title="3 — When Each Ad Is Shown">
        <div className="space-y-2">
          <p><strong className="text-white">App Open:</strong> Fires once per cold-launch or foregrounding (after a minimum interval). Loaded in the background by <Code>adManager.initialize()</Code>.</p>
          <p><strong className="text-white">Interstitial:</strong> Triggered automatically inside <Code>adManager.onScreenView()</Code> — called on every screen navigation. Shows only when the screen count has reached <em>interstitialEveryNScreens</em> AND the cooldown has elapsed. Also fires explicitly in the player before content starts.</p>
          <p><strong className="text-white">Banner:</strong> Rendered by the <Code>{"<AdBanner>"}</Code> component whenever the current placement is enabled. Always visible while on a screen that includes a banner placement.</p>
          <p><strong className="text-white">Rewarded:</strong> Only fires when the user explicitly taps the <Code>{"<AdRewardedButton>"}</Code>. The button is hidden while in cooldown or when the session cap is reached.</p>
          <p><strong className="text-white">Native:</strong> Injected into content lists at a configurable index (e.g. every 3rd item). Skipped if the user is premium.</p>
        </div>
      </DocSection>

      <DocSection icon={ToggleLeft} title="4 — Frequency & Cooldown Control">
        <p>All frequency rules live in the <strong className="text-white">Freq. Cap</strong> tab and are persisted in the <Code>AdSetting</Code> database table (key = <Code>global</Code>). They are delivered to the mobile app inside the remote config response.</p>
        <div className="space-y-1.5 mt-2">
          {[
            { field: "maxAdsPerSession",          effect: "Hard cap on total ads per app session" },
            { field: "maxAdsPerDay",              effect: "Hard cap per calendar day (reset at midnight)" },
            { field: "minIntervalSeconds",        effect: "Minimum gap between any two ads" },
            { field: "interstitialEveryNScreens", effect: "Screen counter before next interstitial fires" },
            { field: "interstitialEveryNMinutes", effect: "Clock cooldown between interstitials" },
            { field: "rewardedCooldownSeconds",   effect: "Hide rewarded button while in cooldown" },
          ].map(r => (
            <div key={r.field} className="flex items-start gap-2 text-[11px]">
              <Code>{r.field}</Code>
              <span className="pt-0.5">{r.effect}</span>
            </div>
          ))}
        </div>
        <p className="mt-2">These are enforced <strong className="text-white">client-side</strong> by <Code>AdManager</Code>. Server-side enforcement is not possible since the provider SDK controls the final display.</p>
      </DocSection>

      <DocSection icon={Shield} title="5 — Premium Users See No Ads">
        <p>Before rendering any ad, <Code>adService.ts</Code> calls <Code>isPremiumUser()</Code> which checks the local auth store for <Code>user.isPremium === true</Code>.</p>
        <p>If true, <Code>adManager.isEnabled</Code> returns <Code>false</Code> and every ad component renders nothing. The banner component checks this on mount; interstitials and rewarded ads are gated in <Code>canShowInterstitial()</Code>.</p>
        <p>The premium flag is set server-side when a subscription payment is verified (<Code>subscriptions/verifyAndActivate</Code>) and included in every <Code>/v1/auth/me</Code> response.</p>
      </DocSection>

      <DocSection icon={Wifi} title="6 — Remote Enable / Disable Per Placement">
        <p>Every placement row in the <strong className="text-white">Placements</strong> tab has an on/off toggle. Flipping it saves <Code>isEnabled: false</Code> to the <Code>AdPlacement</Code> database record.</p>
        <p>The mobile app calls <Code>{"/v1/ads/config"}</Code> on every launch and periodically in the background. The response includes a <Code>placements</Code> map:</p>
        <pre className="bg-black/40 rounded-lg p-3 text-[10px] font-mono text-white/80 overflow-x-auto mt-1">{`{
  "home_banner":      { "enabled": true,  "type": "banner" },
  "player_preroll":   { "enabled": false, "type": "interstitial" }
}`}</pre>
        <p>Disabled placements render nothing in the app without any code change or store update.</p>
      </DocSection>

      <DocSection icon={RefreshCw} title="7 — Switching Providers Without an App Update">
        <p>Go to <strong className="text-white">Providers → Configure a provider → Set as Active Runtime Provider</strong>. This calls <Code>POST /v1/advertisements/providers/:id/activate</Code> which:</p>
        <div className="space-y-1.5 mt-1">
          <p>1. Sets <Code>isSelected = false</Code> on all providers</p>
          <p>2. Sets <Code>isSelected = true</Code> on the chosen provider</p>
          <p>3. Stores the <Code>activeProviderId</Code> in the global <Code>AdSetting</Code> record</p>
        </div>
        <p className="mt-2">Next time the mobile app fetches <Code>/v1/ads/config</Code>, it receives the new provider's slug, App ID, and all ad unit IDs. <Code>AdManager.initialize()</Code> looks up the slug in <Code>PROVIDER_MAP</Code> and initialises the correct SDK. The switch is completely transparent to the user.</p>
        <p className="text-yellow-400/80">⚠ The SDK itself must be linked in the EAS build for this to work. The provider list in the admin shows all configured providers; only providers whose SDK package is installed will actually display real ads.</p>
      </DocSection>

      <DocSection icon={BarChart2} title="8 — Impression, Click & Revenue Tracking">
        <p>The mobile app posts events to <Code>POST /v1/ads/:type</Code> (where type is <Code>impression</Code>, <Code>click</Code>, <Code>error</Code>, or <Code>revenue</Code>).</p>
        <div className="space-y-1.5 mt-2">
          <p><strong className="text-white">Impression</strong> — fired by <Code>adManager.trackEvent('impression', ...)</Code> after a successful <Code>show*()</Code> call. Stored in <Code>AdEvent</Code> table.</p>
          <p><strong className="text-white">Click</strong> — provider SDKs emit a click callback; <Code>adManager</Code> calls <Code>trackEvent('click', ...)</Code> in response.</p>
          <p><strong className="text-white">Revenue</strong> — rewarded ad callbacks return a <Code>RewardItem</Code>; <Code>adManager.trackRevenue()</Code> posts to <Code>/v1/ads/revenue</Code>. Aggregated daily into the <Code>AdRevenue</Code> table, broken down by date / provider / placement / country / device.</p>
        </div>
        <p className="mt-2">Analytics are displayed in the <strong className="text-white">Analytics</strong> tab above and aggregated by the backend across the last 30 days by default.</p>
      </DocSection>

      <DocSection icon={Database} title="9 — Database Schema & API Exposure">
        <p>Five tables back the ad system:</p>
        <div className="space-y-2 mt-2">
          {[
            { table: "ad_providers",   desc: "One row per network. Stores slug, App ID, all five ad unit IDs, isActive, isSelected, isTestMode, apiKey" },
            { table: "ad_settings",    desc: "Single row (key='global'). Stores all frequency caps, activeProviderId, adsEnabled, maintenanceMode" },
            { table: "ad_placements",  desc: "One row per placement slot. Stores name, slug, type, screen, isEnabled, frequency, cooldownSeconds" },
            { table: "ad_events",      desc: "Append-only event log. One row per impression/click/error/revenue event with provider, placement, country, device" },
            { table: "ad_revenue",     desc: "Aggregated daily revenue. Unique on (date, providerId, placement, country, device, os)" },
          ].map(r => (
            <div key={r.table} className="flex items-start gap-2 text-[11px]">
              <Code>{r.table}</Code>
              <span className="pt-0.5">{r.desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-3">The mobile-facing config endpoint is <Code>GET /v1/ads/config</Code> — public, no auth required. It returns the active provider credentials, all enabled placements, and all frequency cap settings in a single response, cached for performance.</p>
        <p>All admin management endpoints live under <Code>/v1/advertisements/</Code> and require <Code>admin</Code> or <Code>super_admin</Code> role.</p>
      </DocSection>
    </div>
  );
}
