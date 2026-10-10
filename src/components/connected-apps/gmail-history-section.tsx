import { useEffect, useRef, useState } from "react";
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
  events: Record<string, unknown>[];
  attachment_metadata?: { mime_type: string }[];
  [key: string]: unknown;
};
type Page = { candidates: Candidate[]; excluded: number; next_page_token?: string | null };

export function GmailHistorySection() {
  const today = new Date();
  const start = new Date(today); start.setFullYear(start.getFullYear() - 1);
  const [startDate, setStartDate] = useState(start.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [page, setPage] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const scan = async (next?: string | null) => {
    setBusy(true); setMessage("Reading and classifying up to 3 emails on the server…");
    try {
      const result = await platform().http.request<Page>({ method: "POST", path: "/v1/connectors/gmail/history/page", timeoutMs: 200000, body: { start_date: startDate, end_date: endDate, page_token: next ?? null } });
      if (!mounted.current) return;
      setPage(result); setSelected(new Set());
      setMessage(`${result.excluded} irrelevant emails excluded by the server. Review the remaining messages before importing.`);
    } catch (error) { if (mounted.current) setMessage(String(error)); }
    finally { if (mounted.current) setBusy(false); }
  };
  const importSelected = async () => {
    setBusy(true); let imported = 0;
    try {
      for (const candidate of page?.candidates ?? []) {
        if (!selected.has(candidate.message_id)) continue;
        const result = await platform().http.request<{ imported_records: number }>({ method: "POST", path: "/v1/connectors/gmail/history/import", timeoutMs: 120000,
          body: { message_ids: [candidate.message_id] } });
        imported += result.imported_records;
        if (mounted.current) { setPage(previous => previous && ({ ...previous, candidates: previous.candidates.filter(item => item.message_id !== candidate.message_id) })); }
      }
      if (mounted.current) { setSelected(new Set()); setMessage(`${imported} reviewed emails imported. PDFs will appear in Updates if they need input.`); }
    } catch (error) { if (mounted.current) setMessage(`${imported} imported. ${String(error)}`); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
    <h3 className="text-sm font-medium">Import previous emails</h3>
    <p className="text-sm text-muted-foreground">Live sync starts at connection time. When you request history, Vox reads and classifies those emails on the server. Select messages to add them to your timeline; PDFs are also processed on the server.</p>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">From<Input type="date" value={startDate} disabled={busy} onChange={event => setStartDate(event.target.value)} /></label>
      <label className="text-xs">Before<Input type="date" value={endDate} disabled={busy} onChange={event => setEndDate(event.target.value)} /></label></div>
    <Button variant="outline" disabled={busy} onClick={() => void scan()}>Review historical emails</Button>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
    {page?.candidates.map(candidate => <div key={candidate.message_id} className="space-y-2 rounded-lg border border-white/10 p-3">
      <div className="flex items-start gap-2"><Checkbox disabled={busy} checked={selected.has(candidate.message_id)} onCheckedChange={checked => setSelected(previous => { const next = new Set(previous); if (checked) next.add(candidate.message_id); else next.delete(candidate.message_id); return next; })} />
        <div className="min-w-0"><p className="text-sm">{candidate.subject ?? "Email"}</p><p className="break-all text-xs text-muted-foreground">{candidate.from}</p></div></div>
      <p className="text-xs text-muted-foreground">{candidate.uncertainty ? "Needs correction. " : ""}{candidate.reason}</p>
      <details><summary className="cursor-pointer text-xs">Review extracted events</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{JSON.stringify(candidate.events, null, 2)}</pre></details>
      {candidate.uncertainty && <p className="text-xs">Uncertain facts will stay out of the timeline. Import to surface a review notice in Updates.</p>}
    </div>)}
    {page && <div className="flex gap-2"><Button disabled={busy || selected.size === 0} onClick={() => void importSelected()}>Import selected ({selected.size})</Button>
      <Button variant="outline" disabled={busy || !page.next_page_token || selected.size > 0} onClick={() => void scan(page.next_page_token)}>Next emails</Button></div>}
  </div>;
}
