import { Outlet } from "react-router-dom";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { AppSidebar } from "@/shared/components/ui/app-sidebar";
import { SiteHeader } from "@/shared/components/ui/site-header";
import { ImpersonationBanner } from "@/shared/components/ImpersonationBanner";

const RootLayout = () => {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="h-svh min-h-0 overflow-hidden">
        <ImpersonationBanner />
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default RootLayout;
