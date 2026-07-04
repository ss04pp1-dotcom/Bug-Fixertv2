"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/axios-client";
import { toast } from "sonner";
import {
  Link2, Play, Image as ImageIcon, BarChart2, Megaphone,
  Settings, Zap, RefreshCw, Save, Plus, Trash2,
  ToggleLeft, ToggleRight, Eye, MousePointer, DollarSign,
  Tv, Home, Film, Search, Layers, Trophy,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SmartlinkConfig {
  enabled: boolean; url: string; frequency: number;
  delaySeconds: number; cooldownMinutes: number;
}
interface VastConfig {
  enabled: boolean; url: string; skipAfterSeconds: number;
  frequency: number; timeoutSeconds: number;
}
interface BannerPositions {
  home: boolean; player: boolean; playerPosition: string;
  categories: boolean; movies: boolean; sports: boolean;
  search: boolean; channelGrid: boolean; channelGridFrequency: number;
}
interface BannerConfig {
  enabled: boolean; htmlCode: string; height: number;
  heights: Partial<Record<string, number>>;
  htmlCodes: Partial<Record<string, string>>;
  vastUrlsByPosition: Partial<Record<string, string[]>>;
  positions: BannerPositions;
}
interface GlobalAdConfig {
  isEnabled: boolean; testMode: boolean;
  smartlink: SmartlinkConfig; vast: VastConfig; banner: BannerConfig;
}
interface HouseAd {
  id: string; title: string; type?: string; isActive?: boolean;
  imageUrl?: string; targetUrl?: string; htmlCode?: string;
}

// ─── Default config ───────────────────────────────────────────────────────────

const DEFAULT: GlobalAdConfig = {
  isEnabled: true,
  testMode: false,
  smartlink: { enabled: false, url: '', frequency: 3, delaySeconds: 0, cooldownMinutes: 30 },
  vast:      { enabled: false, url: '', skipAfterSeconds: 5, frequency: 3, timeoutSeconds: 10 },
  banner: {
    enabled: false, htmlCode: '', height: 90, heights: {}, htmlCodes: {}, vastUrlsByPosition: {},
    positions: {
      home: true, player: true, playerPosition: 'below',
      categories: false, movies: true, sports: false,
      search: false, channelGrid: false, channelGridFrequency: 6,
    },
  },
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex-shrink-0">
      {on
        ? <ToggleRight size={26} className="text-primary" />
        : <ToggleLeft  size={26} className="text-white/25" />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/45 uppercase tracking-wide mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-white/25 mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", mono }: {
  value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  // For number inputs keep a local string so the user can clear the field
  // before typing a new value. Without this, Number("") === 0 fires immediately
  // and the field snaps back to "0" before the user can enter anything.
  //
  // lastExternal stores the string form of the last value that came from the
  // parent (via props). We compare String-to-String so "12" === "12" works
  // even when the parent holds the numeric 12.
  const [localVal, setLocalVal] = useState<string>(String(value ?? ""));
  const lastExternal = useRef<string>(String(value ?? ""));
  const isFocused = useRef<boolean>(false);

  // Sync incoming value only when it changes externally (e.g. after save/load).
  // While the field is focused we skip the sync so in-progress edits aren't
  // clobbered by parent rerenders (e.g. the 15s health poll on this page).
  useEffect(() => {
    const strValue = String(value ?? "");
    if (strValue !== lastExternal.current && !isFocused.current) {
      lastExternal.current = strValue;
      setLocalVal(strValue);
    }
  }, [value]);

  if (type === "number") {
    return (
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={localVal}
        onFocus={() => { isFocused.current = true; }}
        onChange={e => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          setLocalVal(raw);
          if (raw !== "") {
            lastExternal.current = raw;
            onChange(raw);
          }
        }}
        onBlur={() => {
          isFocused.current = false;
          // Commit empty → "0" only when the user leaves the field
          const committed = localVal === "" ? "0" : localVal;
          if (committed !== lastExternal.current) {
            lastExternal.current = committed;
            onChange(committed);
          }
          setLocalVal(committed);
        }}
        placeholder={placeholder}
        className={cn(
          "w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white",
          "outline-none focus:border-primary/50 transition-colors",
          mono && "font-mono text-xs",
        )}
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white",
        "outline-none focus:border-primary/50 transition-colors",
        mono && "font-mono text-xs",
      )}
    />
  );
}

