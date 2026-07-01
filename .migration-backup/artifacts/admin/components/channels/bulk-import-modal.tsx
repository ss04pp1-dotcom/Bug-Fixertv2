"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  X, Upload, Link, FileText, ChevronRight, Check, AlertCircle,
  Loader2, Download, Edit2, CheckSquare, Square, RefreshCw,
  ArrowLeft, FileJson, FileSpreadsheet, Tv2, File, Trash2,
} from "lucide-react";
import { apiClient } from "@/lib/axios-client";

interface ParsedChannel {
  name: string;
  logo: string;
  primaryStreamUrl: string;
  groupTitle: string;
  country: string;
  language: string;
  tvgId: string;
  tvgName: string;
  selected: boolean;
  isDuplicate?: boolean;
  editMode?: boolean;
}

interface Category { id: string; name: string }

type Step = "source" | "input" | "preview" | "importing" | "done";
type SourceType = "m3u" | "json" | "csv" | "remote";
type InputMode = "url" | "file";

interface SourceConfig {
  id: SourceType;
  label: string;
  urlLabel: string;
  fileLabel: string;
  icon: React.FC<{ size?: number; className?: string }>;
  desc: string;
  placeholder: string;
  accept: string;
  extensions: string;
  hint: string;
}

const SOURCE_TYPES: SourceConfig[] = [
  {
    id: "m3u",
    label: "M3U / M3U8",
    urlLabel: "M3U / M3U8 URL",
    fileLabel: "Upload M3U / M3U8 File",
    icon: Link,
    desc: "Import from a remote M3U/M3U8 playlist URL or upload a local file",
    placeholder: "https://example.com/playlist.m3u8",
    accept: ".m3u,.m3u8,.txt",
    extensions: ".m3u · .m3u8 · .txt",
    hint: "m3u",
  },
  {
    id: "json",
    label: "JSON",
    urlLabel: "JSON URL",
    fileLabel: "Upload JSON File",
    icon: FileJson,
    desc: "Import from a remote JSON channels feed URL or upload a local file",
    placeholder: "https://example.com/channels.json",
    accept: ".json",
    extensions: ".json",
    hint: "json",
  },
  {
    id: "csv",
    label: "CSV",
    urlLabel: "CSV URL",
    fileLabel: "Upload CSV File",
    icon: FileSpreadsheet,
    desc: "Import from a remote CSV playlist URL or upload a local file",
    placeholder: "https://example.com/channels.csv",
    accept: ".csv,.txt",
    extensions: ".csv · .txt",
    hint: "csv",
  },
  {
    id: "remote",
    label: "Remote URL (auto)",
    urlLabel: "Remote URL",
    fileLabel: "Upload Local File",
    icon: Tv2,
    desc: "Any URL or local file — format detected automatically",
    placeholder: "https://example.com/channels",
    accept: ".m3u,.m3u8,.json,.csv,.txt",
    extensions: ".m3u · .m3u8 · .json · .csv · .txt",
    hint: "auto",
  },
];

/* ─────────────── parsers ─────────────── */

function parseM3U(content: string): ParsedChannel[] {
  const lines = content.split(/\r?\n/).map(l => l.trim());
  const channels: ParsedChannel[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXTINF:")) continue;
    const tvgId    = line.match(/tvg-id="([^"]*)"/)?.[1] ?? "";
    const tvgName  = line.match(/tvg-name="([^"]*)"/)?.[1] ?? "";
    const tvgLogo  = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? "";
    const group    = line.match(/group-title="([^"]*)"/)?.[1] ?? "";
    const country  = line.match(/tvg-country="([^"]*)"/)?.[1] ?? "";
    const language = line.match(/tvg-language="([^"]*)"/)?.[1] ?? "";
    const commaIdx = line.lastIndexOf(",");
    const name     = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : tvgName;
    let j = i + 1;
    while (j < lines.length && (lines[j].startsWith("#") || lines[j] === "")) j++;
    if (j < lines.length && !lines[j].startsWith("#")) {
      channels.push({ name: name || tvgName, logo: tvgLogo, primaryStreamUrl: lines[j], groupTitle: group, country, language, tvgId, tvgName, selected: true });
      i = j;
    }
  }
  return channels;
}

