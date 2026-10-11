import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { api, invokeErrorMessage } from "@/lib/tauri";

export function useCallSession(signedIn: boolean) {
  const [callState, setCallState] = useState("idle");
  const [isActive, setIsActive] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoxSpeaking, setIsVoxSpeaking] = useState(false);
  const [callError, setCallError] = useState("");

  useEffect(() => {
    if (!signedIn) return;
    const delay = isActive ? 90 : 800;
    const id = window.setInterval(() => {
      void api.callStatus().then((status) => {
        if (!status.state) return;
        setCallState(status.state);
        setIsActive(status.active);
        setMicLevel(status.active ? status.mic_level : 0);
        setIsSpeaking(status.is_speaking);
        setIsVoxSpeaking(status.is_vox_speaking);
        if (status.state === "idle" || status.state === "ended") {
          setIsBusy(false);
          setMicLevel(0);
          setIsSpeaking(false);
          setIsVoxSpeaking(false);
        }
      });
    }, delay);
    return () => window.clearInterval(id);
  }, [signedIn, isActive]);

  useEffect(() => {
    if (!signedIn) {
      resetCallState();
      return;
    }
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    let unlisten: (() => void) | undefined;
    void listen<string>("vox-voice-error", (event) => {
      if (active) setCallError(event.payload);
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [signedIn]);

  async function endCall() {
    await api.endCall();
    setCallState("idle");
    setIsActive(false);
    setIsBusy(false);
    setMicLevel(0);
    setIsSpeaking(false);
    setIsVoxSpeaking(false);
    setCallError("");
  }

  async function toggleCall() {
    if (isActive) {
      await endCall();
      return;
    }
    if (isBusy || !signedIn) return;
    setIsBusy(true);
    setCallError("");
    setCallState("connecting");
    try {
      const status = await api.startCall();
      if (status.state === "active" || status.active) {
        setCallState("active");
        setIsActive(true);
      } else {
        setCallState("idle");
        setIsActive(false);
        setCallError(invokeErrorMessage(status));
      }
    } catch (err) {
      setCallState("idle");
      setIsActive(false);
      setCallError(invokeErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  }

  // Local-only reset for sign-out: the server session is already gone, so
  // this must NOT call api.endCall() like endCall() does.
  function resetCallState() {
    setIsActive(false);
    setIsBusy(false);
    setMicLevel(0);
    setIsSpeaking(false);
    setIsVoxSpeaking(false);
    setCallState("idle");
    setCallError("");
  }

  return {
    callState,
    isActive,
    isBusy,
    isSpeaking,
    micLevel,
    isVoxSpeaking,
    callError,
    toggleCall,
    endCall,
    resetCallState,
  };
}
