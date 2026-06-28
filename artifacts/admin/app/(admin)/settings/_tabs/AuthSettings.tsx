"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Setting { key: string; value: unknown }

function field(raw: Setting[] | undefined, key: string, def = "") {
  const s = (raw ?? []).find(x => x.key === key);
  return s ? String(s.value ?? "") : def;
}

function boolField(raw: Setting[] | undefined, key: string, def = false): boolean {
  const s = (raw ?? []).find(x => x.key === key);
  if (!s) return def;
  return s.value === true || s.value === "true" || s.value === "1";
}

interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/50";
const LABEL = "text-xs text-[#8B92A5] mb-1.5 block";
const SECTION = "bg-card border border-border rounded-xl p-5 space-y-4";

function Toggle({ on, onChange, label, description }: { on: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {description && <div className="text-xs text-[#8B92A5] mt-0.5">{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!on)}
        className={`w-10 h-5 rounded-full flex items-center px-0.5 transition-colors ${on ? "bg-primary" : "bg-white/10"}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}

export default function AuthSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    google_auth_enabled: false,
    google_client_id_web: "",
    google_client_id_android: "",
    google_client_id_ios: "",
    facebook_auth_enabled: false,
    facebook_app_id: "",
    facebook_client_token: "",
    apple_auth_enabled: false,
  });

  useEffect(() => {
    if (!settingsRaw) return;
    setForm({
      google_auth_enabled:     boolField(settingsRaw, "google_auth_enabled"),
      google_client_id_web:    field(settingsRaw, "google_client_id_web"),
      google_client_id_android:field(settingsRaw, "google_client_id_android"),
      google_client_id_ios:    field(settingsRaw, "google_client_id_ios"),
      facebook_auth_enabled:   boolField(settingsRaw, "facebook_auth_enabled"),
      facebook_app_id:         field(settingsRaw, "facebook_app_id"),
      facebook_client_token:   field(settingsRaw, "facebook_client_token"),
      apple_auth_enabled:      boolField(settingsRaw, "apple_auth_enabled"),
    });
  }, [settingsRaw]);

  const set = (k: keyof typeof form) => (v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    try {
      // ── isPublic distinction ───────────────────────────────────────────
      // `isPublic: true`  → returned by GET /v1/settings/app-config so the
      //                     mobile app can read it at runtime (client IDs,
      //                     app IDs, feature toggles).
      // `isPublic: false` → server-side secret. NEVER expose to clients.
      //                     OAuth client secrets must never reach the device.
      const entries: { key: string; value: unknown; isPublic: boolean }[] = [
        { key: "google_auth_enabled",      value: form.google_auth_enabled,      isPublic: true  },
        { key: "google_client_id_web",     value: form.google_client_id_web,     isPublic: true  },
        { key: "google_client_id_android", value: form.google_client_id_android, isPublic: true  },
        { key: "google_client_id_ios",     value: form.google_client_id_ios,     isPublic: true  },
        { key: "facebook_auth_enabled",    value: form.facebook_auth_enabled,    isPublic: true  },
        { key: "facebook_app_id",          value: form.facebook_app_id,          isPublic: true  },
        // OAuth client tokens / secrets must NOT be public — D-001 fix
        { key: "facebook_client_token",    value: form.facebook_client_token,    isPublic: false },
        { key: "apple_auth_enabled",       value: form.apple_auth_enabled,       isPublic: true  },
      ];
      await call("post", "/v1/settings/bulk", { settings: entries });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      refetch();
      toast.success("Authentication settings saved");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-white">Authentication Settings</h2>
      </div>

      <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-4 py-3">
        <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-300 leading-relaxed">
          All credentials saved here are returned by the public <code className="bg-white/10 px-1 rounded">GET /v1/settings/app-config</code> endpoint
          and used by the mobile app at runtime. Ensure your OAuth redirect URIs are registered with each provider.
        </p>
      </div>

      {/* ── Google OAuth ─────────────────────────────────────────────────── */}
      <div className={SECTION}>
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-6 h-6 rounded bg-[#EA4335] flex items-center justify-center text-white text-xs font-bold">G</div>
          <span className="text-sm font-medium text-white">Google OAuth</span>
        </div>
        <Toggle
          on={form.google_auth_enabled}
          onChange={v => set("google_auth_enabled")(v)}
          label="Enable Google Sign-In"
          description="Allow users to sign in with their Google account"
        />
        {form.google_auth_enabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className={LABEL}>Web Client ID</label>
              <input className={INPUT} placeholder="xxxxxx.apps.googleusercontent.com"
                value={form.google_client_id_web}
                onChange={e => set("google_client_id_web")(e.target.value)} />
              <p className="text-[10px] text-[#8B92A5] mt-1">From Google Cloud Console → OAuth 2.0 Client IDs → Web application</p>
            </div>
            <div>
              <label className={LABEL}>Android Client ID</label>
              <input className={INPUT} placeholder="xxxxxx.apps.googleusercontent.com"
                value={form.google_client_id_android}
                onChange={e => set("google_client_id_android")(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>iOS Client ID</label>
              <input className={INPUT} placeholder="xxxxxx.apps.googleusercontent.com"
                value={form.google_client_id_ios}
                onChange={e => set("google_client_id_ios")(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* ── Facebook OAuth ───────────────────────────────────────────────── */}
      <div className={SECTION}>
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-6 h-6 rounded bg-[#1877F2] flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </div>
          <span className="text-sm font-medium text-white">Facebook Login</span>
        </div>
        <Toggle
          on={form.facebook_auth_enabled}
          onChange={v => set("facebook_auth_enabled")(v)}
          label="Enable Facebook Sign-In"
          description="Allow users to sign in with their Facebook account"
        />
        {form.facebook_auth_enabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className={LABEL}>App ID</label>
              <input className={INPUT} placeholder="123456789012345"
                value={form.facebook_app_id}
                onChange={e => set("facebook_app_id")(e.target.value)} />
              <p className="text-[10px] text-[#8B92A5] mt-1">From Meta for Developers → Your App → Settings → Basic</p>
            </div>
            <div>
              <label className={LABEL}>Client Token</label>
              <input className={INPUT} placeholder="Your Facebook Client Token"
                value={form.facebook_client_token}
                onChange={e => set("facebook_client_token")(e.target.value)} />
              <p className="text-[10px] text-[#8B92A5] mt-1">Settings → Advanced → Client Token</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Apple Sign In ────────────────────────────────────────────────── */}
      <div className={SECTION}>
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="black"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          </div>
          <span className="text-sm font-medium text-white">Apple Sign In</span>
        </div>
        <Toggle
          on={form.apple_auth_enabled}
          onChange={v => set("apple_auth_enabled")(v)}
          label="Enable Apple Sign In"
          description="Requires EAS build with expo-apple-authentication"
        />
        {form.apple_auth_enabled && (
          <p className="text-xs text-[#8B92A5] bg-white/5 rounded-lg p-3">
            Apple Sign In requires native build. Configure your Apple Service ID and private key in your Apple Developer account.
            No additional credentials are needed here — the app reads your bundle ID from app.json.
          </p>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 ${
          saved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
        }`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saved ? "Saved!" : loading ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
