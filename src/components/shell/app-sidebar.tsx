import { useRef, useState } from "react";
import {
  Activity,
  House,
  Bell,
  ChevronsUpDown,
  GanttChart,
  Workflow,
  Folder,
  LogOut,
  Monitor,
  Moon,
  Plug,
  Sun,
  Terminal,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { windowControls } from "@/lib/tauri";
import { setThemePref, useThemePref, type ThemePref } from "@/lib/theme";
import { desktopStore } from "@/features/desktop-control/store";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import {
  SidebarVoiceControls,
  type SidebarVoiceProps,
} from "./sidebar-voice-controls";
import { ResizeHandle } from "./resize-handle";
import type { ShellTab } from "./shell-tabs";

const CONTROLS = [
  { title: "Close", color: "bg-destructive", action: windowControls.close },
  { title: "Minimize", color: "bg-muted", action: windowControls.minimize },
  {
    title: "Fullscreen",
    color: "bg-muted",
    action: windowControls.toggleFullscreen,
  },
] as const;

const NAV_ITEMS = [
  { id: "agent", label: "Home", icon: House },
  { id: "timeline", label: "Timeline", icon: GanttChart },
  { id: "spaces", label: "Plans", icon: Workflow },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "pulse", label: "Insights", icon: Activity },
  { id: "updates", label: "Updates", icon: Bell },
] as const satisfies readonly { id: ShellTab; label: string; icon: unknown }[];

const THEMES = [
  { pref: "auto", label: "Auto", icon: Monitor },
  { pref: "light", label: "Light", icon: Sun },
  { pref: "dark", label: "Dark", icon: Moon },
] as const satisfies readonly { pref: ThemePref; label: string; icon: unknown }[];

const INTERACTIVE = "button, a, input, textarea, select, [role='menuitem']";

export function AppSidebar({
  activeTab,
  onTabChange,
  accountLabel,
  userName,
  avatarUrl,
  onSignOut,
  voice,
}: {
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  accountLabel: string;
  userName?: string | null;
  avatarUrl?: string | null;
  onSignOut: () => void;
  voice: SidebarVoiceProps;
}) {
  const context = useDesktopContext();
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [imgError, setImgError] = useState(false);
  const themePref = useThemePref();
  const themeIndex = THEMES.findIndex((t) => t.pref === themePref);
  const theme = THEMES[themeIndex];
  const displayName =
    (userName || accountLabel).replace(/@.*/, "").trim() || "User";
  const initials =
    displayName
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      onMouseDown={(event) => {
        dragOrigin.current = null;
        if (
          event.button !== 0 ||
          (event.target as HTMLElement).closest(INTERACTIVE)
        )
          return;
        dragOrigin.current = { x: event.clientX, y: event.clientY };
      }}
      onMouseMove={(event) => {
        const origin = dragOrigin.current;
        if (!origin) return;
        if ((event.buttons & 1) === 0) {
          dragOrigin.current = null;
          return;
        }
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 5)
          return;
        dragOrigin.current = null;
        void getCurrentWindow()
          .startDragging()
          .catch(() => {});
      }}
      onMouseUp={() => {
        dragOrigin.current = null;
      }}
      onMouseLeave={() => {
        dragOrigin.current = null;
      }}
      className="z-30 p-0 group-data-[side=left]:border-r-0 [&_[data-sidebar=sidebar]]:relative [&_[data-sidebar=sidebar]]:isolate [&_[data-sidebar=sidebar]]:rounded-none [&_[data-sidebar=sidebar]]:bg-panel/90 [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-line [&_[data-sidebar=sidebar]]:backdrop-blur-[30px]"
    >
      <SidebarHeader className="gap-2 px-4 pb-3 pt-3 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center group-data-[collapsible=icon]:hidden">
            {CONTROLS.map((c) => (
              <Button
                key={c.title}
                variant="ghost"
                size="icon-xs"
                title={c.title}
                className="size-4 p-0"
                onClick={() => void c.action()}
              >
                <span className={`size-2.5 rounded-full ${c.color}`} />
              </Button>
            ))}
          </div>
          <SidebarTrigger
            title="Toggle sidebar (⌘B)"
            className="size-6 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground"
          />
        </div>
        <span className="flex min-w-0 items-center gap-2 px-1 py-1 font-heading text-sm font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">
          <span className="truncate group-data-[collapsible=icon]:hidden">
            Vox · {__APP_VERSION__}
          </span>
        </span>
      </SidebarHeader>

      <div className="mx-4 border-t border-ink/5 group-data-[collapsible=icon]:mx-2" />

      <SidebarContent>
        <SidebarGroup className="px-3 pt-2 group-data-[collapsible=icon]:px-2">
          <SidebarGroupLabel className="mb-1 h-5 text-[10px] font-normal uppercase tracking-widest text-muted-foreground/60">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    tooltip={item.label}
                    onClick={() => onTabChange(item.id)}
                    className="h-8 rounded-lg px-3 text-[13px] text-muted-foreground data-[active=true]:bg-ink/[0.08] data-[active=true]:text-foreground [&>svg]:size-4"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2 p-3 group-data-[collapsible=icon]:p-2">
        <span className="px-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
          Assistant
        </span>
        <SidebarVoiceControls {...voice} />
        <SidebarSeparator className="mx-0 my-1" />
        <SidebarMenu className="gap-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={context.terminalOpen}
              tooltip="Terminal"
              aria-label="Terminal"
              aria-expanded={context.terminalOpen}
              onClick={() =>
                desktopStore.patch({ terminalOpen: !context.terminalOpen })
              }
            >
              <Terminal />
              <span>Terminal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeTab === "connections"}
              tooltip="Connected Apps"
              onClick={() => onTabChange("connections")}
            >
              <Plug />
              <span>Connected Apps</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={`Theme: ${theme.label}`}
              aria-label={`Theme: ${theme.label}. Change theme`}
              onClick={() => setThemePref(THEMES[(themeIndex + 1) % THEMES.length].pref)}
            >
              <theme.icon />
              <span>Theme: {theme.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-1 flex items-center gap-1 border-t border-ink/5 pt-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
          <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" tooltip={displayName}>
                    <Avatar className="size-8">
                      {avatarUrl && !imgError ? (
                        <AvatarImage
                          src={avatarUrl}
                          alt={displayName}
                          referrerPolicy="no-referrer"
                          onError={() => setImgError(true)}
                        />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                      <span
                        className="truncate font-medium"
                        title={displayName}
                      >
                        {displayName}
                      </span>
                      <span
                        className="truncate text-xs text-muted-foreground"
                        title={accountLabel}
                      >
                        {accountLabel}
                      </span>
                    </div>
                    <ChevronsUpDown className="ml-auto shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  sideOffset={16}
                  collisionPadding={16}
                  className="w-56 rounded-2xl p-1.5 border border-line bg-panel/90 shadow-float ring-0 backdrop-blur-[30px]"
                >
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Vox Desktop · v{__APP_VERSION__}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    className="rounded-xl"
                    onClick={onSignOut}
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
      <ResizeHandle />
    </Sidebar>
  );
}
