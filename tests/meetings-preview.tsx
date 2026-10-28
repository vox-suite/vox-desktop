import { RecordingControls } from "../src/components/meetings/recording-controls";
import { recordingFixture } from "../src/screenshots/meetings";
import { createRoot } from "react-dom/client";
import { MeetingsPage } from "../src/components/meetings/meetings-page";
import {
  meetingFixture,
  meetingFixturePort,
} from "../src/screenshots/meetings";
import { installPlatform } from "../src/platform";
import { desktopStore } from "../src/features/desktop-control/store";
import "../src/index.css";
if (!import.meta.env.DEV) throw Error("Development fixture only");
Object.assign(window, { meetingFixture, recordingFixture });
document.documentElement.dataset.theme = "dark";
desktopStore.patch({ timezone: "America/Los_Angeles" });
installPlatform({
  meetings: meetingFixturePort,
  http: {
    request: async () => {
      throw Error("Meeting verification must not call an HTTP API");
    },
  },
  live: { subscribe: () => () => {} },
});
createRoot(document.getElementById("root")!).render(
  <div className="flex h-dvh min-h-0 flex-col">
    <RecordingControls accountId="fixture-user" />
    <MeetingsPage accountId="fixture-user" />
  </div>,
);
