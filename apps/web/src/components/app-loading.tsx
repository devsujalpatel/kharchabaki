import { Wallet } from "lucide-react";
export function AppLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading your finances"
      className={`flex flex-col items-center justify-center bg-background ${compact ? "min-h-64 py-12" : "min-h-svh"}`}
    >
      <div className="relative mb-7 flex size-20 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 shadow-[0_0_60px_-15px_var(--primary)]">
        <Wallet className="size-9 text-primary" />
        <div className="absolute -inset-3 animate-pulse rounded-[2rem] border border-primary/10 motion-reduce:animate-none" />
      </div>
      <p className="text-xl font-semibold tracking-tight">kharchabaki</p>
      <p className="mt-2 text-sm text-muted-foreground">
        A little clarity for your money.
      </p>
      <div className="mt-7 flex items-end gap-1.5" aria-hidden="true">
        {[12, 20, 28, 18, 24].map((height, index) => (
          <span
            key={index}
            className="w-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
            style={{ height, animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">Opening your dashboard…</span>
    </div>
  );
}
