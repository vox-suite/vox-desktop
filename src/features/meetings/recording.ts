import type { MeetingRecordingPort, RecordingStatus } from "./types.ts";
const empty = (): RecordingStatus => ({
  id: null,
  phase: "",
  started_ms: 0,
  error: null,
  mic_frames: 0,
  system_frames: 0,
});
export class RecordingSession {
  private state = {
    status: empty(),
    observedMs: 0,
    busy: false,
    error: "",
    modelReady: false,
  };
  private active = true;
  private polling = false;
  private pollAgain = false;
  private statusEpoch = 0;
  private listeners = new Set<() => void>();
  private port: MeetingRecordingPort;
  private changed: () => void;
  constructor(port: MeetingRecordingPort, changed: () => void = () => {}) {
    this.port = port;
    this.changed = changed;
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private patch(update: Partial<typeof this.state>) {
    if (!this.active) return;
    this.state = { ...this.state, ...update };
    this.listeners.forEach((f) => f());
  }
  close() {
    this.active = false;
    this.state = {
      status: empty(),
      observedMs: 0,
      busy: false,
      error: "",
      modelReady: false,
    };
    this.listeners.forEach((f) => f());
    this.listeners.clear();
  }
  async poll() {
    if (!this.active) return;
    if (this.polling) {
      this.pollAgain = true;
      return;
    }
    this.polling = true;
    const epoch = this.statusEpoch;
    try {
      const next = await this.port.status();
      if (!this.active || epoch !== this.statusEpoch) return;
      const previous = this.state.status;
      this.patch({ status: next, observedMs: Date.now() });
      if (
        next.id &&
        next.phase !== previous.phase &&
        ["captured", "ready", "failed"].includes(next.phase)
      )
        this.changed();
    } catch (e) {
      this.patch({ error: String(e) });
    } finally {
      this.polling = false;
      if (this.pollAgain) {
        this.pollAgain = false;
        void this.poll();
      }
    }
  }
  private async run(action: () => Promise<void>) {
    if (!this.active || this.state.busy) return;
    this.statusEpoch++;
    this.patch({ busy: true, error: "" });
    try {
      await action();
      if (this.active) await this.poll();
    } catch (e) {
      this.patch({ error: String(e) });
    } finally {
      this.patch({ busy: false });
    }
  }
  start(title: string) {
    return this.run(async () => {
      await this.port.start(title);
      if (this.active) this.changed();
    });
  }
  stop() {
    return this.run(() => this.port.stop());
  }
  transcribe(id: string) {
    return this.run(() => this.port.transcribe(id));
  }
  async checkModel() {
    try {
      this.patch({ modelReady: await this.port.modelReady() });
    } catch (e) {
      this.patch({ error: String(e) });
    }
  }
  chooseModel() {
    return this.run(async () => {
      if (await this.port.chooseModel()) await this.checkModel();
    });
  }
}
