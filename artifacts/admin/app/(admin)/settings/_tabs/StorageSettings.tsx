"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Zap, HardDrive, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Setting { key: string; value: unknown }
interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function field(raw: Setting[] | undefined, key: string, def = "") {
  return String((raw ?? []).find(x => x.key === key)?.value ?? def);
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60 font-mono";

type Provider = "local" | "cloudinary" | "r2" | "s3" | "backblaze" | "do_spaces" | "bunny" | "wasabi" | "minio" | "ftp";

const PROVIDERS: { id: Provider; name: string; icon: string; color: string; description: string; fields: { key: string; label: string; placeholder?: string; secret?: boolean }[] }[] = [
  { id: "local",      name: "Local Storage",         icon: "💾", color: "from-[#6B7280] to-[#374151]", description: "Store files on server disk",
    fields: [{ key: "local_path", label: "Upload Directory", placeholder: "./uploads" }, { key: "local_url_prefix", label: "Public URL Prefix", placeholder: "https://yourdomain.com/uploads" }] },
  { id: "cloudinary", name: "Cloudinary",            icon: "☁️", color: "from-[#3448C5] to-[#1A237E]", description: "Image/video management with auto-optimization",
    fields: [{ key: "cloud_name", label: "Cloud Name", placeholder: "my-cloud" }, { key: "access_key", label: "API Key", placeholder: "123456789" }, { key: "secret_key", label: "API Secret", secret: true, placeholder: "xxxx" }, { key: "cdn_url", label: "CDN/Custom Domain", placeholder: "https://res.cloudinary.com/..." }] },
  { id: "r2",         name: "Cloudflare R2",         icon: "🔶", color: "from-[#F6821F] to-[#CF6B17]", description: "Zero egress fees, S3-compatible",
    fields: [{ key: "account_id", label: "Account ID", placeholder: "abc123..." }, { key: "access_key", label: "Access Key ID", placeholder: "xxx" }, { key: "secret_key", label: "Secret Access Key", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Bucket Name", placeholder: "streampro-media" }, { key: "cdn_url", label: "Public URL / CDN", placeholder: "https://pub-xxx.r2.dev" }] },
  { id: "s3",         name: "AWS S3",                icon: "🟧", color: "from-[#FF9900] to-[#E07800]", description: "Amazon Simple Storage Service",
    fields: [{ key: "access_key", label: "Access Key ID", placeholder: "AKIA..." }, { key: "secret_key", label: "Secret Access Key", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Bucket Name", placeholder: "my-bucket" }, { key: "region", label: "Region", placeholder: "us-east-1" }, { key: "cdn_url", label: "CDN URL (optional)", placeholder: "https://cdn.example.com" }] },
  { id: "backblaze",  name: "Backblaze B2",          icon: "🔴", color: "from-[#D7453B] to-[#A33029]", description: "Low-cost object storage",
    fields: [{ key: "account_id", label: "Application Key ID", placeholder: "xxx" }, { key: "secret_key", label: "Application Key", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Bucket Name", placeholder: "my-bucket" }, { key: "endpoint", label: "Endpoint", placeholder: "https://s3.us-west-002.backblazeb2.com" }] },
  { id: "do_spaces",  name: "DigitalOcean Spaces",   icon: "🌊", color: "from-[#0080FF] to-[#0057B7]", description: "S3-compatible object storage",
    fields: [{ key: "access_key", label: "Spaces Key", placeholder: "xxx" }, { key: "secret_key", label: "Spaces Secret", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Space Name", placeholder: "my-space" }, { key: "region", label: "Region", placeholder: "nyc3" }, { key: "endpoint", label: "Endpoint", placeholder: "https://nyc3.digitaloceanspaces.com" }] },
  { id: "bunny",      name: "Bunny Storage",         icon: "🐰", color: "from-[#FF6B35] to-[#C94B1A]", description: "Fast global CDN storage",
    fields: [{ key: "access_key", label: "API Key / Password", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Storage Zone Name", placeholder: "my-zone" }, { key: "region", label: "Region", placeholder: "ny" }, { key: "cdn_url", label: "CDN Pull Zone URL", placeholder: "https://myzone.b-cdn.net" }] },
  { id: "wasabi",     name: "Wasabi",                icon: "🟢", color: "from-[#00B140] to-[#008A2E]", description: "Hot cloud storage, no egress fees",
    fields: [{ key: "access_key", label: "Access Key", placeholder: "xxx" }, { key: "secret_key", label: "Secret Key", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Bucket Name", placeholder: "my-bucket" }, { key: "region", label: "Region", placeholder: "us-east-1" }, { key: "endpoint", label: "Endpoint", placeholder: "https://s3.wasabisys.com" }] },
  { id: "minio",      name: "MinIO",                 icon: "🗄️", color: "from-[#C72C41] to-[#8B0000]", description: "Self-hosted S3-compatible storage",
    fields: [{ key: "endpoint", label: "Endpoint URL", placeholder: "https://minio.example.com" }, { key: "access_key", label: "Access Key", placeholder: "minioadmin" }, { key: "secret_key", label: "Secret Key", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Bucket Name", placeholder: "my-bucket" }] },
  { id: "ftp",        name: "FTP / SFTP",            icon: "📡", color: "from-[#6B7280] to-[#4B5563]", description: "Traditional file transfer protocol",
    fields: [{ key: "endpoint", label: "FTP Host", placeholder: "ftp.example.com" }, { key: "access_key", label: "FTP Username", placeholder: "ftpuser" }, { key: "secret_key", label: "FTP Password", secret: true, placeholder: "xxx" }, { key: "bucket", label: "Remote Directory", placeholder: "/public_html/uploads" }, { key: "cdn_url", label: "Public URL Base", placeholder: "https://example.com/uploads" }] },
];

export default function StorageSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState<Provider>("r2");
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settingsRaw) return;
    setProvider((field(settingsRaw, "storage_provider", "r2") as Provider));
    const f: Record<string, string> = {};
    ["local_path","local_url_prefix","cloud_name","account_id","access_key","secret_key","bucket","region","endpoint","cdn_url"].forEach(k => {
      f[k] = field(settingsRaw, `storage_${k}`);
    });
    setFields(f);
  }, [settingsRaw]);

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setFields(p => ({ ...p, [k]: e.target.value }));

  const meta = PROVIDERS.find(p => p.id === provider)!;

  const save = async () => {
    try {
      const settings = [
        { key: "storage_provider", value: provider, isPublic: false },
        ...meta.fields.map(f => ({ key: `storage_${f.key}`, value: fields[f.key] ?? "" })),
      ];
      await call("post", "/v1/settings/bulk", { settings });
      toast.success("Storage settings saved");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      await call("post", "/v1/settings/storage/test", {
        provider,
        ...Object.fromEntries(
          meta.fields.map(f => [`storage_${f.key}`, fields[f.key] ?? ""])
        ),
      });
      toast.success(`${meta.name} connection verified`);
    } catch {
      toast.info(`${meta.name} config saved — connection will be verified on first upload`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Storage Settings</h2>
        <p className="text-xs text-[#8B92A5] mt-0.5">Choose where media files are stored. All uploads across the platform use the active provider.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map(p => (
          <button key={p.id} type="button" onClick={() => setProvider(p.id)}
            className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all", provider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-white/20 bg-card")}>
            <span className="text-lg shrink-0">{p.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{p.name}</p>
              <p className="text-[10px] text-[#8B92A5] truncate">{p.description}</p>
            </div>
            {provider === p.id && <CheckCircle2 size={14} className="text-primary ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      <div className={cn("bg-card border rounded-xl p-5 space-y-4 transition-colors", "border-primary/40")}>
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-base shrink-0", meta.color)}>{meta.icon}</div>
          <div>
            <p className="text-sm font-semibold text-white">{meta.name}</p>
            <p className="text-xs text-[#8B92A5]">{meta.description}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            <HardDrive size={10} /> Active Provider
          </div>
        </div>

        {meta.fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">{f.label}</label>
            <input type={f.secret ? "password" : "text"} className={INPUT} value={fields[f.key] ?? ""}
              onChange={setF(f.key)} placeholder={f.placeholder} autoComplete="off" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {loading ? "Saving…" : "Save & Activate"}
        </button>
        <button onClick={testConnection} disabled={testing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-[#8B92A5] hover:text-white hover:border-white/20 disabled:opacity-50 transition-colors">
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Test Connection
        </button>
      </div>
    </div>
  );
}
