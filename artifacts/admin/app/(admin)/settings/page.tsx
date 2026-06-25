"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Save, Menu, RefreshCw, Power, AlertTriangle, Smartphone } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import dynamic from "next/dynamic";

const AppSettings      = dynamic(() => import("./_tabs/AppSettings"),      { ssr: false });
const AuthSettings     = dynamic(() => import("./_tabs/AuthSettings"),     { ssr: false });
const PaymentGateways  = dynamic(() => import("./_tabs/PaymentGateways"),  { ssr: false });
const EmailSettings    = dynamic(() => import("./_tabs/EmailSettings"),    { ssr: false });
const FirebaseSettings = dynamic(() => import("./_tabs/FirebaseSettings"), { ssr: false });
const StorageSettings  = dynamic(() => import("./_tabs/StorageSettings"),  { ssr: false });
const SecuritySettings = dynamic(() => import("./_tabs/SecuritySettings"), { ssr: false });
const SeoSettings      = dynamic(() => import("./_tabs/SeoSettings"),      { ssr: false });

const TABS = [
  "General", "App Settings", "Authentication", "Payment Gateways",
  "Maintenance", "Force Update",
  "Email Settings", "Firebase / FCM", "Storage", "Security", "SEO Settings",
];

interface Setting  { key: string; value: unknown }
interface ForceUpdateConfig {
  enabled: boolean; minVersionAndroid: string; minVersionIos: string;
  currentVersionAndroid: string; currentVersionIos: string;
  storeUrlAndroid: string; storeUrlIos: string;
  message: string; softUpdate: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("General");
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { data: settingsRaw, isLoading, refetch } = useApi<Setting[]>("/v1/settings");
  const { data: fuConfig, refetch: refetchFu }     = useApi<ForceUpdateConfig>("/v1/force-update/config");
  const { call, loading: mutating }                = useApiCallState();

  const settings: Record<string, unknown> = {};
  (settingsRaw ?? []).forEach(s => { settings[s.key] = s.value; });

  // ── General (controlled state) ──────────────────────────────────────
  const [appName,   setAppName]   = useState("StreamPro");
  const [tagline,   setTagline]   = useState("Watch TV Anytime, Anywhere");
  const [language,  setLanguage]  = useState("English");
  const [currency,  setCurrency]  = useState("USD ($)");

