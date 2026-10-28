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
Object.assign(window, { meetingFixture });
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
  <MeetingsPage accountId="fixture-user" />,
);
