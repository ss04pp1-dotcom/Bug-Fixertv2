"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, Eye, ChevronLeft, ChevronRight, ChevronDown, Menu, RefreshCw, Ban, CheckCircle, X, Mail, Phone, ShieldCheck, Calendar, Plus, Trash2 } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  role: string;
  createdAt: string;
}

interface UsersResponse {
  data: User[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: CreateForm = { name: "", email: "", password: "", role: "user" };

export default function Users() {
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatus]     = useState("all");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showCreate,   setShowCreate] = useState(false);
  const [createForm,   setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [createError,  setCreateError] = useState("");

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter !== "all") params.set("isActive", statusFilter === "active" ? "true" : "false");

  const { data, isLoading: loading, error, refetch } = useApi<UsersResponse>(`/v1/users?${params}`);
  const { call, loading: actionLoading } = useApiCallState();
  const [actionErr, setActionErr] = useState("");

  const users = data?.data ?? [];
  const meta  = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const handleToggle = async (id: string, isActive: boolean) => {
    setActionErr("");
    try {
      await call("put", `/v1/users/${id}`, { isActive: !isActive });
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to update user"); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name || id}"? This cannot be undone.`)) return;
    setActionErr("");
    try {
      await call("delete", `/v1/users/${id}`);
      setSelectedUser(null);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to delete user"); }
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!createForm.email.trim() || !createForm.password.trim()) {
      setCreateError("Email and password are required."); return;
    }
    if (createForm.password.length < 6) {
      setCreateError("Password must be at least 6 characters."); return;
    }
    try {
      await call("post", "/v1/users", {
        name:       createForm.name.trim() || undefined,
        email:      createForm.email.trim(),
        password:   createForm.password,
        role:       createForm.role,
      });
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
    } catch (e: any) { setCreateError(e?.message ?? "Failed to create user"); return; }
    refetch();
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Users</h1>
          {total > 0 && (
            <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">
              {total.toLocaleString()} total
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button onClick={() => { setCreateError(""); setCreateForm(EMPTY_FORM); setShowCreate(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
            <Plus size={12} /> Add User
          </button>
        </div>
      </div>

      <div className="p-6">
        {actionErr && (
          <div className="mb-4 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
            <span className="shrink-0">⚠</span> {actionErr}
            <button onClick={() => setActionErr("")} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
          </div>
        )}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
            <Search size={14} className="text-[#8B92A5] shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users…"
              className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="appearance-none bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-[#8B92A5] outline-none cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="text-primary animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-red-400 text-sm">Failed to load users</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">User</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Email / Phone</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Role</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Joined</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No users found</td>
                    </tr>
                  ) : users.map((u, i) => (
                    <tr key={u.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-white">{u.name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{u.email || u.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#8B92A5] capitalize">{u.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium",
                          u.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        )}>
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">
                        {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleToggle(u.id, u.isActive)} disabled={actionLoading}
                            title={u.isActive ? "Deactivate user" : "Activate user"}
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-50">
                            {u.isActive
                              ? <Ban size={13} className="text-red-400" />
                              : <CheckCircle size={13} className="text-green-400" />}
                          </button>
                          <button onClick={() => setSelectedUser(u)} title="View user details"
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Eye size={13} className="text-[#8B92A5]" />
                          </button>
                          <button onClick={() => handleDelete(u.id, u.name)} disabled={actionLoading}
                            title="Delete user"
                            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-50">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-[#8B92A5]">
                  Showing {users.length} of {total.toLocaleString()} entries
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
                    <ChevronLeft size={13} />
                  </button>
                  {(() => {
                    const getPageNumbers = (cur: number, tot: number) => {
                      const maxVisible = 5;
                      let start = Math.max(1, cur - Math.floor(maxVisible / 2));
                      let end = start + maxVisible - 1;
                      if (end > tot) { end = tot; start = Math.max(1, end - maxVisible + 1); }
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
                    };
                    return getPageNumbers(page, pages).map(pg => (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={cn("w-7 h-7 rounded-md text-xs font-medium", pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5")}>
                        {pg}
                      </button>
                    ));
                  })()}
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40">
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">User Details</h2>
              <button onClick={() => setSelectedUser(null)} className="text-[#8B92A5] hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-xl font-bold text-white shrink-0">
                  {(selectedUser.name || selectedUser.email || "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{selectedUser.name || "—"}</div>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium",
                    selectedUser.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[#8B92A5] shrink-0" />
                  <span className="text-sm text-white">{selectedUser.email || "No email"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[#8B92A5] shrink-0" />
                  <span className="text-sm text-white">{selectedUser.phone || "No phone"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={14} className="text-[#8B92A5] shrink-0" />
                  <span className="text-sm text-white capitalize">{selectedUser.role.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-[#8B92A5] shrink-0" />
                  <span className="text-sm text-white">
                    Joined {new Date(selectedUser.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <div className="text-[10px] text-[#8B92A5] mb-1">User ID</div>
                <div className="font-mono text-[11px] text-[#8B92A5] bg-background rounded-lg px-3 py-2 break-all">{selectedUser.id}</div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { handleToggle(selectedUser.id, selectedUser.isActive); setSelectedUser(null); }}
                disabled={actionLoading}
                className={cn("flex-1 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50",
                  selectedUser.isActive ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400")}>
                {selectedUser.isActive ? "Deactivate" : "Activate"}
              </button>
              <button onClick={() => handleDelete(selectedUser.id, selectedUser.name)} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold text-white">Add New User</h2>
              <button onClick={() => setShowCreate(false)} className="text-[#8B92A5] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-400">{createError}</div>
              )}
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Name</label>
                <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  placeholder="Full name" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Email *</label>
                <input value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  type="email"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  placeholder="user@example.com" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Password *</label>
                <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  type="password"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  placeholder="Min. 6 characters" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Role</label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary">
                  <option value="user">User</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={handleCreate} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
                {actionLoading ? "Creating…" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
