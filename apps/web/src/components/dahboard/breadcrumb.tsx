"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const NavigationBreadcrumb = () => {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);

  const currentPage = segments.at(-1);

  const pageName =
    currentPage
      ?.replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()) ?? "Dashboard";

  if (pageName === "Dashboard") {
    return;
  }

  return (
    <div className="flex items-center mt-2">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          aria-label="Go back to dashboard"
          className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </Link>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>

            {pathname !== "/dashboard" && (
              <>
                <BreadcrumbSeparator />

                <BreadcrumbItem>
                  <BreadcrumbPage>{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
};
