"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Flag, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useApi, useApiCallState, useInvalidate } from "@/lib/use-api";

interface FeatureFlag {
  id: string;
  name: string;
  isEnabled: boolean;
  description?: string | null;
  roles: string[];
  updatedAt: string;
}

const PRESET_FLAGS = [
  { name: "live_tv", description: "Live TV streaming feature" },
  { name: "vod", description: "Video on Demand" },
  { name: "subscriptions", description: "Subscription plans and billing" },
  { name: "ads", description: "Advertisement system" },
  { name: "parental_control", description: "Parental control features" },
  { name: "geo_blocking", description: "Geo-restriction enforcement" },
  { name: "epg", description: "Electronic Program Guide" },
  { name: "downloads", description: "Offline download feature" },
  { name: "multi_profile", description: "Multiple user profiles" },
  { name: "dark_mode", description: "Dark mode UI option" },
];

export default function FeatureFlagsPage() {
  const { data: flags, isLoading, refetch } = useApi<FeatureFlag[]>("/v1/feature-flags");
  const { call, loading: mutating } = useApiCallState();
  const invalidate = useInvalidate();
  const [actionErr, setActionErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  // D-037 fix: removed dead `sidebarOpen` state — the mobile menu button never
  // opened a drawer (there's no drawer to open on this page), so it was a
  // no-op button that misled users. The hamburger is removed below.

  const flagList: FeatureFlag[] = Array.isArray(flags) ? flags : [];

  const toggle = async (flag: FeatureFlag) => {
    setActionErr("");
    try {
      await call("post", `/v1/feature-flags/${flag.name}/toggle`, {});
      // D-011 fix: flat query-key array, not array-of-array
      invalidate(["/v1/feature-flags"]);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to toggle flag"); }
  };

  const del = async (name: string) => {
    if (!confirm(`Delete flag "${name}"?`)) return;
    setActionErr("");
    try {
      await call("delete", `/v1/feature-flags/${name}`);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to delete flag"); }
  };

  const addFlag = async () => {
    if (!newName.trim()) return;
    setActionErr("");
    try {
      await call("post", "/v1/feature-flags", { name: newName.trim(), isEnabled: false, description: newDesc.trim() });
      setNewName(""); setNewDesc(""); setShowAdd(false);
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to create flag"); }
  };

  const addPreset = async (preset: typeof PRESET_FLAGS[0]) => {
    const exists = flagList.some(f => f.name === preset.name);
    if (exists) return;
    setActionErr("");
    try {
      await call("post", "/v1/feature-flags", { name: preset.name, isEnabled: true, description: preset.description });
      refetch();
    } catch (e: any) { setActionErr(e?.message ?? "Failed to add preset flag"); }
  };

  const enabledCount = flagList.filter(f => f.isEnabled).length;

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          {/* D-037 fix: dead hamburger button removed — `sidebarOpen` was
              declared but never rendered into a drawer. */}
          <h1 className="text-sm font-bold text-white">Feature Flags</h1>
          {flagList.length > 0 && (
            <span className="text-xs text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">
              {enabledCount}/{flagList.length} enabled
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <RefreshCw size={14} className="text-primary animate-spin" />}
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus size={13} /> Add Flag
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-57px)]">

        {/* Add flag form */}
        {showAdd && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-white">New Feature Flag</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Flag Name (snake_case)</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. new_player_ui"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary transition-colors font-mono" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Description</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  placeholder="What does this flag control?"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex gap-2">
                <button onClick={addFlag} disabled={mutating || !newName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold disabled:opacity-50">
                  {mutating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  Create Flag
                </button>
                <button onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Active flags */}
          <div className="xl:col-span-2 space-y-3">
            <h2 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">All Flags</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl p-4 h-16 animate-pulse" />
                ))}
              </div>
            ) : flagList.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
                <Flag size={32} className="text-[#8B92A5]" />
                <p className="text-sm text-[#8B92A5]">No feature flags yet</p>
                <p className="text-xs text-[#8B92A5]/60">Add presets from the right panel or create a custom flag</p>
              </div>
            ) : (
              <div className="space-y-2">
                {flagList.map(flag => (
                  <div key={flag.id} className={cn(
                    "bg-card border rounded-xl p-4 flex items-center justify-between gap-4 transition-colors",
                    flag.isEnabled ? "border-primary/30" : "border-border"
                  )}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        flag.isEnabled ? "gradient-primary" : "bg-white/5"
                      )}>
                        <Flag size={14} className={flag.isEnabled ? "text-white" : "text-[#8B92A5]"} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium text-white">{flag.name}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            flag.isEnabled ? "bg-green-500/20 text-green-400" : "bg-white/10 text-[#8B92A5]"
                          )}>
                            {flag.isEnabled ? "ON" : "OFF"}
                          </span>
                        </div>
                        {flag.description && (
                          <p className="text-xs text-[#8B92A5] truncate mt-0.5">{flag.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggle(flag)}
                        disabled={mutating}
                        className="text-[#8B92A5] hover:text-primary transition-colors disabled:opacity-50"
                        title={flag.isEnabled ? "Disable" : "Enable"}
                      >
                        {flag.isEnabled
                          ? <ToggleRight size={22} className="text-primary" />
                          : <ToggleLeft size={22} />
                        }
                      </button>
                      <button onClick={() => del(flag.name)} disabled={mutating}
                        className="text-[#8B92A5] hover:text-red-400 transition-colors disabled:opacity-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Presets panel */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Preset Flags</h2>
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              {PRESET_FLAGS.map(preset => {
                const exists = flagList.some(f => f.name === preset.name);
                return (
                  <div key={preset.name} className={cn(
                    "flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0",
                    exists && "opacity-40"
                  )}>
                    <div className="min-w-0">
                      <div className="text-xs font-mono text-white">{preset.name}</div>
                      <div className="text-[10px] text-[#8B92A5] truncate">{preset.description}</div>
                    </div>
                    <button
                      onClick={() => addPreset(preset)}
                      disabled={exists || mutating}
                      className="text-[10px] font-semibold px-2 py-1 rounded-md border border-border text-[#8B92A5] hover:text-white hover:border-primary/50 disabled:opacity-40 disabled:cursor-default transition-all shrink-0"
                    >
                      {exists ? "Added" : "+ Add"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Stats card */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-white">Stats</h3>
              <div className="space-y-2">
                {[
                  { label: "Total Flags", value: flagList.length },
                  { label: "Enabled", value: enabledCount, color: "text-green-400" },
                  { label: "Disabled", value: flagList.length - enabledCount, color: "text-[#8B92A5]" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between text-xs">
                    <span className="text-[#8B92A5]">{s.label}</span>
                    <span className={cn("font-semibold", s.color ?? "text-white")}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
