import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { desktopStore } from "@/features/desktop-control/store";
import { platform } from "@/platform";

export type ReadyPlan = { spaceId: string; title: string; summary: string };

const IDLE_MS = 1500;
const BUSY_GIVE_UP_MS = 90_000;

const announcement = (plan: ReadyPlan) =>
  `[Vox app notice] The user's Space "${plan.title || "Untitled"}" now has a finished plan. In one short sentence tell them it is ready and ask whether they would like you to read it out. Do not read it unless they say yes. Plan details for when they ask: ${plan.summary || "(no summary available)"}`;

export function usePlanAnnouncer(
  signedIn: boolean,
  call: {
    isActive: boolean;
    isSpeaking: boolean;
    isVoxSpeaking: boolean;
    startCall: () => Promise<void>;
  },
) {
  const { isActive, isSpeaking, isVoxSpeaking, startCall } = call;
  const [queued, setQueued] = useState<ReadyPlan | null>(null);
  const [prompt, setPrompt] = useState<ReadyPlan | null>(null);
  const [speakAfterConnect, setSpeakAfterConnect] = useState<ReadyPlan | null>(
    null,
  );
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!signedIn) return;
    return platform().live.subscribe((event) => {
      if (event.type !== "space_plan_ready") return;
      const spaceId = String(event.space_id ?? "");
      if (!spaceId || seen.current.has(spaceId)) return;
      seen.current.add(spaceId);
      setQueued({
        spaceId,
        title: String(event.title ?? ""),
        summary: String(event.summary ?? ""),
      });
    });
  }, [signedIn]);

  useEffect(() => {
    if (!queued) return;
    if (!isActive) {
      setPrompt(queued);
      setQueued(null);
      return;
    }
    if (isSpeaking || isVoxSpeaking) {
      const giveUp = window.setTimeout(() => {
        setPrompt(queued);
        setQueued(null);
      }, BUSY_GIVE_UP_MS);
      return () => window.clearTimeout(giveUp);
    }
    const timer = window.setTimeout(() => {
      void invoke("send_desktop_text", { text: announcement(queued) })
        .catch(() => setPrompt(queued))
        .finally(() => setQueued(null));
    }, IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [queued, isActive, isSpeaking, isVoxSpeaking]);

  useEffect(() => {
    if (!speakAfterConnect || !isActive) return;
    const timer = window.setTimeout(() => {
      void invoke("send_desktop_text", {
        text: announcement(speakAfterConnect),
      }).catch(() => undefined);
      setSpeakAfterConnect(null);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [speakAfterConnect, isActive]);

  const dismiss = useCallback(() => setPrompt(null), []);
  const tellMe = useCallback(() => {
    if (!prompt) return;
    setSpeakAfterConnect(prompt);
    setPrompt(null);
    if (!isActive) void startCall();
  }, [prompt, isActive, startCall]);
  const view = useCallback(() => {
    if (!prompt) return;
    desktopStore.navigate("spaces");
    desktopStore.patch({ spaceId: prompt.spaceId, selectedItemId: null });
    setPrompt(null);
  }, [prompt]);

  return { prompt, dismiss, tellMe, view };
}
