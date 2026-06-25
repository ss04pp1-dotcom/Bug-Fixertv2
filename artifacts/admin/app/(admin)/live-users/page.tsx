"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Activity, Smartphone, Monitor, Tablet,
  Search, Wifi, WifiOff, Tv, Film, Library,
  Users, Radio,
} from "lucide-react";
import { usePresence, PresenceEntry, PresenceStats } from "@/lib/use-presence";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DeviceIcon({ type }: { type: PresenceEntry["deviceType"] }) {
  if (type === "android" || type === "ios") return <Smartphone size={13} />;
  if (type === "web") return <Monitor size={13} />;
  return <Tablet size={13} />;
}

function WatchingBadge({ entry }: { entry: PresenceEntry }) {
  if (!entry.watchingType) return <span className="text-[#8B92A5] text-[10px]">—</span>;
  const map = {
    live:   { icon: Radio,   color: "text-red-400",    bg: "bg-red-500/10",   label: "Live TV" },
    movie:  { icon: Film,    color: "text-blue-400",   bg: "bg-blue-500/10",  label: "Movie" },
    series: { icon: Library, color: "text-purple-400", bg: "bg-purple-500/10",label: "Series" },
  } as const;
  const { icon: Icon, color, bg, label } = map[entry.watchingType];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", bg, color)}>
      <Icon size={10} />
      {entry.watchingTitle ? entry.watchingTitle.slice(0, 20) : label}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

// ─── Stat mini-card ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: number; icon: React.FC<{size: number; className?: string}>; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <div className="text-xl font-bold text-white leading-tight">{value.toLocaleString()}</div>
        <div className="text-[10px] text-[#8B92A5]">{label}</div>
      </div>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ entry, index }: { entry: PresenceEntry; index: number }) {
  const initials = (entry.displayName || entry.email || "?")
    .split(" ").slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");

  return (
    <tr className={cn(
      "border-b border-border hover:bg-white/[0.02] transition-colors",
      index % 2 === 0 ? "bg-transparent" : "bg-white/[0.01]",
    )}>
      {/* Avatar + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            {entry.avatarUrl
              ? <img src={entry.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              : <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white">
                  {initials || "?"}
                </div>
            }
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border-2 border-card" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-white truncate max-w-[140px]">{entry.displayName || "—"}</div>
            <div className="text-[10px] text-[#8B92A5] truncate max-w-[140px]">{entry.email}</div>
          </div>
        </div>
      </td>

      {/* User ID */}
      <td className="px-4 py-3">
        <code className="text-[10px] text-[#8B92A5] font-mono">{entry.userId.slice(-8).toUpperCase()}</code>
      </td>

      {/* Device */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-[#8B92A5]">
          <DeviceIcon type={entry.deviceType} />
          <span className="text-[10px] capitalize">{entry.deviceType}</span>
        </div>
      </td>

      {/* App Version */}
      <td className="px-4 py-3">
        <span className="text-[10px] text-[#8B92A5]">{entry.appVersion ?? "—"}</span>
      </td>

      {/* Login Time */}
      <td className="px-4 py-3">
        <div className="text-[10px] text-white">{fmtTime(entry.connectedAt)}</div>
        <div className="text-[9px] text-[#8B92A5]">{timeAgo(entry.connectedAt)}</div>
      </td>

      {/* Last Activity */}
      <td className="px-4 py-3">
        <div className="text-[10px] text-white">{fmtTime(entry.lastActivityAt)}</div>
        <div className="text-[9px] text-[#8B92A5]">{timeAgo(entry.lastActivityAt)}</div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Online
        </span>
      </td>

      {/* Screen */}
      <td className="px-4 py-3">
        <span className="text-[10px] text-[#8B92A5]">{entry.currentScreen ?? "—"}</span>
      </td>

      {/* Watching */}
      <td className="px-4 py-3">
        <WatchingBadge entry={entry} />
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveUsersPage() {
  const { users, stats, connected } = usePresence();
  const [query, setQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [watchingFilter, setWatchingFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return users.filter(u => {
      const q = query.toLowerCase();
      const matchesQ = !q
        || u.displayName?.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q)
        || u.userId.toLowerCase().includes(q)
        || u.currentScreen?.toLowerCase().includes(q)
        || u.watchingTitle?.toLowerCase().includes(q);
      const matchesDev = deviceFilter === "all" || u.deviceType === deviceFilter;
      const matchesWatching = watchingFilter === "all"
        || (watchingFilter === "idle" ? !u.watchingType : u.watchingType === watchingFilter);
      return matchesQ && matchesDev && matchesWatching;
    });
  }, [users, query, deviceFilter, watchingFilter]);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Activity size={15} className="text-[#8B92A5]" />
          <h1 className="text-sm font-bold text-white">Live Users</h1>
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
            connected
              ? "bg-green-500/15 text-green-400"
              : "bg-[#8B92A5]/15 text-[#8B92A5]"
          )}>
            {connected
              ? <><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE</>
              : <><WifiOff size={9} /> Connecting…</>
            }
          </span>
        </div>
        <div className="text-xs text-[#8B92A5]">
          {users.length} user{users.length !== 1 ? "s" : ""} online
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <StatCard label="Online Now"       value={stats.totalOnline}    icon={Users}    color="gradient-primary" />
          <StatCard label="Watching Live TV" value={stats.watchingLive}   icon={Radio}    color="gradient-green"   />
          <StatCard label="Watching Movies"  value={stats.watchingMovies} icon={Film}     color="gradient-blue"    />
          <StatCard label="Watching Series"  value={stats.watchingSeries} icon={Library}  color="gradient-pink"    />
          <StatCard label="Total Devices"    value={stats.totalDevices}   icon={Smartphone} color="gradient-orange" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email, screen…"
              className="w-full pl-8 pr-3 py-2 bg-card border border-border rounded-lg text-xs text-white placeholder-[#8B92A5] focus:outline-none focus:border-primary/50"
            />
          </div>
          <select
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs text-white focus:outline-none focus:border-primary/50"
          >
            <option value="all">All Devices</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="web">Web</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            value={watchingFilter}
            onChange={e => setWatchingFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-xs text-white focus:outline-none focus:border-primary/50"
          >
            <option value="all">All Activity</option>
            <option value="live">Watching Live</option>
            <option value="movie">Watching Movie</option>
            <option value="series">Watching Series</option>
            <option value="idle">Idle</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {!connected && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Wifi size={32} className="text-[#8B92A5]/40 animate-pulse" />
              <p className="text-sm text-[#8B92A5]">Connecting to presence server…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} className="text-[#8B92A5]/30" />
              <p className="text-sm text-[#8B92A5]">
                {users.length === 0 ? "No users are currently online" : "No users match your filter"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02]">
                    {["User", "ID", "Device", "Version", "Login Time", "Last Activity", "Status", "Screen", "Watching"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#8B92A5] uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry, i) => (
                    <UserRow key={entry.socketId} entry={entry} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-[#8B92A5]/60 text-center">
          Showing users currently connected via WebSocket. Updates in real-time — no refresh needed.
        </p>
      </div>
    </>
  );
}
