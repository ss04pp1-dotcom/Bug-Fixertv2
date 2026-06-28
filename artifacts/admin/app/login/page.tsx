"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { apiClient, extractData, getApiErrorMessage } from "@/lib/axios-client";
import { setToken } from "@/lib/auth";

interface LoginPayload {
  accessToken:  string;
  refreshToken?: string; // ignored on client — see D-002 fix in lib/auth.ts
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res     = await apiClient.post("/v1/auth/login", { identifier: email, password });
      const payload = extractData<LoginPayload>(res);
      const token   = payload?.accessToken;
      if (!token) throw new Error("No token received");
      setToken(token);
      // Refresh token intentionally not stored — see D-002 fix in lib/auth.ts
      router.push("/");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-black text-xl">S</span>
          </div>
          <h1 className="text-xl font-bold text-white">StreamPro Admin</h1>
          <p className="text-sm text-[#8B92A5] mt-1">Sign in to your admin panel</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@streampro.com" required autoFocus
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-[#8B92A5] outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B92A5]" />
              <input
                type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full bg-background border border-border rounded-lg pl-9 pr-10 py-2.5 text-sm text-white placeholder:text-[#8B92A5] outline-none focus:border-primary"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] hover:text-white">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 mt-2">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-[#8B92A5] mt-4">
          StreamPro Admin Panel · Restricted Access
        </p>
      </div>
    </div>
  );
}
