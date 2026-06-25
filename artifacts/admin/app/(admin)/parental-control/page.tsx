"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Save, RefreshCw, Menu, ShieldCheck, Info, ChevronDown } from "lucide-react";
import { useApi, useApiCallState } from "@/lib/use-api";

// ── Types ──────────────────────────────────────────────────────
interface Setting {
  key: string;
  value: unknown;
}

const AGE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17", "Adult"];

const DEFAULT_CATEGORIES = [
  "Horror",
  "Thriller",
  "Action",
  "Comedy",
  "Drama",
  "Romance",
  "Sci-Fi",
  "Documentary",
  "Animation",
  "Crime",
  "War",
  "Adult",
];

// ── Page ───────────────────────────────────────────────────────
export default function ParentalControlPage() {
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const { data: settingsRaw, isLoading, refetch } = useApi<Setting[]>("/v1/settings");
  const { call, loading: mutating } = useApiCallState();

  const settings: Record<string, unknown> = {};
  (settingsRaw ?? []).forEach((s) => {
    settings[s.key] = s.value;
  });

  // ── Local state ──────────────────────────────────────────────
  const [defaultMaxAgeRating, setDefaultMaxAgeRating] = useState("PG-13");
  const [enableByDefault, setEnableByDefault] = useState(false);
  const [requirePinPremium, setRequirePinPremium] = useState(false);
  const [restrictedCategories, setRestrictedCategories] = useState<string[]>([
    "Horror",
    "Adult",
  ]);

  useEffect(() => {
    if (!settingsRaw) return;
    if (settings["parental_default_max_age_rating"])
      setDefaultMaxAgeRating(String(settings["parental_default_max_age_rating"]));
    if (settings["parental_enable_by_default"] !== undefined)
      setEnableByDefault(Boolean(settings["parental_enable_by_default"]));
    if (settings["parental_require_pin_premium"] !== undefined)
      setRequirePinPremium(Boolean(settings["parental_require_pin_premium"]));
    if (settings["parental_restricted_categories"]) {
      try {
        const parsed = JSON.parse(String(settings["parental_restricted_categories"]));
        if (Array.isArray(parsed)) setRestrictedCategories(parsed);
      } catch {
        // comma-separated fallback
        const split = String(settings["parental_restricted_categories"])
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        if (split.length > 0) setRestrictedCategories(split);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRaw]);

  const flash = () => {
    setSaved(true);
    setSaveErr(null);
    setTimeout(() => setSaved(false), 2200);
  };
  const flashErr = (msg: string) => {
    setSaveErr(msg);
    setTimeout(() => setSaveErr(null), 4000);
  };

  const toggleCategory = (cat: string) => {
    setRestrictedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSave = async () => {
    try {
      const pairs: [string, unknown][] = [
        ["parental_default_max_age_rating", defaultMaxAgeRating],
        ["parental_enable_by_default", enableByDefault],
        ["parental_require_pin_premium", requirePinPremium],
        ["parental_restricted_categories", JSON.stringify(restrictedCategories)],
      ];
      const results = await Promise.allSettled(
        pairs.map(([key, value]) => call("put", "/v1/settings", { key, value }))
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        flashErr(`${failed.length} of ${pairs.length} settings failed to save.`);
      } else {
        flash();
      }
      refetch();
    } catch {
      flashErr("Failed to save parental control settings. Check your connection.");
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-[13px] border-b border-border">
        <div className="flex items-center gap-3">
          <Menu size={18} className="text-[#8B92A5] lg:hidden" />
          <ShieldCheck size={16} className="text-primary" />
          <h1 className="text-sm font-bold text-white">Parental Control</h1>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && <RefreshCw size={14} className="text-primary animate-spin" />}
          {saved && <span className="text-xs text-emerald-400 font-medium">Saved ✓</span>}
          {saveErr && <span className="text-xs text-red-400 font-medium">{saveErr}</span>}
        </div>
      </div>

      <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-57px)]">
        {/* ── Info Banner ──────────────────────────────────── */}
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
          <Info size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">System-Wide Defaults</p>
            <p className="text-xs text-[#8B92A5] mt-1 leading-relaxed">
              These settings define the default parental control configuration applied to
              new users. Users can customize their own PIN, age rating, and category
              restrictions from the mobile app under Settings → Parental Control.
            </p>
          </div>
        </div>

        {/* ── Global Settings Card ─────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-white">Global Parental Settings</h2>

          {/* Default Max Age Rating */}
          <div>
            <label className="text-xs text-[#8B92A5] mb-1.5 block">Default Max Age Rating</label>
            <div className="relative">
              <select
                value={defaultMaxAgeRating}
                onChange={(e) => setDefaultMaxAgeRating(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none appearance-none cursor-pointer focus:border-primary"
              >
                {AGE_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none"
              />
            </div>
            <p className="text-[11px] text-[#8B92A5]/60 mt-1">
              Content rated above this level will be blocked by default.
            </p>
          </div>

          {/* Enable by Default */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Enable by Default for New Users
              </div>
              <div className="text-xs text-[#8B92A5] mt-0.5">
                New registrations will have parental control turned on automatically
              </div>
            </div>
            <div
              className={cn(
                "w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors",
                enableByDefault ? "bg-primary" : "bg-white/10"
              )}
              onClick={() => setEnableByDefault((v) => !v)}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white transition-all",
                  enableByDefault ? "ml-auto" : ""
                )}
              />
            </div>
          </div>

          {/* Require PIN for Premium */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Require PIN for Premium Content
              </div>
              <div className="text-xs text-[#8B92A5] mt-0.5">
                Users must enter their PIN to access premium-only content
              </div>
            </div>
            <div
              className={cn(
                "w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors",
                requirePinPremium ? "bg-primary" : "bg-white/10"
              )}
              onClick={() => setRequirePinPremium((v) => !v)}
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-full bg-white transition-all",
                  requirePinPremium ? "ml-auto" : ""
                )}
              />
            </div>
          </div>

          {/* Restricted Categories */}
          <div>
            <label className="text-xs text-[#8B92A5] mb-2 block">
              Default Restricted Categories
            </label>
            <p className="text-[11px] text-[#8B92A5]/60 mb-3">
              Content in these categories will be blocked for users with parental control enabled.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = restrictedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                      isSelected
                        ? "bg-primary/15 border-primary/40 text-white"
                        : "bg-background border-border text-[#8B92A5] hover:border-primary/30 hover:text-white"
                    )}
                  >
                    <div
                      className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-[#8B92A5]/40"
                      )}
                    >
                      {isSelected && (
                        <svg
                          width="8"
                          height="6"
                          viewBox="0 0 8 6"
                          fill="none"
                          className="text-white"
                        >
                          <path
                            d="M1 3L3 5L7 1"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={mutating}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60",
                saved
                  ? "bg-green-600 text-white"
                  : "gradient-primary text-white hover:opacity-90"
              )}
            >
              {mutating ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              {saved ? "Saved!" : mutating ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {/* ── How It Works Card ───────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-white mb-4">How Parental Control Works</h2>
          <div className="space-y-3">
            {[
              {
                step: "1",
                title: "Admin Sets Defaults",
                desc: "Configure the default age rating and restricted categories here. New users inherit these defaults.",
              },
              {
                step: "2",
                title: "User Sets PIN",
                desc: "Users create a 4-digit PIN from the mobile app under Settings → Parental Control.",
              },
              {
                step: "3",
                title: "Content Filtering",
                desc: "The app automatically filters out content based on the user's age rating and restricted categories.",
              },
              {
                step: "4",
                title: "PIN Bypass",
                desc: "When a user tries to access restricted content, they must enter their PIN to proceed.",
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-[#8B92A5] mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}