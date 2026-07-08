"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Plus, Search, Edit, Trash2, ChevronDown, ChevronLeft, ChevronRight,
  Menu, RefreshCw, Trophy, Users, Calendar, Tv, Layers,
} from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface Sport { id: string; name: string }
interface Tournament { id: string; name: string; sportId?: string; country?: string; isActive?: boolean; startDate?: string; endDate?: string; description?: string }
interface Team { id: string; name: string; shortName?: string; abbr?: string; logo?: string; country?: string; tournamentId?: string; tournament?: { name: string } | null }

interface Match {
  id: string;
  title?: string;
  sportId?: string;
  tournamentId?: string;
  teamAId?: string;
  teamBId?: string;
  scheduledAt?: string;
  venue?: string;
  streamUrl?: string;
  description?: string;
  status?: string;
  isActive?: boolean;
  sport?: { name: string } | null;
  tournament?: { name: string } | null;
  teamA?: { name: string; logo?: string; abbr?: string } | null;
  teamB?: { name: string; logo?: string; abbr?: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; totalPages: number; page: number };
}

type Tab = "matches" | "teams" | "tournaments" | "sports";

const STATUS_COLORS: Record<string, string> = {
  live: "bg-red-500/15 text-red-400",
  upcoming: "bg-blue-500/15 text-blue-400",
  completed: "bg-green-500/15 text-green-400",
  postponed: "bg-yellow-500/15 text-yellow-400",
  cancelled: "bg-gray-500/15 text-gray-400",
};

/* ─── Component ─────────────────────────────────────────────────────────────── */

