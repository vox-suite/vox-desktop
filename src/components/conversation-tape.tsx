import { useEffect, useRef } from "react";
import { readToken } from "@/lib/theme";

const BAR = 2;
const GAP = 1.5;
const TICK_MS = 70;
const LABEL_W = 22;

// A two-lane tape of the conversation: your voice rises above the line, Vox
// answers below it, and the newest moment is at the right edge. Vox's lane is
// a speech envelope while it talks; the call reports no output level.
export function ConversationTape({
  micLevel,
  voxSpeaking,
  active,
  height = 30,
}: {
  micLevel: number;
  voxSpeaking: boolean;
  active: boolean;
  height?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ micLevel, voxSpeaking, active });
  useEffect(() => {
    live.current = { micLevel, voxSpeaking, active };
  }, [micLevel, voxSpeaking, active]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const history: { you: number; vox: number }[] = [];
    let vox = 0;
    let raf = 0;
    let last = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - last < TICK_MS) return;
      last = now;
      const { micLevel, voxSpeaking, active } = live.current;
      const s = now / 1000;
      const target = voxSpeaking
        ? Math.min(
            1,
            0.12 +
              0.85 * Math.abs(Math.sin(s * 9.1) * Math.sin(s * 2.3 + 0.7)) +
              Math.random() * 0.2,
          )
        : 0;
      vox += (target - vox) * (voxSpeaking ? 0.6 : 0.35);
      const you = active ? Math.min(1, micLevel * 5) : 0;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth;
      if (el.width !== Math.round(w * dpr)) {
        el.width = Math.round(w * dpr);
        el.height = Math.round(height * dpr);
      }
      const slots = Math.max(1, Math.floor((w - LABEL_W) / (BAR + GAP)));
      history.push({ you, vox });
      if (history.length > slots) history.splice(0, history.length - slots);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const mid = height / 2;
      const youColor = readToken("mint");
      const voxColor = readToken("violet");
      const dim = readToken("text-dim");

      ctx.fillStyle = dim;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(LABEL_W, mid - 0.25, w - LABEL_W, 0.5);
      ctx.globalAlpha = 1;
      ctx.font = "600 7px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "middle";
      ctx.fillStyle = youColor;
      ctx.fillText("YOU", 0, mid - 6);
      ctx.fillStyle = voxColor;
      ctx.fillText("VOX", 0, mid + 6);

      const room = mid - 2;
      history.forEach((h, i) => {
        const x = w - (history.length - i) * (BAR + GAP);
        if (x < LABEL_W) return;
        const fade = Math.min(1, (x - LABEL_W) / 18);
        const up = Math.max(0.5, h.you * room);
        const down = Math.max(0.5, h.vox * room);
        ctx.globalAlpha = fade * (h.you > 0.02 ? 1 : 0.35);
        ctx.fillStyle = youColor;
        ctx.fillRect(x, mid - 0.75 - up, BAR, up);
        ctx.globalAlpha = fade * (h.vox > 0.02 ? 1 : 0.35);
        ctx.fillStyle = voxColor;
        ctx.fillRect(x, mid + 0.75, BAR, down);
      });
      ctx.globalAlpha = 1;
      const head = vox > 0.05 ? voxColor : you > 0.05 ? youColor : dim;
      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.arc(w - 1.5, mid, 1.5, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [height]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={
        voxSpeaking
          ? "Vox is speaking"
          : active
            ? "Listening to you"
            : "Conversation idle"
      }
      className="block w-full"
      style={{ height }}
    />
  );
}
