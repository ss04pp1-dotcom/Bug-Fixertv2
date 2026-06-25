"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Save, Menu, RefreshCw, Check } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

const PERMISSION_GROUPS = [
  {
    group: "Dashboard & Analytics",
    permissions: [
      { key: "view_dashboard",  label: "View Dashboard",       desc: "Access main dashboard stats" },
      { key: "view_analytics",  label: "View Analytics",       desc: "View detailed analytics reports" },
      { key: "export_reports",  label: "Export Reports",       desc: "Download PDF/CSV reports" },
    ],
  },
  {
    group: "Content Management",
    permissions: [
      { key: "view_channels",   label: "View Channels",        desc: "View live TV channels" },
      { key: "manage_channels", label: "Manage Channels",      desc: "Add/edit/delete channels" },
      { key: "view_movies",     label: "View Movies",          desc: "View movie library" },
      { key: "manage_movies",   label: "Manage Movies",        desc: "Add/edit/delete movies" },
      { key: "manage_series",   label: "Manage Series",        desc: "Add/edit/delete TV series" },
      { key: "manage_epg",      label: "Manage EPG",           desc: "Electronic program guide" },
    ],
  },
  {
    group: "User Management",
    permissions: [
      { key: "view_users",      label: "View Users",           desc: "View user list" },
      { key: "manage_users",    label: "Manage Users",         desc: "Edit user profiles and status" },
      { key: "delete_users",    label: "Delete Users",         desc: "Permanently remove users" },
    ],
  },
  {
    group: "Financial",
    permissions: [
      { key: "view_billing",    label: "View Billing",         desc: "View payment & billing info" },
      { key: "manage_billing",  label: "Manage Billing",       desc: "Configure gateways & invoices" },
      { key: "issue_refunds",   label: "Issue Refunds",        desc: "Process payment refunds" },
      { key: "view_subs",       label: "View Subscriptions",   desc: "View subscription plans" },
      { key: "manage_subs",     label: "Manage Subscriptions", desc: "Create/edit plans & coupons" },
    ],
  },
  {
    group: "System",
    permissions: [
      { key: "manage_settings", label: "Manage Settings",      desc: "Change app-wide settings" },
      { key: "manage_roles",    label: "Manage Roles",         desc: "Create/edit user roles" },
      { key: "view_audit",      label: "View Audit Logs",      desc: "See system activity log" },
      { key: "manage_admins",   label: "Manage Admins",        desc: "Add/remove admin users" },
    ],
  },
];

interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystem?: boolean;
}

function buildMatrix(roles: Role[]): Record<string, Record<string, boolean>> {
  const matrix: Record<string, Record<string, boolean>> = {};
  PERMISSION_GROUPS.forEach(g => {
    g.permissions.forEach(p => {
      matrix[p.key] = {};
      roles.forEach(r => {
        matrix[p.key][r.name] = r.permissions.includes(p.key);
      });
    });
  });
  return matrix;
}

export default function Permissions() {
  const { call, loading: actionLoading } = useApiCallState();
  const { data: rolesData, isLoading: loading, refetch } = useApi<{ data: Role[] }>("/v1/roles");
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const roles: Role[] = rolesData?.data ?? [];

  useEffect(() => {
    if (roles.length > 0) setMatrix(buildMatrix(roles));
  }, [rolesData]);

  const toggle = (perm: string, roleName: string) => {
    const role = roles.find(r => r.name === roleName);
    if (role?.isSystem) return;
    setMatrix(prev => ({ ...prev, [perm]: { ...prev[perm], [roleName]: !prev[perm]?.[roleName] } }));
  };

  const save = async () => {
    setSaveErr("");
    const allPerms = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));
    const updates = roles
      .filter(r => !r.isSystem)
      .map(r => ({
        id: r.id,
        permissions: allPerms.filter(p => matrix[p]?.[r.name]),
      }));
    try {
      for (const upd of updates) {
        await call("put", `/v1/roles/${upd.id}`, { permissions: upd.permissions });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      refetch();
    } catch (e: any) { setSaveErr(e?.message ?? "Failed to save permissions"); }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Permissions</h1>
          {loading && <RefreshCw size={12} className="text-[#8B92A5] animate-spin" />}
        </div>
        <button
          onClick={save}
          disabled={actionLoading || loading || roles.length === 0}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50",
            saved ? "bg-green-600 text-white" : "gradient-primary text-white hover:opacity-90"
          )}
        >
          {saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? "Saved!" : actionLoading ? "Saving…" : "Save Permissions"}
        </button>
      </div>

      {roles.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-xs text-[#8B92A5] gap-2">
          No roles found. Create roles first on the Roles page.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="text-primary animate-spin" />
        </div>
      )}

      {roles.length > 0 && !loading && (
        <div className="p-6 overflow-x-auto">
          <div style={{ minWidth: `${280 + roles.length * 120}px` }}>
            <div className="grid gap-0 mb-1" style={{ gridTemplateColumns: `280px repeat(${roles.length}, 1fr)` }}>
              <div className="px-4 py-2 text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">Permission</div>
              {roles.map(r => (
                <div key={r.id} className="px-3 py-2 text-center">
                  <span className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-md",
                    r.isSystem ? "bg-primary/20 text-primary" : "bg-white/5 text-[#8B92A5]"
                  )}>{r.name}</span>
                </div>
              ))}
            </div>

            {PERMISSION_GROUPS.map(group => (
              <div key={group.group} className="mb-4">
                <div className="px-4 py-2 bg-white/[0.02] border-y border-border">
                  <span className="text-xs font-semibold text-white">{group.group}</span>
                </div>
                {group.permissions.map(perm => (
                  <div
                    key={perm.key}
                    className="grid border-b border-border/50 hover:bg-white/[0.02] transition-colors"
                    style={{ gridTemplateColumns: `280px repeat(${roles.length}, 1fr)` }}
                  >
                    <div className="px-4 py-3">
                      <div className="text-xs font-medium text-white">{perm.label}</div>
                      <div className="text-[10px] text-[#8B92A5]">{perm.desc}</div>
                    </div>
                    {roles.map(role => {
                      const checked = matrix[perm.key]?.[role.name] ?? false;
                      const isSystem = role.isSystem ?? false;
                      return (
                        <div key={role.id} className="flex items-center justify-center py-3">
                          <button
                            onClick={() => toggle(perm.key, role.name)}
                            className={cn(
                              "w-5 h-5 rounded flex items-center justify-center transition-colors border",
                              checked
                                ? isSystem
                                  ? "bg-primary/30 border-primary/50 cursor-not-allowed"
                                  : "bg-primary border-primary"
                                : "bg-transparent border-border hover:border-primary/50"
                            )}
                          >
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
