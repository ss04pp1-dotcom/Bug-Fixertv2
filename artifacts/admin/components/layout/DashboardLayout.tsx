"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { getToken, clearToken } from "@/lib/auth";
import { useApiQuery } from "@/lib/use-api";
import { API_CONFIG } from "@/lib/config/api";
import { apiClient } from "@/lib/axios-client";

interface AdminProfile { id: string; identifier: string }
interface Setting { key: string; value: unknown }
interface GitHubSource {
  id: string;
  name: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// ── Intervals ─────────────────────────────────────────────────────────────────
const KEEP_ALIVE_MS   = 8 * 60 * 1000;  // ping Render every 8 min
const AUTO_SYNC_MS    = 60 * 1000;       // check overdue sources every 1 min
const SOURCES_POLL_MS = 2 * 60 * 1000;  // re-fetch source list every 2 min

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked]     = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const router = useRouter();

  const keepAliveRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSyncRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourcesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourcesRef    = useRef<GitHubSource[]>([]);
  const syncingRef    = useRef<Set<string>>(new Set());

  const token = typeof window !== "undefined" ? getToken() : null;

  const { isError } = useApiQuery<AdminProfile>(
    ["/v1/auth/profile"],
    "/v1/auth/profile",
    { enabled: !!token, retry: false },
  );

  // Fetch settings once (keep_alive_enabled)
  const { data: settingsData } = useApiQuery<Setting[]>(
    ["settings-keep-alive"],
    "/v1/settings",
    { enabled: !!token && !isError, staleTime: 5 * 60 * 1000, retry: false },
  );

  // ── Keep-alive: admin panel pings Render every 8 min ──────────────────────
  // If keep_alive_enabled = true, the browser sends a GET /healthz to the
  // Render API server. Render counts incoming HTTP requests as activity, so
  // the free-tier server never crosses the 15-min idle threshold.
  useEffect(() => {
    if (!settingsData) return;

    const setting = (settingsData as Setting[]).find(s => s.key === "keep_alive_enabled");
    const enabled = setting ? String(setting.value) !== "false" : true;

    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }

    if (!enabled) return;

    const ping = () => {
      fetch(`${API_CONFIG.BASE_URL}/healthz`, { method: "GET", cache: "no-store" })
        .catch(() => { /* non-fatal */ });
    };

    ping(); // immediate ping on load/setting-change
    keepAliveRef.current = setInterval(ping, KEEP_ALIVE_MS);
    return () => { if (keepAliveRef.current) clearInterval(keepAliveRef.current); };
  }, [settingsData]);

  // ── Load GitHub sources list (background poll) ─────────────────────────────
  const loadSources = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiClient.get<{ data?: GitHubSource[] } | GitHubSource[]>("/v1/github-sources");
      const raw = (res.data as any)?.data ?? res.data;
      if (Array.isArray(raw)) sourcesRef.current = raw;
    } catch { /* non-fatal */ }
  }, [token]);

  // ── Auto-sync: trigger overdue sources from the browser ───────────────────
  // Runs every 60 seconds. For each enabled source whose syncIntervalMinutes
  // has elapsed since lastSyncAt (and is not currently syncing), sends a POST
  // /sync. This happens on ANY admin page — the browser acts as the scheduler.
  const triggerOverdue = useCallback(async () => {
    const now = Date.now();
    for (const src of sourcesRef.current) {
      if (!src.enabled || src.isSyncing || syncingRef.current.has(src.id)) continue;

      const intervalMs = Math.max(1, src.syncIntervalMinutes ?? 10) * 60 * 1000;
      const lastMs     = src.lastSyncAt ? new Date(src.lastSyncAt).getTime() : 0;
      if (now - lastMs < intervalMs) continue;

      syncingRef.current.add(src.id);
      try {
        await apiClient.post(`/v1/github-sources/${src.id}/sync`);
      } catch { /* non-fatal */ } finally {
        // Release lock after max 5 min so it can retry if something went wrong
        setTimeout(() => syncingRef.current.delete(src.id), 5 * 60 * 1000);
      }
    }
  }, []);

  // Wire up the two background intervals once we have a valid token
  useEffect(() => {
    if (!token || isError) return;

    // Initial load
    loadSources();

    // Re-fetch source list every 2 minutes so intervals/lastSyncAt stay fresh
    sourcesPollRef.current = setInterval(loadSources, SOURCES_POLL_MS);

    // Check & trigger overdue sources every 60 seconds
    autoSyncRef.current = setInterval(triggerOverdue, AUTO_SYNC_MS);

    return () => {
      if (sourcesPollRef.current) clearInterval(sourcesPollRef.current);
      if (autoSyncRef.current)    clearInterval(autoSyncRef.current);
    };
  }, [token, isError, loadSources, triggerOverdue]);

  // ── Auth guards ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) { router.replace("/login"); return; }
    if (isTokenExpired(token)) { clearToken(); router.replace("/login"); return; }
  }, [token, router]);

  useEffect(() => {
    if (isError) { clearToken(); router.replace("/login"); }
  }, [isError, router]);

  useEffect(() => {
    if (checked) return;
    const t = setTimeout(() => { setChecked(true); setTimedOut(true); }, 5000);
    return () => clearTimeout(t);
  }, [checked]);

  useEffect(() => {
    if (token && !isError) {
      const t = setTimeout(() => setChecked(true), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [token, isError]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (timedOut) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Connection timed out</h2>
          <p className="text-[#8B92A5] text-sm mb-6">
            We couldn't verify your session. The API may be unreachable.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <main className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        collapsed ? "ml-[60px]" : "ml-56"
      )}>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
