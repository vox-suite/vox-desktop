import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { PageBody, PageContainer, PageHeader } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updatesApi, type UpdateItem } from "@/features/updates/api";

const kinds = [["", "All"], ["briefing", "Briefings"], ["email_notice", "Email"], ["processing_issue", "Needs attention"], ["connection_status", "Connections"], ["daily_plan", "Plans"]];
export function UpdatesView() {
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<UpdateItem[]>([]);
  const requestId = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [unlock, setUnlock] = useState<UpdateItem | null>(null);
  const [password, setPassword] = useState("");
  const load = useCallback(async () => {
    const ticket = ++requestId.current;
    setLoading(true); setError("");
    try { const result = await updatesApi.list(kind || undefined); if (ticket === requestId.current) { setItems(result); setHasMore(result.length === 100); } } catch (e) { if (ticket === requestId.current) setError(String(e)); }
    finally { if (ticket === requestId.current) setLoading(false); }
  }, [kind]);
  useEffect(() => { void load(); }, [load]);
  async function more() {
    const ticket = ++requestId.current;
    setLoading(true);
    try { const result = await updatesApi.list(kind || undefined, items.at(-1)); if (ticket === requestId.current) { setItems(previous => [...previous, ...result]); setHasMore(result.length === 100); } }
    catch (error) { if (ticket === requestId.current) setError(String(error)); }
    finally { if (ticket === requestId.current) setLoading(false); }
  }
  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); await load(); } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <PageContainer><PageHeader><h1 className="text-sm font-medium">Updates</h1><Button variant="ghost" size="icon" aria-label="Refresh updates" disabled={loading} onClick={() => void load()}><RotateCw size={16} /></Button></PageHeader>
    <div className="flex shrink-0 flex-wrap gap-2 border-b border-border px-6 py-3" role="group" aria-label="Update categories">{kinds.map(([value, label]) => <Button key={value} size="sm" variant={kind === value ? "secondary" : "ghost"} onClick={() => setKind(value)}>{label}</Button>)}</div>
    <PageBody className="p-6"><div className="mx-auto max-w-4xl space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading updates…</p>}
      {!loading && !error && !items.length && <p className="py-12 text-center text-sm text-muted-foreground">You're up to date.</p>}
      {items.map((item) => <article key={item.id} className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium">{item.title}</h2><span className="text-xs text-muted-foreground">{item.category}</span></div>
        {item.summary && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.summary}</p>}
        <p className="mt-3 text-xs text-muted-foreground">{new Date(item.published_at).toLocaleString()}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!item.read_at && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(() => updatesApi.action(item.id, "read"))}>Mark read</Button>}
          {item.available_actions.includes("retry") && item.source_job_id && <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(() => updatesApi.retry(item.source_job_id!))}>Retry</Button>}
          {item.available_actions.includes("provide_input") && item.source_job_id && <Button variant="outline" size="sm" disabled={busy} onClick={() => { setPassword(""); setUnlock(item); }}>Unlock attachment</Button>}
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(() => updatesApi.action(item.id, "dismiss"))}>Dismiss</Button>
        </div>
      </article>)}
      {hasMore && <Button variant="outline" disabled={loading} onClick={() => void more()}>Load more updates</Button>}
    </div></PageBody>
    <Dialog open={!!unlock} onOpenChange={(open) => { if (!open) { setUnlock(null); setPassword(""); } }}><DialogContent><DialogHeader><DialogTitle>Unlock attachment</DialogTitle><DialogDescription>The password is encrypted for this parsing job and expires after 15 minutes.</DialogDescription></DialogHeader>
      <Input type="password" autoComplete="off" aria-label="Attachment password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button disabled={busy || !password || !unlock?.source_job_id} onClick={() => { const job = unlock?.source_job_id; const secret = password; setPassword(""); setUnlock(null); if (job) void act(() => updatesApi.password(job, secret)); }}>Submit password</Button>
    </DialogContent></Dialog>
  </PageContainer>;
}
