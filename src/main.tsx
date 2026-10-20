import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app";
import { UpdateGate } from "@/components/update-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./index.css";
import { installPlatform } from "@/platform";
import { tauriPlatform } from "@/platform/tauri-platform";

installPlatform(tauriPlatform);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider>
        <App />
        <UpdateGate />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);
