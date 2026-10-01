import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import "./index.css";
import { installPlatform } from "@vox/ui";
import { tauriPlatform } from "./platform/tauri-platform";

installPlatform(tauriPlatform);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