function parseCSV(content: string): ParsedChannel[] {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^["']|["']$/g, "").toLowerCase().trim());
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (const c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur); cur = ""; continue; }
      cur += c;
    }
    cols.push(cur);
    const g = (k: string[]) => { for (const key of k) { const idx = headers.indexOf(key); if (idx >= 0 && cols[idx]) return cols[idx].trim(); } return ""; };
    return {
      name: g(["name","channel_name","title"]),
      logo: g(["logo","tvg_logo","channel_logo","image"]),
      primaryStreamUrl: g(["url","stream_url","primary_stream_url","primarystreamurl"]),
      groupTitle: g(["group","group_title","category"]),
      country: g(["country"]),
      language: g(["language"]),
      tvgId: g(["tvg_id","tvgid","epg_id"]),
      tvgName: g(["tvg_name","tvgname"]),
      selected: true,
    };
  }).filter(c => c.name && c.primaryStreamUrl);
}

function parseJSON(content: string): ParsedChannel[] {
  const data = JSON.parse(content);
  const arr = Array.isArray(data) ? data : (data as any).channels ?? (data as any).data ?? [];
  return arr.map((item: any) => ({
    name: item.name ?? item.title ?? item.channel_name ?? "",
    logo: item.logo ?? item.tvg_logo ?? item.thumbnail ?? "",
    primaryStreamUrl: item.primaryStreamUrl ?? item.stream_url ?? item.url ?? "",
    groupTitle: item.groupTitle ?? item.group_title ?? item.group ?? item.category ?? "",
    country: item.country ?? "",
    language: item.language ?? "",
    tvgId: item.tvgId ?? item.tvg_id ?? item.epgChannelId ?? "",
    tvgName: item.tvgName ?? item.tvg_name ?? item.name ?? "",
    selected: true,
  })).filter((c: ParsedChannel) => c.name && c.primaryStreamUrl);
}

function parseContent(content: string, hint: string): ParsedChannel[] {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return parseJSON(content);
  if (trimmed.startsWith("#EXTM3U") || trimmed.includes("#EXTINF:")) return parseM3U(content);
  if (hint === "json") return parseJSON(content);
  if (hint === "csv") return parseCSV(content);
  if (trimmed.split("\n")[0].includes(",")) return parseCSV(content);
  return parseM3U(content);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/* ─────────────── file drop zone ─────────────── */

interface FileDropZoneProps {
  accept: string;
  extensions: string;
  parsing: boolean;
  error: string | null;
  file: File | null;
  onFile: (f: File) => void;
  onRemove: () => void;
}

function FileDropZone({ accept, extensions, parsing, error, file, onFile, onRemove }: FileDropZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }, [onFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  if (parsing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5">
        <Loader2 size={32} className="text-primary animate-spin" />
        <div className="text-sm font-semibold text-white">Parsing file…</div>
      </div>
    );
  }

  if (file) {
    return (
      <div className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <File size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{file.name}</div>
          <div className="text-xs text-[#8B92A5] mt-0.5">{formatBytes(file.size)}</div>
        </div>
        <button
          onClick={onRemove}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-red-500/20 hover:bg-red-500/10 transition-colors shrink-0"
          title="Remove file"
        >
          <Trash2 size={13} className="text-red-400" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center gap-4 p-10 rounded-xl border-2 border-dashed transition-all cursor-pointer",
          dragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-white/[0.02]"
        )}
        onClick={() => fileRef.current?.click()}
      >
        <div className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center transition-colors",
          dragging ? "bg-primary/20" : "bg-white/5"
        )}>
          <Upload size={26} className={dragging ? "text-primary" : "text-[#8B92A5]"} />
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold text-white mb-1">
            {dragging ? "Drop your file here" : "Drag & drop your file here"}
          </div>
          <div className="text-xs text-[#8B92A5] mb-3">or</div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            className="px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Browse File
          </button>
        </div>
        <div className="text-[10px] text-[#8B92A5] bg-white/5 px-3 py-1.5 rounded-full">
          Supported: {extensions}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-3 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/* ─────────────── main modal ─────────────── */

interface BulkImportModalProps {
  categories: Category[];
  onClose: () => void;
  onImported: () => void;
}

