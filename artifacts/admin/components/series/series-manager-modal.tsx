"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Loader2, Check, AlertCircle, Film, Layers, PlayCircle,
  Clock, Star, Eye, EyeOff,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

/* ─── types ─── */
interface Episode {
  id: string;
  episodeNumber: number;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  streamUrl?: string | null;
  duration?: number | null;
  isPremium?: boolean;
  isActive?: boolean;
}

interface Season {
  id: string;
  seasonNumber: number;
  title?: string | null;
  description?: string | null;
  poster?: string | null;
  year?: number | null;
  isActive?: boolean;
  episodes: Episode[];
}

interface SeriesDetail {
  id: string;
  title: string;
  poster?: string | null;
  seasons: Season[];
}

/* ─── helpers ─── */
const emptySeasonForm = () => ({ seasonNumber: 1, title: "", description: "", year: "", isActive: true });
const emptyEpisodeForm = () => ({ episodeNumber: 1, title: "", description: "", thumbnail: "", streamUrl: "", duration: "", isPremium: false, isActive: true });

type SeasonForm  = ReturnType<typeof emptySeasonForm>;
type EpisodeForm = ReturnType<typeof emptyEpisodeForm>;

/* ─── sub-components ─── */

interface FieldProps { label: string; required?: boolean; children: React.ReactNode }
function Field({ label, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-[10px] text-[#8B92A5] mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary placeholder:text-[#8B92A5]",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={2}
      className={cn(
        "w-full bg-[#0d1525] border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary placeholder:text-[#8B92A5] resize-none",
        className
      )}
      {...props}
    />
  );
}

/* ─── Season form panel ─── */
interface SeasonFormPanelProps {
  initial?: SeasonForm;
  loading: boolean;
  error: string | null;
  onSave: (f: SeasonForm) => void;
  onCancel: () => void;
}

function SeasonFormPanel({ initial, loading, error, onSave, onCancel }: SeasonFormPanelProps) {
  const [form, setForm] = useState<SeasonForm>(initial ?? emptySeasonForm());
  const set = (k: keyof SeasonForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-[#0a1020] border border-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Season Number" required>
          <Input type="number" min={1} value={form.seasonNumber} onChange={e => set("seasonNumber", Number(e.target.value))} />
        </Field>
        <Field label="Year">
          <Input type="number" placeholder="2024" value={form.year} onChange={e => set("year", e.target.value)} />
        </Field>
      </div>
      <Field label="Title (optional)">
        <Input placeholder="Season 1: The Beginning" value={form.title} onChange={e => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea placeholder="Season description…" value={form.description} onChange={e => set("description", e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="season-active" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} className="accent-primary" />
        <label htmlFor="season-active" className="text-xs text-[#8B92A5] cursor-pointer">Active</label>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">Cancel</button>
        <button onClick={() => onSave(form)} disabled={loading} className="flex-1 py-2 rounded-lg gradient-primary text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {loading ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : <><Check size={11} /> Save Season</>}
        </button>
      </div>
    </div>
  );
}

/* ─── Episode form panel ─── */
interface EpisodeFormPanelProps {
  initial?: EpisodeForm;
  loading: boolean;
  error: string | null;
  onSave: (f: EpisodeForm) => void;
  onCancel: () => void;
}

function EpisodeFormPanel({ initial, loading, error, onSave, onCancel }: EpisodeFormPanelProps) {
  const [form, setForm] = useState<EpisodeForm>(initial ?? emptyEpisodeForm());
  const [thumb, setThumb] = useState(initial?.thumbnail ?? "");
  const set = (k: keyof EpisodeForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-[#0a1020] border border-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Episode Number" required>
          <Input type="number" min={1} value={form.episodeNumber} onChange={e => set("episodeNumber", Number(e.target.value))} />
        </Field>
        <Field label="Duration (min)">
          <Input type="number" placeholder="45" value={form.duration} onChange={e => set("duration", e.target.value)} />
        </Field>
      </div>
      <Field label="Title" required>
        <Input placeholder="Episode title" value={form.title} onChange={e => set("title", e.target.value)} />
      </Field>
      <Field label="Description">
        <Textarea placeholder="Episode description…" value={form.description} onChange={e => set("description", e.target.value)} />
      </Field>
      <Field label="Stream URL">
        <Input placeholder="https://cdn.example.com/ep1.m3u8" value={form.streamUrl} onChange={e => set("streamUrl", e.target.value)} />
      </Field>
      <ImageUpload
        value={thumb}
        onChange={v => { setThumb(v); set("thumbnail", v); }}
        uploadPath="/v1/storage/upload/poster"
        label="Thumbnail"
        previewClass="h-24 w-full"
      />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="ep-premium" checked={form.isPremium} onChange={e => set("isPremium", e.target.checked)} className="accent-primary" />
          <label htmlFor="ep-premium" className="text-xs text-[#8B92A5] cursor-pointer">Premium</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="ep-active" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} className="accent-primary" />
          <label htmlFor="ep-active" className="text-xs text-[#8B92A5] cursor-pointer">Active</label>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={11} /> {error}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5">Cancel</button>
        <button onClick={() => onSave({ ...form, thumbnail: thumb })} disabled={loading || !form.title.trim()} className="flex-1 py-2 rounded-lg gradient-primary text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
          {loading ? <><Loader2 size={11} className="animate-spin" /> Saving…</> : <><Check size={11} /> Save Episode</>}
        </button>
      </div>
    </div>
  );
}

/* ─── main modal ─── */
interface Props {
  seriesId: string;
  seriesTitle: string;
  onClose: () => void;
}

type PanelKey = string; // e.g. "new-season" | "edit-season-{id}" | "new-ep-{seasonId}" | "edit-ep-{id}"

export default function SeriesManagerModal({ seriesId, seriesTitle, onClose }: Props) {
  const { data, isLoading, error, refetch } = useApi<SeriesDetail>(`/v1/series/${seriesId}`);
  const { call } = useApiCallState();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const series   = data;
  const seasons: Season[] = series?.seasons ?? [];

  const toggleExpand = (id: string) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openPanel = (key: PanelKey) => {
    setActivePanel(key);
    setPanelError(null);
  };
  const closePanel = () => { setActivePanel(null); setPanelError(null); };

  const withPanel = useCallback(async (fn: () => Promise<unknown>) => {
    setPanelLoading(true);
    setPanelError(null);
    try {
      await fn();
      closePanel();
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Something went wrong";
      setPanelError(typeof msg === "string" ? msg : "Something went wrong");
    } finally {
      setPanelLoading(false);
    }
  }, [refetch]);

  /* season actions */
  const saveSeason = async (f: SeasonForm) => withPanel(() =>
    call("post", `/v1/series/${seriesId}/seasons`, {
      seasonNumber: Number(f.seasonNumber),
      title: f.title || undefined,
      description: f.description || undefined,
      year: f.year ? Number(f.year) : undefined,
      isActive: f.isActive,
    })
  );

  const updateSeason = async (seasonId: string, f: SeasonForm) => withPanel(() =>
    call("put", `/v1/series/seasons/${seasonId}`, {
      seasonNumber: Number(f.seasonNumber),
      title: f.title || undefined,
      description: f.description || undefined,
      year: f.year ? Number(f.year) : undefined,
      isActive: f.isActive,
    })
  );

  const deleteSeason = async (seasonId: string) => {
    if (!confirm("Delete this season and all its episodes?")) return;
    try {
      await call("delete", `/v1/series/seasons/${seasonId}`);
      refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? "Delete failed");
    }
  };

  /* episode actions */
  const saveEpisode = async (seasonId: string, f: EpisodeForm) => withPanel(() =>
    call("post", `/v1/series/seasons/${seasonId}/episodes`, {
      episodeNumber: Number(f.episodeNumber),
      title: f.title,
      description: f.description || undefined,
      thumbnail: f.thumbnail || undefined,
      streamUrl: f.streamUrl || undefined,
      duration: f.duration ? Number(f.duration) : undefined,
      isPremium: f.isPremium,
      isActive: f.isActive,
    })
  );

  const updateEpisode = async (episodeId: string, f: EpisodeForm) => withPanel(() =>
    call("put", `/v1/series/episodes/${episodeId}`, {
      episodeNumber: Number(f.episodeNumber),
      title: f.title,
      description: f.description || undefined,
      thumbnail: f.thumbnail || undefined,
      streamUrl: f.streamUrl || undefined,
      duration: f.duration ? Number(f.duration) : undefined,
      isPremium: f.isPremium,
      isActive: f.isActive,
    })
  );

  const deleteEpisode = async (episodeId: string) => {
    if (!confirm("Delete this episode?")) return;
    try {
      await call("delete", `/v1/series/episodes/${episodeId}`);
      refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? "Delete failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a1020] border border-border rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Layers size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{seriesTitle}</h2>
              <p className="text-[10px] text-[#8B92A5]">Seasons &amp; Episodes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && (
              <div className="flex items-center gap-3 text-[10px] text-[#8B92A5] mr-2">
                <span className="flex items-center gap-1"><Layers size={10} /> {seasons.length} seasons</span>
                <span className="flex items-center gap-1"><Film size={10} /> {seasons.reduce((a, s) => a + s.episodes.length, 0)} episodes</span>
              </div>
            )}
            <button onClick={onClose} className="text-[#8B92A5] hover:text-white"><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-primary animate-spin" />
            </div>
          )}

          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <AlertCircle size={24} className="text-red-400" />
              <p className="text-sm text-red-400">Failed to load series data</p>
              <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
            </div>
          )}

          {!isLoading && !error && (
            <>
              {/* Season list */}
              {seasons.length === 0 && activePanel !== "new-season" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
                    <Layers size={24} className="text-[#8B92A5]" />
                  </div>
                  <p className="text-sm text-[#8B92A5]">No seasons yet</p>
                  <button onClick={() => openPanel("new-season")} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
                    <Plus size={13} /> Add First Season
                  </button>
                </div>
              )}

              {seasons.map(season => (
                <div key={season.id} className="border border-border rounded-xl overflow-hidden">
                  {/* Season header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-[#0d1525] cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleExpand(season.id)}
                  >
                    <div className="text-[#8B92A5] shrink-0">
                      {expanded.has(season.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-primary">{season.seasonNumber}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        Season {season.seasonNumber}{season.title ? `: ${season.title}` : ""}
                        {season.year ? <span className="text-[#8B92A5] font-normal ml-1">({season.year})</span> : null}
                      </div>
                      <div className="text-[10px] text-[#8B92A5] mt-0.5">
                        {season.episodes.length} episode{season.episodes.length !== 1 ? "s" : ""}
                        {!season.isActive && <span className="ml-2 text-yellow-400">· Inactive</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openPanel(`edit-season-${season.id}`)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        title="Edit season"
                      >
                        <Edit2 size={12} className="text-[#8B92A5]" />
                      </button>
                      <button
                        onClick={() => deleteSeason(season.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                        title="Delete season"
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Edit season form */}
                  {activePanel === `edit-season-${season.id}` && (
                    <div className="px-4 py-3 border-t border-border bg-[#0a1020]">
                      <SeasonFormPanel
                        initial={{
                          seasonNumber: season.seasonNumber,
                          title: season.title ?? "",
                          description: season.description ?? "",
                          year: season.year ? String(season.year) : "",
                          isActive: season.isActive ?? true,
                        }}
                        loading={panelLoading}
                        error={panelError}
                        onSave={f => updateSeason(season.id, f)}
                        onCancel={closePanel}
                      />
                    </div>
                  )}

                  {/* Episodes */}
                  {expanded.has(season.id) && (
                    <div className="divide-y divide-border/50 border-t border-border">
                      {season.episodes.length === 0 && activePanel !== `new-ep-${season.id}` && (
                        <div className="flex items-center justify-center py-6 text-xs text-[#8B92A5]">
                          No episodes yet
                        </div>
                      )}

                      {season.episodes.map(ep => (
                        <div key={ep.id}>
                          <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                            {ep.thumbnail ? (
                              <img src={ep.thumbnail} alt="" className="w-12 h-8 rounded object-cover bg-black/20 shrink-0" />
                            ) : (
                              <div className="w-12 h-8 rounded bg-white/5 flex items-center justify-center shrink-0">
                                <PlayCircle size={13} className="text-[#8B92A5]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[#8B92A5] shrink-0">E{ep.episodeNumber}</span>
                                <span className="text-xs font-medium text-white truncate">{ep.title}</span>
                                {ep.isPremium && (
                                  <span className="shrink-0 flex items-center gap-0.5 text-[9px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full">
                                    <Star size={8} /> Premium
                                  </span>
                                )}
                                {!ep.isActive && (
                                  <span className="shrink-0 text-[9px] text-[#8B92A5] bg-white/5 px-1.5 py-0.5 rounded-full">Inactive</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5">
                                {ep.duration && (
                                  <span className="flex items-center gap-1 text-[10px] text-[#8B92A5]">
                                    <Clock size={9} /> {ep.duration}m
                                  </span>
                                )}
                                {ep.streamUrl && (
                                  <span className="text-[10px] text-[#8B92A5] truncate max-w-[200px]">{ep.streamUrl}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openPanel(`edit-ep-${ep.id}`)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                              >
                                <Edit2 size={11} className="text-[#8B92A5]" />
                              </button>
                              <button
                                onClick={() => deleteEpisode(ep.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={11} className="text-red-400" />
                              </button>
                            </div>
                          </div>
                          {/* Edit episode form */}
                          {activePanel === `edit-ep-${ep.id}` && (
                            <div className="px-4 py-3 bg-[#0a1020] border-t border-border">
                              <EpisodeFormPanel
                                initial={{
                                  episodeNumber: ep.episodeNumber,
                                  title: ep.title,
                                  description: ep.description ?? "",
                                  thumbnail: ep.thumbnail ?? "",
                                  streamUrl: ep.streamUrl ?? "",
                                  duration: ep.duration ? String(ep.duration) : "",
                                  isPremium: ep.isPremium ?? false,
                                  isActive: ep.isActive ?? true,
                                }}
                                loading={panelLoading}
                                error={panelError}
                                onSave={f => updateEpisode(ep.id, f)}
                                onCancel={closePanel}
                              />
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Add episode form */}
                      {activePanel === `new-ep-${season.id}` && (
                        <div className="px-4 py-3 bg-[#0a1020] border-t border-border">
                          <p className="text-[10px] text-[#8B92A5] mb-3 font-semibold uppercase tracking-wide">Add Episode to Season {season.seasonNumber}</p>
                          <EpisodeFormPanel
                            initial={{ ...emptyEpisodeForm(), episodeNumber: season.episodes.length + 1 }}
                            loading={panelLoading}
                            error={panelError}
                            onSave={f => saveEpisode(season.id, f)}
                            onCancel={closePanel}
                          />
                        </div>
                      )}

                      {/* Add episode button */}
                      {activePanel !== `new-ep-${season.id}` && (
                        <div className="px-4 py-2.5 flex justify-end">
                          <button
                            onClick={() => { setExpanded(s => new Set([...s, season.id])); openPanel(`new-ep-${season.id}`); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-[10px] text-[#8B92A5] hover:border-primary/50 hover:text-primary transition-colors"
                          >
                            <Plus size={11} /> Add Episode
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add season form */}
              {activePanel === "new-season" && (
                <div>
                  <p className="text-[10px] text-[#8B92A5] mb-2 font-semibold uppercase tracking-wide">New Season</p>
                  <SeasonFormPanel
                    initial={{ ...emptySeasonForm(), seasonNumber: seasons.length + 1 }}
                    loading={panelLoading}
                    error={panelError}
                    onSave={saveSeason}
                    onCancel={closePanel}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && !error && (
          <div className="px-5 py-3.5 border-t border-border shrink-0 flex items-center justify-between">
            <span className="text-[10px] text-[#8B92A5]">
              {seasons.length} season{seasons.length !== 1 ? "s" : ""} · {seasons.reduce((a, s) => a + s.episodes.length, 0)} episodes total
            </span>
            {activePanel !== "new-season" && (
              <button
                onClick={() => openPanel("new-season")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90"
              >
                <Plus size={13} /> Add Season
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
