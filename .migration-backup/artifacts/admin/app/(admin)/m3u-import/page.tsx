"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Upload, FileUp, X, Loader2, CheckCircle2, AlertCircle,
  Settings, ChevronDown, ArrowRight, Eye, Trash2,
  Play, Pause, RotateCcw, Clock, BarChart3, RefreshCw,
} from "lucide-react";
import { useApiCallState, useApiQuery, useInvalidate } from "@/lib/use-api";
import { apiClient, extractData } from "@/lib/axios-client";

/* ─── Types ──────────────────────────────────────────── */

interface JobProgress {
  id: string;
  filename: string;
  status: string;
  totalChannels: number;
  checkedChannels: number;
  activeChannels: number;
  failedChannels: number;
  skippedChannels: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

interface ImportJob {
  id: string;
  filename: string;
  fileSize: number;
  status: string;
  totalChannels: number;
  checkedChannels: number;
  activeChannels: number;
  failedChannels: number;
  skippedChannels: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface FailedChannel {
  id: string;
  channelName: string;
  streamUrl: string;
  failReason: string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
}

/* ─── Status badge ───────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  parsing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  validating: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  completing: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-medium border", STATUS_COLORS[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30")}>
      {status}
    </span>
  );
}

/* ─── Upload Zone ────────────────────────────────────── */

function UploadZone({ onUploaded }: { onUploaded: (jobId: string) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [saveFailed, setSaveFailed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".m3u") && !file.name.toLowerCase().endsWith(".m3u8")) {
      setError("Only .m3u and .m3u8 files are supported");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("File size must be under 100MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("batchSize", String(batchSize));
      formData.append("saveFailed", String(saveFailed));

      const res = await apiClient.post("/v1/m3u-import/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30_000,
      });

      const data = extractData<{ importJobId: string; message: string }>(res);
      onUploaded(data.importJobId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [batchSize, saveFailed, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }, [uploadFile]);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-sm font-semibold text-white mb-4">Upload M3U Playlist</h3>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200",
          dragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-white/[0.02]"
        )}
      >
        <input ref={fileRef} type="file" accept=".m3u,.m3u8" className="hidden" onChange={handleFileInput} />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-primary animate-spin" />
            <p className="text-sm text-[#8B92A5]">Uploading & queueing for processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              dragging ? "bg-primary/20" : "bg-white/5"
            )}>
              <FileUp size={28} className={dragging ? "text-primary" : "text-[#8B92A5]"} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Drag & drop your M3U file here
              </p>
              <p className="text-xs text-[#8B92A5] mt-1">
                or click to browse — supports .m3u and .m3u8 up to 100MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Settings toggle */}
      <div className="mt-4">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 text-xs text-[#8B92A5] hover:text-white transition-colors"
        >
          <Settings size={13} />
          Import Settings
          <ChevronDown size={13} className={cn("transition-transform", showSettings && "rotate-180")} />
        </button>

        {showSettings && (
          <div className="mt-3 p-4 bg-[#0D1321] rounded-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#8B92A5]">Batch Size (channels per batch)</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="bg-[#121A2F] border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50 (Recommended)</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#8B92A5]">Save failed channels to database</label>
              <button
                onClick={() => setSaveFailed(!saveFailed)}
                className={cn(
                  "w-10 h-5 rounded-full relative transition-colors",
                  saveFailed ? "bg-primary" : "bg-[#2A3450]"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow",
                  saveFailed ? "left-5.5" : "left-0.5"
                )} />
              </button>
            </div>
            <p className="text-[11px] text-[#555B70]">
              Batch size controls how many streams are validated simultaneously. Smaller batches use less bandwidth but take longer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Progress Card ──────────────────────────────────── */

function ProgressCard({ jobId }: { jobId: string }) {
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [showFailed, setShowFailed] = useState(false);
  const [failedList, setFailedList] = useState<FailedChannel[]>([]);
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const { call: cancelCall } = useApiCallState();

  useEffect(() => {
    if (!jobId) return;
    setPollError(null);
    const poll = setInterval(async () => {
      try {
        const res = await apiClient.get(`/v1/m3u-import/jobs/${jobId}/progress`);
        const data = extractData<JobProgress>(res);
        setProgress(data);
        setPollError(null);
        // Stop polling if terminal state
        if (["completed", "failed", "cancelled"].includes(data.status)) {
          clearInterval(poll);
        }
      } catch (e) {
        // D-019 fix: surface the error and stop the poller instead of swallowing
        setPollError("Failed to fetch progress");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
    pollRef.current = poll;
    return () => clearInterval(poll);
  }, [jobId]);

  const pct = progress ? (progress.totalChannels > 0 ? Math.round((progress.checkedChannels / progress.totalChannels) * 100) : 0) : 0;
  const isRunning = progress && ["pending", "parsing", "validating", "completing"].includes(progress.status);

  const viewFailed = async () => {
    setShowFailed(true);
    setLoadingFailed(true);
    try {
      const res = await apiClient.get(`/v1/m3u-import/jobs/${jobId}/failed`);
      setFailedList(extractData<FailedChannel[]>(res));
    } catch {}
    setLoadingFailed(false);
  };

  const cancelJob = async () => {
    try { await cancelCall("post", `/v1/m3u-import/jobs/${jobId}/cancel`); } catch {}
  };

  if (!progress) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <Loader2 size={18} className="text-primary animate-spin" />
          <span className="text-sm text-[#8B92A5]">Loading progress...</span>
        </div>
        {pollError && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={14} /> {pollError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      {pollError && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} /> {pollError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          ) : progress.status === "completed" ? (
            <CheckCircle2 size={18} className="text-green-400" />
          ) : (
            <AlertCircle size={18} className="text-red-400" />
          )}
          <div>
            <p className="text-sm font-medium text-white">{progress.filename}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={progress.status} />
              {progress.startedAt && (
                <span className="text-[10px] text-[#555B70]">
                  Started: {new Date(progress.startedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        {isRunning && (
          <button onClick={cancelJob} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20">
            <Pause size={12} /> Stop
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-[#8B92A5]">Processing Channels...</span>
          <span className="text-white font-medium">{pct}%</span>
        </div>
        <div className="h-2.5 bg-[#1A2340] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #7C3AED, #2563EB)",
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: progress.totalChannels, color: "text-white" },
          { label: "Checked", value: progress.checkedChannels, color: "text-blue-400" },
          { label: "Working", value: progress.activeChannels, color: "text-green-400" },
          { label: "Failed", value: progress.failedChannels, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0D1321] rounded-lg p-3 text-center border border-border/50">
            <p className={cn("text-xl font-bold", s.color)}>{s.value.toLocaleString()}</p>
            <p className="text-[10px] text-[#555B70] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Completion summary */}
      {progress.status === "completed" && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-sm font-medium text-green-400">Import Complete</span>
          </div>
          <p className="text-xs text-[#8B92A5]">
            <span className="text-green-400 font-medium">{progress.activeChannels}</span> active channels imported
            {progress.failedChannels > 0 && (
              <>
                {" · "}
                <button onClick={viewFailed} className="text-red-400 hover:underline font-medium">
                  {progress.failedChannels} failed
                </button>
              </>
            )}
          </p>
        </div>
      )}

      {progress.status === "failed" && progress.errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-xs text-red-400">{progress.errorMessage}</p>
        </div>
      )}

      {/* Failed channels drawer */}
      {showFailed && (
        <div className="bg-[#0D1321] border border-border rounded-lg max-h-60 overflow-y-auto">
          <div className="flex items-center justify-between sticky top-0 bg-[#0D1321] p-3 border-b border-border">
            <span className="text-xs font-medium text-white">Failed Channels ({failedList.length})</span>
            <button onClick={() => setShowFailed(false)}><X size={14} className="text-[#8B92A5]" /></button>
          </div>
          <div className="divide-y divide-border/50">
            {loadingFailed ? (
              <div className="p-4 text-center"><Loader2 size={16} className="text-primary animate-spin mx-auto" /></div>
            ) : failedList.length === 0 ? (
              <p className="p-4 text-xs text-[#8B92A5] text-center">No failed channels</p>
            ) : (
              failedList.map((ch) => (
                <div key={ch.id} className="px-3 py-2 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{ch.channelName}</p>
                    <p className="text-[10px] text-[#555B70] truncate">{ch.streamUrl}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <span className="text-[10px] text-red-400 font-medium">{ch.failReason || "Unknown"}</span>
                    {ch.httpStatus && <p className="text-[10px] text-[#555B70]">HTTP {ch.httpStatus}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Import History ─────────────────────────────────── */

const ACTIVE_JOB_STATUSES = ["pending", "parsing", "validating", "completing"];

function ImportHistory({ onReload }: { onReload: () => void }) {
  const { data: jobs, isLoading, refetch } = useApiQuery<ImportJob[]>(
    ["import-jobs"],
    "/v1/m3u-import/jobs",
    {
      refetchInterval: (query) => {
        const data = query.state.data as ImportJob[] | undefined;
        if (Array.isArray(data) && data.some((j) => ACTIVE_JOB_STATUSES.includes(j.status))) return 2000;
        return 15_000;
      },
    },
  );

  const { call: deleteCall } = useApiCallState();
  const { call: cancelCall } = useApiCallState();
  const invalidate = useInvalidate();

  const deleteJob = async (id: string) => {
    if (!confirm("Delete this import job?")) return;
    await deleteCall("delete", `/v1/m3u-import/jobs/${id}`);
    invalidate(["import-jobs"]);
  };

  const cancelJob = async (id: string) => {
    await cancelCall("post", `/v1/m3u-import/jobs/${id}/cancel`);
    refetch();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Import History</h3>
        <button onClick={() => { refetch(); onReload(); }} className="text-[#8B92A5] hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-primary animate-spin" />
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <p className="text-xs text-[#555B70] text-center py-8">No import jobs yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-2 text-[#555B70] font-medium">File</th>
                <th className="text-left py-2.5 px-2 text-[#555B70] font-medium">Status</th>
                <th className="text-center py-2.5 px-2 text-[#555B70] font-medium">Total</th>
                <th className="text-center py-2.5 px-2 text-[#555B70] font-medium">Active</th>
                <th className="text-center py-2.5 px-2 text-[#555B70] font-medium">Failed</th>
                <th className="text-left py-2.5 px-2 text-[#555B70] font-medium">Date</th>
                <th className="text-right py-2.5 px-2 text-[#555B70] font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <FileUp size={13} className="text-[#555B70] shrink-0" />
                      <span className="text-white font-medium truncate max-w-[150px]">{job.filename}</span>
                    </div>
                    <span className="text-[10px] text-[#555B70]">{(job.fileSize / 1024).toFixed(1)} KB</span>
                  </td>
                  <td className="py-2.5 px-2"><StatusBadge status={job.status} /></td>
                  <td className="py-2.5 px-2 text-center text-white">{job.totalChannels.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-center text-green-400">{job.activeChannels.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-center text-red-400">{job.failedChannels.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-[#8B92A5]">{new Date(job.createdAt).toLocaleDateString()}</td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {["pending", "parsing", "validating", "completing"].includes(job.status) && (
                        <button onClick={() => cancelJob(job.id)} className="p-1.5 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors" title="Cancel">
                          <Pause size={13} />
                        </button>
                      )}
                      <button onClick={() => deleteJob(job.id)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────── */

export default function M3uImportPage() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = (jobId: string) => {
    setActiveJobId(jobId);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Upload size={18} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white">M3U Import & Validation</h1>
            {activeJobId && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                IMPORTING
              </span>
            )}
          </div>
          <p className="text-xs text-[#8B92A5]">Upload M3U playlists with automatic stream validation. Only working channels are activated.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upload */}
        <UploadZone onUploaded={handleUploaded} />

        {/* Right: Active progress or quick stats */}
        <div className="space-y-6">
          {activeJobId ? (
            <ProgressCard key={activeJobId} jobId={activeJobId} />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#1A2340] flex items-center justify-center mb-3">
                <Play size={24} className="text-[#555B70]" />
              </div>
              <p className="text-sm text-[#8B92A5]">No active import</p>
              <p className="text-xs text-[#555B70] mt-1">Upload an M3U file to start</p>
            </div>
          )}

          {/* Quick workflow steps */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-xs font-semibold text-[#8B92A5] mb-3 uppercase tracking-wider">How it Works</h3>
            <div className="space-y-3">
              {[
                { step: "1", title: "Upload M3U File", desc: "Drag & drop or browse your playlist file", icon: Upload },
                { step: "2", title: "Background Parsing", desc: "Channels are extracted and queued for validation", icon: RotateCcw },
                { step: "3", title: "Stream Validation", desc: "Each URL is checked for accessibility and HLS validity", icon: Eye },
                { step: "4", title: "Auto-Activation", desc: "Only working streams are saved as active channels", icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{item.title}</p>
                    <p className="text-[11px] text-[#555B70]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Import History */}
      <ImportHistory key={refreshKey} onReload={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}