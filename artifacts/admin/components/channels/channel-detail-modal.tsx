"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, ChevronUp, ChevronDown, Play, Trash2, RotateCcw, Plus,
  CheckCircle, XCircle, Loader2, Clock, Github, Server,
  Shield, Save, AlertTriangle, Info, ExternalLink, ToggleLeft,
  ToggleRight, Wifi, WifiOff, ImageIcon, Tag, Type,
} from "lucide-react";
import { apiClient } from "@/lib/axios-client";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Category { id: string; name: string }

interface ChannelServer {
  id: string;
  link: string;
  priority: number;
  sourceType: "ADMIN" | "GITHUB";
  enabled: boolean;
  healthCheckEnabled: boolean;
  cookie?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  origin?: string | null;
  lastSeenAt?: string | null;
  githubChannelId?: string | null;
  githubSource?: {
    id: string;
    name: string;
    lastSyncAt?: string | null;
    lastSyncStatus?: "pending" | "running" | "success" | "failed" | null;
    lastSyncMessage?: string | null;
  } | null;
  createdAt: string;
}

interface ChannelDetail {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  streamType: string;
  primaryStreamUrl?: string | null;
  epgChannelId?: string | null;
  isActive: boolean;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  normalizedName?: string | null;
  githubChannelId?: string | null;
  adminNameOverride?: string | null;
  adminLogoOverride?: string | null;
  adminCategoryIdOverride?: string | null;
  servers: ChannelServer[];
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  contentType?: string | null;
  error?: string;
}

type Tab = "info" | "overrides" | "servers" | "github";

