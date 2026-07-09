"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_CONFIG } from "@/lib/config/api";
import { getToken } from "@/lib/auth";

export interface PresenceEntry {
  socketId:       string;
  userId:         string;
  displayName:    string;
  email:          string;
  avatarUrl?:     string;
  role:           string;
  deviceType:     "android" | "ios" | "web" | "unknown";
  appVersion?:    string;
  platform?:      string;
  ipAddress?:     string;
  connectedAt:    string;
  lastActivityAt: string;
  currentScreen?: string;
  watchingType?:  "live" | "movie" | "series";
  watchingId?:    string;
  watchingTitle?: string;
}

export interface PresenceStats {
  totalOnline:    number;
  watchingLive:   number;
  watchingMovies: number;
  watchingSeries: number;
  totalDevices:   number;
}

interface PresenceUpdate {
  type: "add" | "update" | "remove";
  entry?: PresenceEntry;
  socketId?: string;
}

const DEFAULT_STATS: PresenceStats = {
  totalOnline: 0, watchingLive: 0, watchingMovies: 0,
  watchingSeries: 0, totalDevices: 0,
};

// FIX 9: BASE_URL (https) এর বদলে WEBSOCKET_URL (wss) use করো
// socket.io এর namespace '/ws' server এ defined তাই সেটা append করতে হবে
function getWsUrl(): string {
  const raw = API_CONFIG.WEBSOCKET_URL || API_CONFIG.BASE_URL;
  return raw.replace(/\/+$/, '');
}

export function usePresence() {
  const [users, setUsers]         = useState<PresenceEntry[]>([]);
  const [stats, setStats]         = useState<PresenceStats>(DEFAULT_STATS);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) return;

    const token = getToken();
    if (!token) return;

    const { io } = await import("socket.io-client");

    // D-047 fix: pass `auth` as a FUNCTION so socket.io re-fetches the token
    // on every reconnect. Previously auth was a static object captured at
    // connect time, so a refreshed token (after 401 / re-login) was never
    // picked up and the socket kept failing to authenticate.
    const socket = io(`${getWsUrl()}/ws`, {
      auth:       (cb: (payload: { token: string }) => void) => cb({ token: `Bearer ${getToken()}` }),
      transports: ["websocket", "polling"],
      reconnection:          true,
      // Render's free tier spins down after idle and can take 30-60s to cold-start.
      // A 10-attempt / 2s-delay cap gives up after ~20s — long before the server
      // wakes up — so the admin panel would never receive presence:stats after
      // an idle period. Match the mobile app's unlimited-retry / backoff config.
      reconnectionAttempts: Infinity,
      reconnectionDelay:    2000,
      reconnectionDelayMax: 30_000,
      randomizationFactor:  0.4,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("admin:subscribe");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("presence:snapshot", (all: PresenceEntry[]) => {
      setUsers(all);
    });

    socket.on("presence:stats", (s: PresenceStats) => {
      setStats(s);
    });

    socket.on("presence:update", (update: PresenceUpdate) => {
      setUsers(prev => {
        if (update.type === "add" && update.entry) {
          const exists = prev.find(u => u.socketId === update.entry!.socketId);
          return exists ? prev : [...prev, update.entry!];
        }
        if (update.type === "update" && update.entry) {
          return prev.map(u => u.socketId === update.entry!.socketId ? update.entry! : u);
        }
        if (update.type === "remove" && update.socketId) {
          return prev.filter(u => u.socketId !== update.socketId);
        }
        return prev;
      });
    });
  }, []);

  useEffect(() => {
    void connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  return { users, stats, connected };
}

export function usePresenceStats() {
  const [stats, setStats]         = useState<PresenceStats>(DEFAULT_STATS);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<import("socket.io-client").Socket | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      const token = getToken();
      if (!token) return;

      const { io } = await import("socket.io-client");
      // FIX 9: WEBSOCKET_URL use করো
      // D-047 fix: `auth` as a function so reconnects pick up a refreshed token.
      const socket = io(`${getWsUrl()}/ws`, {
        auth:       (cb: (payload: { token: string }) => void) => cb({ token: `Bearer ${getToken()}` }),
        transports: ["websocket", "polling"],
        reconnection:          true,
        // See connect() above — unlimited retries with backoff to survive Render
        // free-tier cold starts (30-60s) instead of giving up after ~20s.
        reconnectionAttempts:  Infinity,
        reconnectionDelay:     2000,
        reconnectionDelayMax:  30_000,
        randomizationFactor:   0.4,
      });
      if (!mounted) { socket.disconnect(); return; }
      socketRef.current = socket;

      socket.on("connect", () => {
        if (mounted) setConnected(true);
        socket.emit("admin:subscribe");
      });
      socket.on("disconnect", () => { if (mounted) setConnected(false); });
      socket.on("presence:stats", (s: PresenceStats) => { if (mounted) setStats(s); });
    };

    void connect();
    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { stats, connected };
}