  useEffect(() => {
    if (!settingsRaw) return;
    if (settings["app_name"])        setAppName(String(settings["app_name"]));
    if (settings["app_tagline"])     setTagline(String(settings["app_tagline"]));
    if (settings["default_language"])setLanguage(String(settings["default_language"]));
    if (settings["default_currency"])setCurrency(String(settings["default_currency"]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRaw]);

  // ── Maintenance (controlled state) ──────────────────────────────────
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintMessage, setMaintMessage] = useState("We're performing scheduled maintenance. We'll be back shortly!");

  useEffect(() => {
    if (!settingsRaw) return;
    setMaintEnabled(Boolean(settings["maintenance_enabled"] ?? false));
    if (settings["maintenance_message"]) setMaintMessage(String(settings["maintenance_message"]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRaw]);

  // ── Force Update (controlled state) ─────────────────────────────────
  const [fuEnabled,    setFuEnabled]    = useState(false);
  const [fuSoft,       setFuSoft]       = useState(false);
  const [fuMinAndroid, setFuMinAndroid] = useState("1.0.0");
  const [fuMinIos,     setFuMinIos]     = useState("1.0.0");
  const [fuCurAndroid, setFuCurAndroid] = useState("1.0.0");
  const [fuCurIos,     setFuCurIos]     = useState("1.0.0");
  const [fuStoreAnd,   setFuStoreAnd]   = useState("");
  const [fuStoreIos,   setFuStoreIos]   = useState("");
  const [fuMessage,    setFuMessage]    = useState("");

  useEffect(() => {
    if (!fuConfig) return;
    setFuEnabled(fuConfig.enabled);
    setFuSoft(fuConfig.softUpdate);
    setFuMinAndroid(fuConfig.minVersionAndroid);
    setFuMinIos(fuConfig.minVersionIos);
    setFuCurAndroid(fuConfig.currentVersionAndroid);
    setFuCurIos(fuConfig.currentVersionIos);
    setFuStoreAnd(fuConfig.storeUrlAndroid);
    setFuStoreIos(fuConfig.storeUrlIos);
    setFuMessage(fuConfig.message);
  }, [fuConfig]);

  const flash = () => { setSaved(true); setSaveErr(null); setTimeout(() => setSaved(false), 2200); };
  const flashErr = (msg: string) => { setSaveErr(msg); setTimeout(() => setSaveErr(null), 4000); };

  const saveGeneral = async () => {
    try {
      const pairs: [string, string][] = [
        ["app_name",         appName],
        ["app_tagline",      tagline],
        ["default_language", language],
        ["default_currency", currency],
      ];
      const results = await Promise.allSettled(
        pairs.map(([key, value]) => call("post", "/v1/settings", { key, value }))
      );
      const failed = results.filter(r => r.status === "rejected");
      if (failed.length > 0) {
        flashErr(`${failed.length} of ${pairs.length} settings failed to save.`);
      } else {
        flash();
      }
      refetch();
    } catch { flashErr("Failed to save general settings. Check your connection."); }
  };

  const saveMaintenance = async (explicitEnabled?: boolean) => {
    const value = explicitEnabled !== undefined ? explicitEnabled : maintEnabled;
    try {
      await Promise.all([
        call("post", "/v1/settings", { key: "maintenance_enabled", value, isPublic: true }),
        call("post", "/v1/settings", { key: "maintenance_message",  value: maintMessage, isPublic: true }),
      ]);
      setMaintEnabled(value);
      flash(); refetch();
    } catch { flashErr("Failed to save maintenance settings."); }
  };

  const handleToggleMaintenance = (value: boolean) => {
    saveMaintenance(value);
  };

  const saveForceUpdate = async () => {
    try {
      await call("post", "/v1/force-update/config", {
        enabled: fuEnabled, softUpdate: fuSoft,
        minVersionAndroid:     fuMinAndroid,
        minVersionIos:         fuMinIos,
        currentVersionAndroid: fuCurAndroid,
        currentVersionIos:     fuCurIos,
        storeUrlAndroid:       fuStoreAnd,
        storeUrlIos:           fuStoreIos,
        message:               fuMessage,
      });
      flash(); refetchFu();
    } catch { flashErr("Failed to save force update config."); }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <RefreshCw size={14} className="text-primary animate-spin" />}
          {saved    && <span className="text-xs text-emerald-400 font-medium">Saved ✓</span>}
          {saveErr  && <span className="text-xs text-red-400 font-medium">{saveErr}</span>}
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)] overflow-hidden">
        {/* Sub-nav */}
        <div className="w-44 border-r border-border bg-sidebar shrink-0 py-3 overflow-y-auto">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn("w-full text-left px-4 py-2.5 text-xs transition-colors",
                activeTab === tab
                  ? "text-white font-semibold bg-white/5 border-r-2 border-primary"
                  : "text-[#8B92A5] hover:text-white hover:bg-white/[0.03]"
              )}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── GENERAL ── */}
          {activeTab === "General" && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-sm font-semibold text-white mb-4">General Settings</h2>
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">App Name</label>
                  <input value={appName} onChange={e => setAppName(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">App Tagline</label>
                  <input value={tagline} onChange={e => setTagline(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[#8B92A5] mb-1.5 block">Default Language</label>
                    <div className="relative">
                      <select value={language} onChange={e => setLanguage(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none appearance-none cursor-pointer focus:border-primary">
                        {["English","Bengali","Hindi","Arabic","French","Spanish"].map(l => <option key={l}>{l}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B92A5] mb-1.5 block">Default Currency</label>
                    <div className="relative">
                      <select value={currency} onChange={e => setCurrency(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none appearance-none cursor-pointer focus:border-primary">
                        {["USD ($)","BDT (৳)","EUR (€)","GBP (£)","INR (₹)"].map(c => <option key={c}>{c}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={saveGeneral} disabled={mutating}
                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60",
                  saved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
                )}>
                {mutating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {saved ? "Saved!" : mutating ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}

          {/* ── APP SETTINGS ── */}
          {activeTab === "App Settings" && (
            <AppSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── AUTHENTICATION ── */}
          {activeTab === "Authentication" && (
            <AuthSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── PAYMENT GATEWAYS ── */}
          {activeTab === "Payment Gateways" && <PaymentGateways />}

          {/* ── MAINTENANCE ── */}
          {activeTab === "Maintenance" && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-sm font-semibold text-white mb-4">Maintenance Mode</h2>
              <div className={cn("bg-card border rounded-xl p-5 space-y-4 transition-colors", maintEnabled ? "border-orange-500/40" : "border-border")}>
                {maintEnabled && (
                  <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                    <AlertTriangle size={14} className="text-orange-400 shrink-0" />
                    <p className="text-xs text-orange-300">Maintenance mode is <strong>ACTIVE</strong>. The app is currently showing a maintenance screen to users.</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Enable Maintenance Mode</div>
                    <div className="text-xs text-[#8B92A5] mt-0.5">When enabled, the mobile app shows a maintenance screen</div>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", maintEnabled ? "bg-orange-500" : "bg-white/10")}
                    onClick={() => handleToggleMaintenance(!maintEnabled)}>
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-all", maintEnabled ? "ml-auto" : "")} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Maintenance Message</label>
                  <textarea value={maintMessage} onChange={e => setMaintMessage(e.target.value)} rows={3}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Estimated End Time (optional)</label>
                  <input type="datetime-local"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={saveMaintenance} disabled={mutating}
                  className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60",
                    saved ? "bg-green-600 text-white" : maintEnabled ? "bg-orange-600 text-white hover:bg-orange-500" : "gradient-primary text-white hover:opacity-90"
                  )}>
                  {mutating ? <RefreshCw size={14} className="animate-spin" /> : <Power size={14} />}
                  {saved ? "Saved!" : mutating ? "Saving…" : maintEnabled ? "Enable Maintenance" : "Save Settings"}
                </button>
                {maintEnabled && (
                  <button onClick={() => handleToggleMaintenance(false)}
                    className="text-xs text-[#8B92A5] hover:text-white transition-colors">
                    Disable maintenance
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── FORCE UPDATE ── */}
          {activeTab === "Force Update" && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-sm font-semibold text-white mb-4">Force Update Configuration</h2>
              <div className={cn("bg-card border rounded-xl p-5 space-y-5 transition-colors", fuEnabled ? "border-primary/40" : "border-border")}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2"><Smartphone size={14}/> Enable Force Update</div>
                    <div className="text-xs text-[#8B92A5] mt-0.5">Force users below the minimum version to update</div>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", fuEnabled ? "bg-primary" : "bg-white/10")}
                    onClick={() => setFuEnabled(v => !v)}>
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-all", fuEnabled ? "ml-auto" : "")} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Soft Update (Optional)</div>
                    <div className="text-xs text-[#8B92A5] mt-0.5">Show a dismissable "Update Available" prompt instead of a hard block</div>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", fuSoft ? "bg-primary" : "bg-white/10")}
                    onClick={() => setFuSoft(v => !v)}>
                    <div className={cn("w-4 h-4 rounded-full bg-white transition-all", fuSoft ? "ml-auto" : "")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Android</h3>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">Min Required Version</label>
                      <input value={fuMinAndroid} onChange={e => setFuMinAndroid(e.target.value)} placeholder="1.0.0"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary font-mono" /></div>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">Latest Version</label>
                      <input value={fuCurAndroid} onChange={e => setFuCurAndroid(e.target.value)} placeholder="1.2.0"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary font-mono" /></div>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">Play Store URL</label>
                      <input value={fuStoreAnd} onChange={e => setFuStoreAnd(e.target.value)} placeholder="https://play.google.com/..."
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" /></div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">iOS</h3>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">Min Required Version</label>
                      <input value={fuMinIos} onChange={e => setFuMinIos(e.target.value)} placeholder="1.0.0"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary font-mono" /></div>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">Latest Version</label>
                      <input value={fuCurIos} onChange={e => setFuCurIos(e.target.value)} placeholder="1.2.0"
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary font-mono" /></div>
                    <div><label className="text-xs text-[#8B92A5] mb-1 block">App Store URL</label>
                      <input value={fuStoreIos} onChange={e => setFuStoreIos(e.target.value)} placeholder="https://apps.apple.com/..."
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary" /></div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Update Message</label>
                  <textarea value={fuMessage} onChange={e => setFuMessage(e.target.value)} rows={2}
                    placeholder="A new version of StreamPro is available. Please update to continue."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors resize-none" />
                </div>
              </div>
              <button onClick={saveForceUpdate} disabled={mutating}
                className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60",
                  saved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
                )}>
                {mutating ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {saved ? "Saved!" : mutating ? "Saving…" : "Save Force Update Config"}
              </button>
            </div>
          )}

          {/* ── EMAIL SETTINGS ── */}
          {activeTab === "Email Settings" && (
            <EmailSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── FIREBASE / FCM ── */}
          {activeTab === "Firebase / FCM" && (
            <FirebaseSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── STORAGE ── */}
          {activeTab === "Storage" && (
            <StorageSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── SECURITY ── */}
          {activeTab === "Security" && (
            <SecuritySettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

          {/* ── SEO SETTINGS ── */}
          {activeTab === "SEO Settings" && (
            <SeoSettings settingsRaw={settingsRaw} refetch={refetch} />
          )}

        </div>
      </div>
    </>
  );
}
