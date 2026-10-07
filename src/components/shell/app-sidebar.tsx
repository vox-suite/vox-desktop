import { useState } from "react";
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
  SidebarRail,
  SidebarTrigger,
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
    action: windowControls.toggleMaximize,
  },
] as const;

const NAV_ITEMS = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "timeline", label: "Span", icon: GanttChart },
  { id: "spaces", label: "Spaces", icon: Workflow },
  { id: "pulse", label: "Pulse", icon: Activity },
] as const satisfies readonly { id: ShellTab; label: string; icon: unknown }[];

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
    <Sidebar collapsible="icon" onMouseDown={startWindowDrag}>
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
          <span className="flex items-center gap-2 font-heading text-sm font-semibold">
            <VoxLogo animated size={20} state="idle" />
            <span className="group-data-[collapsible=icon]:hidden">Vox</span>
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
      <SidebarRail />
    </Sidebar>
  );
}
