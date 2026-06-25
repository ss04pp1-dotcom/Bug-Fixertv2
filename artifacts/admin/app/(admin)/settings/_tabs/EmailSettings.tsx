"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Send, Mail, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Setting { key: string; value: unknown }
interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function field(raw: Setting[] | undefined, key: string, def = "") {
  const s = (raw ?? []).find(x => x.key === key);
  return s ? String(s.value ?? "") : def;
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60";
const SELECT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors appearance-none cursor-pointer";

const PROVIDER_PRESETS: Record<string, { host: string; port: string; encryption: string }> = {
  gmail:    { host: "smtp.gmail.com",          port: "587", encryption: "tls" },
  zoho:     { host: "smtp.zoho.com",            port: "587", encryption: "tls" },
  outlook:  { host: "smtp-mail.outlook.com",    port: "587", encryption: "tls" },
  ses:      { host: "email-smtp.us-east-1.amazonaws.com", port: "587", encryption: "tls" },
  mailgun:  { host: "smtp.mailgun.org",         port: "587", encryption: "tls" },
  sendgrid: { host: "smtp.sendgrid.net",        port: "587", encryption: "tls" },
  brevo:    { host: "smtp-relay.brevo.com",     port: "587", encryption: "tls" },
  custom:   { host: "",                         port: "587", encryption: "tls" },
};

const TEMPLATES = [
  { key: "email_template_welcome",      label: "Welcome Email" },
  { key: "email_template_otp",          label: "OTP / Verification" },
  { key: "email_template_reset",        label: "Password Reset" },
  { key: "email_template_subscription", label: "Subscription Success" },
  { key: "email_template_invoice",      label: "Invoice" },
];

const DEFAULT_TEMPLATES: Record<string, string> = {
  email_template_welcome: `Hi {{name}},\n\nWelcome to StreamPro! Your account has been created.\n\nEmail: {{email}}\n\nStart watching at: {{website_url}}\n\nThe StreamPro Team`,
  email_template_otp: `Hi {{name}},\n\nYour verification code is: {{otp}}\n\nThis code expires in 10 minutes.\n\nStreamPro`,
  email_template_reset: `Hi {{name}},\n\nYou requested a password reset. Use this code:\n\n{{otp}}\n\nIf you didn't request this, ignore this email.\n\nStreamPro`,
  email_template_subscription: `Hi {{name}},\n\nThank you! Your subscription to {{plan}} is now active.\n\nExpires: {{expires_at}}\n\nStreamPro`,
  email_template_invoice: `Hi {{name}},\n\nYour invoice #{{invoice_number}} for {{amount}} is ready.\n\nStreamPro`,
};

export default function EmailSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();
  const [testEmail, setTestEmail] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0].key);
  const [activeTab, setActiveTab] = useState<"smtp" | "templates">("smtp");

  const [form, setForm] = useState({
    smtp_provider:   "custom",
    smtp_host:       "",
    smtp_port:       "587",
    smtp_username:   "",
    smtp_password:   "",
    smtp_encryption: "tls",
    smtp_from_email: "",
    smtp_from_name:  "StreamPro",
    smtp_reply_to:   "",
  });

  const [templates, setTemplates] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!settingsRaw) return;
    setForm({
      smtp_provider:   field(settingsRaw, "smtp_provider", "custom"),
      smtp_host:       field(settingsRaw, "smtp_host"),
      smtp_port:       field(settingsRaw, "smtp_port", "587"),
      smtp_username:   field(settingsRaw, "smtp_username"),
      smtp_password:   field(settingsRaw, "smtp_password"),
      smtp_encryption: field(settingsRaw, "smtp_encryption", "tls"),
      smtp_from_email: field(settingsRaw, "smtp_from_email"),
      smtp_from_name:  field(settingsRaw, "smtp_from_name", "StreamPro"),
      smtp_reply_to:   field(settingsRaw, "smtp_reply_to"),
    });
    const tpls: Record<string, string> = {};
    TEMPLATES.forEach(t => {
      tpls[t.key] = field(settingsRaw, t.key, DEFAULT_TEMPLATES[t.key] ?? "");
    });
    setTemplates(tpls);
  }, [settingsRaw]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const applyPreset = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider];
    if (preset) setForm(p => ({ ...p, smtp_provider: provider, ...preset }));
  };

  const saveSmtp = async () => {
    try {
      await call("post", "/v1/settings/bulk", { settings: Object.entries(form).map(([key, value]) => ({ key, value })) });
      toast.success("Email settings saved");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const saveTemplates = async () => {
    try {
      await call("post", "/v1/settings/bulk", { settings: Object.entries(templates).map(([key, value]) => ({ key, value })) });
      toast.success("Email templates saved");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const sendTestEmail = async () => {
    if (!testEmail) { toast.warning("Enter a recipient email address"); return; }
    setTestLoading(true);
    try {
      await call("post", "/v1/settings/test-email", { to: testEmail });
      toast.success("Test email sent to " + testEmail);
    } catch (err) { toast.error(getApiErrorMessage(err)); }
    finally { setTestLoading(false); }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Email Settings</h2>
        <p className="text-xs text-[#8B92A5] mt-0.5">Configure SMTP and manage email templates</p>
      </div>

      <div className="flex gap-1 border-b border-border pb-0">
        {(["smtp","templates"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${activeTab === t ? "text-white border-primary" : "text-[#8B92A5] border-transparent hover:text-white"}`}>
            {t === "smtp" ? "SMTP Configuration" : "Email Templates"}
          </button>
        ))}
      </div>

      {activeTab === "smtp" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Email Provider</label>
              <div className="relative">
                <select className={SELECT} value={form.smtp_provider}
                  onChange={e => { set("smtp_provider")(e); applyPreset(e.target.value); }}>
                  <option value="gmail">Gmail</option>
                  <option value="zoho">Zoho Mail</option>
                  <option value="outlook">Outlook / Microsoft 365</option>
                  <option value="ses">Amazon SES</option>
                  <option value="mailgun">Mailgun</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="brevo">Brevo (Sendinblue)</option>
                  <option value="custom">Custom SMTP</option>
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B92A5] pointer-events-none" />
              </div>
              {form.smtp_provider !== "custom" && (
                <p className="text-[11px] text-primary mt-1.5">✓ SMTP host pre-filled from preset</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-[#8B92A5] mb-1.5 block">SMTP Host</label>
                <input className={INPUT} value={form.smtp_host} onChange={set("smtp_host")} placeholder="smtp.example.com" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Port</label>
                <input className={INPUT + " font-mono"} value={form.smtp_port} onChange={set("smtp_port")} placeholder="587" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Username</label>
                <input className={INPUT} value={form.smtp_username} onChange={set("smtp_username")} placeholder="you@example.com" autoComplete="off" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Password / App Password</label>
                <input type="password" className={INPUT} value={form.smtp_password} onChange={set("smtp_password")} placeholder="••••••••" autoComplete="new-password" />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Encryption</label>
              <div className="flex gap-2">
                {["none","tls","ssl"].map(enc => (
                  <button key={enc} type="button" onClick={() => setForm(p => ({ ...p, smtp_encryption: enc }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${form.smtp_encryption === enc ? "border-primary bg-primary/10 text-primary" : "border-border text-[#8B92A5] hover:border-white/20 hover:text-white"}`}>
                    {enc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Mail size={11}/> Sender Identity</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">From Email</label>
                <input type="email" className={INPUT} value={form.smtp_from_email} onChange={set("smtp_from_email")} placeholder="noreply@streampro.app" />
              </div>
              <div>
                <label className="text-xs text-[#8B92A5] mb-1.5 block">From Name</label>
                <input className={INPUT} value={form.smtp_from_name} onChange={set("smtp_from_name")} placeholder="StreamPro" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#8B92A5] mb-1.5 block">Reply-To (optional)</label>
                <input type="email" className={INPUT} value={form.smtp_reply_to} onChange={set("smtp_reply_to")} placeholder="support@streampro.app" />
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2"><Send size={11}/> Send Test Email</h3>
            <div className="flex gap-2">
              <input type="email" className={INPUT} value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" />
              <button onClick={sendTestEmail} disabled={testLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:text-white hover:border-white/20 transition-colors shrink-0 disabled:opacity-50">
                {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send Test
              </button>
            </div>
            <p className="text-[11px] text-[#8B92A5]">Save settings first, then send a test to verify your SMTP configuration.</p>
          </div>

          <button onClick={saveSmtp} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {loading ? "Saving…" : "Save Email Settings"}
          </button>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => setActiveTemplate(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTemplate === t.key ? "bg-primary text-white" : "bg-card border border-border text-[#8B92A5] hover:text-white"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-white">{TEMPLATES.find(t => t.key === activeTemplate)?.label}</p>
              <p className="text-[10px] text-[#8B92A5]">Variables: {"{{name}}"}, {"{{email}}"}, {"{{otp}}"}, {"{{plan}}"}</p>
            </div>
            <textarea rows={10} value={templates[activeTemplate] ?? ""}
              onChange={e => setTemplates(p => ({ ...p, [activeTemplate]: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary font-mono resize-none" />
          </div>
          <button onClick={saveTemplates} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {loading ? "Saving…" : "Save Templates"}
          </button>
        </div>
      )}
    </div>
  );
}
