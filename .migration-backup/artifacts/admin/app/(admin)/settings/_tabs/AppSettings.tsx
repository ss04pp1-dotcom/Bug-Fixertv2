"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Globe, Mail, Phone, MapPin, Smartphone, Link2, Activity, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Setting { key: string; value: unknown }

const LANGUAGES = ["English","Bengali","Hindi","Arabic","French","Spanish","German","Turkish","Urdu","Portuguese"];
const CURRENCIES = ["USD ($)","BDT (৳)","EUR (€)","GBP (£)","INR (₹)","AED (د.إ)","SAR (﷼)","PKR (₨)","NPR (₨)","MYR (RM)","SGD (S$)","CAD (C$)","AUD (A$)","BRL (R$)"];
const TIMEZONES = ["UTC","Asia/Dhaka","Asia/Kolkata","Asia/Karachi","Asia/Dubai","Asia/Singapore","America/New_York","America/Los_Angeles","America/Chicago","Europe/London","Europe/Paris","Europe/Berlin","Australia/Sydney","Pacific/Auckland"];

function field(raw: Setting[] | undefined, key: string, def = "") {
  const s = (raw ?? []).find(x => x.key === key);
  return s ? String(s.value ?? "") : def;
}

interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#8B92A5] mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60";
const SELECT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors appearance-none cursor-pointer";

