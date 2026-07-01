// DEPRECATED: This component is not currently used.
"use client";

import { useState } from "react";
import { Bell, Search, Settings, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TopHeader() {
  const [isDark] = useState(true);

  return (
    <header className="h-14 border-b border-border bg-sidebar/50 backdrop-blur-sm flex items-center gap-3 px-5 shrink-0">
      {/* Search */}
      <div className="flex-1 max-w-xs flex items-center gap-2 bg-background/60 border border-border rounded-lg px-3 py-2">
        <Search size={13} className="text-[#8B92A5] shrink-0" />
        <input
          placeholder="Search..."
          className="bg-transparent text-xs text-white placeholder:text-[#8B92A5] outline-none flex-1"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto">
        {/* Dark mode indicator */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B92A5]">
          {isDark ? <Moon size={15} /> : <Sun size={15} />}
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[#8B92A5] hover:bg-white/5 transition-colors">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
        </button>

        {/* Settings */}
        <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8B92A5] hover:bg-white/5 transition-colors">
          <Settings size={15} />
        </button>

        {/* Admin avatar */}
        <div className="ml-2 flex items-center gap-2 cursor-pointer group">
          <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-bold text-white">
            A
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-white leading-none">Admin</div>
            <div className="text-[10px] text-[#8B92A5] leading-none mt-0.5">Super Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
