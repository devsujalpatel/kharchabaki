"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Receipt, User, Settings, LogOut } from "lucide-react";

import { authClient } from "@/lib/auth-client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: Receipt,
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

  return (
    <div className="sticky top-0 z-50  pt-4 ">
      <header
        className="
          mx-auto flex h-14 max-w-6xl items-center
          rounded-2xl border border-border/50
          bg-background/70 px-2
          shadow-lg shadow-black/5
          backdrop-blur-xl
          supports-backdrop-filter:bg-background/50
        "
      >
        {/* Brand */}

        <Logo className="scale-90" href="/dashboard" isTitle={false} />

        {/* Navigation */}
        <nav className="flex items-center gap-1 ml-2">
          {navigation.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Button
                key={item.href}
                variant="ghost"
                size="sm"
                className={`
                  h-9 rounded-xl px-2
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-muted text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Link
                  href={item.href}
                  prefetch
                  className="flex items-center justify-center gap-1"
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* User */}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                className="
                  size-10 rounded-xl p-1
                  transition-all duration-200
                  hover:bg-muted
                "
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
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="
                w-60 rounded-2xl
                border-border/50
                bg-background/80
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
                  className="w-full flex h-6 items-center gap-1"
                >
                  <User className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem className="rounded-xl">
                <Link
                  href="/dashboard/settings"
                  className="w-full flex h-6 items-center gap-1"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-2" />

              <DropdownMenuItem
                className="
                  rounded-xl text-destructive
                  focus:bg-destructive/10
                  focus:text-destructive h-8 cursor-pointer flex items-center gap-1
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
  );
}
