import { PanelEdgeBlur } from "@/components/panel-edge-blur";
import { useLayoutEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  ChevronsUpDown,
  GanttChart,
  Workflow,
  LogOut,
  Plug,
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { VoxLogo } from "@/components/vox-logo";
import { windowControls } from "@/lib/tauri";
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
  { id: "agent", label: "Agent", icon: Bot },
  { id: "timeline", label: "Span", icon: GanttChart },
  { id: "spaces", label: "Spaces", icon: Workflow },
  { id: "pulse", label: "Pulse", icon: Activity },
] as const satisfies readonly { id: ShellTab; label: string; icon: unknown }[];

const WIDTH_KEY = "vox.sidebar.width";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 176;
const MAX_WIDTH = 420;
const COLLAPSE_BELOW = 120;

function storedWidth() {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY));
    if (value >= MIN_WIDTH && value <= MAX_WIDTH) return value;
  } catch {
    return DEFAULT_WIDTH;
  }
  return DEFAULT_WIDTH;
}

function ResizeHandle() {
  const { open, setOpen, toggleSidebar } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const width = useRef(storedWidth());

  const wrapper = () =>
    ref.current?.closest<HTMLElement>("[data-slot=sidebar-wrapper]");
  const apply = (px: number) => {
    width.current = px;
    wrapper()?.style.setProperty("--sidebar-width", `${px}px`);
  };

  useLayoutEffect(() => {
    wrapper()?.style.setProperty("--sidebar-width", `${width.current}px`);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let moved = false;
    let isOpen = open;
    const root = wrapper();
    root?.classList.add("sidebar-resizing");

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      if (!moved) return;
      if (ev.clientX < COLLAPSE_BELOW) {
        if (isOpen) setOpen((isOpen = false));
        return;
      }
      if (!isOpen) setOpen((isOpen = true));
      apply(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX)));
    };
    const up = () => {
      root?.classList.remove("sidebar-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) return toggleSidebar();
      try {
        localStorage.setItem(WIDTH_KEY, String(width.current));
      } catch {
        return;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-[#5a1a1e] active:after:bg-[#5a1a1e]"
    />
  );
}

const INTERACTIVE = "button, a, input, textarea, select, [role='menuitem']";

function startWindowDrag(e: React.MouseEvent) {
  if (e.button !== 0 || (e.target as HTMLElement).closest(INTERACTIVE)) return;
  void getCurrentWindow().startDragging();
}

export function AppSidebar({
  activeTab,
  onTabChange,
  accountLabel,
  userName,
  avatarUrl,
  onSignOut,
}: {
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  accountLabel: string;
  userName?: string | null;
  avatarUrl?: string | null;
  onSignOut: () => void;
}) {
  const [imgError, setImgError] = useState(false);
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
      onMouseDown={startWindowDrag}
      className="z-30 group-data-[side=left]:border-r-0 [&_[data-sidebar=sidebar]]:border-r [&_[data-sidebar=sidebar]]:border-[#292929] [&_[data-sidebar=sidebar]]:relative [&_[data-sidebar=sidebar]]:isolate [&_[data-sidebar=sidebar]]:bg-black/25 [&_[data-sidebar=sidebar]]:backdrop-blur-[30px] [&_[data-sidebar=sidebar]]:backdrop-saturate-150"
    >
      <PanelEdgeBlur
        selector="[data-slot=sidebar-container]"
        edge="right"
        width={24}
      />
      <SidebarHeader data-tauri-drag-region>
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
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
          <span className="flex min-w-0 items-center gap-2 font-heading text-sm font-semibold">
            <VoxLogo animated size={20} state="idle" />
            <span className="truncate group-data-[collapsible=icon]:hidden">
              Vox
            </span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    tooltip={item.label}
                    onClick={() => onTabChange(item.id)}
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

      <SidebarFooter>
        <SidebarMenu>
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
        </SidebarMenu>
        <div className="-mx-2 flex items-center gap-1 border-t border-sidebar-border px-2 pt-2 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:gap-2">
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
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Vox Desktop · v{__APP_VERSION__}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onSignOut}>
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarTrigger title="Toggle sidebar (⌘B)" className="shrink-0" />
        </div>
      </SidebarFooter>
      <ResizeHandle />
    </Sidebar>
  );
}
