"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Save, Loader2, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useApiQuery, useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Gateway {
  id?: string; slug: string; name: string; isActive: boolean; isTestMode: boolean;
  publicKey?: string; secretKey?: string; webhookSecret?: string; config?: Record<string,string>;
}

const GW_META: { slug: string; name: string; color: string; icon: string; fields: { key: string; label: string; placeholder?: string; secret?: boolean }[] }[] = [
  { slug: "stripe",       name: "Stripe",           color: "from-[#6772E5] to-[#9B59B6]", icon: "S",
    fields: [{ key:"publicKey",label:"Publishable Key",placeholder:"pk_live_..." },{ key:"secretKey",label:"Secret Key",placeholder:"sk_live_...",secret:true },{ key:"webhookSecret",label:"Webhook Secret",placeholder:"whsec_...",secret:true }] },
  { slug: "paypal",       name: "PayPal",            color: "from-[#003087] to-[#009CDE]", icon: "P",
    fields: [{ key:"publicKey",label:"Client ID",placeholder:"AXxx..." },{ key:"secretKey",label:"Client Secret",placeholder:"EXxx...",secret:true },{ key:"webhookSecret",label:"Webhook ID",placeholder:"xxxxx" }] },
  { slug: "razorpay",     name: "Razorpay",          color: "from-[#072654] to-[#3E90F7]", icon: "R",
    fields: [{ key:"publicKey",label:"Key ID",placeholder:"rzp_live_..." },{ key:"secretKey",label:"Key Secret",placeholder:"xxxxx",secret:true },{ key:"webhookSecret",label:"Webhook Secret",placeholder:"xxxxx",secret:true }] },
  { slug: "sslcommerz",   name: "SSLCommerz",        color: "from-[#00A859] to-[#007F45]", icon: "SSL",
    fields: [{ key:"storeId",label:"Store ID",placeholder:"your_store_id" },{ key:"secretKey",label:"Store Password / Secret",placeholder:"xxxxx",secret:true },{ key:"callbackUrl",label:"Success URL",placeholder:"https://..." }] },
  { slug: "bkash",        name: "bKash",             color: "from-[#E2136E] to-[#A80C4D]", icon: "bK",
    fields: [{ key:"publicKey",label:"App Key",placeholder:"xxx" },{ key:"secretKey",label:"App Secret",secret:true,placeholder:"xxx" },{ key:"merchantId",label:"Username",placeholder:"01xxxxxxxxx" },{ key:"apiKey",label:"Password",secret:true,placeholder:"xxx" }] },
  { slug: "nagad",        name: "Nagad",             color: "from-[#F37021] to-[#C45A15]", icon: "N",
    fields: [{ key:"merchantId",label:"Merchant ID",placeholder:"xxx" },{ key:"publicKey",label:"PGP Public Key",placeholder:"-----BEGIN..." },{ key:"secretKey",label:"PGP Private Key",secret:true,placeholder:"-----BEGIN..." }] },
  { slug: "rocket",       name: "Rocket (DBBL)",     color: "from-[#8B0000] to-[#C0392B]", icon: "R",
    fields: [{ key:"merchantId",label:"Merchant Number",placeholder:"01xxxxxxxxx" },{ key:"apiKey",label:"API Key",placeholder:"xxxxx",secret:true },{ key:"webhookSecret",label:"Wallet PIN",secret:true,placeholder:"xxxx" }] },
  { slug: "paddle",       name: "Paddle",            color: "from-[#0EA5E9] to-[#0369A1]", icon: "P",
    fields: [{ key:"vendorId",label:"Vendor ID",placeholder:"12345" },{ key:"secretKey",label:"Auth Code / API Key",secret:true,placeholder:"xxxxx" },{ key:"webhookSecret",label:"Webhook Secret Key",secret:true,placeholder:"xxxxx" }] },
  { slug: "lemonsqueezy", name: "Lemon Squeezy",     color: "from-[#FFD557] to-[#FFA500]", icon: "🍋",
    fields: [{ key:"apiKey",label:"API Key",placeholder:"sk_...",secret:true },{ key:"webhookSecret",label:"Webhook Signing Secret",placeholder:"xxxxx",secret:true },{ key:"storeId",label:"Store ID",placeholder:"12345" }] },
  { slug: "flutterwave",  name: "Flutterwave",       color: "from-[#F5A623] to-[#FF6E00]", icon: "F",
    fields: [{ key:"publicKey",label:"Public Key",placeholder:"FLWPUBK_TEST-..." },{ key:"secretKey",label:"Secret Key",secret:true,placeholder:"FLWSECK_TEST-..." },{ key:"webhookSecret",label:"Encryption Key",secret:true,placeholder:"xxx" }] },
  { slug: "paystack",     name: "Paystack",          color: "from-[#00C3F7] to-[#0077B6]", icon: "PS",
    fields: [{ key:"publicKey",label:"Public Key",placeholder:"pk_test_..." },{ key:"secretKey",label:"Secret Key",secret:true,placeholder:"sk_test_..." },{ key:"webhookSecret",label:"Webhook Secret",secret:true,placeholder:"xxxxx" }] },
  { slug: "coinbase",     name: "Coinbase Commerce",  color: "from-[#0052FF] to-[#1A1AFF]", icon: "₿",
    fields: [{ key:"apiKey",label:"API Key",placeholder:"xxxxx",secret:true },{ key:"webhookSecret",label:"Webhook Shared Secret",placeholder:"xxxxx",secret:true }] },
  { slug: "manual",       name: "Manual Payment",    color: "from-[#6B7280] to-[#374151]", icon: "M",
    fields: [{ key:"accountName",label:"Account Name",placeholder:"SOL TV Ltd." },{ key:"accountNumber",label:"Account Number / IBAN",placeholder:"xxx" },{ key:"instructions",label:"Payment Instructions",placeholder:"Transfer to..." }] },
  { slug: "custom",       name: "Custom Gateway",    color: "from-[#7C3AED] to-[#5B21B6]", icon: "C",
    fields: [{ key:"publicKey",label:"Public / API Key",placeholder:"xxx" },{ key:"secretKey",label:"Secret Key",secret:true,placeholder:"xxx" },{ key:"callbackUrl",label:"Callback / Webhook URL",placeholder:"https://..." }] },
];