export default function BulkImportModal({ categories, onClose, onImported }: BulkImportModalProps) {
  const [step, setStep]           = useState<Step>("source");
  const [sourceType, setSource]   = useState<SourceType>("m3u");
  const [inputMode, setInputMode] = useState<InputMode>("url");

  const [urlInput, setUrlInput]   = useState("");
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  const [channels, setChannels]   = useState<ParsedChannel[]>([]);
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; addedAsServer?: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [globalCategory, setGlobalCategory] = useState("");
  const [editIdx, setEditIdx]     = useState<number | null>(null);
  const [editVals, setEditVals]   = useState<Partial<ParsedChannel>>({});
  const [searchFilter, setSearchFilter] = useState("");

  const currentSource = SOURCE_TYPES.find(s => s.id === sourceType)!;
  const selected  = channels.filter(c => c.selected);
  const dupes     = channels.filter(c => c.isDuplicate).length;
  const filtered  = channels.filter(c =>
    !searchFilter || c.name.toLowerCase().includes(searchFilter.toLowerCase()) || c.groupTitle.toLowerCase().includes(searchFilter.toLowerCase())
  );

  /* reset file when switching source or mode */
  useEffect(() => { setPickedFile(null); setParseError(null); }, [sourceType, inputMode]);

  const parseAndPreview = useCallback(async (content: string, hint: string) => {
    setParsing(true);
    setParseError(null);
    try {
      const parsed = parseContent(content, hint);
      if (parsed.length === 0) throw new Error("No channels found in this file — check the format.");
      setChannels(parsed);
      setStep("preview");
    } catch (e: any) {
      setParseError(e?.message ?? "Failed to parse playlist");
    } finally {
      setParsing(false);
    }
  }, []);

  /* URL fetch */
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await apiClient.post<any>("/v1/channels/parse-playlist", { url: urlInput.trim() });
      const { content, contentType } = (res.data as any)?.data ?? res.data;
      const hint = currentSource.hint === "auto" ? (contentType ?? "m3u") : currentSource.hint;
      await parseAndPreview(content, hint);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to fetch URL";
      setParseError(typeof msg === "string" ? msg : "Failed to fetch URL");
      setParsing(false);
    }
  };

  /* File pick → auto-parse */
  const handleFile = useCallback((file: File) => {
    setPickedFile(file);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const ext  = file.name.split(".").pop()?.toLowerCase() ?? "";
      const hint = currentSource.hint !== "auto"
        ? currentSource.hint
        : ext === "json" ? "json" : ext === "csv" ? "csv" : "m3u";
      parseAndPreview(content, hint);
    };
    reader.readAsText(file);
  }, [currentSource.hint, parseAndPreview]);

  const removeFile = () => { setPickedFile(null); setParseError(null); };

  /* channel list helpers */
  const toggleAll = (v: boolean) => setChannels(cs => cs.map(c => ({ ...c, selected: v })));
  const toggle    = (i: number) =>  setChannels(cs => cs.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c));

  const startEdit = (i: number) => {
    setEditIdx(i);
    setEditVals({ name: channels[i].name, logo: channels[i].logo, primaryStreamUrl: channels[i].primaryStreamUrl, groupTitle: channels[i].groupTitle, country: channels[i].country, language: channels[i].language, tvgId: channels[i].tvgId });
  };
  const saveEdit = () => {
    if (editIdx === null) return;
    setChannels(cs => cs.map((c, i) => i === editIdx ? { ...c, ...editVals } : c));
    setEditIdx(null);
  };

  const applyGlobalCategory = () => {
    if (!globalCategory) return;
    setChannels(cs => cs.map(c => c.selected ? { ...c, groupTitle: categories.find(cat => cat.id === globalCategory)?.name ?? c.groupTitle } : c));
  };

  const handleImport = async () => {
    const toImport = selected.map(c => ({
      name: c.name,
      logo: c.logo || undefined,
      primaryStreamUrl: c.primaryStreamUrl,
      categoryId: categories.find(cat => cat.name === c.groupTitle)?.id || (globalCategory || undefined),
      country: c.country || undefined,
      language: c.language || undefined,
      epgChannelId: c.tvgId || undefined,
      streamType: "HLS",
      isActive: true,
    }));
    if (toImport.length === 0) return;
    setImporting(true);
    setStep("importing");
    try {
      const res = await apiClient.post<any>("/v1/channels/bulk-import", { channels: toImport });
      const result = (res.data as any)?.data ?? res.data;
      setImportResult(result);
      setStep("done");
      onImported();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Import failed";
      setImportResult({ imported: 0, skipped: 0, errors: [typeof msg === "string" ? msg : "Import failed"] });
      setStep("done");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = (fmt: "json" | "csv" | "m3u") => {
    const toExport = selected.length > 0 ? selected : channels;
    let content = "";
    const filename = `channels.${fmt}`;
    if (fmt === "json") {
      content = JSON.stringify(toExport.map(c => ({ name: c.name, logo: c.logo, primaryStreamUrl: c.primaryStreamUrl, groupTitle: c.groupTitle, country: c.country, language: c.language, tvgId: c.tvgId })), null, 2);
    } else if (fmt === "csv") {
      const headers = "name,logo,primaryStreamUrl,groupTitle,country,language,tvgId";
      const rows    = toExport.map(c => [c.name, c.logo, c.primaryStreamUrl, c.groupTitle, c.country, c.language, c.tvgId].map(v => `"${v.replace(/"/g, '""')}"`).join(","));
      content = [headers, ...rows].join("\n");
    } else {
      const lines = ["#EXTM3U"];
      for (const c of toExport) {
        lines.push(`#EXTINF:-1 tvg-id="${c.tvgId}" tvg-name="${c.tvgName || c.name}" tvg-logo="${c.logo}" group-title="${c.groupTitle}",${c.name}`);
        lines.push(c.primaryStreamUrl);
      }
      content = lines.join("\n");
    }
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  /* ─── render ─── */
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a1020] border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {(step === "input" || step === "preview") && (
              <button onClick={() => { setStep(step === "preview" ? "input" : "source"); setParseError(null); }} className="text-[#8B92A5] hover:text-white">
                <ArrowLeft size={16} />
              </button>
            )}
            <h2 className="text-sm font-bold text-white">
              {step === "source"    && "Bulk Import Channels"}
              {step === "input"     && "Load Playlist"}
              {step === "preview"   && `Preview — ${channels.length.toLocaleString()} channels found`}
              {step === "importing" && "Importing…"}
              {step === "done"      && "Import Complete"}
            </h2>
            {step === "preview" && (
              <span className="text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">
                {selected.length.toLocaleString()} selected{dupes > 0 ? ` · ${dupes} duplicates` : ""}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-[#8B92A5] hover:text-white"><X size={18} /></button>
        </div>

        {/* Steps bar */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-border shrink-0">
          {(["source","input","preview","done"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                s === step ? "bg-primary text-white" :
                (["source","input","preview","done"].indexOf(step) > i) ? "bg-green-500/80 text-white" : "bg-white/10 text-[#8B92A5]"
              )}>
                {["source","input","preview","done"].indexOf(step) > i ? <Check size={10} /> : i + 1}
              </div>
              <span className={cn("text-[10px] capitalize", s === step ? "text-white" : "text-[#8B92A5]")}>
                {s === "source" ? "Source" : s === "input" ? "Load" : s === "preview" ? "Preview" : "Done"}
              </span>
              {i < 3 && <ChevronRight size={10} className="text-[#8B92A5]" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: SOURCE ── */}
          {step === "source" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOURCE_TYPES.map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSource(s.id); setInputMode("url"); setStep("input"); setParseError(null); setUrlInput(""); setPickedFile(null); }}
                    className={cn(
                      "flex items-start gap-4 p-5 rounded-xl border transition-all text-left",
                      sourceType === s.id ? "border-primary bg-primary/10" : "border-border hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white mb-1">{s.label}</div>
                      <div className="text-xs text-[#8B92A5] leading-relaxed">{s.desc}</div>
                      <div className="flex items-center gap-3 mt-2.5">
                        <span className="flex items-center gap-1 text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">
                          <Link size={9} /> URL
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-[#8B92A5] bg-white/5 px-2 py-0.5 rounded-full">
                          <Upload size={9} /> File Upload
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── STEP 2: INPUT ── */}
          {step === "input" && (
            <div className="max-w-xl mx-auto space-y-5">
              {/* Source badge */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-2">
                <currentSource.icon size={14} className="text-primary shrink-0" />
                <span className="text-xs text-[#8B92A5]">
                  <span className="text-primary font-semibold">{currentSource.label}</span>
                  {" "}— choose how to load your playlist
                </span>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                <button
                  onClick={() => setInputMode("url")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                    inputMode === "url"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-[#8B92A5] hover:text-white"
                  )}
                >
                  <Link size={13} />
                  {currentSource.urlLabel}
                </button>
                <button
                  onClick={() => setInputMode("file")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all",
                    inputMode === "file"
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "text-[#8B92A5] hover:text-white"
                  )}
                >
                  <Upload size={13} />
                  {currentSource.fileLabel}
                </button>
              </div>

              {/* URL mode */}
              {inputMode === "url" && (
                <div className="space-y-3">
                  <label className="text-xs text-[#8B92A5] block">Playlist URL</label>
                  <input
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleFetchUrl()}
                    placeholder={currentSource.placeholder}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                  />
                  {parseError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <AlertCircle size={12} className="shrink-0" />
                      {parseError}
                    </div>
                  )}
                  <button
                    onClick={handleFetchUrl}
                    disabled={!urlInput.trim() || parsing}
                    className="w-full py-3 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {parsing
                      ? <><Loader2 size={14} className="animate-spin" /> Fetching playlist…</>
                      : <><RefreshCw size={14} /> Fetch &amp; Parse Playlist</>}
                  </button>
                </div>
              )}

              {/* File mode */}
              {inputMode === "file" && (
                <FileDropZone
                  accept={currentSource.accept}
                  extensions={currentSource.extensions}
                  parsing={parsing}
                  error={parseError}
                  file={pickedFile}
                  onFile={handleFile}
                  onRemove={removeFile}
                />
              )}
            </div>
          )}

          {/* ── STEP 3: PREVIEW ── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-xs text-[#8B92A5]">
                  Total: <span className="text-white font-semibold">{channels.length.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 text-xs text-green-400">
                  Selected: <span className="font-semibold">{selected.length.toLocaleString()}</span>
                </div>
                {dupes > 0 && (
                  <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
                    Duplicates: <span className="font-semibold">{dupes}</span>
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#8B92A5]">Export:</span>
                  {(["json","csv","m3u"] as const).map(f => (
                    <button key={f} onClick={() => handleExport(f)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[10px] text-[#8B92A5] hover:bg-white/5 hover:text-white">
                      <Download size={10} /> {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => toggleAll(true)}  className="flex items-center gap-1.5 text-xs text-[#8B92A5] hover:text-white"><CheckSquare size={13} /> Select all</button>
                <button onClick={() => toggleAll(false)} className="flex items-center gap-1.5 text-xs text-[#8B92A5] hover:text-white"><Square size={13} /> Deselect all</button>
                <div className="flex-1 min-w-[160px]">
                  <input value={searchFilter} onChange={e => setSearchFilter(e.target.value)} placeholder="Filter channels…"
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary placeholder:text-[#8B92A5]" />
                </div>
                {categories.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select value={globalCategory} onChange={e => setGlobalCategory(e.target.value)}
                      className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary">
                      <option value="">Assign category…</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={applyGlobalCategory} disabled={!globalCategory}
                      className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                      Apply to selected
                    </button>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-border bg-[#0d1525]">
                        <th className="px-3 py-2.5 w-8">
                          <input type="checkbox" checked={channels.length > 0 && channels.every(c => c.selected)} onChange={e => toggleAll(e.target.checked)} className="accent-primary" />
                        </th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">Logo</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">Name</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">Stream URL</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">Group</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">TVG ID</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 500).map((ch, rawIdx) => {
                        const realIdx = channels.indexOf(ch);
                        if (editIdx === realIdx) {
                          return (
                            <tr key={realIdx} className="border-b border-border/50 bg-primary/5">
                              <td className="px-3 py-2" colSpan={7}>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  {([
                                    ["Name", "name", "Channel name"],
                                    ["Logo URL", "logo", "https://…/logo.png"],
                                    ["Stream URL", "primaryStreamUrl", "https://…/stream.m3u8"],
                                    ["Group", "groupTitle", "News"],
                                    ["Country", "country", "US"],
                                    ["Language", "language", "English"],
                                    ["TVG ID", "tvgId", "CNN"],
                                  ] as [string, keyof ParsedChannel, string][]).map(([lbl, key, ph]) => (
                                    <div key={key}>
                                      <label className="text-[9px] text-[#8B92A5] block mb-0.5">{lbl}</label>
                                      <input
                                        value={editVals[key] as string ?? ""}
                                        onChange={e => setEditVals(v => ({ ...v, [key]: e.target.value }))}
                                        placeholder={ph}
                                        className="w-full bg-background border border-border rounded px-2 py-1 text-[11px] text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
                                      />
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1 rounded-lg gradient-primary text-white text-xs font-semibold"><Check size={11} /> Save</button>
                                  <button onClick={() => setEditIdx(null)} className="flex items-center gap-1 px-3 py-1 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5"><X size={11} /> Cancel</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={realIdx} className={cn("border-b border-border/50 last:border-0 hover:bg-white/[0.02]", !ch.selected && "opacity-40")}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={ch.selected} onChange={() => toggle(realIdx)} className="accent-primary" />
                            </td>
                            <td className="px-3 py-2">
                              {ch.logo
                                ? <img src={ch.logo} alt="" className="w-8 h-8 rounded object-contain bg-black/20" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                : <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center text-[10px] text-[#8B92A5]">{ch.name.slice(0, 2).toUpperCase()}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-white max-w-[160px] truncate">{ch.name}</td>
                            <td className="px-3 py-2 text-[10px] text-[#8B92A5] max-w-[200px] truncate">{ch.primaryStreamUrl}</td>
                            <td className="px-3 py-2 text-[10px] text-[#8B92A5]">{ch.groupTitle || "—"}</td>
                            <td className="px-3 py-2 text-[10px] text-[#8B92A5]">{ch.tvgId || "—"}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => startEdit(realIdx)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10">
                                <Edit2 size={11} className="text-[#8B92A5]" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length > 500 && (
                        <tr><td colSpan={7} className="text-center py-3 text-xs text-[#8B92A5]">Showing 500 of {filtered.length} — use search to filter</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── IMPORTING ── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <div className="text-white font-semibold">Importing {selected.length.toLocaleString()} channels…</div>
              <div className="text-xs text-[#8B92A5]">This may take a moment for large playlists</div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === "done" && importResult && (
            <div className="flex flex-col items-center justify-center py-16 gap-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={32} className="text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Import Complete</h3>
              <div className="flex gap-4 flex-wrap justify-center">
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-6 py-4 text-center">
                  <div className="text-2xl font-bold text-green-400">{importResult.imported}</div>
                  <div className="text-xs text-[#8B92A5]">Imported</div>
                </div>
                {(importResult.addedAsServer ?? 0) > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-6 py-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{importResult.addedAsServer}</div>
                    <div className="text-xs text-[#8B92A5]">Added as Server</div>
                  </div>
                )}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-6 py-4 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{importResult.skipped}</div>
                  <div className="text-xs text-[#8B92A5]">Skipped (duplicates)</div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4 text-center">
                    <div className="text-2xl font-bold text-red-400">{importResult.errors.length}</div>
                    <div className="text-xs text-[#8B92A5]">Errors</div>
                  </div>
                )}
              </div>
              {importResult.errors.length > 0 && (
                <details className="w-full max-w-md">
                  <summary className="text-xs text-red-400 cursor-pointer">Show errors</summary>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="text-[10px] text-red-300 bg-red-500/5 rounded px-2 py-1">{err}</div>
                    ))}
                  </div>
                </details>
              )}
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90">Done</button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "preview" && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
            <div className="text-xs text-[#8B92A5]">
              {selected.length.toLocaleString()} of {channels.length.toLocaleString()} channels selected
            </div>
            <button
              onClick={handleImport}
              disabled={selected.length === 0 || importing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {importing ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : <><Upload size={14} /> Import {selected.length.toLocaleString()} Channels</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
