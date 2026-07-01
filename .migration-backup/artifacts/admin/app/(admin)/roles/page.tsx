"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Users, Shield, Menu, RefreshCw } from "lucide-react";
import { useApi, useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  _count?: { users?: number };
}

const ROLE_GRADIENTS = ["gradient-primary","gradient-blue","gradient-green","gradient-orange","gradient-pink","gradient-primary"];

const ALL_PERMISSIONS = [
  "view_dashboard", "view_analytics", "export_reports",
  "view_channels", "manage_channels", "view_movies", "manage_movies", "manage_series", "manage_epg",
  "view_users", "manage_users", "delete_users",
  "view_billing", "manage_billing", "issue_refunds", "view_subs", "manage_subs",
  "manage_settings", "manage_roles", "view_audit", "manage_admins",
];

export default function Roles() {
  const [showModal, setShowModal]   = useState(false);
  const [selected, setSelected]     = useState<Role | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const nameRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  const { data, isLoading: loading, refetch } = useApi<{ data: Role[] }>("/v1/roles");
  const { call, loading: mutating } = useApiCallState();

  const roles = data?.data ?? [];

  const openCreate = () => { setSelected(null); setSelectedPerms([]); setShowModal(true); };
  const openEdit   = (r: Role) => { setSelected(r); setSelectedPerms(r.permissions ?? []); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSelected(null); };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    if (!name) return;
    const body = { name, description: descRef.current?.value?.trim() || undefined, permissions: selectedPerms };
    // D-025 fix: keep modal open on failure so the user can fix input
    try {
      if (selected) {
        await call("put", `/v1/roles/${selected.id}`, body);
      } else {
        await call("post", "/v1/roles", body);
      }
      closeModal();
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to save role");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role?")) return;
    try {
      await call("delete", `/v1/roles/${id}`);
      refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || "Failed to delete role");
    }
  };

  const togglePerm = (p: string) => {
    setSelectedPerms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Roles</h1>
          {roles.length > 0 && <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">{roles.length} roles</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus size={13} /> Add Role
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {!loading && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.length === 0 && (
                <div className="col-span-3 text-center py-12 text-sm text-[#8B92A5]">No roles found. Create your first role.</div>
              )}
              {roles.map((role, i) => (
                <div key={role.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", ROLE_GRADIENTS[i % ROLE_GRADIENTS.length])}>
                      <Shield size={18} className="text-white" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(role)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                        <Edit size={13} className="text-[#8B92A5]" />
                      </button>
                      <button onClick={() => handleDelete(role.id)} disabled={mutating}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-50">
                        <Trash2 size={13} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">{role.name}</h3>
                  <p className="text-xs text-[#8B92A5] mb-3">{role.description ?? "No description"}</p>
                  <div className="flex items-center gap-1.5 text-xs text-[#8B92A5] mb-3">
                    <Users size={11} />
                    <span>{role._count?.users ?? 0} {(role._count?.users ?? 0) === 1 ? "user" : "users"}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(role.permissions ?? []).slice(0, 4).map(p => (
                      <span key={p} className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary">{p}</span>
                    ))}
                    {(role.permissions ?? []).length > 4 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[#8B92A5]">+{role.permissions.length - 4} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {roles.length > 0 && (
              <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-border">
                  <h3 className="text-xs font-semibold text-white">Role Assignments</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-[#0d1525]">
                      {["Role","Description","Users Assigned","Permissions","Action"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r, i) => (
                      <tr key={r.id} className="tbl-row border-b border-border/50 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", ROLE_GRADIENTS[i % ROLE_GRADIENTS.length])}>
                              <Shield size={12} className="text-white" />
                            </div>
                            <span className="text-sm font-medium text-white">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#8B92A5] max-w-[200px] truncate">{r.description ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-white">{r._count?.users ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#8B92A5]">{(r.permissions ?? []).length} modules</td>
                        <td className="px-4 py-3">
                          <button onClick={() => openEdit(r)} className="text-xs text-primary hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {(showModal || selected) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">{selected ? `Edit Role: ${selected.name}` : "Add New Role"}</h2>
              <button onClick={closeModal} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Role Name</label>
                <input ref={nameRef} defaultValue={selected?.name} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Enter role name" />
              </div>
              <div><label className="text-xs text-[#8B92A5] mb-1.5 block">Description</label>
                <input ref={descRef} defaultValue={selected?.description} className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" placeholder="Role description" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-2 block">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={selectedPerms.includes(p)} onChange={() => togglePerm(p)}
                        className="w-3.5 h-3.5 accent-primary" />
                      <span className="text-xs text-[#8B92A5]">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleSave} disabled={mutating} className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {mutating ? "Saving…" : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
