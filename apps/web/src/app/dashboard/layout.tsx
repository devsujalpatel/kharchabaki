import { SyncStatus } from "@/components/sync-status";
import { DashboardGuard } from "@/components/dashboard-guard";
import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { NavigationBreadcrumb } from "@/components/dahboard/breadcrumb";
import { Navbar } from "@/components/dahboard/navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <PreferencesProvider>
        <main className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 sm:pt-20">
          <Navbar />
          <NavigationBreadcrumb />
          <div className="mt-5">
            <SyncStatus />
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </PreferencesProvider>
    </DashboardGuard>
  );
}
