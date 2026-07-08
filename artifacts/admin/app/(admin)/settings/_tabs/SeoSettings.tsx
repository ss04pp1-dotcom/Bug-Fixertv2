"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Search, BarChart2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";
import { ImageUpload } from "@/components/ui/image-upload";

interface Setting { key: string; value: unknown }
interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function field(raw: Setting[] | undefined, key: string, def = "") {
  return String((raw ?? []).find(x => x.key === key)?.value ?? def);
}
function boolField(raw: Setting[] | undefined, key: string, def = true) {
  const v = (raw ?? []).find(x => x.key === key)?.value;
  if (v === undefined) return def;
  return v === true || v === "true";
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60";

export default function SeoSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();
  const [tab, setTab] = useState<"general" | "social" | "analytics" | "advanced">("general");

  const [form, setForm] = useState({
    seo_website_title:   "SOL TV",
    seo_meta_title:      "SOL TV — Watch TV Anytime",
    seo_meta_description:"Stream live TV, movies, and series anytime, anywhere.",
    seo_meta_keywords:   "streaming,live tv,movies,series",
    seo_canonical_url:   "",
    seo_og_title:        "",
    seo_og_description:  "",
    seo_og_image:        "",
    seo_twitter_title:   "",
    seo_twitter_desc:    "",
    seo_twitter_image:   "",
    seo_twitter_card:    "summary_large_image",
    seo_robots_index:    true,
    seo_robots_follow:   true,
    seo_sitemap_url:     "",
    seo_google_verify:   "",
    ga_id:               "",
    gtm_id:              "",
    fb_pixel_id:         "",
    ms_clarity_id:       "",
    seo_json_ld:         "",
    seo_favicon:         "",
    seo_apple_touch:     "",
  });

  useEffect(() => {
    if (!settingsRaw) return;
    setForm({
      seo_website_title:   field(settingsRaw, "seo_website_title",   "SOL TV"),
      seo_meta_title:      field(settingsRaw, "seo_meta_title",      "SOL TV — Watch TV Anytime"),
      seo_meta_description:field(settingsRaw, "seo_meta_description","Stream live TV, movies, and series anytime, anywhere."),
      seo_meta_keywords:   field(settingsRaw, "seo_meta_keywords",   "streaming,live tv,movies,series"),
      seo_canonical_url:   field(settingsRaw, "seo_canonical_url"),
      seo_og_title:        field(settingsRaw, "seo_og_title"),
      seo_og_description:  field(settingsRaw, "seo_og_description"),
      seo_og_image:        field(settingsRaw, "seo_og_image"),
      seo_twitter_title:   field(settingsRaw, "seo_twitter_title"),
      seo_twitter_desc:    field(settingsRaw, "seo_twitter_desc"),
      seo_twitter_image:   field(settingsRaw, "seo_twitter_image"),
      seo_twitter_card:    field(settingsRaw, "seo_twitter_card",    "summary_large_image"),
      seo_robots_index:    boolField(settingsRaw, "seo_robots_index", true),
      seo_robots_follow:   boolField(settingsRaw, "seo_robots_follow",true),
      seo_sitemap_url:     field(settingsRaw, "seo_sitemap_url"),
      seo_google_verify:   field(settingsRaw, "seo_google_verify"),
      ga_id:               field(settingsRaw, "ga_id"),
      gtm_id:              field(settingsRaw, "gtm_id"),
      fb_pixel_id:         field(settingsRaw, "fb_pixel_id"),
      ms_clarity_id:       field(settingsRaw, "ms_clarity_id"),
      seo_json_ld:         field(settingsRaw, "seo_json_ld"),
      seo_favicon:         field(settingsRaw, "seo_favicon"),
      seo_apple_touch:     field(settingsRaw, "seo_apple_touch"),
    });
  }, [settingsRaw]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setImg = (k: keyof typeof form) => (v: string) => setForm(p => ({ ...p, [k]: v }));
  const setB = (k: keyof typeof form, v: boolean) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    try {
      await call("post", "/v1/settings/bulk", {
        settings: Object.entries(form).map(([key, value]) => ({ key, value, isPublic: true })),
      });
      toast.success("SEO settings saved");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const metaTitle = form.seo_meta_title || form.seo_website_title || "SOL TV";
  const metaDesc  = form.seo_meta_description || "Stream live TV anytime.";

  const TABS = [
    { id: "general"   as const, label: "General" },
    { id: "social"    as const, label: "Social / OG" },
    { id: "analytics" as const, label: "Analytics" },
    { id: "advanced"  as const, label: "Advanced" },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">SEO Settings</h2>
        <p className="text-xs text-[#8B92A5] mt-0.5">Search engine optimization, social sharing, and analytics</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${tab === t.id ? "text-white border-primary" : "text-[#8B92A5] border-transparent hover:text-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Eye size={13} className="text-primary" /><p className="text-xs font-medium text-white">Google Search Preview</p>
            </div>
            <div className="px-4 py-4">
              <p className="text-[#1a0dab] text-sm font-medium truncate">{metaTitle}</p>
              <p className="text-[#006621] text-xs mt-0.5 truncate">{form.seo_canonical_url || "https://soltv.app"}</p>
              <p className="text-[#4d5156] text-xs mt-1 line-clamp-2 leading-relaxed">{metaDesc}</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Search size={11}/>Meta Tags</h3>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Website Title</label>
              <input className={INPUT} value={form.seo_website_title} onChange={set("seo_website_title")} placeholder="SOL TV" />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Meta Title <span className="text-[10px] text-[#8B92A5]/60">(recommended: 50–60 chars)</span></label>
              <input className={INPUT} value={form.seo_meta_title} onChange={set("seo_meta_title")} placeholder="SOL TV — Watch TV Anytime" maxLength={70} />
              <p className="text-[10px] text-[#8B92A5] mt-1">{form.seo_meta_title.length}/70</p>
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Meta Description <span className="text-[10px] text-[#8B92A5]/60">(recommended: 150–160 chars)</span></label>
              <textarea rows={3} className={INPUT + " resize-none"} value={form.seo_meta_description} onChange={set("seo_meta_description")} placeholder="Stream live TV, movies, and series..." maxLength={200} />
              <p className="text-[10px] text-[#8B92A5] mt-1">{form.seo_meta_description.length}/200</p>
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Meta Keywords</label>
              <input className={INPUT} value={form.seo_meta_keywords} onChange={set("seo_meta_keywords")} placeholder="streaming, live tv, movies, series" />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Canonical URL</label>
              <input className={INPUT} value={form.seo_canonical_url} onChange={set("seo_canonical_url")} placeholder="https://soltv.app" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Robots</h3>
            <div className="flex gap-4">
              {[{k:"seo_robots_index",yes:"Index",no:"NoIndex"},{k:"seo_robots_follow",yes:"Follow",no:"NoFollow"}].map(({k,yes,no}) => (
                <div key={k} className="flex-1 flex gap-2">
                  {[{v:true,l:yes},{v:false,l:no}].map(opt => (
                    <button key={String(opt.v)} type="button" onClick={() => setB(k as keyof typeof form, opt.v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${(form[k as keyof typeof form] === true) === opt.v ? "border-primary bg-primary/10 text-primary" : "border-border text-[#8B92A5] hover:border-white/20 hover:text-white"}`}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Sitemap URL</label>
              <input className={INPUT} value={form.seo_sitemap_url} onChange={set("seo_sitemap_url")} placeholder="https://soltv.app/sitemap.xml" />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Google Search Console Verification</label>
              <input className={INPUT} value={form.seo_google_verify} onChange={set("seo_google_verify")} placeholder="google-site-verification=xxx" />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Icons</h3>
            <div className="grid grid-cols-2 gap-4">
              <ImageUpload label="Favicon" value={form.seo_favicon} onChange={setImg("seo_favicon")} uploadPath="/v1/storage/upload?folder=logos" previewClass="h-16 w-full" />
              <ImageUpload label="Apple Touch Icon" value={form.seo_apple_touch} onChange={setImg("seo_apple_touch")} uploadPath="/v1/storage/upload?folder=logos" previewClass="h-16 w-full" />
            </div>
          </div>
        </div>
      )}

      {tab === "social" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Open Graph (Facebook / LinkedIn)</h3>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">OG Title</label>
              <input className={INPUT} value={form.seo_og_title} onChange={set("seo_og_title")} placeholder={form.seo_meta_title || "SOL TV"} />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">OG Description</label>
              <textarea rows={2} className={INPUT + " resize-none"} value={form.seo_og_description} onChange={set("seo_og_description")} placeholder={form.seo_meta_description} />
            </div>
            <ImageUpload label="OG Image (1200×630 recommended)" value={form.seo_og_image} onChange={setImg("seo_og_image")} uploadPath="/v1/storage/upload?folder=banners" previewClass="h-32 w-full" />
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider">Twitter Card</h3>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Card Type</label>
              <div className="flex gap-2">
                {["summary","summary_large_image"].map(v => (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, seo_twitter_card: v }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${form.seo_twitter_card === v ? "border-primary bg-primary/10 text-primary" : "border-border text-[#8B92A5] hover:border-white/20 hover:text-white"}`}>
                    {v === "summary" ? "Summary" : "Summary Large Image"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Twitter Title</label>
              <input className={INPUT} value={form.seo_twitter_title} onChange={set("seo_twitter_title")} placeholder={form.seo_og_title || form.seo_meta_title} />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Twitter Description</label>
              <textarea rows={2} className={INPUT + " resize-none"} value={form.seo_twitter_desc} onChange={set("seo_twitter_desc")} placeholder={form.seo_og_description || form.seo_meta_description} />
            </div>
            <ImageUpload label="Twitter Image" value={form.seo_twitter_image} onChange={setImg("seo_twitter_image")} uploadPath="/v1/storage/upload?folder=banners" previewClass="h-28 w-full" />
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><BarChart2 size={11}/>Tracking IDs</h3>
            {[
              { k: "ga_id",          label: "Google Analytics ID",         placeholder: "G-XXXXXXXXXX" },
              { k: "gtm_id",         label: "Google Tag Manager ID",       placeholder: "GTM-XXXXXXX"  },
              { k: "fb_pixel_id",    label: "Facebook Pixel ID",           placeholder: "123456789012345" },
              { k: "ms_clarity_id",  label: "Microsoft Clarity ID",        placeholder: "xxxxxxxxxx"   },
            ].map(({ k, label, placeholder }) => (
              <div key={k}>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">{label}</label>
                <input className={INPUT + " font-mono"} value={form[k as keyof typeof form] as string} onChange={set(k as keyof typeof form)} placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "advanced" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <label className="text-xs text-[#8B92A5] mb-1.5 block">JSON-LD Structured Data (Schema.org)</label>
            <p className="text-[10px] text-[#8B92A5] mb-3">Paste valid JSON-LD for rich results in Google Search.</p>
            <textarea rows={14} className={INPUT + " font-mono text-xs resize-y"}
              value={form.seo_json_ld}
              onChange={set("seo_json_ld")}
              placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "SOL TV",\n  "url": "https://soltv.app"\n}`}
            />
          </div>
        </div>
      )}

      <button onClick={save} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {loading ? "Saving…" : "Save SEO Settings"}
      </button>
    </div>
  );
}