interface Props {
  channelId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function SourceBadge({ overridden }: { overridden: boolean }) {
  return overridden ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
      <Shield size={9} /> Admin Override
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#8B92A5]/15 text-[#8B92A5] font-medium">
      <Github size={9} /> GitHub Source
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ChannelDetailModal({ channelId, categories, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [detail, setDetail]       = useState<ChannelDetail | null>(null);
  const [servers, setServers]     = useState<ChannelServer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Basic Info state ──────────────────────────────────────────────────────
  const nameRef      = useRef<HTMLInputElement>(null);
  const urlRef       = useRef<HTMLInputElement>(null);
  const streamRef    = useRef<HTMLSelectElement>(null);
  const tvgRef       = useRef<HTMLInputElement>(null);
  const catRef       = useRef<HTMLSelectElement>(null);
  const [editLogo, setEditLogo] = useState("");

  // ── Override state ────────────────────────────────────────────────────────
  const [overrideName,   setOverrideName]   = useState("");
  const [overrideLogo,   setOverrideLogo]   = useState("");
  const [overrideCatId,  setOverrideCatId]  = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [resetingField,  setResetingField]  = useState<string | null>(null);

  // ── Server state ──────────────────────────────────────────────────────────
  const [testResults,   setTestResults]   = useState<Record<string, TestResult>>({});
  const [testingIds,    setTestingIds]    = useState<Set<string>>(new Set());
  const [togglingIds,   setTogglingIds]   = useState<Set<string>>(new Set());
  const [deletingIds,   setDeletingIds]   = useState<Set<string>>(new Set());
  const [reorderSaving, setReorderSaving] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [addSaving,     setAddSaving]     = useState(false);
  const [addError,      setAddError]      = useState<string | null>(null);
  const addUrlRef       = useRef<HTMLInputElement>(null);
  const addCookieRef    = useRef<HTMLInputElement>(null);
  const addUARef        = useRef<HTMLInputElement>(null);
  const addRefererRef   = useRef<HTMLInputElement>(null);
  const addOriginRef    = useRef<HTMLInputElement>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chRes, srvRes] = await Promise.all([
        apiClient.get(`/v1/channels/${channelId}`),
        apiClient.get(`/v1/channels/${channelId}/servers`),
      ]);
      const ch: ChannelDetail = chRes.data?.data ?? chRes.data;
      setDetail(ch);
      setEditLogo(ch.logo ?? "");
      setOverrideName(ch.adminNameOverride ?? "");
      setOverrideLogo(ch.adminLogoOverride ?? "");
      setOverrideCatId(ch.adminCategoryIdOverride ?? "");
      const srvData = srvRes.data?.data ?? srvRes.data;
      setServers(Array.isArray(srvData) ? srvData : []);
    } catch {
      setError("Failed to load channel details");
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // ── Basic info save ───────────────────────────────────────────────────────
  const handleInfoSave = async () => {
    if (!detail) return;
    const name = nameRef.current?.value?.trim();
    const url  = urlRef.current?.value?.trim();
    if (!name) return;
    setSaving(true);
    try {
      await apiClient.put(`/v1/channels/${detail.id}`, {
        name,
        streamType:      streamRef.current?.value || detail.streamType,
        primaryStreamUrl: url || detail.primaryStreamUrl,
        epgChannelId:    tvgRef.current?.value || null,
        categoryId:      catRef.current?.value || null,
        logo:            editLogo || null,
      });
      await loadDetail();
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Override save/reset ───────────────────────────────────────────────────
  const handleOverrideSave = async () => {
    if (!detail) return;
    setOverrideSaving(true);
    try {
      await apiClient.patch(`/v1/channels/${detail.id}/overrides`, {
        adminNameOverride:        overrideName.trim() || null,
        adminLogoOverride:        overrideLogo.trim() || null,
        adminCategoryIdOverride:  overrideCatId || null,
      });
      await loadDetail();
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to save overrides");
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleResetOverride = async (field: string) => {
    if (!detail) return;
    setResetingField(field);
    try {
      await apiClient.delete(`/v1/channels/${detail.id}/overrides/${field}`);
      await loadDetail();
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to reset");
    } finally {
      setResetingField(null);
    }
  };

  // ── Server actions ────────────────────────────────────────────────────────
  const handleToggleServer = async (srv: ChannelServer) => {
    if (!detail) return;
    setTogglingIds(prev => new Set(prev).add(srv.id));
    try {
      const res = await apiClient.patch(`/v1/channels/${detail.id}/servers/${srv.id}`, {
        enabled: !srv.enabled,
      });
      const updated = res.data?.data ?? res.data;
      if (Array.isArray(updated)) setServers(updated);
      else await loadDetail();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to update server");
    } finally {
      setTogglingIds(prev => { const n = new Set(prev); n.delete(srv.id); return n; });
    }
  };

  const handleDeleteServer = async (srv: ChannelServer) => {
    if (!detail || !confirm(`Remove this server?\n${srv.link}`)) return;
    setDeletingIds(prev => new Set(prev).add(srv.id));
    try {
      await apiClient.delete(`/v1/channels/${detail.id}/servers/${srv.id}`);
      setServers(prev => prev.filter(s => s.id !== srv.id));
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to delete");
    } finally {
      setDeletingIds(prev => { const n = new Set(prev); n.delete(srv.id); return n; });
    }
  };

  const handleTestServer = async (srv: ChannelServer) => {
    if (!detail) return;
    setTestingIds(prev => new Set(prev).add(srv.id));
    try {
      const res = await apiClient.post(`/v1/channels/${detail.id}/servers/${srv.id}/test`);
      const result: TestResult = res.data?.data ?? res.data;
      setTestResults(prev => ({ ...prev, [srv.id]: result }));
    } catch {
      setTestResults(prev => ({ ...prev, [srv.id]: { ok: false, status: null, latencyMs: 0, error: "Request failed" } }));
    } finally {
      setTestingIds(prev => { const n = new Set(prev); n.delete(srv.id); return n; });
    }
  };

  const moveServer = async (idx: number, dir: "up" | "down") => {
    if (!detail) return;
    const list = [...servers];
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    const reordered = list.map((s, i) => ({ ...s, priority: i * 10 }));
    setServers(reordered);
    setReorderSaving(true);
    try {
      const res = await apiClient.put(`/v1/channels/${detail.id}/servers`, {
        servers: reordered.map(s => ({ id: s.id, priority: s.priority })),
      });
      const updated = res.data?.data ?? res.data;
      if (Array.isArray(updated)) setServers(updated);
    } catch {
      await loadDetail();
    } finally {
      setReorderSaving(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const link = addUrlRef.current?.value?.trim();
    if (!link) return;
    setAddSaving(true);
    setAddError(null);
    try {
      const res = await apiClient.post(`/v1/channels/${detail.id}/servers`, {
        link,
        cookie:    addCookieRef.current?.value?.trim() || undefined,
        userAgent: addUARef.current?.value?.trim() || undefined,
        referer:   addRefererRef.current?.value?.trim() || undefined,
        origin:    addOriginRef.current?.value?.trim() || undefined,
        priority:  0,
      });
      const srv: ChannelServer = res.data?.data ?? res.data;
      setServers(prev => [srv, ...prev].sort((a, b) => a.priority - b.priority));
      setShowAddServer(false);
      if (addUrlRef.current)    addUrlRef.current.value    = "";
      if (addCookieRef.current) addCookieRef.current.value = "";
      if (addUARef.current)     addUARef.current.value     = "";
    } catch (e: any) {
      setAddError(e?.response?.data?.message ?? "Failed to add server");
    } finally {
      setAddSaving(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "info",      label: "Basic Info",      show: true },
    { id: "overrides", label: "Admin Overrides",  show: true },
    { id: "servers",   label: `Servers (${servers.length})`, show: true },
    { id: "github",    label: "GitHub Details",   show: !!detail?.githubChannelId },
  ];

  const isGitHub = !!detail?.githubChannelId;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {detail?.logo && (
              <img src={detail.logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-black/20 border border-border/50 shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                {detail?.adminNameOverride ?? detail?.name ?? "Channel Details"}
              </h2>
              {isGitHub && (
                <span className="text-[10px] text-[#8B92A5] flex items-center gap-1 mt-0.5">
                  <Github size={9} /> GitHub Synced
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[#8B92A5] hover:text-white transition-colors shrink-0 ml-4">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-6 gap-1 pt-1">
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                activeTab === tab.id
                  ? "border-primary text-white"
                  : "border-transparent text-[#8B92A5] hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A5]">
              <XCircle size={28} className="text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={loadDetail} className="text-xs text-primary underline">Retry</button>
            </div>
          ) : detail ? (
            <>
              {/* ── Basic Info Tab ─────────────────────────────────────── */}
              {activeTab === "info" && (
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#8B92A5] mb-1.5 block">Channel Name *</label>
                      <input
                        ref={nameRef}
                        defaultValue={detail.name}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B92A5] mb-1.5 block">Stream Type</label>
                      <select
                        ref={streamRef}
                        defaultValue={detail.streamType}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer"
                      >
                        {["HLS", "M3U", "RTMP", "DASH"].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8B92A5] mb-1.5 block">Primary Stream URL</label>
                    <input
                      ref={urlRef}
                      defaultValue={detail.primaryStreamUrl ?? ""}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary font-mono text-xs"
                      placeholder="https://example.com/stream.m3u8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-[#8B92A5] mb-1.5 block">TVG ID (EPG)</label>
                      <input
                        ref={tvgRef}
                        defaultValue={detail.epgChannelId ?? ""}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#8B92A5] mb-1.5 block">Category</label>
                      <select
                        ref={catRef}
                        defaultValue={detail.categoryId ?? ""}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer"
                      >
                        <option value="">No category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <ImageUpload
                    value={editLogo}
                    onChange={setEditLogo}
                    uploadPath="/v1/storage/upload/logo"
                    label="Channel Logo"
                    previewClass="h-20 w-full"
                  />
                </div>
              )}

              {/* ── Overrides Tab ──────────────────────────────────────── */}
              {activeTab === "overrides" && (
                <div className="p-6 space-y-5">
                  {!isGitHub && (
                    <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#8B92A5]/10 text-[#8B92A5] text-xs">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>This channel was not synced from GitHub. Overrides are still supported but the "GitHub Source" values shown below are the current admin-set values.</span>
                    </div>
                  )}

                  {/* Name Override */}
                  <div className="bg-background/60 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Type size={14} className="text-[#8B92A5]" />
                        <span className="text-sm font-medium text-white">Name</span>
                      </div>
                      <SourceBadge overridden={!!detail.adminNameOverride} />
                    </div>
                    <div className="text-xs text-[#8B92A5]">
                      GitHub value: <span className="text-white font-mono">{detail.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={overrideName}
                        onChange={e => setOverrideName(e.target.value)}
                        placeholder="Override name (leave blank to use GitHub value)"
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary placeholder-[#4B5563]"
                      />
                      {detail.adminNameOverride && (
                        <button
                          onClick={() => handleResetOverride("adminNameOverride")}
                          disabled={resetingField === "adminNameOverride"}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {resetingField === "adminNameOverride"
                            ? <Loader2 size={11} className="animate-spin" />
                            : <RotateCcw size={11} />}
                          Reset to GitHub
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Logo Override */}
                  <div className="bg-background/60 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={14} className="text-[#8B92A5]" />
                        <span className="text-sm font-medium text-white">Logo</span>
                      </div>
                      <SourceBadge overridden={!!detail.adminLogoOverride} />
                    </div>
                    {detail.logo && !detail.adminLogoOverride && (
                      <div className="flex items-center gap-2 text-xs text-[#8B92A5]">
                        GitHub logo:
                        <img src={detail.logo} alt="" className="h-8 w-8 rounded object-contain border border-border" />
                        <span className="font-mono truncate max-w-xs">{detail.logo.slice(0, 60)}</span>
                      </div>
                    )}
                    <ImageUpload
                      value={overrideLogo}
                      onChange={setOverrideLogo}
                      uploadPath="/v1/storage/upload/logo"
                      label="Override Logo"
                      previewClass="h-16 w-full"
                    />
                    {detail.adminLogoOverride && (
                      <button
                        onClick={() => handleResetOverride("adminLogoOverride")}
                        disabled={resetingField === "adminLogoOverride"}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        {resetingField === "adminLogoOverride"
                          ? <Loader2 size={11} className="animate-spin" />
                          : <RotateCcw size={11} />}
                        Reset to GitHub Logo
                      </button>
                    )}
                  </div>

                  {/* Category Override */}
                  <div className="bg-background/60 border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-[#8B92A5]" />
                        <span className="text-sm font-medium text-white">Category</span>
                      </div>
                      <SourceBadge overridden={!!detail.adminCategoryIdOverride} />
                    </div>
                    <div className="text-xs text-[#8B92A5]">
                      Current: <span className="text-white">{detail.category?.name ?? "No category"}</span>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={overrideCatId}
                        onChange={e => setOverrideCatId(e.target.value)}
                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary appearance-none cursor-pointer"
                      >
                        <option value="">Use GitHub category (or none)</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      {detail.adminCategoryIdOverride && (
                        <button
                          onClick={() => handleResetOverride("adminCategoryIdOverride")}
                          disabled={resetingField === "adminCategoryIdOverride"}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {resetingField === "adminCategoryIdOverride"
                            ? <Loader2 size={11} className="animate-spin" />
                            : <RotateCcw size={11} />}
                          Reset
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleOverrideSave}
                    disabled={overrideSaving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {overrideSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Overrides
                  </button>
                </div>
              )}

              {/* ── Servers Tab ────────────────────────────────────────── */}
              {activeTab === "servers" && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#8B92A5]">
                      Admin servers play first (lower priority number = higher preference). GitHub servers fill in as fallback.
                    </p>
                    <button
                      onClick={() => setShowAddServer(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors shrink-0"
                    >
                      <Plus size={12} /> Add Server
                    </button>
                  </div>

                  {/* Add Server Form */}
                  {showAddServer && (
                    <form onSubmit={handleAddServer} className="bg-background/60 border border-border rounded-xl p-4 space-y-3">
                      <p className="text-xs font-medium text-white">New Admin Server</p>
                      <div>
                        <label className="text-xs text-[#8B92A5] mb-1 block">Stream URL *</label>
                        <input
                          ref={addUrlRef}
                          required
                          placeholder="https://example.com/stream.m3u8"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary font-mono text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#8B92A5] mb-1 block">Cookie</label>
                          <input ref={addCookieRef} placeholder="Optional" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-[#8B92A5] mb-1 block">User-Agent</label>
                          <input ref={addUARef} placeholder="Optional" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-[#8B92A5] mb-1 block">Referer</label>
                          <input ref={addRefererRef} placeholder="Optional" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-xs text-[#8B92A5] mb-1 block">Origin</label>
                          <input ref={addOriginRef} placeholder="Optional" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary" />
                        </div>
                      </div>
                      {addError && <p className="text-xs text-red-400">{addError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowAddServer(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white">Cancel</button>
                        <button type="submit" disabled={addSaving} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50">
                          {addSaving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Server
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Server List */}
                  {servers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-[#8B92A5]">
                      <Server size={32} className="mb-2 opacity-30" />
                      <p className="text-sm">No servers yet. Add an admin server or sync from GitHub.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {reorderSaving && (
                        <div className="text-xs text-[#8B92A5] flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin" /> Saving order…
                        </div>
                      )}
                      {servers.map((srv, idx) => {
                        const isTesting  = testingIds.has(srv.id);
                        const isToggling = togglingIds.has(srv.id);
                        const isDeleting = deletingIds.has(srv.id);
                        const testResult = testResults[srv.id];
                        const isAdmin    = srv.sourceType === "ADMIN";

                        return (
                          <div
                            key={srv.id}
                            className={cn(
                              "border border-border rounded-xl p-3 space-y-2 transition-all",
                              !srv.enabled && "opacity-60",
                              isAdmin ? "bg-background/40" : "bg-[#0d1525]/60"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {/* Priority controls */}
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  onClick={() => moveServer(idx, "up")}
                                  disabled={idx === 0 || reorderSaving}
                                  className="w-5 h-5 flex items-center justify-center rounded text-[#8B92A5] hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronUp size={11} />
                                </button>
                                <div className="w-5 text-center text-[10px] text-[#8B92A5] font-mono">{idx + 1}</div>
                                <button
                                  onClick={() => moveServer(idx, "down")}
                                  disabled={idx === servers.length - 1 || reorderSaving}
                                  className="w-5 h-5 flex items-center justify-center rounded text-[#8B92A5] hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                                >
                                  <ChevronDown size={11} />
                                </button>
                              </div>

                              {/* Source badge */}
                              <div className="shrink-0">
                                {isAdmin ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                    <Shield size={9} /> Admin
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#8B92A5]/15 text-[#8B92A5]">
                                    <Github size={9} /> {srv.githubSource?.name ?? "GitHub"}
                                  </span>
                                )}
                              </div>

                              {/* URL */}
                              <span className="flex-1 font-mono text-xs text-white truncate" title={srv.link}>
                                {srv.link}
                              </span>

                              {/* Last seen */}
                              <span className="text-[10px] text-[#8B92A5] shrink-0 hidden sm:block">
                                <Clock size={9} className="inline mr-0.5" />
                                {formatRelative(srv.lastSeenAt ?? srv.createdAt)}
                              </span>

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Test */}
                                <button
                                  onClick={() => handleTestServer(srv)}
                                  disabled={isTesting}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[#8B92A5] hover:text-white disabled:opacity-50 transition-colors"
                                  title="Test server"
                                >
                                  {isTesting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                                </button>
                                {/* Enable/disable */}
                                <button
                                  onClick={() => handleToggleServer(srv)}
                                  disabled={isToggling}
                                  className={cn(
                                    "w-6 h-6 flex items-center justify-center rounded transition-colors",
                                    srv.enabled
                                      ? "text-green-400 hover:bg-green-500/10"
                                      : "text-[#8B92A5] hover:bg-white/10 hover:text-white"
                                  )}
                                  title={srv.enabled ? "Disable" : "Enable"}
                                >
                                  {isToggling
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : srv.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                                </button>
                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteServer(srv)}
                                  disabled={isDeleting}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/10 text-[#8B92A5] hover:text-red-400 disabled:opacity-50 transition-colors"
                                  title="Remove server"
                                >
                                  {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                </button>
                              </div>
                            </div>

                            {/* Test result */}
                            {testResult && (
                              <div className={cn(
                                "flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg",
                                testResult.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                              )}>
                                {testResult.ok
                                  ? <CheckCircle size={11} />
                                  : <XCircle size={11} />}
                                {testResult.ok ? (
                                  <>
                                    <span>HTTP {testResult.status}</span>
                                    <span className="text-[#8B92A5]">·</span>
                                    <span>{testResult.latencyMs}ms</span>
                                    {testResult.contentType && (
                                      <>
                                        <span className="text-[#8B92A5]">·</span>
                                        <span className="text-[#8B92A5]">{testResult.contentType}</span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <span>{testResult.error ?? `HTTP ${testResult.status}`}</span>
                                )}
                              </div>
                            )}

                            {/* HTTP headers (if set) */}
                            {(srv.cookie || srv.userAgent || srv.referer || srv.origin) && (
                              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                                {srv.cookie    && <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#8B92A5]">Cookie</span>}
                                {srv.userAgent && <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#8B92A5]">User-Agent</span>}
                                {srv.referer   && <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#8B92A5]">Referer</span>}
                                {srv.origin    && <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#8B92A5]">Origin</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── GitHub Details Tab ─────────────────────────────────── */}
              {activeTab === "github" && detail.githubChannelId && (
                <div className="p-6 space-y-5">
                  {/* Sync Status Banner */}
                  {(() => {
                    const ghSrc = servers.find(s => s.sourceType === "GITHUB")?.githubSource;
                    if (!ghSrc?.lastSyncStatus) return null;
                    const statusMap: Record<string, { bg: string; text: string; dot: string; label: string }> = {
                      success: { bg: "bg-green-500/10 border-green-500/20",  text: "text-green-400",  dot: "bg-green-400",  label: "Last sync succeeded" },
                      failed:  { bg: "bg-red-500/10 border-red-500/20",    text: "text-red-400",    dot: "bg-red-400",    label: "Last sync failed" },
                      running: { bg: "bg-blue-500/10 border-blue-500/20",   text: "text-blue-400",  dot: "bg-blue-400 animate-pulse",  label: "Sync in progress" },
                      pending: { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-400", label: "Sync pending" },
                    };
                    const s = statusMap[ghSrc.lastSyncStatus] ?? statusMap.pending;
                    return (
                      <div className={cn("flex items-start gap-3 px-4 py-3 rounded-xl border", s.bg)}>
                        <span className={cn("w-2 h-2 rounded-full mt-0.5 shrink-0", s.dot)} />
                        <div className="min-w-0">
                          <p className={cn("text-xs font-medium", s.text)}>{s.label} — {ghSrc.name}</p>
                          {ghSrc.lastSyncMessage && (
                            <p className="text-[11px] text-[#8B92A5] mt-0.5 truncate">{ghSrc.lastSyncMessage}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-[#8B92A5] shrink-0 ml-auto">{formatRelative(ghSrc.lastSyncAt)}</span>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "GitHub Channel ID",
                        value: detail.githubChannelId,
                        mono: true,
                      },
                      {
                        label: "Normalized Name",
                        value: detail.normalizedName ?? "—",
                        mono: true,
                      },
                      {
                        label: "GitHub Source",
                        value: servers.find(s => s.githubSource)?.githubSource?.name ?? "—",
                        mono: false,
                      },
                      {
                        label: "Total Servers",
                        value: String(servers.length),
                        mono: false,
                      },
                      {
                        label: "Admin Servers",
                        value: String(servers.filter(s => s.sourceType === "ADMIN").length),
                        mono: false,
                      },
                      {
                        label: "GitHub Servers",
                        value: String(servers.filter(s => s.sourceType === "GITHUB").length),
                        mono: false,
                      },
                      {
                        label: "Last Seen",
                        value: formatRelative(
                          servers
                            .filter(s => s.sourceType === "GITHUB")
                            .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime())[0]
                            ?.lastSeenAt,
                        ),
                        mono: false,
                      },
                      {
                        label: "Last Sync",
                        value: formatRelative(
                          servers.find(s => s.sourceType === "GITHUB")?.githubSource?.lastSyncAt,
                        ),
                        mono: false,
                      },
                      {
                        label: "Sync Status",
                        value: servers.find(s => s.sourceType === "GITHUB")?.githubSource?.lastSyncStatus ?? "—",
                        mono: false,
                        badge: true,
                      },
                      {
                        label: "Active Servers",
                        value: String(servers.filter(s => s.enabled).length),
                        mono: false,
                      },
                    ].map(({ label, value, mono, badge }) => (
                      <div key={label} className="bg-background/60 border border-border rounded-xl p-4">
                        <div className="text-xs text-[#8B92A5] mb-1">{label}</div>
                        {badge ? (
                          <span className={cn(
                            "inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                            value === "success" ? "bg-green-500/15 text-green-400"
                            : value === "failed"  ? "bg-red-500/15 text-red-400"
                            : value === "running" ? "bg-blue-500/15 text-blue-400"
                            : value === "pending" ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-white/5 text-[#8B92A5]"
                          )}>{value}</span>
                        ) : (
                          <div className={cn("text-sm text-white", mono && "font-mono break-all")}>{value}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Per-server detail */}
                  <div>
                    <p className="text-xs font-medium text-[#8B92A5] mb-2">Servers from GitHub</p>
                    {servers.filter(s => s.sourceType === "GITHUB").length === 0 ? (
                      <p className="text-xs text-[#8B92A5]">No GitHub servers currently active.</p>
                    ) : (
                      <div className="space-y-2">
                        {servers.filter(s => s.sourceType === "GITHUB").map(srv => (
                          <div key={srv.id} className="flex items-center gap-2 bg-background/40 border border-border rounded-lg px-3 py-2">
                            <span className="flex-1 font-mono text-xs text-white truncate">{srv.link}</span>
                            <span className="text-[10px] text-[#8B92A5] shrink-0">{srv.githubSource?.name}</span>
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                              srv.enabled ? "bg-green-500/15 text-green-400" : "bg-[#8B92A5]/15 text-[#8B92A5]"
                            )}>
                              {srv.enabled ? "Active" : "Disabled"}
                            </span>
                            <span className="text-[10px] text-[#8B92A5] shrink-0">{formatRelative(srv.lastSeenAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Override status */}
                  <div>
                    <p className="text-xs font-medium text-[#8B92A5] mb-2">Override Status</p>
                    <div className="space-y-1.5">
                      {[
                        { field: "Name", isOverridden: !!detail.adminNameOverride, overrideVal: detail.adminNameOverride, githubVal: detail.name },
                        { field: "Logo", isOverridden: !!detail.adminLogoOverride, overrideVal: detail.adminLogoOverride, githubVal: detail.logo },
                        { field: "Category", isOverridden: !!detail.adminCategoryIdOverride, overrideVal: null, githubVal: detail.category?.name ?? null },
                      ].map(({ field, isOverridden, overrideVal, githubVal }) => (
                        <div key={field} className="flex items-center gap-2 text-xs">
                          {isOverridden
                            ? <Shield size={11} className="text-blue-400 shrink-0" />
                            : <Github size={11} className="text-[#8B92A5] shrink-0" />}
                          <span className="text-[#8B92A5] w-20 shrink-0">{field}:</span>
                          {isOverridden
                            ? <span className="text-blue-400">Admin Override{overrideVal ? `: ${overrideVal.slice(0, 40)}` : ""}</span>
                            : <span className="text-white">{githubVal ? githubVal.slice(0, 60) : "—"}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && !error && detail && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
            <div className="text-xs text-[#8B92A5]">
              ID: <span className="font-mono">{detail.id.slice(0, 8)}…</span>
              <span className="mx-2">·</span>
              Updated {formatRelative(detail.updatedAt)}
            </div>
            {activeTab === "info" && (
              <button
                onClick={handleInfoSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
              </button>
            )}
            {activeTab !== "info" && (
              <button
                onClick={loadDetail}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white transition-colors"
              >
                <Loader2 size={11} /> Refresh
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
