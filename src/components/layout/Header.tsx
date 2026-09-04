import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 bg-background">
      <SidebarTrigger />
      <div className="w-full flex justify-between items-center ml-2">
        <h1 className="text-base font-bold tracking-tight text-foreground">Content Studio <span className="font-normal text-muted-foreground text-xs ml-2 hidden sm:inline-block">AI Blog Governance Engine</span></h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>System Active</span>
          </div>
        </div>
      </div>
    </header>
  );
}
