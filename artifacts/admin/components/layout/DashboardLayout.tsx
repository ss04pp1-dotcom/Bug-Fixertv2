"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { getToken, clearToken } from "@/lib/auth";
import { useApiQuery } from "@/lib/use-api";

// D-008 fix: profile fetch goes through React Query so the in-flight request
// is deduped with the one in Sidebar.tsx (same query key).
interface AdminProfile { id: string; identifier: string }

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [checked, setChecked]     = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const router = useRouter();

  const token = typeof window !== "undefined" ? getToken() : null;
  // D-008: shared React Query hook — dedupes the profile fetch with Sidebar
  const { isError } = useApiQuery<AdminProfile>(
    ["/v1/auth/profile"],
    "/v1/auth/profile",
    { enabled: !!token, retry: false },
  );

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired(token)) {
      clearToken();
      router.replace("/login");
      return;
    }
  }, [token, router]);

  // React Query error → token is invalid/expired → bounce to login
  useEffect(() => {
    if (isError) {
      clearToken();
      router.replace("/login");
    }
  }, [isError, router]);

  // D-031 fix: 5s fallback so the spinner can't lock users out forever
  // if the auth/profile call hangs (network blip, dead API, etc).
  useEffect(() => {
    if (checked) return;
    const fallback = setTimeout(() => {
      setChecked(true);
      setTimedOut(true);
    }, 5000);
    return () => clearTimeout(fallback);
  }, [checked]);

  // Mark checked as soon as React Query resolves (success OR error)
  useEffect(() => {
    // isError handled above; on success we just stop spinning
    if (token && !isError) {
      // give React Query one tick to register the success state
      const t = setTimeout(() => setChecked(true), 300);
      return () => clearTimeout(t);
    }
  }, [token, isError]);

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
            We couldn’t verify your session. The API may be unreachable.
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
