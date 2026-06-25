"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { getToken, clearToken } from "@/lib/auth";
import { apiClient } from "@/lib/axios-client";

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
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired(token)) {
      clearToken();
      router.replace("/login");
      return;
    }
    // Verify token is still valid with the server
    apiClient.get("/v1/auth/profile")
      .then(() => setChecked(true))
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
