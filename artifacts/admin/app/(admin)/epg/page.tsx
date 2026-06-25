"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Upload, RefreshCw, Calendar, Clock, Tv, Menu, AlertCircle, Loader2 } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";
import { apiClient } from "@/lib/axios-client";
import { toast } from "sonner";

interface Channel { id: string; name: string }
interface Program {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category?: string;
  channel?: { id: string; name: string };
}
interface ProgramsPage { data: Program[] }

const gradients = ["gradient-primary","gradient-blue","gradient-green","gradient-orange","gradient-pink"];

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { return iso; }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
  } catch { return ""; }
}

export default function EPG() {
  const router = useRouter();
  const [showModal,  setShowModal]  = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editProgram, setEditProgram] = useState<Program | null>(null);
  const [selectedCh, setSelectedCh] = useState<string | null>(null);

  // Import state
  const [importUrl, setImportUrl]       = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importErr, setImportErr]       = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Form state for add/edit modal
  const [formTitle, setFormTitle]       = useState("");
  const [formStart, setFormStart]       = useState("");
  const [formEnd, setFormEnd]           = useState("");
  const [formCategory, setFormCategory] = useState("");

  // Populate form state when editing a program
  useEffect(() => {
    if (editProgram) {
      setFormTitle(editProgram.title);
      setFormStart(isoToTime(editProgram.startTime));
      setFormEnd(isoToTime(editProgram.endTime));
      setFormCategory(editProgram.category ?? "");
    } else if (showModal) {
      setFormTitle("");
      setFormStart("");
      setFormEnd("");
      setFormCategory("");
    }
  }, [editProgram, showModal]);

  const { data: channelsPage } = useApi<{ data: Channel[] }>("/v1/channels?limit=100");
  const channels = channelsPage?.data ?? [];

  const chId = selectedCh ?? channels[0]?.id ?? "";
  const { data: programsPage, isLoading, refetch } = useApi<ProgramsPage>(
    chId ? `/v1/epg/channels/${chId}` : null
  );
  const programs = programsPage?.data ?? [];

  const { call, loading: mutating } = useApiCallState();

  const openAdd = () => {
    setEditProgram(null);
    setShowModal(true);
  };

  const openEdit = (p: Program) => {
    setEditProgram(p);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditProgram(null);
  };

  const [epgErr, setEpgErr] = useState("");

  const handleImport = async () => {
    setImportErr(null);
    const file = importFileRef.current?.files?.[0];
    const isM3u = file
      ? (file.name.endsWith(".m3u") || file.name.endsWith(".m3u8"))
      : (importUrl.toLowerCase().includes(".m3u") || importUrl.toLowerCase().includes(".m3u8"));

    if (file && isM3u) {
      setShowImport(false);
      router.push("/admin/m3u-import");
      toast.info("Upload your M3U file on the M3U Import page.");
      return;
    }

    if (importUrl && isM3u) {
      setShowImport(false);
      router.push("/admin/m3u-import");
      toast.info("Use the M3U Import page to import M3U playlists.");
      return;
    }

    if (!file && !importUrl.trim()) {
      setImportErr("Please enter a URL or upload a file.");
      return;
    }

    if (file) {
      setImportLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("batchSize", "50");
        await apiClient.post("/v1/m3u-import/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30_000,
        });
        toast.success("File uploaded for import. Track progress on the M3U Import page.");
        setShowImport(false);
        router.push("/admin/m3u-import");
      } catch (e: any) {
        setImportErr(e?.response?.data?.message ?? e?.message ?? "Upload failed");
      } finally {
        setImportLoading(false);
      }
      return;
    }

    setImportErr("XMLTV URL import is not supported yet. Upload a .m3u file instead.");
  };

  const saveProgram = async () => {
    if (!chId || !formTitle.trim()) return;
    const today = todayIso();
    const payload = {
      channelId:  chId,
      title:      formTitle.trim(),
      startTime:  formStart ? `${today}T${formStart}:00Z`  : undefined,
      endTime:    formEnd   ? `${today}T${formEnd}:00Z`    : undefined,
      category:   formCategory || undefined,
    };
    setEpgErr("");
    try {
      if (editProgram) {
        await call("put", `/v1/epg/${editProgram.id}`, payload);
      } else {
        await call("post", "/v1/epg", payload);
      }
      closeModal();
      refetch();
    } catch (e: any) { setEpgErr(e?.message ?? "Failed to save program"); }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm("Delete this program?")) return;
    setEpgErr("");
    try {
      await call("delete", `/v1/epg/${id}`);
      refetch();
    } catch (e: any) { setEpgErr(e?.message ?? "Failed to delete program"); }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">EPG — Electronic Program Guide</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 transition-colors">
            <Upload size={13} /> Import M3U/XMLTV
          </button>
          <button onClick={() => refetch()} disabled={isLoading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Sync Now
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity">
            <Plus size={13} /> Add Program
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Channels",  value: String(channels.length || "—"), icon: Tv,       color: "gradient-primary" },
            { label: "Programs Today",  value: String(programs.length),        icon: Calendar,  color: "gradient-blue"    },
            { label: "Avg Duration",    value: "—",                            icon: Clock,     color: "gradient-green"   },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.color)}>
                  <Icon size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-[#8B92A5]">{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Channel selector */}
        {channels.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-[#8B92A5] mb-2 font-medium">Select Channel</div>
            <div className="flex flex-wrap gap-2">
              {channels.slice(0, 20).map((ch, i) => (
                <button key={ch.id} onClick={() => setSelectedCh(ch.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors",
                    (selectedCh ?? channels[0]?.id) === ch.id
                      ? "border-primary/50 text-white bg-primary/10"
                      : "border-border text-[#8B92A5] hover:bg-white/5"
                  )}>
                  <div className={cn("w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white", gradients[i % gradients.length])}>
                    {ch.name[0]}
                  </div>
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Program listing */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-white">
              Today's Schedule — {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-[#0d1525]">
                {["Channel","Program","Start","End","Category","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8B92A5]">
                  <RefreshCw size={14} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              )}
              {!isLoading && programs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-[#8B92A5]">
                  No programs scheduled. Add one above.
                </td></tr>
              )}
              {programs.map((p, i) => {
                const chName = p.channel?.name ?? channels.find(c => c.id === chId)?.name ?? "—";
                return (
                  <tr key={p.id} className="tbl-row border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white", gradients[i % gradients.length])}>
                          {chName[0]}
                        </div>
                        <span className="text-xs text-white">{chName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{p.title}</td>
                    <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtTime(p.startTime)}</td>
                    <td className="px-4 py-3 text-sm text-[#8B92A5]">{fmtTime(p.endTime)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                        {p.category ?? "General"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} disabled={mutating}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10 disabled:opacity-50">
                          <Edit size={13} className="text-[#8B92A5]" />
                        </button>
                        <button onClick={() => deleteProgram(p.id)} disabled={mutating}
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 disabled:opacity-50">
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Program Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{editProgram ? "Edit EPG Program" : "Add EPG Program"}</h2>
              <button onClick={closeModal} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Program Title</label>
                <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Enter program title"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Start Time</label>
                  <input value={formStart} onChange={e => setFormStart(e.target.value)} type="time"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">End Time</label>
                  <input value={formEnd} onChange={e => setFormEnd(e.target.value)} type="time"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Category</label>
                <input value={formCategory} onChange={e => setFormCategory(e.target.value)} placeholder="News / Sports / Drama"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeModal} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button onClick={saveProgram} disabled={mutating}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {mutating ? "Saving…" : editProgram ? "Update Program" : "Save Program"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Import EPG / M3U</h2>
              <button onClick={() => { setShowImport(false); setImportErr(null); setImportUrl(""); }} className="text-[#8B92A5] hover:text-white text-lg">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Source URL (M3U / M3U8)</label>
                <input
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  placeholder="https://example.com/playlist.m3u"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
              </div>
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => importFileRef.current?.click()}
              >
                <input ref={importFileRef} type="file" accept=".m3u,.m3u8,.xml,.xmltv" className="hidden" />
                <Upload size={20} className="text-[#8B92A5]" />
                <div className="text-xs text-[#8B92A5]">Or click to upload M3U / XMLTV file</div>
                <div className="text-[10px] text-[#8B92A5]/60">Max 100MB</div>
              </div>
              {importErr && (
                <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {importErr}
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => { setShowImport(false); setImportErr(null); setImportUrl(""); }} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">Cancel</button>
              <button
                onClick={handleImport}
                disabled={importLoading}
                className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {importLoading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
