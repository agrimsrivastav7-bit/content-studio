"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, CheckSquare, ShieldCheck, PenTool, Search, Settings, Database, Activity } from "lucide-react";
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

const items = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Knowledge Base",
    url: "/knowledge",
    icon: Database,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: Activity,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="h-16 flex flex-row items-center justify-start px-6 border-b">
        <span className="font-bold text-lg tracking-tight">Content <span className="font-light text-muted-foreground">Studio</span></span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton isActive={isActive} render={<Link href={item.url} />}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-sidebar-accent rounded-md transition-colors">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Settings</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
