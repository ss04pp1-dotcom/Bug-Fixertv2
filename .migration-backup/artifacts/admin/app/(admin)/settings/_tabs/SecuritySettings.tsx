"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Shield, Lock, Globe, Smartphone, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Setting { key: string; value: unknown }
interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function field(raw: Setting[] | undefined, key: string, def = "") {
  return String((raw ?? []).find(x => x.key === key)?.value ?? def);
}
function boolField(raw: Setting[] | undefined, key: string, def = false) {
  const v = (raw ?? []).find(x => x.key === key)?.value;
  if (v === undefined) return def;
  return v === true || v === "true" || v === 1;
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60";

function Toggle({ on, onChange, label, desc }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{label}</p>
        {desc && <p className="text-xs text-[#8B92A5] mt-0.5">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!on)}
        className={cn("w-10 h-5 rounded-full flex items-center px-0.5 transition-colors shrink-0", on ? "bg-primary" : "bg-white/10")}>
        <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", on ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}

export default function SecuritySettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();

  const [form, setForm] = useState({
    jwt_access_expiry:       "15m",
    jwt_refresh_expiry:      "7d",
    jwt_refresh_enabled:     true,
    two_factor_enabled:      false,
    two_factor_method:       "email_otp",
    login_attempt_limit:     "5",
    account_lock_enabled:    true,
    account_lock_duration:   "30",
    session_timeout:         "60",
    single_device_login:     false,
    password_min_length:     "8",
    password_require_upper:  true,
    password_require_number: true,
    password_require_special:false,
    ip_whitelist:            "",
    ip_blacklist:            "",
    api_rate_limit:          "100",
    cors_origins:            "",
    https_enforce:           true,
    admin_ip_restrict:       false,
    admin_allowed_ips:       "",
    device_verification:     false,
    force_logout_all:        false,
  });

  useEffect(() => {
    if (!settingsRaw) return;
    setForm({
      jwt_access_expiry:       field(settingsRaw, "jwt_access_expiry",       "15m"),
      jwt_refresh_expiry:      field(settingsRaw, "jwt_refresh_expiry",      "7d"),
      jwt_refresh_enabled:     boolField(settingsRaw, "jwt_refresh_enabled", true),
      two_factor_enabled:      boolField(settingsRaw, "two_factor_enabled",  false),
      two_factor_method:       field(settingsRaw, "two_factor_method",       "email_otp"),
      login_attempt_limit:     field(settingsRaw, "login_attempt_limit",     "5"),
      account_lock_enabled:    boolField(settingsRaw, "account_lock_enabled",true),
      account_lock_duration:   field(settingsRaw, "account_lock_duration",   "30"),
      session_timeout:         field(settingsRaw, "session_timeout",         "60"),
      single_device_login:     boolField(settingsRaw, "single_device_login", false),
      password_min_length:     field(settingsRaw, "password_min_length",     "8"),
      password_require_upper:  boolField(settingsRaw, "password_require_upper", true),
      password_require_number: boolField(settingsRaw, "password_require_number", true),
      password_require_special:boolField(settingsRaw, "password_require_special", false),
      ip_whitelist:            field(settingsRaw, "ip_whitelist"),
      ip_blacklist:            field(settingsRaw, "ip_blacklist"),
      api_rate_limit:          field(settingsRaw, "api_rate_limit",          "100"),
      cors_origins:            field(settingsRaw, "cors_origins"),
      https_enforce:           boolField(settingsRaw, "https_enforce",       true),
      admin_ip_restrict:       boolField(settingsRaw, "admin_ip_restrict",   false),
      admin_allowed_ips:       field(settingsRaw, "admin_allowed_ips"),
      device_verification:     boolField(settingsRaw, "device_verification", false),
      force_logout_all:        false,
    });
  }, [settingsRaw]);

  const set = (k: keyof typeof form, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const input = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(k, e.target.value);

  const save = async () => {
    try {
      await call("post", "/v1/settings/bulk", {
        settings: Object.entries(form).filter(([k]) => k !== "force_logout_all").map(([key, value]) => ({ key, value })),
      });
      toast.success("Security settings saved. Restart the API server for JWT changes to take effect.");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Security Settings</h2>
        <p className="text-xs text-[#8B92A5] mt-0.5">Authentication, access control, and API protection</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Lock size={11}/> JWT Tokens</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Access Token Expiry</label>
            <select className={INPUT + " cursor-pointer"} value={form.jwt_access_expiry} onChange={input("jwt_access_expiry")}>
              {["5m","10m","15m","30m","1h","2h","6h","12h","24h"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Refresh Token Expiry</label>
            <select className={INPUT + " cursor-pointer"} value={form.jwt_refresh_expiry} onChange={input("jwt_refresh_expiry")}>
              {["1d","3d","7d","14d","30d","60d","90d"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <Toggle on={form.jwt_refresh_enabled} onChange={v => set("jwt_refresh_enabled", v)} label="Enable Refresh Tokens" desc="Allow users to refresh their session without re-logging in" />
        <Toggle on={form.https_enforce}       onChange={v => set("https_enforce", v)}       label="Enforce HTTPS" desc="Reject plain HTTP requests" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Smartphone size={11}/> Two-Factor Authentication</h3>
        <Toggle on={form.two_factor_enabled} onChange={v => set("two_factor_enabled", v)} label="Enable 2FA" desc="Require a second factor when users log in" />
        {form.two_factor_enabled && (
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">2FA Method</label>
            <div className="flex gap-2">
              {[
                { v: "email_otp",   label: "Email OTP"   },
                { v: "phone_otp",   label: "Phone OTP"   },
                { v: "totp",        label: "Authenticator App" },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => set("two_factor_method", opt.v)}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-medium border transition-colors", form.two_factor_method === opt.v ? "border-primary bg-primary/10 text-primary" : "border-border text-[#8B92A5] hover:border-white/20 hover:text-white")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={11}/> Login Protection</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Max Failed Login Attempts</label>
            <input type="number" min="1" max="20" className={INPUT} value={form.login_attempt_limit} onChange={input("login_attempt_limit")} />
          </div>
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Account Lock Duration (min)</label>
            <input type="number" min="1" className={INPUT} value={form.account_lock_duration} onChange={input("account_lock_duration")} />
          </div>
        </div>
        <Toggle on={form.account_lock_enabled} onChange={v => set("account_lock_enabled", v)} label="Auto Account Lock" desc="Lock account after max failed attempts" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Session Timeout (min)</label>
            <input type="number" min="5" className={INPUT} value={form.session_timeout} onChange={input("session_timeout")} />
          </div>
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">API Rate Limit (req/min)</label>
            <input type="number" min="10" className={INPUT} value={form.api_rate_limit} onChange={input("api_rate_limit")} />
          </div>
        </div>
        <Toggle on={form.single_device_login}  onChange={v => set("single_device_login", v)}  label="Single Device Login" desc="Users can only be logged in on one device at a time" />
        <Toggle on={form.device_verification}  onChange={v => set("device_verification", v)}  label="Device Verification" desc="Require email confirmation for new devices" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Lock size={11}/> Password Policy</h3>
        <div>
          <label className="text-xs text-[#8B92A5] mb-1.5 block">Minimum Password Length</label>
          <input type="number" min="6" max="32" className={INPUT} value={form.password_min_length} onChange={input("password_min_length")} />
        </div>
        <Toggle on={form.password_require_upper}   onChange={v => set("password_require_upper", v)}   label="Require Uppercase Letter" />
        <Toggle on={form.password_require_number}  onChange={v => set("password_require_number", v)}  label="Require Number" />
        <Toggle on={form.password_require_special} onChange={v => set("password_require_special", v)} label="Require Special Character (!@#$...)" />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Globe size={11}/> Network & CORS</h3>
        <div>
          <label className="text-xs text-[#8B92A5] mb-1.5 block">Allowed CORS Origins (comma-separated)</label>
          <input className={INPUT} value={form.cors_origins} onChange={input("cors_origins")} placeholder="https://app.streampro.com,https://admin.streampro.com" />
        </div>
        <div>
          <label className="text-xs text-[#8B92A5] mb-1.5 block">IP Whitelist (comma-separated, leave blank to allow all)</label>
          <input className={INPUT} value={form.ip_whitelist} onChange={input("ip_whitelist")} placeholder="192.168.1.1,10.0.0.0/8" />
        </div>
        <div>
          <label className="text-xs text-[#8B92A5] mb-1.5 block">IP Blacklist (comma-separated)</label>
          <input className={INPUT} value={form.ip_blacklist} onChange={input("ip_blacklist")} placeholder="1.2.3.4,5.6.7.8" />
        </div>
        <Toggle on={form.admin_ip_restrict} onChange={v => set("admin_ip_restrict", v)} label="Restrict Admin Panel by IP" />
        {form.admin_ip_restrict && (
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Allowed Admin IPs</label>
            <input className={INPUT} value={form.admin_allowed_ips} onChange={input("admin_allowed_ips")} placeholder="203.0.113.0,198.51.100.0" />
          </div>
        )}
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white flex items-center gap-2"><Shield size={14} className="text-red-400" /> Force Logout All Devices</p>
          <p className="text-xs text-[#8B92A5] mt-0.5">Invalidates all active sessions for all users immediately</p>
        </div>
        <button onClick={() => { set("force_logout_all", true); toast.warning("Force logout initiated — all active sessions will be invalidated on next request"); }}
          className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors shrink-0">
          Force Logout
        </button>
      </div>

      <button onClick={save} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {loading ? "Saving…" : "Save Security Settings"}
      </button>
    </div>
  );
}
