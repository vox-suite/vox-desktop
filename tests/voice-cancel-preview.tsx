import React from "react";
import { createRoot } from "react-dom/client";
import { useCallSession } from "../src/hooks/use-call-session";
export function Preview() {
  const voice = useCallSession(true);
  return (
    <>
      <output data-testid="state">{voice.callState}</output>
      <output data-testid="error">{voice.callError}</output>
      <button onClick={() => void voice.toggleCall()}>Toggle call</button>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
