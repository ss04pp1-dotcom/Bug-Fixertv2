"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Save, Shield, Bell, Key, LogOut, Camera, Menu, RefreshCw, Activity, Clock, Globe, Monitor } from "lucide-react";
import { useApi, useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface AdminProfile {
  id: string;
  identifier: string;
  role: { name: string };
  createdAt: string;
  lastLoginAt?: string;
}

interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  isCurrent?: boolean;
}

const tabs = [
  { id: "profile",       label: "Profile Info" },
  { id: "security",      label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "activity",      label: "Activity" },
];

export default function Profile() {
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved]         = useState(false);
  const [pwSaved, setPwSaved]     = useState(false);
  const [pwError, setPwError]     = useState("");
  const [saveError, setSaveError] = useState("");
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({});

  const { data: profile, isLoading } = useApi<AdminProfile>("/v1/auth/profile");
  const { data: sessions, refetch: refetchSessions } = useApi<Session[]>("/v1/auth/sessions");
  const { data: auditLogs, isLoading: auditLoading } = useApi<{ data: AuditLog[]; total: number }>("/v1/audit?limit=20&page=1");
  const { call, loading: mutating }  = useApiCallState();

  const firstRef   = useRef<HTMLInputElement>(null);
  const lastRef    = useRef<HTMLInputElement>(null);
  const curPwRef   = useRef<HTMLInputElement>(null);
  const newPwRef   = useRef<HTMLInputElement>(null);
  const confPwRef  = useRef<HTMLInputElement>(null);

  const displayName  = profile?.identifier ?? "Admin";
  const displayEmail = profile?.identifier?.includes("@") ? profile.identifier : "admin@streampro.com";
  const roleLabel    = profile?.role?.name ?? "Super Admin";
  const initials     = displayName[0]?.toUpperCase() ?? "A";

  useEffect(() => {
    if (!profile) return;
    const parts = displayName.split(" ");
    if (firstRef.current) firstRef.current.value = parts[0] ?? "";
    if (lastRef.current)  lastRef.current.value  = parts.slice(1).join(" ") || "";
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    const first = firstRef.current?.value?.trim() ?? "";
    const last  = lastRef.current?.value?.trim() ?? "";
    const name  = [first, last].filter(Boolean).join(" ") || undefined;
    setSaveError("");
    try {
      const result = await call("put", "/v1/auth/profile", { name });
      if (result) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      setSaveError(getApiErrorMessage(e));
      toast.error("Failed to save profile", { description: getApiErrorMessage(e) });
    }
  };

  const changePassword = async () => {
    setPwError("");
    const currentPassword = curPwRef.current?.value?.trim() ?? "";
    const newPassword     = newPwRef.current?.value?.trim() ?? "";
    const confirmPassword = confPwRef.current?.value?.trim() ?? "";
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError("All fields are required."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match."); return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters."); return;
    }
    try {
      await call("put", "/v1/auth/change-password", { currentPassword, newPassword });
      if (curPwRef.current) curPwRef.current.value = "";
      if (newPwRef.current) newPwRef.current.value = "";
      if (confPwRef.current) confPwRef.current.value = "";
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 2000);
    } catch (e: any) {
      setPwError(e?.message ?? "Failed to update password.");
      toast.error("Failed to update password", { description: getApiErrorMessage(e) });
    }
  };

  const handleLogout = async () => {
    await call("post", "/v1/auth/logout");
    window.location.href = "/login";
  };

  const revokeSession = async (id: string) => {
    if (!confirm("Revoke this session? That device will be logged out.")) return;
    await call("delete", `/v1/auth/sessions/${id}`);
    refetchSessions();
  };

  const revokeAll = async () => {
    if (!confirm("This will log out ALL other sessions. Continue?")) return;
    await call("post", "/v1/auth/logout-all");
    refetchSessions();
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Profile</h1>
        </div>
        {isLoading && <RefreshCw size={14} className="text-primary animate-spin" />}
      </div>

      <div className="p-6 max-w-3xl">
        {/* Profile Banner */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5">
          <div className="h-24 gradient-primary relative">
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, #9333EA 0%, transparent 60%)" }} />
          </div>
          <div className="px-6 pb-5 relative">
            <div className="flex items-end justify-between -mt-10 mb-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full gradient-primary border-4 border-card flex items-center justify-center text-2xl font-bold text-white">
                  {initials}
                </div>
                <button className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                  <Camera size={12} className="text-white" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleLogout} disabled={mutating} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                  <LogOut size={12} /> Logout
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-base font-bold text-white">{displayName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-[#8B92A5]">{displayEmail}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full gradient-primary text-white font-semibold">{roleLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn("px-4 py-2.5 text-xs font-medium border-b-2 transition-colors",
                activeTab === t.id ? "border-primary text-white" : "border-transparent text-[#8B92A5] hover:text-white"
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Info Tab */}
        {activeTab === "profile" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white mb-2">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">First Name</label>
                <input ref={firstRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Last Name</label>
                <input ref={lastRef} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
              </div>
            </div>
            <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Email</label>
              <input defaultValue={displayEmail} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
            </div>
            <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Role</label>
              <input value={roleLabel} readOnly className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-[#8B92A5] outline-none cursor-not-allowed" />
            </div>
            {profile?.createdAt && (
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Member Since</label>
                <input value={new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} readOnly
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-[#8B92A5] outline-none cursor-not-allowed" />
              </div>
            )}
            {saveError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400">{saveError}</div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={mutating} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50",
                saved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
              )}>
                <Save size={13} /> {saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Key size={15} className="text-primary" /> Change Password
              </h3>
              {pwError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400">{pwError}</div>
              )}
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Current Password</label>
                <input ref={curPwRef} type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="••••••••" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">New Password</label>
                <input ref={newPwRef} type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="••••••••" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Confirm New Password</label>
                <input ref={confPwRef} type="password" className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="••••••••" />
              </div>
              <button onClick={changePassword} disabled={mutating} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50",
                pwSaved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
              )}>
                <Key size={13} /> {pwSaved ? "Password Updated!" : "Update Password"}
              </button>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
                <Shield size={15} className="text-primary" /> Two-Factor Authentication
              </h3>
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div>
                  <div className="text-xs font-medium text-white">Enable 2FA</div>
                  <div className="text-[11px] text-[#8B92A5]">Secure your account with TOTP authenticator</div>
                </div>
                <div className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", tfaEnabled ? "bg-primary" : "bg-white/10")}
                  onClick={async () => {
                    const next = !tfaEnabled;
                    setTfaEnabled(next);
                    try {
                      await call("patch", "/v1/auth/profile", { tfaEnabled: next });
                      toast.success(next ? "2FA enabled successfully" : "2FA disabled");
                    } catch {
                      setTfaEnabled(v => !v);
                      toast.error("Failed to update 2FA setting");
                    }
                  }}>
                  <div className={cn("w-4 h-4 rounded-full bg-white transition-all", tfaEnabled ? "ml-auto" : "")} />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Active Sessions</h3>
                {(sessions ?? []).length > 1 && (
                  <button onClick={revokeAll} disabled={mutating} className="text-xs text-red-400 hover:underline disabled:opacity-50">Revoke All Others</button>
                )}
              </div>
              {(sessions ?? []).length === 0 && (
                <div className="text-xs text-[#8B92A5] py-2">No active sessions found</div>
              )}
              {(sessions ?? []).map((s, i) => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <div className="text-xs font-medium text-white flex items-center gap-1.5">
                      {s.userAgent ?? `Session ${i + 1}`}
                      {s.isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Current</span>}
                    </div>
                    <div className="text-[10px] text-[#8B92A5]">
                      {s.ipAddress ?? "Unknown IP"} ·{" "}
                      {new Date(s.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => revokeSession(s.id)} disabled={mutating}
                      className="text-xs text-red-400 hover:underline disabled:opacity-50">Revoke</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
              <Bell size={15} className="text-primary" /> Notification Preferences
            </h3>
            {[
              { key: "new_users",       label: "New User Registrations",    desc: "Get notified when new users sign up" },
              { key: "payment_alerts",   label: "Payment Alerts",            desc: "Alerts for new payments and failures" },
              { key: "system_alerts",    label: "System Alerts",             desc: "Critical system events and errors" },
              { key: "content_updates",  label: "Content Updates",           desc: "When content is added or modified" },
              { key: "support_tickets",  label: "Support Tickets",           desc: "New and updated support requests" },
              { key: "subscription_renewals", label: "Subscription Renewals",     desc: "Subscription expiry and renewal events" },
              { key: "weekly_report",    label: "Weekly Report Email",       desc: "Weekly summary report via email" },
            ].map(n => (
              <div key={n.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <div className="text-xs font-medium text-white">{n.label}</div>
                  <div className="text-[11px] text-[#8B92A5]">{n.desc}</div>
                </div>
                <div className={cn("w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors", notifToggles[n.key] ? "bg-primary" : "bg-white/10")}
                  onClick={() => {
                    setNotifToggles(v => ({ ...v, [n.key]: !v[n.key] }));
                    toast.info("Notification preferences are coming soon!");
                  }}>
                  <div className={cn("w-4 h-4 rounded-full bg-white transition-all", notifToggles[n.key] ? "ml-auto" : "")} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5"><Activity size={13} className="text-primary" /> Recent Activity</h3>
              {auditLoading && <RefreshCw size={12} className="text-primary animate-spin" />}
            </div>
            {auditLoading ? (
              <div className="flex items-center justify-center py-12"><RefreshCw size={18} className="text-primary animate-spin" /></div>
            ) : (auditLogs?.data ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#8B92A5]">No activity logs found</div>
            ) : (
              <div className="divide-y divide-border/50">
                {(auditLogs?.data ?? []).map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02]">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Activity size={11} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white capitalize">{log.action?.replace(/_/g, ' ') ?? '—'}</span>
                        {log.resource && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{log.resource}</span>}
                      </div>
                      {log.details && <div className="text-[11px] text-[#8B92A5] mt-0.5 truncate">{log.details}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        {log.ipAddress && <span className="text-[10px] text-[#8B92A5] flex items-center gap-1"><Globe size={9} />{log.ipAddress}</span>}
                        <span className="text-[10px] text-[#8B92A5] flex items-center gap-1">
                          <Clock size={9} />
                          {new Date(log.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(auditLogs?.total ?? 0) > 20 && (
              <div className="px-4 py-3 border-t border-border text-center text-[11px] text-[#8B92A5]">
                Showing 20 of {auditLogs?.total} entries
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
