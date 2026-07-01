"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Bell, AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApiCallState, getApiErrorMessage } from "@/lib/use-api";

interface Setting { key: string; value: unknown }
interface Props { settingsRaw: Setting[] | undefined; refetch: () => void }

function field(raw: Setting[] | undefined, key: string, def = "") {
  const s = (raw ?? []).find(x => x.key === key);
  return s ? String(s.value ?? "") : def;
}

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary transition-colors placeholder:text-[#8B92A5]/60 font-mono";

export default function FirebaseSettings({ settingsRaw, refetch }: Props) {
  const { call, loading } = useApiCallState();
  const [showKey, setShowKey] = useState(false);
  const [testToken, setTestToken] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [jsonMode, setJsonMode] = useState(false);
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firebase_project_id:   "",
    firebase_client_email: "",
    firebase_private_key:  "",
  });

  useEffect(() => {
    if (!settingsRaw) return;
    const projectId   = field(settingsRaw, "firebase_project_id");
    const clientEmail = field(settingsRaw, "firebase_client_email");
    const privateKey  = field(settingsRaw, "firebase_private_key");
    setForm({ firebase_project_id: projectId, firebase_client_email: clientEmail, firebase_private_key: privateKey });
    if (projectId || clientEmail || privateKey) setJsonMode(false);
  }, [settingsRaw]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const parseServiceAccountJson = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(serviceAccountJson) as Record<string, string>;
      if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
        setJsonError("JSON must contain project_id, client_email, and private_key fields.");
        return;
      }
      setForm({
        firebase_project_id:   parsed.project_id,
        firebase_client_email: parsed.client_email,
        firebase_private_key:  parsed.private_key,
      });
      setJsonMode(false);
      setServiceAccountJson("");
      toast.success("Service account parsed — review the fields below, then save.");
    } catch {
      setJsonError("Invalid JSON. Please paste the full Firebase service account JSON.");
    }
  };

  const save = async () => {
    if (!form.firebase_project_id || !form.firebase_client_email || !form.firebase_private_key) {
      toast.warning("All three Firebase fields are required.");
      return;
    }
    try {
      await call("post", "/v1/settings/bulk", {
        settings: [
          { key: "firebase_project_id",   value: form.firebase_project_id },
          { key: "firebase_client_email", value: form.firebase_client_email },
          { key: "firebase_private_key",  value: form.firebase_private_key },
        ],
      });
      toast.success("Firebase settings saved. Push notifications are now enabled.");
      refetch();
    } catch (err) { toast.error(getApiErrorMessage(err)); }
  };

  const sendTestPush = async () => {
    if (!testToken) { toast.warning("Enter an FCM device token to test"); return; }
    setTestLoading(true);
    try {
      await call("post", "/v1/notifications/test-push", { token: testToken });
      toast.success("Test push notification sent!");
    } catch (err) { toast.error("Test failed: " + getApiErrorMessage(err)); }
    finally { setTestLoading(false); }
  };

  const isConfigured = !!(form.firebase_project_id && form.firebase_client_email && form.firebase_private_key);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Firebase / FCM Settings</h2>
          <p className="text-xs text-[#8B92A5] mt-0.5">Configure Firebase to enable push notifications on Android & iOS</p>
        </div>
        {isConfigured && (
          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
            <CheckCircle2 size={12} />
            <span className="text-xs font-medium">Configured</span>
          </div>
        )}
      </div>

      {/* How to get credentials */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-300 flex items-center gap-1.5"><AlertCircle size={12}/> How to get Firebase credentials</p>
        <ol className="text-[11px] text-[#8B92A5] space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-0.5">Firebase Console <ExternalLink size={9}/></a></li>
          <li>Select your project → Project Settings → Service Accounts</li>
          <li>Click <strong className="text-white">"Generate new private key"</strong> → Download JSON</li>
          <li>Paste the JSON below or enter fields manually</li>
        </ol>
      </div>

      {/* JSON paste mode toggle */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2">
            <Upload size={11}/> Service Account
          </h3>
          <button onClick={() => { setJsonMode(v => !v); setJsonError(null); }}
            className="text-xs text-primary hover:text-primary/80 transition-colors">
            {jsonMode ? "Enter fields manually →" : "Paste service account JSON →"}
          </button>
        </div>

        {jsonMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Paste service account JSON</label>
              <textarea rows={8} value={serviceAccountJson}
                onChange={e => { setServiceAccountJson(e.target.value); setJsonError(null); }}
                placeholder={'{\n  "type": "service_account",\n  "project_id": "your-project",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "client_email": "firebase-adminsdk-...@project.iam.gserviceaccount.com"\n}'}
                className={INPUT + " resize-none text-[11px]"} />
            </div>
            {jsonError && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg p-2.5">
                <AlertCircle size={12} /> {jsonError}
              </div>
            )}
            <button onClick={parseServiceAccountJson}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
              Parse JSON & Fill Fields
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Project ID</label>
              <input className={INPUT} value={form.firebase_project_id}
                onChange={set("firebase_project_id")} placeholder="your-firebase-project-id" />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">Client Email</label>
              <input className={INPUT} value={form.firebase_client_email}
                onChange={set("firebase_client_email")}
                placeholder="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com" />
            </div>
            <div>
              <label className="text-xs text-[#8B92A5] mb-1.5 block">
                Private Key
                <span className="text-[#8B92A5]/60 ml-1">(paste the full key including BEGIN/END lines)</span>
              </label>
              <div className="relative">
                <textarea rows={showKey ? 6 : 3}
                  value={form.firebase_private_key}
                  onChange={set("firebase_private_key")}
                  placeholder={"-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----"}
                  className={INPUT + " resize-none pr-9 " + (!showKey ? "blur-[1.5px] select-none" : "")} />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-2.5 text-[#8B92A5] hover:text-white transition-colors">
                  {showKey ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
              </div>
              {form.firebase_private_key && !form.firebase_private_key.includes("BEGIN PRIVATE KEY") && (
                <p className="text-[11px] text-orange-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={10}/> Private key should start with -----BEGIN PRIVATE KEY-----
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <button onClick={save} disabled={loading || jsonMode}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {loading ? "Saving…" : "Save Firebase Settings"}
      </button>

      {/* Test push */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold text-[#8B92A5] uppercase tracking-wider flex items-center gap-2">
          <Bell size={11}/> Send Test Push Notification
        </h3>
        <p className="text-[11px] text-[#8B92A5]">
          Save settings first. Get a device FCM token from your mobile app's debug console.
        </p>
        <div className="flex gap-2">
          <input className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary font-mono text-xs placeholder:text-[#8B92A5]/60"
            value={testToken} onChange={e => setTestToken(e.target.value)}
            placeholder="FCM device token (from mobile app console…)" />
          <button onClick={sendTestPush} disabled={testLoading || !isConfigured}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-[#8B92A5] hover:text-white hover:border-white/20 transition-colors shrink-0 disabled:opacity-40">
            {testLoading ? <Loader2 size={13} className="animate-spin" /> : <Bell size={13} />}
            Test
          </button>
        </div>
        {!isConfigured && (
          <p className="text-[11px] text-orange-400 flex items-center gap-1">
            <AlertCircle size={10}/> Save Firebase settings first before testing
          </p>
        )}
      </div>
    </div>
  );
}
