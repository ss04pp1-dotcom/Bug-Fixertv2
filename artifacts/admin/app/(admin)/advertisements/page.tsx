"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart2, TrendingUp, DollarSign, Eye, RefreshCw, Plus,
  Zap, Check, Tv, Link2, Play, Code2, ExternalLink, Search,
  ChevronRight, Shield, Wifi, BookOpen, Trash2, Save,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "overview" | "channel-ads" | "house-ads" | "analytics";

interface Channel {
  id: string;
  name: string;
  logoUrl?: string;
  logo?: string;
  isSmartlinkEnabled?: boolean;
  smartlinkUrl?: string;
  vastUrl?: string;
  bannerHtmlCode?: string;
  category?: { name: string } | string;
  isActive?: boolean;
}

interface ChannelsResponse {
  data?: Channel[];
  items?: Channel[];
}

interface AdAnalytics {
  summary: { totalImpressions: number; totalClicks: number; ctr: string; totalRevenue: number; ecpm: string };
  byPlacement: { placement: string; _sum: { revenue: number; impressions: number; clicks: number } }[];
}

interface HouseAd {
  id: string; title: string; type?: string; isActive?: boolean;
  imageUrl?: string; targetUrl?: string; createdAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n?: number) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtMoney(dollars?: number) {
  if (!dollars) return "$0";
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function getCatName(cat?: Channel["category"]): string {
  if (!cat) return "—";
  if (typeof cat === "string") return cat;
  return cat.name ?? "—";
}

// ─── AdTypeBadge ─────────────────────────────────────────────────────────────

function AdTypeBadge({ active, icon: Icon, label, color }: {
  active: boolean; icon: React.ElementType; label: string; color: string;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
      active ? color : "border-white/8 text-white/25 bg-transparent",
    )}>
      <Icon size={9} />
      {label}
    </span>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

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

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, gradient, loading }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string; loading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br", gradient)}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="text-xl font-bold text-white">{loading ? "…" : value}</div>
      <div className="text-xs text-[#8B92A5] mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-[#8B92A5] mt-1">{sub}</div>}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Advertisements() {
  const [tab, setTab]           = useState<Tab>("overview");
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "smartlink" | "vast" | "banner" | "none">("all");

  // House ad quick-create
  const [quickForm, setQuickForm]   = useState({ title: "", imageUrl: "", targetUrl: "", type: "interstitial" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickResult, setQuickResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Analytics seed/reset
  const [seedLoading, setSeedLoading]   = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [seedResult, setSeedResult]     = useState<string | null>(null);

  const { call, loading: mutating } = useApiCallState();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: channelsRaw, isLoading: chLoading, refetch: refetchCh } =
    useApi<Channel[] | ChannelsResponse>("/v1/channels?limit=500&isActive=true");

  const { data: houseAdsRaw, isLoading: houseLoading, refetch: refetchHouse } =
    useApi<HouseAd[] | { data?: HouseAd[] }>("/v1/advertisements");

  const { data: analytics, isLoading: analyticsLoading, refetch: refetchAnalytics } =
    useApi<AdAnalytics>("/v1/advertisements/analytics");

  // Normalise channels
  const channels: Channel[] = (() => {
    if (!channelsRaw) return [];
    if (Array.isArray(channelsRaw)) return channelsRaw;
    const r = channelsRaw as ChannelsResponse;
    return r.data ?? r.items ?? [];
  })();

  // Normalise house ads
  const houseAds: HouseAd[] = (() => {
    if (!houseAdsRaw) return [];
    if (Array.isArray(houseAdsRaw)) return houseAdsRaw;
    return (houseAdsRaw as { data?: HouseAd[] }).data ?? [];
  })();

  const summary    = analytics?.summary;
  const byPlacement = analytics?.byPlacement ?? [];
  const barMax = byPlacement.length ? Math.max(...byPlacement.map(p => p._sum?.revenue ?? 0), 1) : 1;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const total          = channels.length;
  const withSmartlink  = channels.filter(c => c.isSmartlinkEnabled).length;
  const withVast       = channels.filter(c => !!c.vastUrl).length;
  const withBanner     = channels.filter(c => !!c.bannerHtmlCode).length;
  const withAny        = channels.filter(c => c.isSmartlinkEnabled || !!c.vastUrl || !!c.bannerHtmlCode).length;
  const withNone       = total - withAny;

  // ── Filtered channel list ──────────────────────────────────────────────────
  const filtered = channels.filter(c => {
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (filter === "smartlink") return c.isSmartlinkEnabled;
    if (filter === "vast")      return !!c.vastUrl;
    if (filter === "banner")    return !!c.bannerHtmlCode;
    if (filter === "none")      return !c.isSmartlinkEnabled && !c.vastUrl && !c.bannerHtmlCode;
    return true;
  });

  // ── House ad actions ───────────────────────────────────────────────────────
  const handleQuickSave = async () => {
    if (!quickForm.title.trim()) { setQuickResult({ ok: false, msg: "Title is required" }); return; }
    setQuickSaving(true); setQuickResult(null);
    try {
      await call("post", "/v1/advertisements", {
        title: quickForm.title.trim(),
        imageUrl: quickForm.imageUrl.trim() || undefined,
        targetUrl: quickForm.targetUrl.trim() || undefined,
        type: quickForm.type,
        isActive: true,
      });
      setQuickResult({ ok: true, msg: "House ad created ✓" });
      setQuickForm({ title: "", imageUrl: "", targetUrl: "", type: "interstitial" });
      refetchHouse();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? "Failed";
      setQuickResult({ ok: false, msg: Array.isArray(msg) ? msg.join(", ") : String(msg) });
    } finally { setQuickSaving(false); }
  };

  const handleToggleHouseAd = async (id: string, isActive: boolean) => {
    await call("put", `/v1/advertisements/${id}`, { isActive: !isActive });
    refetchHouse();
  };

  const handleDeleteHouseAd = async (id: string) => {
    if (!confirm("Delete this house ad?")) return;
    await call("delete", `/v1/advertisements/${id}`);
    refetchHouse();
  };

  // ── Analytics actions ──────────────────────────────────────────────────────
  const handleSeedDemo = async () => {
    setSeedLoading(true); setSeedResult(null);
    const res = await call("post", "/v1/advertisements/analytics/seed-demo", {});
    setSeedLoading(false);
    if (res && typeof res === "object") {
      const r = res as { revenueRowsInserted?: number; eventRowsInserted?: number; daysSeeded?: number };
      setSeedResult(`✓ Seeded ${(r.revenueRowsInserted ?? 0).toLocaleString()} revenue rows + ${(r.eventRowsInserted ?? 0).toLocaleString()} events across ${r.daysSeeded ?? 0} days`);
    }
    refetchAnalytics();
  };

  const handleResetAnalytics = async () => {
    if (!confirm("Permanently delete ALL analytics data? This cannot be undone.")) return;
    setResetLoading(true); setSeedResult(null);
    const res = await call("delete", "/v1/advertisements/analytics/reset");
    setResetLoading(false);
    if (res && typeof res === "object") {
      const r = res as { deletedEvents?: number };
      setSeedResult(`🗑 Reset — deleted ${(r.deletedEvents ?? 0).toLocaleString()} events`);
    }
    refetchAnalytics();
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",    label: "Overview"     },
    { id: "channel-ads", label: "Channel Ads"  },
    { id: "house-ads",   label: "House Ads"    },
    { id: "analytics",   label: "Analytics"    },
  ];

  return (
    <>
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-white">Ad Monetization</h1>
          {(chLoading || analyticsLoading) && <RefreshCw size={12} className="text-[#8B92A5] animate-spin" />}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-semibold border border-violet-500/20">
            SDK-Free · Per-Channel
          </span>
        </div>
        <button
          onClick={() => { refetchCh(); refetchAnalytics(); refetchHouse(); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white hover:bg-white/5"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            {/* How it works */}
            <div className="bg-gradient-to-r from-violet-900/30 to-fuchsia-900/20 border border-violet-500/20 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={15} className="text-violet-400" />
                <h3 className="text-sm font-semibold text-white">SDK-Free · Per-Channel Ad System</h3>
              </div>
              <p className="text-[12px] text-[#8B92A5] leading-relaxed mb-4">
                Each channel can have up to 3 ad types configured independently — no native SDK, no app store re-review required.
                All ads are rendered via WebView and controlled from this panel.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Link2,  color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", title: "Smartlink Gate",  desc: "Opens a Smartlink URL in-app before the channel loads. Great for CPA/CPC affiliate traffic." },
                  { icon: Play,   color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       title: "VAST Pre-Roll",   desc: "Plays a standard VAST video ad before the stream starts. Skip button appears after your configured delay." },
                  { icon: Code2,  color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20",     title: "HTML Banner",     desc: "Injects an HTML banner (300×90 or custom) below the player. Paste any ad tag or custom HTML." },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className={cn("rounded-lg border p-3", item.bg)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon size={13} className={item.color} />
                        <span className="text-xs font-semibold text-white">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-[#8B92A5] leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coverage stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Channels with Ads" value={withAny} sub={`of ${total} total channels`} icon={Tv} gradient="from-violet-600 to-violet-800" loading={chLoading} />
              <StatCard label="Smartlink Gates"   value={withSmartlink} sub="channels"               icon={Link2} gradient="from-emerald-600 to-emerald-800" loading={chLoading} />
              <StatCard label="VAST Pre-Rolls"    value={withVast}      sub="channels"               icon={Play} gradient="from-blue-600 to-blue-800" loading={chLoading} />
              <StatCard label="HTML Banners"      value={withBanner}    sub="channels"               icon={Code2} gradient="from-amber-600 to-amber-800" loading={chLoading} />
            </div>

            {/* Coverage breakdown */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Channel Ad Coverage</h3>
              <div className="space-y-3">
                {[
                  { label: "No ads configured",    count: withNone,       total, color: "bg-white/10" },
                  { label: "Smartlink enabled",     count: withSmartlink,  total, color: "bg-emerald-500" },
                  { label: "VAST pre-roll set",     count: withVast,       total, color: "bg-blue-500" },
                  { label: "HTML banner set",       count: withBanner,     total, color: "bg-amber-500" },
                ].map(row => {
                  const pct = total > 0 ? (row.count / total) * 100 : 0;
                  return (
                    <div key={row.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#8B92A5]">{row.label}</span>
                        <span className="text-xs font-semibold text-white">{row.count} <span className="text-[#8B92A5] font-normal">/ {row.total}</span></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#8B92A5] mt-4">
                To configure ads on a channel, go to <strong className="text-white/60">Channels → edit channel → Ad Monetization tab</strong>.
              </p>
            </div>

            {/* House Ads summary */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold text-white">House Ads</h3>
                </div>
                <button onClick={() => setTab("house-ads")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                  Manage <ChevronRight size={11} />
                </button>
              </div>
              {houseLoading ? (
                <div className="flex items-center justify-center py-6"><RefreshCw size={16} className="text-primary animate-spin" /></div>
              ) : houseAds.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#8B92A5]">No house ads yet — go to House Ads tab to create one</div>
              ) : (
                <div className="space-y-2">
                  {houseAds.slice(0, 4).map(ad => (
                    <div key={ad.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                      <div>
                        <span className="text-xs font-medium text-white">{ad.title}</span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8B92A5] capitalize">{ad.type}</span>
                      </div>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", ad.isActive ? "bg-green-500/15 text-green-400" : "bg-white/5 text-[#8B92A5]")}>
                        {ad.isActive ? "Active" : "Off"}
                      </span>
                    </div>
                  ))}
                  {houseAds.length > 4 && (
                    <p className="text-[11px] text-[#8B92A5] pt-1">+{houseAds.length - 4} more</p>
                  )}
                </div>
              )}
            </div>

            {/* How to configure */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={14} className="text-[#8B92A5]" />
                <h3 className="text-sm font-semibold text-white">Quick Setup Guide</h3>
              </div>
              <ol className="space-y-3 text-[12px] text-[#8B92A5] leading-relaxed list-decimal list-inside">
                <li>Go to <strong className="text-white/70">Channels</strong> in the sidebar and open any channel.</li>
                <li>Click the <strong className="text-white/70">Ad Monetization</strong> tab inside the channel editor.</li>
                <li>Enable <strong className="text-white/70">Smartlink</strong> and paste your affiliate Smartlink URL — users will land here before the stream starts.</li>
                <li>Paste a <strong className="text-white/70">VAST Tag URL</strong> (from any SSP / ad network) to play a pre-roll video ad.</li>
                <li>Paste raw <strong className="text-white/70">Banner HTML</strong> (any ad tag, iframe, or custom HTML) to show a banner below the player.</li>
                <li>Save the channel — changes take effect immediately on next stream load.</li>
              </ol>
            </div>
          </>
        )}

        {/* ── CHANNEL ADS ───────────────────────────────────────────────────── */}
        {tab === "channel-ads" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 flex-1 min-w-[180px] max-w-xs">
                <Search size={13} className="text-[#8B92A5] shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search channels…"
                  className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none w-full"
                />
              </div>
              <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                {(["all", "smartlink", "vast", "banner", "none"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors capitalize",
                      filter === f ? "bg-primary text-white" : "text-[#8B92A5] hover:text-white"
                    )}>
                    {f === "none" ? "No Ads" : f === "all" ? "All" : f === "smartlink" ? "Smartlink" : f === "vast" ? "VAST" : "Banner"}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#8B92A5]">{filtered.length} channels</span>
            </div>

            {chLoading ? (
              <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Channel", "Category", "Smartlink", "VAST Pre-Roll", "HTML Banner", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-sm text-[#8B92A5]">
                          No channels match your filter
                        </td>
                      </tr>
                    ) : filtered.map(ch => {
                      const hasAny = ch.isSmartlinkEnabled || !!ch.vastUrl || !!ch.bannerHtmlCode;
                      return (
                        <tr key={ch.id} className={cn("border-b border-border/50 last:border-0 hover:bg-white/2", !hasAny && "opacity-60")}>
                          {/* Channel */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {ch.logoUrl || ch.logo ? (
                                <img
                                  src={ch.logoUrl ?? ch.logo}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-white border border-white/10"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-700 flex items-center justify-center">
                                  <Tv size={12} className="text-white" />
                                </div>
                              )}
                              <span className="text-sm font-medium text-white truncate max-w-[140px]">{ch.name}</span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3 text-xs text-[#8B92A5]">{getCatName(ch.category)}</td>

                          {/* Smartlink */}
                          <td className="px-4 py-3">
                            {ch.isSmartlinkEnabled && ch.smartlinkUrl ? (
                              <div className="flex flex-col gap-0.5">
                                <AdTypeBadge active icon={Link2} label="Enabled"
                                  color="border-emerald-500/30 text-emerald-400 bg-emerald-500/10" />
                                <span className="text-[9px] text-[#8B92A5] font-mono truncate max-w-[120px]">
                                  {ch.smartlinkUrl.replace(/^https?:\/\//, "").slice(0, 24)}…
                                </span>
                              </div>
                            ) : (
                              <AdTypeBadge active={false} icon={Link2} label="Off"
                                color="border-emerald-500/30 text-emerald-400 bg-emerald-500/10" />
                            )}
                          </td>

                          {/* VAST */}
                          <td className="px-4 py-3">
                            {ch.vastUrl ? (
                              <div className="flex flex-col gap-0.5">
                                <AdTypeBadge active icon={Play} label="Configured"
                                  color="border-blue-500/30 text-blue-400 bg-blue-500/10" />
                                <span className="text-[9px] text-[#8B92A5] font-mono truncate max-w-[120px]">
                                  {ch.vastUrl.replace(/^https?:\/\//, "").slice(0, 24)}…
                                </span>
                              </div>
                            ) : (
                              <AdTypeBadge active={false} icon={Play} label="None"
                                color="border-blue-500/30 text-blue-400 bg-blue-500/10" />
                            )}
                          </td>

                          {/* Banner */}
                          <td className="px-4 py-3">
                            {ch.bannerHtmlCode ? (
                              <AdTypeBadge active icon={Code2} label={`${ch.bannerHtmlCode.length} chars`}
                                color="border-amber-500/30 text-amber-400 bg-amber-500/10" />
                            ) : (
                              <AdTypeBadge active={false} icon={Code2} label="None"
                                color="border-amber-500/30 text-amber-400 bg-amber-500/10" />
                            )}
                          </td>

                          {/* Edit link */}
                          <td className="px-4 py-3">
                            <a
                              href={`/channels?edit=${ch.id}&tab=ads`}
                              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              Edit <ChevronRight size={11} />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── HOUSE ADS ─────────────────────────────────────────────────────── */}
        {tab === "house-ads" && (
          <>
            {/* Quick create */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-primary" />
                <h3 className="text-sm font-semibold text-white">Quick Create House Ad</h3>
              </div>
              <p className="text-[11px] text-[#8B92A5] mb-4">
                House ads show in the app to all users on the placement you choose. No external ad network needed.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Title *</label>
                  <input
                    type="text"
                    value={quickForm.title}
                    onChange={e => setQuickForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Upgrade to Premium"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5]/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Type</label>
                  <select
                    value={quickForm.type}
                    onChange={e => setQuickForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary"
                  >
                    <option value="interstitial">Interstitial — full-screen</option>
                    <option value="banner">Banner — strip at bottom</option>
                    <option value="rewarded">Rewarded — user watches to unlock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Image URL (optional)</label>
                  <input
                    type="url"
                    value={quickForm.imageUrl}
                    onChange={e => setQuickForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://… (jpg, png, webp)"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5]/60 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[#8B92A5] mb-1 uppercase tracking-wide">Destination URL (optional)</label>
                  <input
                    type="url"
                    value={quickForm.targetUrl}
                    onChange={e => setQuickForm(f => ({ ...f, targetUrl: e.target.value }))}
                    placeholder="https://… (where tapping the ad goes)"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#8B92A5]/60 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleQuickSave}
                  disabled={quickSaving || !quickForm.title.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {quickSaving ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  Create & Activate
                </button>
                {quickResult && (
                  <span className={cn("text-xs font-medium", quickResult.ok ? "text-emerald-400" : "text-red-400")}>
                    {quickResult.msg}
                  </span>
                )}
              </div>
            </div>

            {/* House ads list */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-white">All House Ads</h3>
              </div>
              {houseLoading ? (
                <div className="flex items-center justify-center py-10"><RefreshCw size={16} className="text-primary animate-spin" /></div>
              ) : houseAds.length === 0 ? (
                <div className="text-center py-10 text-sm text-[#8B92A5]">No house ads yet — create one above</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Title","Type","Status","Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {houseAds.map(ad => (
                      <tr key={ad.id} className="border-b border-border/50 last:border-0 hover:bg-white/2">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-white">{ad.title}</div>
                          {ad.targetUrl && (
                            <a href={ad.targetUrl} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] text-[#8B92A5] hover:text-primary mt-0.5">
                              <ExternalLink size={9} />
                              {ad.targetUrl.length > 40 ? ad.targetUrl.slice(0, 40) + "…" : ad.targetUrl}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 capitalize">{ad.type ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Toggle
                            on={ad.isActive ?? false}
                            onChange={() => handleToggleHouseAd(ad.id, ad.isActive ?? false)}
                            disabled={mutating}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteHouseAd(ad.id)}
                            disabled={mutating}
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── ANALYTICS ─────────────────────────────────────────────────────── */}
        {tab === "analytics" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleSeedDemo}
                disabled={seedLoading || resetLoading || mutating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {seedLoading ? <><RefreshCw size={13} className="animate-spin" /> Seeding…</> : <><Zap size={13} /> Seed 30-Day Demo Data</>}
              </button>
              <button
                onClick={handleResetAnalytics}
                disabled={seedLoading || resetLoading || mutating}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold hover:bg-red-500/10 disabled:opacity-50"
              >
                {resetLoading ? <><RefreshCw size={13} className="animate-spin" /> Resetting…</> : <><Trash2 size={13} /> Reset All Data</>}
              </button>
              {seedResult && (
                <span className={cn("text-xs px-3 py-2 rounded-lg border",
                  seedResult.startsWith("✓")
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                )}>
                  {seedResult}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Impressions",  value: fmtNum(summary?.totalImpressions), icon: Eye,        gradient: "from-blue-600 to-blue-800"     },
                { label: "Total Clicks",       value: fmtNum(summary?.totalClicks),       icon: TrendingUp, gradient: "from-emerald-600 to-emerald-800" },
                { label: "Click-Through Rate", value: summary?.ctr ?? "0.00%",            icon: BarChart2,  gradient: "from-violet-600 to-violet-800"  },
                { label: "House Ad Revenue",   value: fmtMoney(summary?.totalRevenue),    icon: DollarSign, gradient: "from-orange-600 to-orange-800"  },
              ].map(s => <StatCard key={s.label} {...s} loading={analyticsLoading} sub="Last 30 days" />)}
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">Performance by Placement</h3>
                <button onClick={() => refetchAnalytics()} className="flex items-center gap-1 text-[10px] text-[#8B92A5] hover:text-white">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {/* Bar chart */}
              {byPlacement.length > 0 && (
                <div className="p-4">
                  <div className="flex items-end gap-3 h-28">
                    {byPlacement.slice(0, 8).map(d => {
                      const rev = d._sum?.revenue ?? 0;
                      const pct = barMax > 0 ? (rev / barMax) * 100 : 0;
                      return (
                        <div key={d.placement} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] text-[#8B92A5]">{fmtMoney(rev)}</span>
                          <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[9px] text-[#8B92A5] truncate w-full text-center">{d.placement}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                    <tr><td colSpan={5} className="text-center py-10 text-sm text-[#8B92A5]">No data yet — appears as the mobile app logs events</td></tr>
                  ) : byPlacement.map(r => {
                    const impr  = r._sum?.impressions ?? 0;
                    const clicks = r._sum?.clicks ?? 0;
                    const ctr   = impr > 0 ? `${((clicks / impr) * 100).toFixed(2)}%` : "0.00%";
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
          </>
        )}

      </div>
    </>
  );
}