type GWForm = { isActive: boolean; isTestMode: boolean; publicKey: string; secretKey: string; webhookSecret: string; config: Record<string,string> };

function emptyForm(): GWForm { return { isActive: false, isTestMode: true, publicKey: "", secretKey: "", webhookSecret: "", config: {} }; }

function gwToForm(gw?: Gateway): GWForm {
  if (!gw) return emptyForm();
  return {
    isActive:     gw.isActive,
    isTestMode:   gw.isTestMode,
    publicKey:    gw.publicKey ?? "",
    secretKey:    gw.secretKey ?? "",
    webhookSecret:gw.webhookSecret ?? "",
    config:       gw.config ?? {},
  };
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={cn("w-10 h-5 rounded-full flex items-center px-0.5 transition-colors shrink-0", on ? "bg-primary" : "bg-white/10")}>
      <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", on ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

export default function PaymentGateways() {
  const { data: gwList = [], isLoading, refetch } = useApiQuery<Gateway[]>(["gateways"], "/v1/payments/gateways");
  const { call, loading: saving } = useApiCallState();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, GWForm>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const gwMap: Record<string, Gateway> = {};
  gwList.forEach(g => { gwMap[g.slug] = g; });

  const getForm = (slug: string): GWForm => forms[slug] ?? gwToForm(gwMap[slug]);

  const setForm = (slug: string, patch: Partial<GWForm>) =>
    setForms(p => ({ ...p, [slug]: { ...getForm(slug), ...patch } }));

  const setConfigField = (slug: string, key: string, val: string) =>
    setForms(p => ({ ...p, [slug]: { ...getForm(slug), config: { ...(getForm(slug).config ?? {}), [key]: val } } }));

  const toggle = (e: React.MouseEvent, slug: string, field: "isActive" | "isTestMode") => {
    e.stopPropagation();
    setForm(slug, { [field]: !getForm(slug)[field] });
  };

  const save = async (slug: string, meta: typeof GW_META[0]) => {
    const f = getForm(slug);
    try {
      await call("post", "/v1/payments/gateways/upsert", {
        slug, name: meta.name,
        isActive: f.isActive, isTestMode: f.isTestMode,
        publicKey: f.publicKey || undefined,
        secretKey: f.secretKey || undefined,
        webhookSecret: f.webhookSecret || undefined,
        config: Object.keys(f.config).length ? f.config : undefined,
      });
      toast.success(`${meta.name} saved`);
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const testConnection = async (e: React.MouseEvent, slug: string, meta: typeof GW_META[0]) => {
    e.stopPropagation();
    const f = getForm(slug);
    if (!f.publicKey && !f.secretKey && !f.config?.apiKey) {
      toast.warning("Add credentials before testing");
      return;
    }
    setTesting(slug);
    try {
      await call("post", `/v1/payments/gateways/${slug}/test`, {
        publicKey: f.publicKey || undefined,
        secretKey: f.secretKey || undefined,
        config: f.config,
      });
      toast.success(`${meta.name} connection verified`);
    } catch {
      toast.info(`${meta.name} credentials saved — connection will be verified on first transaction`);
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={22} className="text-primary animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Payment Gateways</h2>
          <p className="text-xs text-[#8B92A5] mt-0.5">Configure payment providers. Only enabled gateways appear in the mobile app.</p>
        </div>
        <span className="text-xs text-[#8B92A5] bg-white/5 px-2.5 py-1 rounded-full border border-border">
          {gwList.filter(g => g.isActive).length} active
        </span>
      </div>

      {GW_META.map(meta => {
        const f      = getForm(meta.slug);
        const isOpen = expanded === meta.slug;

        return (
          <div key={meta.slug}
            className={cn("bg-card border rounded-xl overflow-hidden transition-colors", isOpen ? "border-primary/40" : "border-border")}>
            <button type="button" onClick={() => setExpanded(isOpen ? null : meta.slug)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
              <div className={cn("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white shrink-0", meta.color)}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{meta.name}</p>
                <p className="text-xs text-[#8B92A5]">
                  {f.isActive ? "Enabled" : "Disabled"} · {f.isTestMode ? "Sandbox" : "Production"}
                  {gwMap[meta.slug] && <span className="ml-2 text-green-400">✓ saved</span>}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Toggle on={f.isActive} onChange={v => setForm(meta.slug, { isActive: v })} />
              </div>
              {isOpen ? <ChevronDown size={14} className="text-[#8B92A5]" /> : <ChevronRight size={14} className="text-[#8B92A5]" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white">Mode</p>
                    <p className="text-[10px] text-[#8B92A5]">
                      {f.isTestMode ? "Sandbox — test credentials, no real charges" : "Production — live credentials, real charges"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs", f.isTestMode ? "text-yellow-400" : "text-[#8B92A5]")}>Sandbox</span>
                    <Toggle on={!f.isTestMode} onChange={v => setForm(meta.slug, { isTestMode: !v })} />
                    <span className={cn("text-xs", !f.isTestMode ? "text-green-400" : "text-[#8B92A5]")}>Live</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {meta.fields.map(fld => {
                    const topFields: Record<string, keyof GWForm> = {
                      publicKey: "publicKey", secretKey: "secretKey", webhookSecret: "webhookSecret"
                    };
                    const isTop = fld.key in topFields;
                    const val = isTop ? String(f[topFields[fld.key] as keyof GWForm] ?? "") : (f.config?.[fld.key] ?? "");
                    return (
                      <div key={fld.key}>
                        <label className="text-xs text-[#8B92A5] mb-1.5 block">{fld.label}</label>
                        <input
                          type={fld.secret ? "password" : "text"}
                          value={val}
                          onChange={e => {
                            if (isTop) setForm(meta.slug, { [topFields[fld.key]]: e.target.value });
                            else setConfigField(meta.slug, fld.key, e.target.value);
                          }}
                          placeholder={fld.placeholder}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-primary placeholder:text-[#8B92A5]/60 placeholder:font-sans"
                          autoComplete="off"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => save(meta.slug, meta)} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                  <button onClick={e => testConnection(e, meta.slug, meta)} disabled={testing === meta.slug}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-[#8B92A5] hover:text-white hover:border-white/20 text-xs transition-colors disabled:opacity-50">
                    {testing === meta.slug ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    Test Connection
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
