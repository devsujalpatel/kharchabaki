"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  User,
  LogOut,
  HandCoins,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/logo";

const navigation = [
  {
    label: "Home",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: Receipt,
  },
  {
    label: "Loans",
    href: "/dashboard/loans",
    icon: HandCoins,
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const { data: session } = authClient.useSession();
  const user = session?.user;

  const initials =
    user?.name
      ?.split(" ")
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/auth/signin");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      {/* ==================== DESKTOP ==================== */}
      <div className="fixed inset-x-0 top-0 z-50 hidden pt-4 sm:block">
        <header
          className="
            mx-auto flex h-14 max-w-6xl items-center
            rounded-2xl border border-border/50
            bg-background/75 px-2
            shadow-lg shadow-black/5
            backdrop-blur-xl
            supports-[backdrop-filter]:bg-background/60
          "
        >
          {/* Brand */}
          <Logo className="scale-90" href="/dashboard" isTitle={false} />

          {/* Navigation */}
          <nav className="ml-2 flex items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`
                    inline-flex h-9 items-center justify-center
                    gap-1.5 rounded-xl px-3
                    text-sm font-medium
                    transition-colors
                    ${
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }
                  `}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop User */}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="
                  flex size-10 items-center justify-center
                  rounded-xl p-1
                  transition-colors
                  hover:bg-muted
                  focus:outline-none
                "
                aria-label="Open user menu"
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage
                    src={user?.image ?? undefined}
                    alt={user?.name ?? "User"}
                    className="rounded-lg"
                  />

                  <AvatarFallback className="rounded-lg text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="
                  w-60 rounded-2xl
                  border-border/50
                  bg-background/90
                  p-2 shadow-xl
                  backdrop-blur-xl
                "
              >
                {/* User info */}
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="size-9 rounded-xl">
                    <AvatarImage
                      src={user?.image ?? undefined}
                      alt={user?.name ?? "User"}
                      className="rounded-xl"
                    />

                    <AvatarFallback className="rounded-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user?.name}</p>

                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem className="rounded-xl">
                  <Link
                    href="/dashboard/profile"
                    className="flex h-8 w-full items-center gap-2"
                  >
                    <User className="size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2" />

                <DropdownMenuItem
                  className="
                    h-8 cursor-pointer rounded-xl
                    text-destructive
                    focus:bg-destructive/10
                    focus:text-destructive
                  "
                  onClick={handleSignOut}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      </div>

      {/* ==================== MOBILE ==================== */}
      <nav
        className="
          fixed inset-x-0 bottom-0 z-50
          border-t border-border/50
          bg-background/85
          pb-[env(safe-area-inset-bottom)]
          backdrop-blur-2xl
          supports-backdrop-filter:bg-background/70
          sm:hidden
        "
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-4 px-2">
          {/* Home */}
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={`
                  relative flex flex-col items-center justify-center
                  gap-1 rounded-xl
                  text-[11px] font-medium
                  transition-colors
                  ${active ? "text-foreground" : "text-muted-foreground"}
                `}
              >
                <span
                  className={`
                    flex size-8 items-center justify-center
                    rounded-xl
                    transition-all
                    ${active ? "bg-primary/10" : "bg-transparent"}
                  `}
                >
                  <Icon
                    className={`
                      size-5.25
                      transition-transform
                      ${active ? "stroke-[2.2]" : "stroke-[1.8]"}
                    `}
                  />
                </span>

                <span>{item.label}</span>

                {active && (
                  <span
                    className="
                      absolute bottom-0
                      h-0.5 w-6
                      rounded-full bg-primary
                    "
                  />
                )}
              </Link>
            );
          })}

          {/* Profile */}
          <Link
            href="/dashboard/profile"
            prefetch
            className={`
              relative flex flex-col items-center justify-center
              gap-1 rounded-xl
              text-[11px] font-medium
              transition-colors
              ${
                isActive("/dashboard/profile")
                  ? "text-foreground"
                  : "text-muted-foreground"
              }
            `}
          >
            <span
              className={`
                flex size-8 items-center justify-center
                rounded-xl
                transition-all
                ${
                  isActive("/dashboard/profile")
                    ? "bg-primary/10"
                    : "bg-transparent"
                }
              `}
            >
              <Avatar className="size-6 rounded-lg">
                <AvatarImage
                  src={user?.image ?? undefined}
                  alt={user?.name ?? "User"}
                  className="rounded-lg"
                />

                <AvatarFallback className="rounded-lg text-[9px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </span>

            <span>Profile</span>

            {isActive("/dashboard/profile") && (
              <span
                className="
                  absolute bottom-0
                  h-0.5 w-6
                  rounded-full bg-primary
                "
              />
            )}
          </Link>
        </div>
      </nav>
    </>
  );
}
