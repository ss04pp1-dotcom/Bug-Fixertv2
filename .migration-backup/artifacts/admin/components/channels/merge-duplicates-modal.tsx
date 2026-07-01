"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/axios-client";
import { GitMerge, RefreshCw, X, CheckSquare, Square, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DupeChannel {
  id: string;
  name: string;
  logo: string | null;
  category: string | null;
}

interface DupeGroup {
  normalizedName: string;
  channels: DupeChannel[];
}

interface Props {
  onClose: () => void;
  onMerged: () => void;
}

export function MergeDuplicatesModal({ onClose, onMerged }: Props) {
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const [groups, setGroups] = useState<DupeGroup[]>([]);
  const [backfilled, setBackfilled] = useState(0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>("/v1/channels/preview-duplicates");
      const data = res.data?.data ?? res.data;
      setGroups(data.groups ?? []);
      setBackfilled(data.backfilled ?? 0);
      // All selected by default
      setExcluded(new Set());
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load duplicates");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (normalizedName: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(normalizedName)) next.delete(normalizedName);
      else next.add(normalizedName);
      return next;
    });
  };

  const toggleExpand = (normalizedName: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(normalizedName)) next.delete(normalizedName);
      else next.add(normalizedName);
      return next;
    });
  };

  const selectAll = () => setExcluded(new Set());
  const deselectAll = () => setExcluded(new Set(groups.map(g => g.normalizedName)));

  const selectedCount = groups.length - excluded.size;

  const handleMerge = async () => {
    if (selectedCount === 0) return;
    setMerging(true);
    try {
      const res = await apiClient.post<any>("/v1/channels/merge-duplicates", {
        excludedNormalizedNames: [...excluded],
      });
      const data = res.data?.data ?? res.data;
      setResult(data?.message ?? "Merge complete");
      onMerged();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-orange-400" />
            <h2 className="text-sm font-bold text-white">Merge Duplicates</h2>
            {!loading && groups.length > 0 && (
              <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                {groups.length} group{groups.length !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-[#8B92A5]">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={20} className="text-primary animate-spin" />
              <p className="text-xs text-[#8B92A5]">Scanning for duplicates…</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-2 py-10">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchPreview} className="text-xs text-primary underline">Retry</button>
            </div>
          )}

          {result && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-sm text-green-400">
              ✅ {result}
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-[#8B92A5]">কোনো duplicate চ্যানেল পাওয়া যায়নি।</p>
              {backfilled > 0 && (
                <p className="text-xs text-[#8B92A5]">{backfilled}টি চ্যানেলের নাম আপডেট করা হয়েছে।</p>
              )}
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <>
              {backfilled > 0 && (
                <p className="text-[11px] text-[#8B92A5] mb-3">{backfilled}টি চ্যানেলের normalizedName আপডেট হয়েছে।</p>
              )}
              <p className="text-[11px] text-[#8B92A5] mb-3">
                নিচের duplicate group গুলো পাওয়া গেছে। যেগুলো merge করতে চাও সেগুলো selected রাখো। যেগুলো চাও না সেগুলো deselect করো।
              </p>

              {groups.map((group) => {
                const isSelected = !excluded.has(group.normalizedName);
                const isExpanded = expanded.has(group.normalizedName);
                return (
                  <div
                    key={group.normalizedName}
                    className={cn(
                      "border rounded-xl overflow-hidden transition-colors",
                      isSelected ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card/50 opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => toggleGroup(group.normalizedName)}
                        className="shrink-0 text-[#8B92A5] hover:text-primary transition-colors"
                      >
                        {isSelected
                          ? <CheckSquare size={15} className="text-orange-400" />
                          : <Square size={15} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate capitalize">{group.normalizedName}</p>
                        <p className="text-[10px] text-[#8B92A5]">{group.channels.length} channels will merge into 1</p>
                      </div>
                      <button
                        onClick={() => toggleExpand(group.normalizedName)}
                        className="shrink-0 text-[#8B92A5] hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/50 divide-y divide-border/30">
                        {group.channels.map((ch, i) => (
                          <div key={ch.id} className="flex items-center gap-3 px-4 py-2.5">
                            {ch.logo ? (
                              <img src={ch.logo} alt={ch.name} className="w-6 h-6 rounded object-contain bg-black/20 shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                {ch.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-white flex-1 truncate">{ch.name}</span>
                            {ch.category && (
                              <span className="text-[10px] text-[#8B92A5] shrink-0">{ch.category}</span>
                            )}
                            {i === 0 && (
                              <span className="text-[9px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-medium shrink-0">keep</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !error && groups.length > 0 && !result && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-[11px] text-[#8B92A5] hover:text-white underline">Select All</button>
              <span className="text-[#8B92A5] text-[11px]">·</span>
              <button onClick={deselectAll} className="text-[11px] text-[#8B92A5] hover:text-white underline">Deselect All</button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-[#8B92A5] hover:bg-white/5 border border-border">
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging || selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold hover:bg-orange-500/30 disabled:opacity-50"
              >
                <GitMerge size={12} className={merging ? "animate-pulse" : ""} />
                {merging ? "Merging…" : `Merge ${selectedCount} Group${selectedCount !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex justify-end px-6 py-4 border-t border-border shrink-0">
            <button onClick={onClose} className="px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
