import { NavigationBreadcrumb } from "@/components/dahboard/breadcrumb";
import { Navbar } from "@/components/dahboard/navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-2">
      <Navbar />
      <NavigationBreadcrumb />
      <div className="mt-6">{children}</div>
    </main>
  );
}