function Section({ title, icon: Icon, children, accent = "bg-primary/15" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="bg-[#13131C] border border-white/8 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", accent)}>
          <Icon size={14} className="text-white/80" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-xs text-white/35 mt-0.5">{hint}</p>}
      </div>
      <Toggle on={value} onChange={onChange} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-[#13131C] border border-white/8 rounded-xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className="text-xs text-white/40 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function HealthStat({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub?: string;
}) {
  return (
    <div className="bg-[#0A0B0F] border border-white/8 rounded-lg p-3">
      <span className="text-[11px] text-white/35 uppercase tracking-wide">{label}</span>
      <p className={cn("text-lg font-bold mt-1", color)}>{Number(value).toLocaleString()}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Tab type ────────────────────────────────────────────────────────────────

type Tab = "global" | "frequency" | "banners" | "analytics" | "house-ads";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdvertisementsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("global");
  const [config, setConfig]       = useState<GlobalAdConfig>(DEFAULT);
  const [saving, setSaving]       = useState(false);
  const [houseAds, setHouseAds]   = useState<HouseAd[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [health, setHealth]       = useState<any>(null);

  // New house-ad form state
  const [newTitle,      setNewTitle]      = useState('');
  const [newType,       setNewType]       = useState('banner');
  const [newTargetUrl,  setNewTargetUrl]  = useState('');
  const [newHtml,       setNewHtml]       = useState('');
  const [creatingAd,    setCreatingAd]    = useState(false);

  // ── Shorthand updaters ────────────────────────────────────────────────────

  const setSL  = (fn: (s: SmartlinkConfig)  => SmartlinkConfig)  =>
    setConfig(c => ({ ...c, smartlink: fn(c.smartlink) }));
  const setVA  = (fn: (v: VastConfig)       => VastConfig)       =>
    setConfig(c => ({ ...c, vast:      fn(c.vast)      }));
  const setBN  = (fn: (b: BannerConfig)     => BannerConfig)     =>
    setConfig(c => ({ ...c, banner:    fn(c.banner)    }));
  const setBNP = (fn: (p: BannerPositions)  => BannerPositions)  =>
    setBN(b => ({ ...b, positions: fn(b.positions) }));

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Global ad config
    apiClient.get('/v1/ads/config').then(res => {
      const gc = res.data?.data?.globalConfig ?? res.data?.globalConfig;
      if (gc && typeof gc === 'object') {
        setConfig(prev => ({
          ...prev, ...gc,
          smartlink: { ...prev.smartlink, ...(gc.smartlink ?? {}) },
          vast:      { ...prev.vast,      ...(gc.vast      ?? {}) },
          banner: {
            ...prev.banner, ...(gc.banner ?? {}),
            heights:   { ...prev.banner.heights,   ...(gc.banner?.heights   ?? {}) },
            htmlCodes: { ...prev.banner.htmlCodes, ...(gc.banner?.htmlCodes ?? {}) },
            vastUrlsByPosition: { ...prev.banner.vastUrlsByPosition, ...(gc.banner?.vastUrlsByPosition ?? {}) },
            positions: { ...prev.banner.positions, ...(gc.banner?.positions ?? {}) },
          },
        }));
      }
    }).catch(() => {});

    // House ads
    apiClient.get('/v1/advertisements?limit=100').then(res => {
      const raw = res.data?.data?.data ?? res.data?.data ?? res.data;
      setHouseAds(Array.isArray(raw) ? raw : []);
    }).catch(() => {});

    // Analytics
    apiClient.get('/v1/advertisements/analytics').then(res => {
      setAnalytics(res.data?.data ?? res.data);
    }).catch(() => {});

    // Ad health check — polls every 15s so admins see fresh event data live
    const loadHealth = () => {
      apiClient.get('/v1/advertisements/health').then(res => {
        setHealth(res.data?.data ?? res.data);
      }).catch(() => {});
    };
    loadHealth();
    const healthInterval = setInterval(loadHealth, 15000);
    return () => clearInterval(healthInterval);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await apiClient.put('/v1/ads/global-config', config);
      toast.success('Ad configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }, [config]);

  // ── House Ads CRUD ────────────────────────────────────────────────────────

  const handleCreateAd = useCallback(async () => {
    if (!newTitle.trim()) return;
    setCreatingAd(true);
    try {
      const body: any = { title: newTitle.trim(), type: newType, isActive: true };
      if (newTargetUrl) body.targetUrl = newTargetUrl.trim();
      if (newHtml)      body.htmlCode  = newHtml.trim();
      const res = await apiClient.post('/v1/advertisements', body);
      const ad  = res.data?.data ?? res.data;
      if (ad?.id) setHouseAds(prev => [ad, ...prev]);
      setNewTitle(''); setNewTargetUrl(''); setNewHtml('');
      toast.success('House ad created');
    } catch { toast.error('Failed to create ad'); }
    finally { setCreatingAd(false); }
  }, [newTitle, newType, newTargetUrl, newHtml]);

  const handleDeleteAd = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/v1/advertisements/${id}`);
      setHouseAds(prev => prev.filter(a => a.id !== id));
    } catch { toast.error('Failed to delete'); }
  }, []);

  const handleToggleAd = useCallback(async (id: string, active: boolean) => {
    try {
      await apiClient.patch(`/v1/advertisements/${id}`, { isActive: active });
      setHouseAds(prev => prev.map(a => a.id === id ? { ...a, isActive: active } : a));
    } catch { toast.error('Failed to update'); }
  }, []);

  // ── Cycle preview values ──────────────────────────────────────────────────

  const slFreq   = Math.max(1, config.smartlink.frequency);
  const vaFreq   = Math.max(1, config.vast.frequency);
  const cycleLen = slFreq + vaFreq;

  // ── Tab config ────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'global',    label: 'Global Settings',  icon: Settings  },
    { id: 'frequency', label: 'Frequency Rules',  icon: Zap       },
    { id: 'banners',   label: 'Banner Positions', icon: Layers    },
    { id: 'analytics', label: 'Analytics',        icon: BarChart2 },
    { id: 'house-ads', label: 'House Ads',        icon: Megaphone },
  ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0A0B0F] text-white">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#0A0B0F]/95 backdrop-blur-sm border-b border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">Ad Monetization</h1>
            <p className="text-xs text-white/35 mt-0.5">
              Global Rule Engine — configure once for all channels
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Master enable */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/8">
              <span className="text-xs text-white/50">Ads Enabled</span>
              <Toggle on={config.isEnabled} onChange={v => setConfig(c => ({ ...c, isEnabled: v }))} />
            </div>
            {/* Test mode */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/8 border border-amber-400/20">
              <span className="text-xs text-amber-400">Test Mode</span>
              <Toggle on={config.testMode} onChange={v => setConfig(c => ({ ...c, testMode: v }))} />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap",
                "border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-primary text-white"
                  : "border-transparent text-white/35 hover:text-white/60",
              )}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ════ Global Settings ══════════════════════════════════════════════ */}
        {activeTab === 'global' && (
          <>
            {/* Smartlink */}
            <Section title="Smartlink Gate" icon={Link2} accent="bg-blue-500/15">
              <ToggleRow
                label="Enable Smartlink Gate"
                hint="Opens an affiliate URL in-browser before the channel loads (counts per cycle)"
                value={config.smartlink.enabled}
                onChange={v => setSL(s => ({ ...s, enabled: v }))}
              />
              <div className="pt-3 border-t border-white/5 space-y-3">
                <Field label="Smartlink URL">
                  <TextInput
                    value={config.smartlink.url}
                    onChange={v => setSL(s => ({ ...s, url: v }))}
                    placeholder="https://smartlink.example.com/go"
                    mono
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Open Delay (seconds)" hint="Wait before opening browser">
                    <TextInput type="number" value={config.smartlink.delaySeconds}
                      onChange={v => setSL(s => ({ ...s, delaySeconds: Number(v) }))} />
                  </Field>
                  <Field label="Cooldown (minutes)" hint="Min time between Smartlinks">
                    <TextInput type="number" value={config.smartlink.cooldownMinutes}
                      onChange={v => setSL(s => ({ ...s, cooldownMinutes: Number(v) }))} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* VAST */}
            <Section title="VAST Pre-roll" icon={Play} accent="bg-green-500/15">
              <ToggleRow
                label="Enable VAST Pre-roll"
                hint="Shows a video ad before the channel stream starts"
                value={config.vast.enabled}
                onChange={v => setVA(s => ({ ...s, enabled: v }))}
              />
              <div className="pt-3 border-t border-white/5 space-y-3">
                <Field label="VAST Tag URL">
                  <TextInput
                    value={config.vast.url}
                    onChange={v => setVA(s => ({ ...s, url: v }))}
                    placeholder="https://example.com/vast.xml"
                    mono
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Skip After (seconds)">
                    <TextInput type="number" value={config.vast.skipAfterSeconds}
                      onChange={v => setVA(s => ({ ...s, skipAfterSeconds: Number(v) }))} />
                  </Field>
                  <Field label="Timeout (seconds)">
                    <TextInput type="number" value={config.vast.timeoutSeconds}
                      onChange={v => setVA(s => ({ ...s, timeoutSeconds: Number(v) }))} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Banner */}
            <Section title="HTML Banner" icon={ImageIcon} accent="bg-pink-500/15">
              <ToggleRow
                label="Enable HTML Banner"
                hint="Renders an Adsterra / Monetag script in a WebView banner"
                value={config.banner.enabled}
                onChange={v => setBN(b => ({ ...b, enabled: v }))}
              />
              <div className="pt-3 border-t border-white/5 space-y-3">
                <Field label="Banner HTML / JS Code">
                  <textarea
                    value={config.banner.htmlCode}
                    onChange={e => setBN(b => ({ ...b, htmlCode: e.target.value }))}
                    rows={5}
                    placeholder="<script>/* paste your Adsterra or Monetag banner script */</script>"
                    className="w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-primary/50 font-mono resize-none"
                  />
                </Field>
                <Field label="Banner Height (px)">
                  <TextInput type="number" value={config.banner.height}
                    onChange={v => setBN(b => ({ ...b, height: Number(v) }))} />
                </Field>
              </div>
            </Section>
          </>
        )}

        {/* ════ Frequency Rules ══════════════════════════════════════════════ */}
        {activeTab === 'frequency' && (
          <>
            <div className="bg-[#13131C] border border-white/8 rounded-xl p-5 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Channel Switch Cycle</h3>
                <p className="text-xs text-white/40 leading-relaxed">
                  Every time a user switches to a different channel, the counter increments.
                  Smartlink and VAST never fire on the same switch — they alternate in a repeating cycle.
                  The counter is persistent and survives app restarts.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Smartlink fires every X switches"
                  hint="Switch number in cycle where Smartlink appears"
                >
                  <TextInput
                    type="number"
                    value={config.smartlink.frequency}
                    onChange={v => setSL(s => ({ ...s, frequency: Math.max(1, Number(v)) }))}
                  />
                </Field>
                <Field
                  label="VAST fires every X switches (after SL)"
                  hint="After Smartlink, VAST fires this many switches later"
                >
                  <TextInput
                    type="number"
                    value={config.vast.frequency}
                    onChange={v => setVA(s => ({ ...s, frequency: Math.max(1, Number(v)) }))}
                  />
                </Field>
              </div>

              {/* Cycle preview */}
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">
                  Cycle Preview — length: {cycleLen} switches (showing 2 cycles)
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Math.min(cycleLen * 2, 30) }, (_, i) => {
                    const pos = (i % cycleLen) + 1;
                    const isSL = pos === slFreq;
                    const isVA = pos === cycleLen;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex flex-col items-center gap-1 px-2.5 py-2 rounded-lg border min-w-[50px]",
                          isSL ? "border-blue-500/40 bg-blue-500/10" :
                          isVA ? "border-green-500/40 bg-green-500/10" :
                                  "border-white/5 bg-white/2",
                        )}
                      >
                        <span className="text-[9px] font-bold text-white/25">#{i + 1}</span>
                        <span className={cn(
                          "text-[9px] font-bold leading-tight text-center",
                          isSL ? "text-blue-400" :
                          isVA ? "text-green-400" :
                                  "text-white/15",
                        )}>
                          {isSL ? "SL" : isVA ? "VAST" : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
                    <span className="text-xs text-white/40">Smartlink</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
                    <span className="text-xs text-white/40">VAST Pre-roll</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
                    <span className="text-xs text-white/40">No ad</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-4">
              <p className="text-xs text-amber-300 font-medium mb-1">Important</p>
              <p className="text-xs text-amber-300/70 leading-relaxed">
                The persistent counter is stored in AsyncStorage on the device.
                It is NOT reset on app restart or reinstall (it survives until the user clears app data).
                This ensures the frequency cap is respected across sessions.
              </p>
            </div>
          </>
        )}

        {/* ════ Banner Positions ════════════════════════════════════════════ */}
        {activeTab === 'banners' && (
          <>
            <div className="bg-[#13131C] border border-white/8 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Screen Positions</h3>
                <p className="text-xs text-white/40">
                  Toggle which screens show the HTML banner. Requires "Enable HTML Banner" to be on in Global Settings.
                </p>
              </div>
              <div className="divide-y divide-white/5">
                {([
                  { key: 'home',        icon: Home,    label: 'Home Screen'                  },
                  { key: 'player',      icon: Tv,      label: 'Player Screen'                },
                  { key: 'categories',  icon: Layers,  label: 'Categories / Channel Grid'    },
                  { key: 'movies',      icon: Film,    label: 'Movies & Series'              },
                  { key: 'sports',      icon: Trophy,  label: 'Sports'                       },
                  { key: 'search',      icon: Search,  label: 'Search'                       },
                  { key: 'channelGrid', icon: Layers,  label: 'Channel Grid (between cards)' },
                ] as const).map(({ key, icon: Icon, label }) => (
                  <div key={key} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Icon size={14} className="text-white/35" />
                        <span className="text-sm text-white">{label}</span>
                      </div>
                      <Toggle
                        on={!!config.banner.positions[key as keyof BannerPositions]}
                        onChange={v => setBNP(p => ({ ...p, [key]: v }))}
                      />
                    </div>
                    {/* Per-placement height override */}
                    {!!config.banner.positions[key as keyof BannerPositions] && (
                      <div className="flex items-center gap-2 pl-5">
                        <span className="text-xs text-white/30 shrink-0">Height (px)</span>
                        <div className="w-24">
                          <TextInput
                            type="number"
                            placeholder={String(config.banner.height || 90)}
                            value={config.banner.heights?.[key] ?? ''}
                            onChange={v => setBN(b => {
                              const h = { ...(b.heights ?? {}) };
                              const n = Number(v);
                              if (n > 0) { h[key] = n; } else { delete h[key]; }
                              return { ...b, heights: h };
                            })}
                          />
                        </div>
                        {(config.banner.heights?.[key] ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setBN(b => {
                              const h = { ...(b.heights ?? {}) };
                              delete h[key];
                              return { ...b, heights: h };
                            })}
                            className="text-xs text-white/25 hover:text-white/60 transition-colors"
                          >
                            reset
                          </button>
                        )}
                        {!(config.banner.heights?.[key] ?? 0) && (
                          <span className="text-xs text-white/20">
                            using default ({config.banner.height || 90} px)
                          </span>
                        )}
                      </div>
                    )}
                    {/* Per-placement ad script override */}
                    {!!config.banner.positions[key as keyof BannerPositions] && (
                      <div className="pl-5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/30 shrink-0">Ad Script Override</span>
                          {!!(config.banner.htmlCodes?.[key]?.trim()) && (
                            <button
                              type="button"
                              onClick={() => setBN(b => {
                                const h = { ...(b.htmlCodes ?? {}) };
                                delete h[key];
                                return { ...b, htmlCodes: h };
                              })}
                              className="text-xs text-white/25 hover:text-white/60 transition-colors"
                            >
                              reset
                            </button>
                          )}
                        </div>
                        <textarea
                          value={config.banner.htmlCodes?.[key] ?? ''}
                          onChange={e => setBN(b => {
                            const h = { ...(b.htmlCodes ?? {}) };
                            const v = e.target.value;
                            if (v.trim()) { h[key] = v; } else { delete h[key]; }
                            return { ...b, htmlCodes: h };
                          })}
                          rows={3}
                          placeholder="Leave empty to use the global Banner HTML / JS Code"
                          className="w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/50 font-mono resize-none"
                        />
                        {!(config.banner.htmlCodes?.[key]?.trim()) && (
                          <span className="text-xs text-white/20">using global ad script</span>
                        )}
                      </div>
                    )}
                    {/* Per-placement VAST rotation */}
                    {!!config.banner.positions[key as keyof BannerPositions] && (
                      <div className="pl-5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/30 shrink-0">
                            VAST Ad Tags (one per line, rotates automatically)
                          </span>
                          {!!(config.banner.vastUrlsByPosition?.[key]?.length) && (
                            <button
                              type="button"
                              onClick={() => setBN(b => {
                                const v = { ...(b.vastUrlsByPosition ?? {}) };
                                delete v[key];
                                return { ...b, vastUrlsByPosition: v };
                              })}
                              className="text-xs text-white/25 hover:text-white/60 transition-colors"
                            >
                              reset
                            </button>
                          )}
                        </div>
                        <textarea
                          value={(config.banner.vastUrlsByPosition?.[key] ?? []).join('\n')}
                          onChange={e => setBN(b => {
                            const v = { ...(b.vastUrlsByPosition ?? {}) };
                            const urls = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
                            if (urls.length > 0) { v[key] = urls; } else { delete v[key]; }
                            return { ...b, vastUrlsByPosition: v };
                          })}
                          rows={3}
                          placeholder={"https://example.com/vast1.xml\nhttps://example.com/vast2.xml"}
                          className="w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/50 font-mono resize-none"
                        />
                        <p className="text-xs text-white/20">
                          {(config.banner.vastUrlsByPosition?.[key]?.length ?? 0) >= 2
                            ? `Rotates through ${config.banner.vastUrlsByPosition?.[key]?.length} tags — one plays each time this slot loads`
                            : 'Add 2+ URLs to rotate between tags in this slot. Leave empty to use the global VAST Pre-roll tag.'}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Player position */}
            <div className="bg-[#13131C] border border-white/8 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-white">Player Banner Position</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'below',           label: 'Below Player'    },
                  { value: 'above',           label: 'Above Player'    },
                  { value: 'floating-bottom', label: 'Floating Bottom' },
                  { value: 'floating-top',    label: 'Floating Top'    },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBNP(p => ({ ...p, playerPosition: opt.value }))}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors",
                      config.banner.positions.playerPosition === opt.value
                        ? "border-primary/60 bg-primary/12 text-white"
                        : "border-white/8 text-white/40 hover:border-white/20 hover:text-white/60",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Channel grid frequency */}
            {config.banner.positions.channelGrid && (
              <div className="bg-[#13131C] border border-white/8 rounded-xl p-5">
                <Field
                  label="Channel Grid: Insert banner every N cards"
                  hint="e.g. 6 = a banner row appears after every 6 channel cards"
                >
                  <TextInput
                    type="number"
                    value={config.banner.positions.channelGridFrequency}
                    onChange={v => setBNP(p => ({ ...p, channelGridFrequency: Math.max(3, Number(v)) }))}
                  />
                </Field>
              </div>
            )}
          </>
        )}

        {/* ════ Analytics ═══════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Impressions" value={(analytics?.summary?.totalImpressions ?? 0).toLocaleString()} icon={Eye}          color="text-blue-400"   />
                <StatCard label="Clicks"      value={(analytics?.summary?.totalClicks ?? 0).toLocaleString()}      icon={MousePointer}  color="text-green-400"  />
                <StatCard label="CTR"         value={analytics?.summary?.ctr ?? '0%'}                               icon={BarChart2}     color="text-yellow-400" />
                <StatCard label="Revenue"     value={`$${(analytics?.summary?.totalRevenue ?? 0).toFixed(2)}`}      icon={DollarSign}    color="text-pink-400"   />
              </div>

              {(analytics?.byPlacement?.length ?? 0) > 0 && (
                <div className="bg-[#13131C] border border-white/8 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">By Placement</h3>
                  <div className="space-y-0">
                    {analytics.byPlacement.map((p: any, i: number) => (
                      <div
                        key={p.placement ?? i}
                        className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                      >
                        <span className="text-sm text-white/60 font-mono text-xs">{p.placement ?? 'unknown'}</span>
                        <div className="flex gap-5 text-xs text-white/35">
                          <span>{(p._sum?.impressions ?? 0).toLocaleString()} imp</span>
                          <span>{(p._sum?.clicks ?? 0).toLocaleString()} clicks</span>
                          <span className="text-green-400">${(p._sum?.revenue ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[#13131C] border border-white/8 rounded-xl p-14 text-center">
              <BarChart2 size={40} className="mx-auto text-white/8 mb-3" />
              <p className="text-white/35 font-medium">No analytics data yet</p>
              <p className="text-xs text-white/20 mt-1">
                Events will appear once ads are enabled and serving
              </p>
            </div>
          )
        )}

        {/* ════ Ad Health Check ═══════════════════════════════════════════════ */}
        {activeTab === 'analytics' && health && (
          <div className="bg-[#13131C] border border-white/8 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Ad Health Check</h3>
                <p className="text-xs text-white/35 mt-0.5">
                  Live event breakdown (last 24h) — refreshes every 15s
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  health.lastEventAt && (Date.now() - new Date(health.lastEventAt).getTime()) < 15 * 60 * 1000
                    ? "bg-green-400" : "bg-white/15",
                )} />
                <span className="text-[11px] text-white/35">
                  {health.lastEventAt
                    ? `Last event ${new Date(health.lastEventAt).toLocaleTimeString()}`
                    : 'No events yet'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
              <HealthStat label="Impressions" value={health.last24h?.impression ?? 0} color="text-blue-400" />
              <HealthStat label="Clicks"      value={health.last24h?.click ?? 0}      color="text-green-400" />
              <HealthStat label="Sessions"    value={health.last24h?.session ?? 0}    color="text-purple-400" />
              <HealthStat label="Revenue evts" value={health.last24h?.revenue ?? 0}   color="text-pink-400" />
              <HealthStat
                label="Errors"
                value={health.last24h?.error ?? 0}
                color={Number(health.last24h?.error ?? 0) > 0 ? "text-red-400" : "text-white/40"}
                sub={`${health.errorRatePct ?? '0.00%'} rate`}
              />
            </div>

            {(health.recentErrors?.length ?? 0) > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">
                  Recent Errors ({health.recentErrors.length})
                </h4>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {health.recentErrors.map((e: any) => (
                    <div key={e.id} className="flex items-start justify-between gap-3 py-1.5 px-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                      <div className="min-w-0">
                        <p className="text-xs text-red-300 font-mono truncate">
                          {e.errorCode ?? 'unknown_error'} — {e.errorMsg ?? 'no message'}
                        </p>
                        <p className="text-[11px] text-white/30 mt-0.5">
                          {e.placement ?? 'unknown placement'}{e.os ? ` • ${e.os}` : ''}{e.device ? ` • ${e.device}` : ''}
                        </p>
                      </div>
                      <span className="text-[11px] text-white/25 flex-shrink-0">
                        {new Date(e.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ House Ads ════════════════════════════════════════════════════ */}
        {activeTab === 'house-ads' && (
          <>
            {/* Create form */}
            <div className="bg-[#13131C] border border-white/8 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Create House Ad</h3>
                <p className="text-xs text-white/40">
                  Promote your own content, subscription plans, or announcements directly in the app.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Ad Title">
                    <TextInput value={newTitle} onChange={setNewTitle} placeholder="Premium Subscription — 50% Off" />
                  </Field>
                </div>
                <Field label="Type">
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                    className="w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50 appearance-none cursor-pointer"
                  >
                    {['banner', 'video', 'popup', 'interstitial', 'native'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Click URL">
                  <TextInput value={newTargetUrl} onChange={setNewTargetUrl} placeholder="https://..." mono />
                </Field>
                <div className="col-span-2">
                  <Field label="HTML Code (optional — for script-based ads)">
                    <textarea
                      value={newHtml}
                      onChange={e => setNewHtml(e.target.value)}
                      rows={3}
                      placeholder="<script>/* optional ad script */</script>"
                      className="w-full bg-[#0A0B0F] border border-white/8 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-primary/50 font-mono resize-none"
                    />
                  </Field>
                </div>
              </div>

              <button
                onClick={handleCreateAd}
                disabled={creatingAd || !newTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} />
                {creatingAd ? 'Creating…' : 'Create House Ad'}
              </button>
            </div>

            {/* List */}
            {houseAds.length > 0 ? (
              <div className="bg-[#13131C] border border-white/8 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                    {houseAds.length} House Ad{houseAds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="divide-y divide-white/5">
                  {houseAds.map(ad => (
                    <div key={ad.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0 mt-0.5",
                        ad.isActive ? "bg-green-400" : "bg-white/15",
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{ad.title}</p>
                        <p className="text-xs text-white/35 mt-0.5">
                          {ad.type ?? 'banner'}
                          {ad.targetUrl ? ` • ${ad.targetUrl.replace(/^https?:\/\//, '').slice(0, 40)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Toggle on={!!ad.isActive} onChange={v => handleToggleAd(ad.id, v)} />
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="p-1.5 text-white/25 hover:text-red-400 transition-colors rounded"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-[#13131C] border border-white/8 rounded-xl p-12 text-center">
                <Megaphone size={36} className="mx-auto text-white/8 mb-3" />
                <p className="text-white/35 text-sm">No house ads yet</p>
                <p className="text-xs text-white/20 mt-1">Create one above to promote your own content</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
