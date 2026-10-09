import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { platform } from "@/platform";

type Candidate = {
  message_id: string;
  subject?: string;
  from?: string;
  reason?: string;
  uncertainty: boolean;
  user_reviewed: boolean;
  proposed_event: Record<string, unknown> | null;
  attachment_metadata?: { mime_type: string }[];
  [key: string]: unknown;
};
type Page = { candidates: Candidate[]; excluded: number; next_page_token?: string | null };

export function GmailHistorySection() {
  const today = new Date();
  const start = new Date(today); start.setFullYear(start.getFullYear() - 1);
  const [startDate, setStartDate] = useState(start.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void invoke<string[]>("gmail_local_models").then(values => { if (mounted.current) { setModels(values); setModel(values[0] ?? ""); } })
      .catch(error => { if (mounted.current) setMessage(String(error)); });
    return () => { mounted.current = false; };
  }, []);
  const scan = async (next?: string | null) => {
    setBusy(true); setMessage("Reading and classifying up to 10 emails on this device…");
    try {
      const result = await invoke<Page>("gmail_history_page", { startDate, endDate, pageToken: next ?? null, model });
      if (!mounted.current) return;
      setPage(result); setSelected(new Set());
      setDrafts(Object.fromEntries(result.candidates.map(candidate => [candidate.message_id, JSON.stringify(candidate.proposed_event, null, 2)])));
      setMessage(`${result.excluded} irrelevant emails excluded locally. Review the remaining messages before importing.`);
    } catch (error) { if (mounted.current) setMessage(String(error)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const importSelected = async () => {
    setBusy(true); let imported = 0;
    try {
      for (const candidate of page?.candidates ?? []) {
        if (!selected.has(candidate.message_id)) continue;
        const event: unknown = JSON.parse(drafts[candidate.message_id] ?? "null");
        if (event !== null && (typeof event !== "object" || Array.isArray(event))) throw new Error("Event must be a JSON object or null");
        const attachments = await invoke<unknown[]>("gmail_history_attachments", { messageId: candidate.message_id });
        if (event === null && attachments.length === 0) throw new Error("Provide an actual event or select a message with a PDF attachment");
        const { reason: _reason, attachment_metadata: _attachments, ...data } = candidate;
        await platform().http.request({ method: "POST", path: "/v1/connectors/gmail/device-historical-import", timeoutMs: 120000,
          body: { messages: [{ ...data, proposed_event: event, attachments, uncertainty: false, user_reviewed: true }] } });
        imported += 1;
        if (mounted.current) { setPage(previous => previous && ({ ...previous, candidates: previous.candidates.filter(item => item.message_id !== candidate.message_id) })); }
      }
      if (mounted.current) { setSelected(new Set()); setMessage(`${imported} reviewed emails imported. PDFs will appear in Updates if they need input.`); }
    } catch (error) { if (mounted.current) setMessage(`${imported} imported. ${String(error)}`); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <h3 className="text-sm font-medium">Import previous emails</h3>
    <p className="text-sm text-muted-foreground">Live sync starts at connection time. Historical email is fetched and classified on this device. Only messages you select below are sent to Vox.</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">From<Input type="date" value={startDate} disabled={busy} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="text-xs">Before<Input type="date" value={endDate} disabled={busy} onChange={event => setEndDate(event.target.value)} /></label></div>
    <label className="block text-xs">Local Ollama model<select className="mt-1 w-full rounded-md border border-white/10 bg-background p-2 text-sm" value={model} disabled={busy} onChange={event => setModel(event.target.value)}>
      {models.map(name => <option key={name}>{name}</option>)}</select></label>
    <Button variant="outline" disabled={busy || !model} onClick={() => void scan()}>Review historical emails</Button>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {page?.candidates.map(candidate => <div key={candidate.message_id} className="space-y-2 rounded-lg border border-white/10 p-3">
      <div className="flex items-start gap-2"><Checkbox disabled={busy} checked={selected.has(candidate.message_id)} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked) next.add(candidate.message_id); else next.delete(candidate.message_id); return next; })} />
        <div className="min-w-0"><p className="text-sm">{candidate.subject ?? "Email"}</p><p className="break-all text-xs text-muted-foreground">{candidate.from}</p></div></div>
      <p className="text-xs text-muted-foreground">{candidate.uncertainty ? "Needs correction. " : ""}{candidate.reason}</p>
      <details><summary className="cursor-pointer text-xs">Review extracted event</summary><textarea className="mt-2 min-h-40 w-full rounded-md border border-white/10 bg-background p-2 font-mono text-xs" disabled={busy} value={drafts[candidate.message_id] ?? "null"} onChange={event => setDrafts(previous => ({ ...previous, [candidate.message_id]: event.target.value }))} /></details>
      {candidate.uncertainty && <p className="text-xs">Selecting this message confirms you checked and corrected the extracted facts.</p>}
    </div>)}
    {page && <div className="flex gap-2"><Button disabled={busy || selected.size === 0} onClick={() => void importSelected()}>Import selected ({selected.size})</Button>
      <Button variant="outline" disabled={busy || !page.next_page_token || selected.size > 0} onClick={() => void scan(page.next_page_token)}>Next emails</Button></div>}
  </div>;
}
