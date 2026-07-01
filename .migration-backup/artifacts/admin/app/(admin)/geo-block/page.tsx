"use client";

import { useState } from "react";
import { Trash2, Plus, Globe2, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import { useApiQuery, useApiMutation, useInvalidate, getApiErrorMessage } from "@/lib/use-api";

interface GeoRestriction {
  id:          number;
  countryCode: string;
  isBlocked:   boolean;
  reason:      string | null;
  createdAt:   string;
  updatedAt:   string;
}

const COUNTRIES: { code: string; name: string }[] = [
  { code: "AF", name: "Afghanistan" }, { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },     { code: "AR", name: "Argentina" },
  { code: "AU", name: "Australia" },   { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },     { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },      { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },    { code: "HR", name: "Croatia" },
  { code: "CZ", name: "Czech Republic"}, { code: "DK", name: "Denmark" },
  { code: "EG", name: "Egypt" },       { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },      { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },       { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },     { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },   { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },        { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },      { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },       { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },  { code: "KE", name: "Kenya" },
  { code: "KW", name: "Kuwait" },      { code: "LB", name: "Lebanon" },
  { code: "LY", name: "Libya" },       { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" },      { code: "MA", name: "Morocco" },
  { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },     { code: "NO", name: "Norway" },
  { code: "PK", name: "Pakistan" },    { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },    { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },     { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" },{ code: "ZA", name: "South Africa" },
  { code: "KR", name: "South Korea" }, { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },      { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },       { code: "TW", name: "Taiwan" },
  { code: "TH", name: "Thailand" },    { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },      { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" }, { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },     { code: "YE", name: "Yemen" },
];

function countryName(code: string) {
  return COUNTRIES.find(c => c.code === code)?.name ?? code;
}

const QUERY_KEY = ["geo-block"];

export default function GeoBlockPage() {
  const invalidate = useInvalidate();

  const { data: restrictions = [], isLoading, error } =
    useApiQuery<GeoRestriction[]>(QUERY_KEY, "/v1/geo-block");

  const setMutation = useApiMutation<GeoRestriction, { countryCode: string; isBlocked: boolean; reason?: string }>(
    "post", "/v1/geo-block",
    { onSuccess: () => { invalidate(QUERY_KEY); setShowAdd(false); } },
  );

  const [deleteErr, setDeleteErr] = useState("");
  const deleteMutation = useApiMutation<unknown, string>(
    "delete",
    (country) => `/v1/geo-block/${country}`,
    {
      onSuccess: () => { invalidate(QUERY_KEY); setDeleteErr(""); },
      onError:   (err: any) => setDeleteErr(err?.message ?? "Failed to remove geo rule"),
    },
  );

  const [showAdd, setShowAdd]       = useState(false);
  const [code, setCode]             = useState("");
  const [customCode, setCustomCode] = useState("");
  const [isBlocked, setIsBlocked]   = useState(true);
  const [reason, setReason]         = useState("");
  const [mutErr, setMutErr]         = useState("");

  const resetForm = () => { setCode(""); setCustomCode(""); setIsBlocked(true); setReason(""); setMutErr(""); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutErr("");
    const finalCode = (code === "__custom__" ? customCode : code).trim().toUpperCase();
    if (!finalCode || finalCode.length < 2) { setMutErr("Enter a valid country code (2–3 letters)."); return; }
    try {
      await setMutation.mutateAsync({ countryCode: finalCode, isBlocked, reason: reason || undefined });
      resetForm();
    } catch (err) {
      setMutErr(getApiErrorMessage(err));
    }
  };

  const handleDelete = (country: string) => {
    if (confirm(`Remove geo rule for ${countryName(country)} (${country})?`)) {
      deleteMutation.mutate(country);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe2 size={20} className="text-primary" />
            Geo Blocking
          </h1>
          <p className="text-sm text-[#8B92A5] mt-0.5">
            Control which countries can access the streaming platform.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Add Rule
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">New Geo Rule</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Country</label>
                <select
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="" disabled>Select a country…</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                  ))}
                  <option value="__custom__">Other — enter code manually</option>
                </select>
              </div>
              {code === "__custom__" && (
                <div>
                  <label className="text-xs text-[#8B92A5] mb-1.5 block">Custom Country Code</label>
                  <input
                    value={customCode}
                    onChange={e => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. XK"
                    maxLength={3}
                    required
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Action</label>
                <select
                  value={isBlocked ? "block" : "allow"}
                  onChange={e => setIsBlocked(e.target.value === "block")}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                >
                  <option value="block">Block — deny access</option>
                  <option value="allow">Allow — explicitly permit</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Reason (optional)</label>
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Licensing restriction"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                />
              </div>
            </div>

            {mutErr && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {mutErr}
              </p>
            )}
            {deleteErr && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {deleteErr}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-[#8B92A5] hover:text-white hover:border-white/20 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={setMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {setMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="text-sm font-medium text-white">
            Active Rules
            <span className="ml-2 text-xs text-[#8B92A5] font-normal">
              {restrictions.length} {restrictions.length === 1 ? "entry" : "entries"}
            </span>
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-sm text-red-400">{getApiErrorMessage(error)}</div>
        ) : restrictions.length === 0 ? (
          <div className="py-16 text-center">
            <Globe2 size={36} className="mx-auto text-[#8B92A5] mb-3 opacity-40" />
            <p className="text-sm text-[#8B92A5]">No geo rules yet. All countries are permitted by default.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {restrictions.map(r => (
              <div key={r.countryCode} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] group">
                <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{r.countryCode}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{countryName(r.countryCode)}</p>
                  {r.reason && <p className="text-xs text-[#8B92A5] truncate mt-0.5">{r.reason}</p>}
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  r.isBlocked
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-green-500/10 text-green-400 border border-green-500/20"
                }`}>
                  {r.isBlocked
                    ? <><ShieldOff size={11} /> Blocked</>
                    : <><ShieldCheck size={11} /> Allowed</>
                  }
                </span>
                <button
                  onClick={() => handleDelete(r.countryCode)}
                  disabled={deleteMutation.isPending}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-[#8B92A5] hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
