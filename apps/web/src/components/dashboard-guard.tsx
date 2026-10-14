"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppSession } from "@/components/providers/session-provider";
import { AppLoading } from "@/components/app-loading";
export function DashboardGuard({ children }: { children: ReactNode }) {
  const session = useAppSession();
  const router = useRouter();
  useEffect(() => {
    if (!session.isPending && !session.isVerifying && !session.data)
      router.replace(
        session.reason === "expired"
          ? "/auth/signin?reason=expired"
          : "/auth/signin",
      );
  }, [
    session.isPending,
    session.isVerifying,
    session.data,
    session.reason,
    router,
  ]);
  if (session.isPending || !session.data) return <AppLoading />;
  return children;
}
