import { Link, useLocation } from "wouter";
import { ScanSearch, History, Settings, Upload, Newspaper } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";

const items = [
  { title: "Intake", url: "/", icon: Upload, testId: "link-intake" },
  { title: "Scan Results", url: "/results", icon: ScanSearch, testId: "link-results" },
  { title: "History", url: "/history", icon: History, testId: "link-history" },
  { title: "Legal Updates", url: "/legal-updates", icon: Newspaper, testId: "link-legal-updates" },
  { title: "Settings", url: "/settings", icon: Settings, testId: "link-settings" },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-7 w-7 shrink-0 text-sidebar-primary" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">ClearanceScore</span>
            <span className="text-[11px] text-sidebar-foreground/55">IP risk triage</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workflow</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={item.testId}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <p className="text-[11px] leading-snug text-sidebar-foreground/50">
          Automated triage only. Not legal advice.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
