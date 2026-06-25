"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, Link, X, ImageIcon, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/axios-client";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  uploadPath?: string;
  label?: string;
  className?: string;
  previewClass?: string;
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  uploadPath = "/v1/storage/upload?folder=logos",
  label,
  className,
  previewClass,
  accept = "image/jpeg,image/jpg,image/png,image/webp,image/gif",
}: ImageUploadProps) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState(value ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiClient.post<{ data: { url: string } }>(uploadPath, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url: string = (res.data as any)?.data?.url ?? (res.data as any)?.url ?? "";
      if (!url) throw new Error("No URL returned");
      onChange(url);
      setUrlInput(url);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const handleUrlApply = () => {
    const url = urlInput.trim();
    if (url) onChange(url);
  };

  const handleClear = () => {
    onChange("");
    setUrlInput("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-xs text-[#8B92A5] block">{label}</label>}

      <div className="flex gap-1 mb-2">
        {(["upload", "url"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              mode === m ? "bg-primary/20 text-primary border border-primary/30" : "text-[#8B92A5] hover:text-white border border-transparent"
            )}
          >
            {m === "upload" ? <Upload size={11} /> : <Link size={11} />}
            {m === "upload" ? "Upload File" : "Paste URL"}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
            dragOver ? "border-primary bg-primary/10" : "border-border hover:border-white/20 hover:bg-white/5",
            uploading && "pointer-events-none opacity-60",
            value ? "py-3" : "py-6"
          )}
        >
          <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
          {uploading ? (
            <Loader2 size={20} className="text-primary animate-spin" />
          ) : (
            <Upload size={18} className="text-[#8B92A5]" />
          )}
          <span className="text-xs text-[#8B92A5]">
            {uploading ? "Uploading…" : "Click or drag image here"}
          </span>
        </div>
      )}

      {mode === "url" && (
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleUrlApply()}
            placeholder="https://example.com/image.jpg"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary placeholder:text-[#8B92A5]"
          />
          <button
            type="button"
            onClick={handleUrlApply}
            className="px-3 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 shrink-0"
          >
            Apply
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {value && (
        <div className={cn("relative group rounded-lg overflow-hidden border border-border bg-black/20", previewClass ?? "h-20 w-full")}>
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
          <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white"
            >
              <Upload size={8} /> Replace
            </button>
          </div>
        </div>
      )}

      {!value && (
        <div className={cn("rounded-lg border border-border bg-black/10 flex items-center justify-center", previewClass ?? "h-14 w-full")}>
          <ImageIcon size={16} className="text-[#8B92A5]/40" />
        </div>
      )}
    </div>
  );
}