export default function Sports() {
  const [activeTab, setActiveTab] = useState<Tab>("matches");

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Sports</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 pb-0">
        {([
          { key: "matches" as Tab, label: "Matches", icon: Tv },
          { key: "teams" as Tab, label: "Teams", icon: Users },
          { key: "tournaments" as Tab, label: "Tournaments", icon: Trophy },
          { key: "sports" as Tab, label: "Sport Types", icon: Layers },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-card border border-border border-b-card text-white"
                : "text-[#8B92A5] hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "matches" && <MatchesTab />}
        {activeTab === "teams" && <TeamsTab />}
        {activeTab === "tournaments" && <TournamentsTab />}
        {activeTab === "sports" && <SportTypesTab />}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MATCHES TAB — helpers
   ═══════════════════════════════════════════════════════════════════════════════ */

interface MatchForm {
  title: string; sportId: string; tournamentId: string;
  teamAId: string; teamBId: string; scheduledAt: string;
  venue: string; streamUrls: { label: string; url: string }[];
  description: string; status: string; isActive: boolean;
}

const blankMatchForm = (): MatchForm => ({
  title: '', sportId: '', tournamentId: '', teamAId: '', teamBId: '',
  scheduledAt: '', venue: '', streamUrls: [{ label: 'Server 1', url: '' }],
  description: '', status: 'upcoming', isActive: true,
});

function matchToForm(m: Match): MatchForm {
  let urls: { label: string; url: string }[] = [];
  if ((m as any).streamUrls && Array.isArray((m as any).streamUrls)) {
    urls = (m as any).streamUrls;
  } else if (m.streamUrl) {
    urls = [{ label: 'Server 1', url: m.streamUrl }];
  }
  if (urls.length === 0) urls = [{ label: 'Server 1', url: '' }];
  return {
    title: m.title ?? '', sportId: m.sportId ?? '', tournamentId: m.tournamentId ?? '',
    teamAId: m.teamAId ?? '', teamBId: m.teamBId ?? '',
    scheduledAt: m.scheduledAt ? m.scheduledAt.slice(0, 16) : '',
    venue: m.venue ?? '', streamUrls: urls,
    description: m.description ?? '', status: m.status ?? 'upcoming',
    isActive: m.isActive ?? true,
  };
}

/* ─── ChannelSearchPicker ─────────────────────────────────────────────────── */
function ChannelSearchPicker({
  channels,
  onSelect,
  placeholder = "Search channels to add a stream URL…",
}: {
  channels: { id: string; name: string; primaryStreamUrl?: string; streamUrl?: string }[];
  onSelect: (url: string, channelName: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = q
    ? channels.filter(c => (c.name ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 60)
    : channels.slice(0, 60);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div className={cn(
        "flex items-center gap-2 bg-background border rounded-lg px-3 py-2.5",
        open ? "border-primary" : "border-border"
      )}>
        <Search size={13} className="text-[#8B92A5] shrink-0" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setOpen(false); }}
            className="text-[#8B92A5] hover:text-white text-lg leading-none">&times;</button>
        )}
      </div>
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-[#0d1525] border border-border rounded-xl max-h-52 overflow-y-auto shadow-2xl">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-[#8B92A5] text-center">
              {q ? `No channels match "${q}"` : "No channels available"}
            </p>
          ) : filtered.map(ch => (
            <button
              key={ch.id}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                const url = ch.primaryStreamUrl || ch.streamUrl || '';
                onSelect(url, ch.name);
                setQ(ch.name);
                setOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 group"
            >
              <Tv size={13} className="text-primary shrink-0" />
              <span className="text-sm text-white truncate flex-1">{ch.name}</span>
              <span className="text-[10px] text-[#8B92A5] shrink-0 group-hover:text-primary">+ add</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── StreamUrlsEditor ───────────────────────────────────────────────────── */
function StreamUrlsEditor({
  urls,
  onChange,
}: {
  urls: { label: string; url: string }[];
  onChange: (urls: { label: string; url: string }[]) => void;
}) {
  const add = () => onChange([...urls, { label: `Server ${urls.length + 1}`, url: '' }]);
  const remove = (i: number) => onChange(urls.filter((_, idx) => idx !== i));
  const update = (i: number, key: 'label' | 'url', val: string) => {
    const next = [...urls];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {urls.map((entry, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            value={entry.label}
            onChange={e => update(i, 'label', e.target.value)}
            placeholder="Label"
            className={cn(inputClass, "w-28 shrink-0 text-xs")}
          />
          <input
            value={entry.url}
            onChange={e => update(i, 'url', e.target.value)}
            placeholder="https://…/stream.m3u8"
            className={cn(inputClass, "flex-1 text-xs font-mono")}
          />
          {urls.length > 1 && (
            <button type="button" onClick={() => remove(i)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-red-400 hover:bg-red-500/10">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
        <Plus size={12} /> Add another stream server
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MATCHES TAB
   ═══════════════════════════════════════════════════════════════════════════════ */

function MatchesTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterSport, setFilterSport] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTournament, setFilterTournament] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Match | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Form state — replaces all refs
  const [form, setForm] = useState<MatchForm>(blankMatchForm());
  const [editForm, setEditForm] = useState<MatchForm>(blankMatchForm());
  const pf = <K extends keyof MatchForm>(k: K, v: MatchForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const pe = <K extends keyof MatchForm>(k: K, v: MatchForm[K]) => setEditForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filterStatus) params.set("status", filterStatus);
  if (filterSport) params.set("sportId", filterSport);

  const { data, isLoading: loading, error, refetch } = useApi<PaginatedResponse<Match>>(`/v1/sports?${params}`);
  const { data: sportsData } = useApi<{ data: Sport[] }>("/v1/sports/sports?limit=200");
  const { data: tournamentsData } = useApi<{ data: Tournament[] }>(`/v1/sports/tournaments?limit=200${filterSport ? `&sportId=${filterSport}` : ""}`);
  const { data: teamsData } = useApi<{ data: Team[] }>(`/v1/sports/teams?limit=200${filterSport ? `&sportId=${filterSport}` : ""}`);
  const { data: channelsData } = useApi<{ data: { id: string; name: string; primaryStreamUrl?: string; streamUrl?: string }[] }>("/v1/channels?limit=500&isActive=true");
  const { call, loading: actionLoading } = useApiCallState();

  const channels = channelsData?.data ?? [];
  const matches = data?.data ?? [];
  const sports = sportsData?.data ?? [];
  const tournaments = tournamentsData?.data ?? [];
  const teams = teamsData?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const liveCount = matches.filter(m => m.status === "live").length;
  const upcomingCount = matches.filter(m => m.status === "upcoming").length;
  const completedCount = matches.filter(m => m.status === "completed").length;

  const openEdit = (m: Match) => { setEditForm(matchToForm(m)); setEditItem(m); };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    try { await call("delete", `/v1/sports/${id}`); refetch(); }
    catch (e: any) { alert(e?.response?.data?.message ?? e?.message ?? "Failed to delete match"); }
  };

  const buildPayload = (f: MatchForm) => {
    const validUrls = f.streamUrls.filter(u => (u.url ?? "").trim());
    return {
      title: f.title,
      sportId: f.sportId || undefined,
      tournamentId: f.tournamentId || undefined,
      teamAId: f.teamAId || undefined,
      teamBId: f.teamBId || undefined,
      scheduledAt: f.scheduledAt || undefined,
      venue: f.venue || undefined,
      streamUrl: validUrls[0]?.url || undefined,
      liveUrl: validUrls[0]?.url || undefined,
      streamUrls: validUrls.length > 0 ? validUrls : undefined,
      description: f.description || undefined,
      status: f.status,
      isActive: f.isActive,
    };
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setMutationError("Title is required"); return; }
    if (!form.sportId) { setMutationError("Sport is required"); return; }
    if (!form.teamAId || !form.teamBId) { setMutationError("Both teams are required"); return; }
    if (form.teamAId === form.teamBId) { setMutationError("Team A and Team B must be different"); return; }
    setSubmitting(true); setMutationError(null);
    try {
      await call("post", "/v1/sports", buildPayload(form));
      setShowModal(false); setForm(blankMatchForm()); refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save";
      setMutationError(typeof msg === "string" ? msg : Array.isArray(msg) ? msg.join(", ") : "Failed to save match");
    } finally { setSubmitting(false); }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    if (!editForm.title.trim()) { alert("Title is required"); return; }
    setSubmitting(true);
    try {
      await call("put", `/v1/sports/${editItem.id}`, buildPayload(editForm));
      setEditItem(null); refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update";
      alert(typeof msg === "string" ? msg : Array.isArray(msg) ? msg.join(", ") : "Failed to update match");
    } finally { setSubmitting(false); }
  };

  const handleQuickStatus = async (id: string, status: string) => {
    try { await call("put", `/v1/sports/${id}`, { status }); refetch(); }
    catch { alert("Failed to update status"); }
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total Matches", value: total, cls: "text-white" },
          { label: "Live Now", value: liveCount, cls: "text-red-400" },
          { label: "Upcoming", value: upcomingCount, cls: "text-blue-400" },
          { label: "Completed", value: completedCount, cls: "text-green-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-[#8B92A5] mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.cls)}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters + Actions */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
          <Search size={14} className="text-[#8B92A5] shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search matches…"
            className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1" />
        </div>
        {[
          { value: filterSport, onChange: (v: string) => { setFilterSport(v); setPage(1); }, placeholder: "All Sports", options: sports.map(s => ({ value: s.id, label: s.name })), min: "140px" },
          { value: filterStatus, onChange: (v: string) => { setFilterStatus(v); setPage(1); }, placeholder: "All Statuses", options: ["live","upcoming","completed","postponed","cancelled"].map(s => ({ value: s, label: s.charAt(0).toUpperCase()+s.slice(1) })), min: "140px" },
          { value: filterTournament, onChange: (v: string) => { setFilterTournament(v); setPage(1); }, placeholder: "All Tournaments", options: tournaments.map(t => ({ value: t.id, label: t.name })), min: "160px" },
        ].map((sel, i) => (
          <div key={i} className="relative">
            <select value={sel.value} onChange={e => sel.onChange(e.target.value)}
              className={`bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[${sel.min}]`}>
              <option value="">{sel.placeholder}</option>
              {sel.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
          </div>
        ))}
        <button onClick={() => refetch()} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button onClick={() => { setForm(blankMatchForm()); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90">
          <Plus size={13} /> Add Match
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load matches</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    {["#","Title / Sport","Teams","Tournament","Scheduled At","Status","Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No matches found</td></tr>
                  ) : matches.map((m, i) => (
                    <tr key={m.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page-1)*20+i+1}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-white">{m.title||"—"}</p>
                        <p className="text-xs text-[#8B92A5]">{m.sport?.name??"—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-white">
                          <span className="font-medium">{m.teamA?.name??"TBA"}</span>
                          <span className="text-[#8B92A5] text-xs">vs</span>
                          <span className="font-medium">{m.teamB?.name??"TBA"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{m.tournament?.name??"—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{m.scheduledAt?new Date(m.scheduledAt).toLocaleString():"—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize", STATUS_COLORS[m.status??""]??"bg-gray-500/15 text-gray-400")}>
                          {m.status??"unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {m.status!=="live"?(
                            <button onClick={()=>handleQuickStatus(m.id,"live")} disabled={actionLoading}
                              className="h-7 px-2 rounded-md flex items-center gap-1 text-[10px] font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-40">🔴 Live</button>
                          ):(
                            <button onClick={()=>handleQuickStatus(m.id,"completed")} disabled={actionLoading}
                              className="h-7 px-2 rounded-md flex items-center gap-1 text-[10px] font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-40">✓ End</button>
                          )}
                          <button onClick={()=>openEdit(m)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button onClick={()=>handleDelete(m.id)} disabled={actionLoading} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} count={matches.length} setPage={setPage} />
          </>
        )}
      </div>

      {/* Add Match Modal */}
      {showModal && (
        <Modal title="Add Match" onClose={() => { setShowModal(false); setMutationError(null); }}>
          <ModalField label="Title *">
            <input value={form.title} onChange={e=>pf("title",e.target.value)} className={inputClass} placeholder="Match title" />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Sport *">
              <div className="relative">
                <select value={form.sportId} onChange={e=>pf("sportId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select sport</option>
                  {sports.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
            <ModalField label="Tournament">
              <div className="relative">
                <select value={form.tournamentId} onChange={e=>pf("tournamentId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select tournament</option>
                  {tournaments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Team A *">
              <div className="relative">
                <select value={form.teamAId} onChange={e=>pf("teamAId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select team</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
            <ModalField label="Team B *">
              <div className="relative">
                <select value={form.teamBId} onChange={e=>pf("teamBId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select team</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Scheduled At">
              <input type="datetime-local" value={form.scheduledAt} onChange={e=>pf("scheduledAt",e.target.value)} className={inputClass}/>
            </ModalField>
            <ModalField label="Status">
              <div className="relative">
                <select value={form.status} onChange={e=>pf("status",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">🔴 Live Now</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <ModalField label="Venue">
            <input value={form.venue} onChange={e=>pf("venue",e.target.value)} className={inputClass} placeholder="Stadium / venue name"/>
          </ModalField>
          <ModalField label="Search Channel → adds stream URL">
            <ChannelSearchPicker channels={channels} onSelect={(url,name)=>{
              const empty=form.streamUrls.findIndex(u=>!(u.url ?? "").trim());
              if(empty>=0){const next=[...form.streamUrls];next[empty]={label:name,url};pf("streamUrls",next);}
              else pf("streamUrls",[...form.streamUrls,{label:name,url}]);
            }}/>
          </ModalField>
          <ModalField label="Stream Servers">
            <StreamUrlsEditor urls={form.streamUrls} onChange={v=>pf("streamUrls",v)}/>
          </ModalField>
          <ModalField label="Description">
            <textarea value={form.description} onChange={e=>pf("description",e.target.value)} rows={2} className={cn(inputClass,"resize-none")} placeholder="Match description"/>
          </ModalField>
          <ModalField label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e=>pf("isActive",e.target.checked)} className="accent-primary w-4 h-4"/>
              <span className="text-sm text-white">Is Active</span>
            </label>
          </ModalField>
          {mutationError && <p className="px-1 pb-1 text-xs text-red-400">{mutationError}</p>}
          <ModalFooter cancelLabel="Cancel" submitLabel={submitting?"Saving…":"Save Match"}
            submitting={submitting} onCancel={()=>{setShowModal(false);setMutationError(null);}} onSubmit={handleSave}/>
        </Modal>
      )}

      {/* Edit Match Modal */}
      {editItem && (
        <Modal title="Edit Match" onClose={()=>setEditItem(null)}>
          <ModalField label="Title *">
            <input value={editForm.title} onChange={e=>pe("title",e.target.value)} className={inputClass}/>
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Sport">
              <div className="relative">
                <select value={editForm.sportId} onChange={e=>pe("sportId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select sport</option>
                  {sports.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
            <ModalField label="Tournament">
              <div className="relative">
                <select value={editForm.tournamentId} onChange={e=>pe("tournamentId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select tournament</option>
                  {tournaments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Team A">
              <div className="relative">
                <select value={editForm.teamAId} onChange={e=>pe("teamAId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select team</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
            <ModalField label="Team B">
              <div className="relative">
                <select value={editForm.teamBId} onChange={e=>pe("teamBId",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="">Select team</option>
                  {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Scheduled At">
              <input type="datetime-local" value={editForm.scheduledAt} onChange={e=>pe("scheduledAt",e.target.value)} className={inputClass}/>
            </ModalField>
            <ModalField label="Status">
              <div className="relative">
                <select value={editForm.status} onChange={e=>pe("status",e.target.value)} className={cn(inputClass,"appearance-none cursor-pointer")}>
                  <option value="upcoming">Upcoming</option>
                  <option value="live">🔴 Live Now</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"/>
              </div>
            </ModalField>
          </div>
          <ModalField label="Venue">
            <input value={editForm.venue} onChange={e=>pe("venue",e.target.value)} className={inputClass}/>
          </ModalField>
          <ModalField label="Search Channel → adds stream URL">
            <ChannelSearchPicker channels={channels} onSelect={(url,name)=>{
              const empty=editForm.streamUrls.findIndex(u=>!(u.url ?? "").trim());
              if(empty>=0){const next=[...editForm.streamUrls];next[empty]={label:name,url};pe("streamUrls",next);}
              else pe("streamUrls",[...editForm.streamUrls,{label:name,url}]);
            }}/>
          </ModalField>
          <ModalField label="Stream Servers">
            <StreamUrlsEditor urls={editForm.streamUrls} onChange={v=>pe("streamUrls",v)}/>
          </ModalField>
          <ModalField label="Description">
            <textarea value={editForm.description} onChange={e=>pe("description",e.target.value)} rows={2} className={cn(inputClass,"resize-none")}/>
          </ModalField>
          <ModalField label="Active">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.isActive} onChange={e=>pe("isActive",e.target.checked)} className="accent-primary w-4 h-4"/>
              <span className="text-sm text-white">Is Active</span>
            </label>
          </ModalField>
          <ModalFooter cancelLabel="Cancel" submitLabel={submitting?"Saving…":"Update Match"}
            submitting={submitting} onCancel={()=>setEditItem(null)} onSubmit={handleUpdate}/>
        </Modal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TEAMS TAB
   ═══════════════════════════════════════════════════════════════════════════════ */

function TeamsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterSport, setFilterSport] = useState("");
  const [filterTournament, setFilterTournament] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const shortNameRef = useRef<HTMLInputElement>(null);
  const abbrRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const primaryColorRef = useRef<HTMLInputElement>(null);
  const secondaryColorRef = useRef<HTMLInputElement>(null);
  const tournamentIdRef = useRef<HTMLSelectElement>(null);

  const editNameRef = useRef<HTMLInputElement>(null);
  const editSlugRef = useRef<HTMLInputElement>(null);
  const editShortNameRef = useRef<HTMLInputElement>(null);
  const editAbbrRef = useRef<HTMLInputElement>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);
  const editCountryRef = useRef<HTMLInputElement>(null);
  const editPrimaryColorRef = useRef<HTMLInputElement>(null);
  const editSecondaryColorRef = useRef<HTMLInputElement>(null);
  const editTournamentIdRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filterSport) params.set("sportId", filterSport);
  if (filterTournament) params.set("tournamentId", filterTournament);

  const { data, isLoading: loading, error, refetch } = useApi<PaginatedResponse<Team>>(`/v1/sports/teams?${params}`);
  const { data: sportsData } = useApi<{ data: Sport[] }>("/v1/sports/sports?limit=200");
  const { data: tournamentsData } = useApi<{ data: Tournament[] }>("/v1/sports/tournaments?limit=200");
  const { call, loading: actionLoading } = useApiCallState();

  const teamsList = data?.data ?? [];
  const sports = sportsData?.data ?? [];
  const tournaments = tournamentsData?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    try {
      await call("delete", `/v1/sports/teams/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete team";
      alert(typeof msg === "string" ? msg : "Failed to delete team");
    }
  };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    if (!name) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      const slug = slugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("post", "/v1/sports/teams", {
        name,
        slug,
        shortName: shortNameRef.current?.value?.trim() || undefined,
        abbr: abbrRef.current?.value?.trim() || undefined,
        logo: logoRef.current?.value?.trim() || undefined,
        country: countryRef.current?.value?.trim() || undefined,
        primaryColor: primaryColorRef.current?.value || undefined,
        secondaryColor: secondaryColorRef.current?.value || undefined,
        tournamentId: tournamentIdRef.current?.value || undefined,
      });
      setShowModal(false);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save team";
      setMutationError(typeof msg === "string" ? msg : "Failed to save team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const slug = editSlugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("put", `/v1/sports/teams/${editItem.id}`, {
        name,
        slug,
        shortName: editShortNameRef.current?.value?.trim() || undefined,
        abbr: editAbbrRef.current?.value?.trim() || undefined,
        logo: editLogoRef.current?.value?.trim() || undefined,
        country: editCountryRef.current?.value?.trim() || undefined,
        primaryColor: editPrimaryColorRef.current?.value || undefined,
        secondaryColor: editSecondaryColorRef.current?.value || undefined,
        tournamentId: editTournamentIdRef.current?.value || undefined,
      });
      setEditItem(null);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update team";
      alert(typeof msg === "string" ? msg : "Failed to update team");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 mb-5 max-w-xs">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-[#8B92A5] mb-1">Total Teams</p>
          <p className="text-2xl font-bold text-white">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + Filters + Actions */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
          <Search size={14} className="text-[#8B92A5] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search teams..."
            className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
          />
        </div>
        <div className="relative">
          <select
            value={filterSport}
            onChange={e => { setFilterSport(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="">All Sports</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterTournament}
            onChange={e => { setFilterTournament(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[160px]"
          >
            <option value="">All Tournaments</option>
            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90"
        >
          <Plus size={13} /> Add Team
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load teams</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Abbr</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Country</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Tournament</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Logo</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamsList.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-sm text-[#8B92A5]">No teams found</td></tr>
                  ) : teamsList.map((tm, i) => (
                    <tr key={tm.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{tm.name}</span>
                          {tm.shortName && (
                            <span className="text-[10px] text-[#8B92A5] bg-white/5 px-1.5 py-0.5 rounded">{tm.shortName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{tm.abbr ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{tm.country ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{tm.tournament?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {tm.logo ? (
                          <img src={tm.logo} alt={tm.name} className="w-8 h-8 rounded-lg object-contain bg-black/20 border border-border/50" />
                        ) : (
                          <span className="text-xs text-[#8B92A5]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditItem(tm)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button onClick={() => handleDelete(tm.id)} disabled={actionLoading} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} count={teamsList.length} setPage={setPage} />
          </>
        )}
      </div>

      {/* Add Team Modal */}
      {showModal && (
        <Modal title="Add Team" onClose={() => { setShowModal(false); setMutationError(null); }}>
          <ModalField label="Name *">
            <input ref={nameRef} className={inputClass} placeholder="Team name" />
          </ModalField>
          <ModalField label="Slug">
            <input ref={slugRef} className={inputClass} placeholder="auto-generated-from-name" />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Short Name">
              <input ref={shortNameRef} className={inputClass} placeholder="e.g. Man Utd" />
            </ModalField>
            <ModalField label="Abbreviation">
              <input ref={abbrRef} className={inputClass} placeholder="e.g. MNU" />
            </ModalField>
          </div>
          <ModalField label="Logo URL">
            <input ref={logoRef} className={inputClass} placeholder="https://example.com/logo.png" />
          </ModalField>
          <ModalField label="Country">
            <input ref={countryRef} className={inputClass} placeholder="Country name" />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Primary Color">
              <input ref={primaryColorRef} type="color" className="w-full h-10 rounded-lg bg-background border border-border cursor-pointer" />
            </ModalField>
            <ModalField label="Secondary Color">
              <input ref={secondaryColorRef} type="color" className="w-full h-10 rounded-lg bg-background border border-border cursor-pointer" />
            </ModalField>
          </div>
          <ModalField label="Tournament">
            <div className="relative">
              <select ref={tournamentIdRef} className={cn(inputClass, "appearance-none cursor-pointer")}>
                <option value="">Select tournament</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
            </div>
          </ModalField>
          {mutationError && <p className="px-1 pb-1 text-xs text-red-400">{mutationError}</p>}
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Save Team"}
            submitting={submitting}
            onCancel={() => { setShowModal(false); setMutationError(null); }}
            onSubmit={handleSave}
          />
        </Modal>
      )}

      {/* Edit Team Modal */}
      {editItem && (
        <Modal title="Edit Team" onClose={() => setEditItem(null)}>
          <ModalField label="Name *">
            <input ref={editNameRef} defaultValue={editItem.name} className={inputClass} />
          </ModalField>
          <ModalField label="Slug">
            <input ref={editSlugRef} defaultValue="" className={inputClass} placeholder="auto-generated-from-name" />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Short Name">
              <input ref={editShortNameRef} defaultValue={editItem.shortName ?? ""} className={inputClass} />
            </ModalField>
            <ModalField label="Abbreviation">
              <input ref={editAbbrRef} defaultValue={editItem.abbr ?? ""} className={inputClass} />
            </ModalField>
          </div>
          <ModalField label="Logo URL">
            <input ref={editLogoRef} defaultValue={editItem.logo ?? ""} className={inputClass} />
          </ModalField>
          <ModalField label="Country">
            <input ref={editCountryRef} defaultValue={editItem.country ?? ""} className={inputClass} />
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Primary Color">
              <input ref={editPrimaryColorRef} type="color" defaultValue="#6366f1" className="w-full h-10 rounded-lg bg-background border border-border cursor-pointer" />
            </ModalField>
            <ModalField label="Secondary Color">
              <input ref={editSecondaryColorRef} type="color" defaultValue="#3b82f6" className="w-full h-10 rounded-lg bg-background border border-border cursor-pointer" />
            </ModalField>
          </div>
          <ModalField label="Tournament">
            <div className="relative">
              <select ref={editTournamentIdRef} defaultValue={editItem.tournamentId ?? ""} className={cn(inputClass, "appearance-none cursor-pointer")}>
                <option value="">Select tournament</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
            </div>
          </ModalField>
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Update Team"}
            submitting={submitting}
            onCancel={() => setEditItem(null)}
            onSubmit={handleUpdate}
          />
        </Modal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   TOURNAMENTS TAB
   ═══════════════════════════════════════════════════════════════════════════════ */

function TournamentsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterSport, setFilterSport] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Tournament | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);
  const sportIdRef = useRef<HTMLSelectElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  const editNameRef = useRef<HTMLInputElement>(null);
  const editSlugRef = useRef<HTMLInputElement>(null);
  const editDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const editLogoRef = useRef<HTMLInputElement>(null);
  const editBannerRef = useRef<HTMLInputElement>(null);
  const editCountryRef = useRef<HTMLInputElement>(null);
  const editSportIdRef = useRef<HTMLSelectElement>(null);
  const editStartDateRef = useRef<HTMLInputElement>(null);
  const editEndDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (filterSport) params.set("sportId", filterSport);

  const { data, isLoading: loading, error, refetch } = useApi<PaginatedResponse<Tournament>>(`/v1/sports/tournaments?${params}`);
  const { data: sportsData } = useApi<{ data: Sport[] }>("/v1/sports/sports?limit=200");
  const { call, loading: actionLoading } = useApiCallState();

  const tournamentsList = data?.data ?? [];
  const sports = sportsData?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pages = meta?.totalPages ?? 1;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this tournament?")) return;
    try {
      await call("delete", `/v1/sports/tournaments/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete tournament";
      alert(typeof msg === "string" ? msg : "Failed to delete tournament");
    }
  };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    if (!name) return;
    setSubmitting(true);
    setMutationError(null);
    try {
      const slug = slugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("post", "/v1/sports/tournaments", {
        name,
        slug,
        description: descriptionRef.current?.value?.trim() || undefined,
        logo: logoRef.current?.value?.trim() || undefined,
        banner: bannerRef.current?.value?.trim() || undefined,
        country: countryRef.current?.value?.trim() || undefined,
        sportId: sportIdRef.current?.value || undefined,
        startDate: startDateRef.current?.value || undefined,
        endDate: endDateRef.current?.value || undefined,
      });
      setShowModal(false);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save tournament";
      setMutationError(typeof msg === "string" ? msg : "Failed to save tournament");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    if (!name) return;
    setSubmitting(true);
    try {
      const slug = editSlugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await call("put", `/v1/sports/tournaments/${editItem.id}`, {
        name,
        slug,
        description: editDescriptionRef.current?.value?.trim() || undefined,
        logo: editLogoRef.current?.value?.trim() || undefined,
        banner: editBannerRef.current?.value?.trim() || undefined,
        country: editCountryRef.current?.value?.trim() || undefined,
        sportId: editSportIdRef.current?.value || undefined,
        startDate: editStartDateRef.current?.value || undefined,
        endDate: editEndDateRef.current?.value || undefined,
      });
      setEditItem(null);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update tournament";
      alert(typeof msg === "string" ? msg : "Failed to update tournament");
    } finally {
      setSubmitting(false);
    }
  };

  const toLocalDate = (iso?: string) => {
    if (!iso) return "";
    return iso.slice(0, 10);
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 mb-5 max-w-xs">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-[#8B92A5] mb-1">Total Tournaments</p>
          <p className="text-2xl font-bold text-white">{total.toLocaleString()}</p>
        </div>
      </div>

      {/* Search + Filters + Actions */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
          <Search size={14} className="text-[#8B92A5] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tournaments..."
            className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
          />
        </div>
        <div className="relative">
          <select
            value={filterSport}
            onChange={e => { setFilterSport(e.target.value); setPage(1); }}
            className="bg-card border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-white outline-none appearance-none cursor-pointer min-w-[140px]"
          >
            <option value="">All Sports</option>
            {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90"
        >
          <Plus size={13} /> Add Tournament
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load tournaments</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[#0d1525]">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Sport</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Country</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Start Date</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">End Date</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Active</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tournamentsList.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-sm text-[#8B92A5]">No tournaments found</td></tr>
                  ) : tournamentsList.map((t, i) => (
                    <tr key={t.id} className="tbl-row border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{(page - 1) * 20 + i + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-white">{t.name}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">
                        {sports.find(s => s.id === t.sportId)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{t.country ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{t.startDate ? new Date(t.startDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-sm text-[#8B92A5]">{t.endDate ? new Date(t.endDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-medium",
                          t.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                        )}>
                          {t.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditItem(t)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                            <Edit size={13} className="text-[#8B92A5]" />
                          </button>
                          <button onClick={() => handleDelete(t.id)} disabled={actionLoading} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} count={tournamentsList.length} setPage={setPage} />
          </>
        )}
      </div>

      {/* Add Tournament Modal */}
      {showModal && (
        <Modal title="Add Tournament" onClose={() => { setShowModal(false); setMutationError(null); }}>
          <ModalField label="Name *">
            <input ref={nameRef} className={inputClass} placeholder="Tournament name" />
          </ModalField>
          <ModalField label="Slug">
            <input ref={slugRef} className={inputClass} placeholder="auto-generated-from-name" />
          </ModalField>
          <ModalField label="Description">
            <textarea ref={descriptionRef} rows={3} className={cn(inputClass, "resize-none")} placeholder="Tournament description" />
          </ModalField>
          <ModalField label="Logo URL">
            <input ref={logoRef} className={inputClass} placeholder="https://example.com/logo.png" />
          </ModalField>
          <ModalField label="Banner URL">
            <input ref={bannerRef} className={inputClass} placeholder="https://example.com/banner.png" />
          </ModalField>
          <ModalField label="Country">
            <input ref={countryRef} className={inputClass} placeholder="Country" />
          </ModalField>
          <ModalField label="Sport">
            <div className="relative">
              <select ref={sportIdRef} className={cn(inputClass, "appearance-none cursor-pointer")}>
                <option value="">Select sport</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
            </div>
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Start Date">
              <input ref={startDateRef} type="date" className={inputClass} />
            </ModalField>
            <ModalField label="End Date">
              <input ref={endDateRef} type="date" className={inputClass} />
            </ModalField>
          </div>
          {mutationError && <p className="px-1 pb-1 text-xs text-red-400">{mutationError}</p>}
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Save Tournament"}
            submitting={submitting}
            onCancel={() => { setShowModal(false); setMutationError(null); }}
            onSubmit={handleSave}
          />
        </Modal>
      )}

      {/* Edit Tournament Modal */}
      {editItem && (
        <Modal title="Edit Tournament" onClose={() => setEditItem(null)}>
          <ModalField label="Name *">
            <input ref={editNameRef} defaultValue={editItem.name} className={inputClass} />
          </ModalField>
          <ModalField label="Slug">
            <input ref={editSlugRef} defaultValue="" className={inputClass} placeholder="auto-generated-from-name" />
          </ModalField>
          <ModalField label="Description">
            <textarea ref={editDescriptionRef} rows={3} className={cn(inputClass, "resize-none")} defaultValue="" />
          </ModalField>
          <ModalField label="Logo URL">
            <input ref={editLogoRef} defaultValue="" className={inputClass} />
          </ModalField>
          <ModalField label="Banner URL">
            <input ref={editBannerRef} defaultValue="" className={inputClass} />
          </ModalField>
          <ModalField label="Country">
            <input ref={editCountryRef} defaultValue={editItem.country ?? ""} className={inputClass} />
          </ModalField>
          <ModalField label="Sport">
            <div className="relative">
              <select ref={editSportIdRef} defaultValue={editItem.sportId ?? ""} className={cn(inputClass, "appearance-none cursor-pointer")}>
                <option value="">Select sport</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
            </div>
          </ModalField>
          <div className="grid grid-cols-2 gap-4">
            <ModalField label="Start Date">
              <input ref={editStartDateRef} type="date" defaultValue={toLocalDate(editItem.startDate)} className={inputClass} />
            </ModalField>
            <ModalField label="End Date">
              <input ref={editEndDateRef} type="date" defaultValue={toLocalDate(editItem.endDate)} className={inputClass} />
            </ModalField>
          </div>
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Update Tournament"}
            submitting={submitting}
            onCancel={() => setEditItem(null)}
            onSubmit={handleUpdate}
          />
        </Modal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SPORT TYPES TAB
   ═══════════════════════════════════════════════════════════════════════════════ */

function SportTypesTab() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Sport | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);
  const editSlugRef = useRef<HTMLInputElement>(null);
  const editIconRef = useRef<HTMLInputElement>(null);

  const { data, isLoading: loading, error, refetch } = useApi<{ data: Sport[] }>(
    `/v1/sports/sports?limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}`
  );
  const { call, loading: actionLoading } = useApiCallState();

  const sports = data?.data ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this sport type? All related data (matches, tournaments, teams) may be affected.")) return;
    try {
      await call("delete", `/v1/sports/sports/${id}`);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete sport";
      alert(typeof msg === "string" ? msg : "Failed to delete sport");
    }
  };

  const handleSave = async () => {
    const name = nameRef.current?.value?.trim();
    if (!name) { setMutationError("Name is required"); return; }
    setSubmitting(true);
    setMutationError(null);
    try {
      const slug = slugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      await call("post", "/v1/sports/sports", {
        name,
        slug,
        icon: iconRef.current?.value?.trim() || undefined,
      });
      setShowModal(false);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to save sport";
      setMutationError(typeof msg === "string" ? msg : "Failed to save sport");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    const name = editNameRef.current?.value?.trim();
    if (!name) { alert("Name is required"); return; }
    setSubmitting(true);
    try {
      const slug = editSlugRef.current?.value?.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      await call("put", `/v1/sports/sports/${editItem.id}`, {
        name,
        slug,
        icon: editIconRef.current?.value?.trim() || undefined,
      });
      setEditItem(null);
      refetch();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to update sport";
      alert(typeof msg === "string" ? msg : "Failed to update sport");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 mb-5 max-w-xs">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-[#8B92A5] mb-1">Total Sport Types</p>
          <p className="text-2xl font-bold text-white">{sports.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
          <Search size={14} className="text-[#8B92A5] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sport types..."
            className="bg-transparent text-sm text-white placeholder:text-[#8B92A5] outline-none flex-1"
          />
        </div>
        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-xs text-[#8B92A5] hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90"
        >
          <Plus size={13} /> Add Sport Type
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="text-primary animate-spin" /></div>}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-red-400 text-sm">Failed to load sport types</p>
            <button onClick={() => refetch()} className="text-xs text-primary underline">Retry</button>
          </div>
        )}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-[#0d1525]">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide w-10">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Slug</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Icon</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8B92A5] uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sports.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-sm text-[#8B92A5]">No sport types yet — add one above</td></tr>
                ) : sports.map((s, i) => (
                  <tr key={s.id} className="tbl-row border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 text-sm text-[#8B92A5]">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-[#8B92A5] font-mono">{(s as any).slug ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-[#8B92A5]">{(s as any).icon ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditItem(s)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/10">
                          <Edit size={13} className="text-[#8B92A5]" />
                        </button>
                        <button onClick={() => handleDelete(s.id)} disabled={actionLoading} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10">
                          <Trash2 size={13} className="text-red-400" />
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

      {showModal && (
        <Modal title="Add Sport Type" onClose={() => { setShowModal(false); setMutationError(null); }}>
          <ModalField label="Name *">
            <input ref={nameRef} className={inputClass} placeholder="e.g. Cricket, Football, Tennis" />
          </ModalField>
          <ModalField label="Slug (auto-generated if empty)">
            <input ref={slugRef} className={inputClass} placeholder="e.g. cricket" />
          </ModalField>
          <ModalField label="Icon (emoji or icon name)">
            <input ref={iconRef} className={inputClass} placeholder="e.g. 🏏 or cricket" />
          </ModalField>
          {mutationError && <p className="px-1 pb-1 text-xs text-red-400">{mutationError}</p>}
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Save Sport Type"}
            submitting={submitting}
            onCancel={() => { setShowModal(false); setMutationError(null); }}
            onSubmit={handleSave}
          />
        </Modal>
      )}

      {editItem && (
        <Modal title="Edit Sport Type" onClose={() => setEditItem(null)}>
          <ModalField label="Name *">
            <input ref={editNameRef} defaultValue={editItem.name} className={inputClass} />
          </ModalField>
          <ModalField label="Slug">
            <input ref={editSlugRef} defaultValue={(editItem as any).slug ?? ""} className={inputClass} />
          </ModalField>
          <ModalField label="Icon (emoji or icon name)">
            <input ref={editIconRef} defaultValue={(editItem as any).icon ?? ""} className={inputClass} />
          </ModalField>
          <ModalFooter
            cancelLabel="Cancel"
            submitLabel={submitting ? "Saving..." : "Update Sport Type"}
            submitting={submitting}
            onCancel={() => setEditItem(null)}
            onSubmit={handleUpdate}
          />
        </Modal>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary placeholder:text-[#8B92A5]";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10 rounded-t-2xl">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#8B92A5] hover:text-white text-lg leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#8B92A5] mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function ModalFooter({
  cancelLabel,
  submitLabel,
  submitting,
  onCancel,
  onSubmit,
}: {
  cancelLabel: string;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:bg-white/5">
        {cancelLabel}
      </button>
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="flex-1 py-2.5 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function Pagination({
  page,
  pages,
  total,
  count,
  setPage,
}: {
  page: number;
  pages: number;
  total: number;
  count: number;
  setPage: (p: (prev: number) => number) => void;
}) {
  const getPageNumbers = (current: number, totalPages: number) => {
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <span className="text-xs text-[#8B92A5]">Showing {count} of {total.toLocaleString()}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
        >
          <ChevronLeft size={13} />
        </button>
        {getPageNumbers(page, pages).map(pg => (
          <button
            key={pg}
            onClick={() => setPage(() => pg)}
            className={cn(
              "w-7 h-7 rounded-md text-xs font-medium",
              pg === page ? "bg-primary text-white" : "text-[#8B92A5] hover:bg-white/5"
            )}
          >
            {pg}
          </button>
        ))}
        <button
          onClick={() => setPage(p => Math.min(pages, p + 1))}
          disabled={page >= pages}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/5 text-[#8B92A5] disabled:opacity-40"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}