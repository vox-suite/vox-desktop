import type {
  Meeting,
  MeetingSummary,
  MeetingsPort,
  RecoveryReport,
} from "./types.ts";
const PAGE_SIZE = 20;
const empty = () => ({
  items: [] as MeetingSummary[],
  loaded: false,
  listLoading: false,
  hasMore: false,
  selectedId: null as string | null,
  detail: null as Meeting | null,
  detailLoading: false,
  draft: "",
  dirty: false,
  saving: false,
  conflict: null as Meeting | null,
  error: "",
  detailError: "",
  saveError: "",
  notice: "",
  busy: null as string | null,
  reports: [] as RecoveryReport[],
});
export type MeetingLibraryState = ReturnType<typeof empty>;
type Draft = { text: string; baseNotes: string; revision: number };
const summary = (m: Meeting): MeetingSummary => ({
  id: m.id,
  title: m.title,
  state: m.state,
  revision: m.revision,
  created_ms: m.created_ms,
  updated_ms: m.updated_ms,
  has_transcript: m.tracks.some((t) => t.segments.length > 0),
});
export class MeetingLibrary {
  private state = empty();
  private listeners = new Set<() => void>();
  private drafts = new Map<string, Draft>();
  private port: MeetingsPort;
  private active = true;
  private savingId: string | null = null;
  private detailEpoch = 0;
  private listEpoch = 0;
  private offset = 0;
  constructor(port: MeetingsPort) {
    this.port = port;
  }
  hasDrafts = () => this.drafts.size > 0;
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private patch(next: Partial<MeetingLibraryState>) {
    if (!this.active) return;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((fn) => fn());
  }
  close() {
    this.active = false;
    this.detailEpoch++;
    this.listEpoch++;
    this.drafts.clear();
    this.state = empty();
    this.listeners.forEach((fn) => fn());
    this.listeners.clear();
  }
  async load() {
    if (this.active && !this.state.loaded && !this.state.listLoading)
      await this.fetchPage(true);
  }
  async refresh() {
    if (this.active && !this.state.listLoading) await this.fetchPage(true);
  }
  async loadMore() {
    if (this.active && this.state.hasMore && !this.state.listLoading)
      await this.fetchPage(false);
  }
  private async fetchPage(reset: boolean) {
    const epoch = ++this.listEpoch;
    this.patch({ listLoading: true, error: "" });
    const offset = reset ? 0 : this.offset;
    try {
      const items = await this.port.list(offset, PAGE_SIZE);
      if (!this.active || epoch !== this.listEpoch) return;
      this.offset = offset + items.length;
      const merged = new Map(
        (reset ? [] : this.state.items).map((m) => [m.id, m]),
      );
      items.forEach((m) => merged.set(m.id, m));
      this.patch({
        items: [...merged.values()],
        loaded: true,
        hasMore: items.length === PAGE_SIZE,
      });
    } catch (error) {
      this.patch({ error: String(error), loaded: true });
    } finally {
      if (epoch === this.listEpoch) this.patch({ listLoading: false });
    }
  }
  deselect() {
    this.detailEpoch++;
    this.patch({
      selectedId: null,
      detail: null,
      detailLoading: false,
      draft: "",
      dirty: false,
      conflict: null,
      detailError: "",
      saveError: "",
    });
  }
  async select(id: string) {
    if (!this.active) return;
    const epoch = ++this.detailEpoch;
    this.patch({
      selectedId: id,
      detail: null,
      detailLoading: true,
      detailError: "",
      saveError: "",
      conflict: null,
      draft: "",
      dirty: false,
      notice: "",
    });
    try {
      const m = await this.port.get(id);
      if (!this.active || epoch !== this.detailEpoch) return;
      this.show(m);
    } catch (error) {
      if (epoch === this.detailEpoch)
        this.patch({ detailError: String(error) });
    } finally {
      if (epoch === this.detailEpoch) this.patch({ detailLoading: false });
    }
  }
  async reloadSelected() {
    const id = this.state.selectedId;
    if (!this.active || !id) return;
    if (!this.state.detail) return this.select(id);
    const epoch = ++this.detailEpoch;
    try {
      const m = await this.port.get(id);
      if (this.active && epoch === this.detailEpoch) this.show(m);
    } catch (error) {
      if (this.active && epoch === this.detailEpoch)
        this.patch({
          notice: `Could not refresh this meeting: ${String(error)}`,
        });
    }
  }
  private show(m: Meeting) {
    let draft = this.drafts.get(m.id);
    if (draft?.text === m.notes && this.savingId !== m.id) {
      this.drafts.delete(m.id);
      draft = undefined;
    }
    if (draft && draft.baseNotes === m.notes) {
      draft.revision = m.revision;
    }
    this.patch({
      detail: m,
      draft: draft?.text ?? m.notes,
      dirty: !!draft,
      conflict: draft && draft.baseNotes !== m.notes ? m : null,
    });
  }
  edit(text: string) {
    const m = this.state.detail;
    if (!this.active || !m) return;
    const old = this.drafts.get(m.id);
    if (text === m.notes && this.savingId !== m.id) this.drafts.delete(m.id);
    else
      this.drafts.set(m.id, {
        text,
        baseNotes: old?.baseNotes ?? m.notes,
        revision: old?.revision ?? m.revision,
      });
    this.patch({
      draft: text,
      dirty: this.drafts.has(m.id),
      notice: "",
      saveError: "",
    });
  }
  private upsert(m: Meeting) {
    this.patch({
      items: [
        summary(m),
        ...this.state.items.filter((item) => item.id !== m.id),
      ].sort((a, b) => b.created_ms - a.created_ms || b.id.localeCompare(a.id)),
    });
  }
  async save() {
    const m = this.state.detail;
    const draft = m ? this.drafts.get(m.id) : undefined;
    if (!this.active || !m || !draft || this.state.saving) return;
    const id = m.id,
      text = draft.text,
      revision = draft.revision;
    this.savingId = id;
    this.patch({ saving: true, saveError: "", notice: "" });
    try {
      const saved = await this.port.saveNotes(id, revision, text);
      if (!this.active) return;
      const current = this.drafts.get(id);
      if (current?.text === text) this.drafts.delete(id);
      else if (current) {
        current.baseNotes = saved.notes;
        current.revision = saved.revision;
      }
      this.upsert(saved);
      if (this.state.selectedId === id) {
        this.show(saved);
        this.patch({ notice: "Notes saved on this computer.", conflict: null });
      }
    } catch (error) {
      if (!this.active) return;
      if (this.state.selectedId === id)
        this.patch({ saveError: String(error) });
      try {
        const latest = await this.port.get(id);
        if (
          this.active &&
          this.state.selectedId === id &&
          latest.revision !== revision
        )
          this.patch({ conflict: latest });
      } catch {
        /* Keep the draft when even the saved copy cannot be read. */
      }
    } finally {
      this.savingId = null;
      this.patch({ saving: false });
    }
  }
  useSavedNotes() {
    const latest = this.state.conflict;
    if (!latest) return;
    this.drafts.delete(latest.id);
    this.show(latest);
    this.patch({
      conflict: null,
      saveError: "",
      notice: "Showing the saved notes.",
    });
  }
  async keepMyDraft() {
    const latest = this.state.conflict;
    if (!latest) return;
    const draft = this.drafts.get(latest.id);
    if (!draft) return;
    draft.revision = latest.revision;
    draft.baseNotes = latest.notes;
    this.patch({ detail: latest, conflict: null });
    await this.save();
  }
  async create(title: string) {
    if (!this.active || this.state.busy) return null;
    this.patch({ busy: "create", error: "" });
    try {
      const m = await this.port.create(title.trim());
      if (!this.active) return null;
      this.upsert(m);
      await this.select(m.id);
      return m;
    } catch (error) {
      this.patch({ error: String(error) });
      return null;
    } finally {
      this.patch({ busy: null });
    }
  }
  async importTranscript() {
    const m = this.state.detail;
    if (!this.active || !m || this.state.busy || this.state.saving) return;
    this.patch({ busy: "import", detailError: "", notice: "" });
    try {
      const saved = await this.port.importTranscript(m.id, m.revision);
      if (!this.active || !saved) return;
      this.upsert(saved);
      if (this.state.selectedId === m.id) {
        this.show(saved);
        this.patch({ notice: "Transcript imported on this computer." });
      }
    } catch (error) {
      if (this.state.selectedId === m.id)
        this.patch({ detailError: String(error) });
    } finally {
      this.patch({ busy: null });
    }
  }
  async remove() {
    const m = this.state.detail;
    if (!this.active || !m || this.state.busy || this.state.saving) return;
    this.patch({ busy: "delete", detailError: "" });
    try {
      await this.port.remove(m.id, m.revision);
      if (!this.active) return;
      this.drafts.delete(m.id);
      this.patch({
        items: this.state.items.filter((item) => item.id !== m.id),
      });
      this.offset = Math.max(0, this.offset - 1);
      if (this.state.selectedId === m.id) {
        this.detailEpoch++;
        this.patch({
          selectedId: null,
          detail: null,
          draft: "",
          dirty: false,
          conflict: null,
        });
      }
    } catch (error) {
      this.patch({ detailError: String(error) });
    } finally {
      this.patch({ busy: null });
    }
  }
  async recover() {
    if (!this.active || this.state.busy) return;
    this.patch({ busy: "recover", error: "", notice: "" });
    try {
      const reports = await this.port.recover();
      if (!this.active) return;
      this.patch({
        reports,
        notice: reports.length
          ? `Checked ${reports.length} interrupted meeting${reports.length === 1 ? "" : "s"}. Recording remains stopped.`
          : "No interrupted meetings need recovery.",
      });
      await this.refresh();
      const id = this.state.selectedId;
      if (id && !this.state.dirty) await this.select(id);
    } catch (error) {
      this.patch({ error: String(error) });
    } finally {
      this.patch({ busy: null });
    }
  }
  async exportText() {
    const m = this.state.detail;
    if (!this.active || !m || this.state.busy || this.state.dirty) return;
    this.patch({ busy: "export", detailError: "" });
    try {
      if (await this.port.exportText(m.id))
        this.patch({ notice: "Saved a text copy of this meeting." });
    } catch (error) {
      if (this.state.selectedId === m.id)
        this.patch({ detailError: String(error) });
    } finally {
      this.patch({ busy: null });
    }
  }
}