export default function AppSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();

  const [form, setForm] = useState({
    app_name: "StreamPro",
    app_tagline: "Watch TV Anytime, Anywhere",
    app_logo: "",
    app_favicon: "",
    website_url: "",
    api_base_url: "",
    support_email: "",
    support_phone: "",
    contact_address: "",
    default_language: "English",
    default_currency: "USD ($)",
    default_timezone: "UTC",
    android_package_name: "",
    app_version_android: "1.0.0",
    app_version_ios: "1.0.0",
    keep_alive_enabled: "true",
  });

  useEffect(() => {
    if (!settingsRaw) return;
    setForm({
      app_name:            field(settingsRaw, "app_name", "StreamPro"),
      app_tagline:         field(settingsRaw, "app_tagline", "Watch TV Anytime, Anywhere"),
      app_logo:            field(settingsRaw, "app_logo"),
      app_favicon:         field(settingsRaw, "app_favicon"),
      website_url:         field(settingsRaw, "website_url"),
      api_base_url:        field(settingsRaw, "api_base_url"),
      support_email:       field(settingsRaw, "support_email"),
      support_phone:       field(settingsRaw, "support_phone"),
      contact_address:     field(settingsRaw, "contact_address"),
      default_language:    field(settingsRaw, "default_language", "English"),
      default_currency:    field(settingsRaw, "default_currency", "USD ($)"),
      default_timezone:    field(settingsRaw, "default_timezone", "UTC"),
      android_package_name:field(settingsRaw, "android_package_name"),
      app_version_android: field(settingsRaw, "app_version_android", "1.0.0"),
      app_version_ios:     field(settingsRaw, "app_version_ios", "1.0.0"),
      keep_alive_enabled:  field(settingsRaw, "keep_alive_enabled", "true"),
    });
  }, [settingsRaw]);

  const set = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k)(e.target.value);

  const handleSave = async () => {
    try {
      const PUBLIC_KEYS = ["app_name","app_tagline","app_logo","app_favicon","website_url","keep_alive_enabled"];
      await call("post", "/v1/settings/bulk", {
        settings: Object.entries(form).map(([key, value]) => ({ key, value, isPublic: PUBLIC_KEYS.includes(key) })),
      });
      toast.success("App settings saved successfully");
      refetch();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const keepAliveOn = form.keep_alive_enabled !== "false";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white">App Settings</h2>
        <p className="text-xs text-[#8B92A5] mt-0.5">Core application identity and contact information</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Identity</h3>
        <div className="grid grid-cols-1 gap-4">
          <Field label="App Name">
            <input className={INPUT} value={form.app_name} onChange={onChange("app_name")} placeholder="StreamPro" />
          </Field>
          <Field label="App Tagline">
            <input className={INPUT} value={form.app_tagline} onChange={onChange("app_tagline")} placeholder="Watch TV Anytime, Anywhere" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ImageUpload label="App Logo" value={form.app_logo} onChange={set("app_logo")} uploadPath="/v1/storage/upload?folder=logos" previewClass="h-24 w-full" />
          <ImageUpload label="Favicon" value={form.app_favicon} onChange={set("app_favicon")} uploadPath="/v1/storage/upload?folder=logos" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/jpeg" previewClass="h-24 w-full" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">URLs & API</h3>
        <Field label="Website URL">
          <div className="relative">
            <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
            <input className={INPUT + " pl-8"} value={form.website_url} onChange={onChange("website_url")} placeholder="https://streampro.app" />
          </div>
        </Field>
        <Field label="API Base URL">
          <div className="relative">
            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
            <input className={INPUT + " pl-8"} value={form.api_base_url} onChange={onChange("api_base_url")} placeholder="https://api.streampro.app" />
          </div>
        </Field>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Support & Contact</h3>
        <Field label="Support Email">
          <div className="relative">
            <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
            <input type="email" className={INPUT + " pl-8"} value={form.support_email} onChange={onChange("support_email")} placeholder="support@streampro.app" />
          </div>
        </Field>
        <Field label="Support Phone">
          <div className="relative">
            <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
            <input className={INPUT + " pl-8"} value={form.support_phone} onChange={onChange("support_phone")} placeholder="+1 800 123 4567" />
          </div>
        </Field>
        <Field label="Contact Address">
          <div className="relative">
            <MapPin size={13} className="absolute left-3 top-3 text-[#8B92A5]" />
            <textarea rows={2} className={INPUT + " pl-8 resize-none"} value={form.contact_address} onChange={onChange("contact_address")} placeholder="123 Main St, New York, NY 10001" />
          </div>
        </Field>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Locale Defaults</h3>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Default Language">
            <select className={SELECT} value={form.default_language} onChange={onChange("default_language")}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Default Currency">
            <select className={SELECT} value={form.default_currency} onChange={onChange("default_currency")}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default Timezone">
            <select className={SELECT} value={form.default_timezone} onChange={onChange("default_timezone")}>
              {TIMEZONES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2">
          <Smartphone size={12} /> Version Information
        </h3>
        <Field label="Android Package Name">
          <input className={INPUT} value={form.android_package_name} onChange={onChange("android_package_name")} placeholder="com.streampro.app" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Android App Version">
            <input className={INPUT + " font-mono"} value={form.app_version_android} onChange={onChange("app_version_android")} placeholder="1.0.0" />
          </Field>
          <Field label="iOS App Version">
            <input className={INPUT + " font-mono"} value={form.app_version_ios} onChange={onChange("app_version_ios")} placeholder="1.0.0" />
          </Field>
        </div>
      </div>

      {/* ── Server Keep-Alive ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2">
          <Activity size={12} /> Server Keep-Alive
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${keepAliveOn ? "bg-emerald-500/15" : "bg-red-500/15"}`}>
              {keepAliveOn
                ? <Wifi size={16} className="text-emerald-400" />
                : <WifiOff size={16} className="text-red-400" />}
            </div>
            <div>
              <p className="text-sm text-white font-medium">
                Prevent Render from Sleeping
              </p>
              <p className="text-xs text-[#8B92A5] mt-0.5 leading-relaxed">
                Pings the Render server every 8 minutes so it never goes to sleep.{" "}
                {keepAliveOn
                  ? <span className="text-emerald-400 font-medium">Currently active — server stays awake.</span>
                  : <span className="text-red-400 font-medium">Disabled — server may sleep after 15 min.</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => set("keep_alive_enabled")(keepAliveOn ? "false" : "true")}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 focus:outline-none ${
              keepAliveOn ? "bg-emerald-500" : "bg-[#374151]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                keepAliveOn ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {!keepAliveOn && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
            <Activity size={13} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              Keep-alive is disabled. Save settings to apply. The server will sleep after 15 minutes of inactivity.
            </p>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {loading ? "Saving…" : "Save App Settings"}
      </button>
    </div>
  );
}
