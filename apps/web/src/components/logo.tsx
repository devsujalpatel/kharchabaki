"use client";
import { IndianRupee } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  isTitle = true,
}: {
  className?: string;
  href?: string;
  isTitle?: boolean;
}) {
  return (
    <Link
      href={`${href}`}
      className={cn("flex items-center gap-2.5", className)}
    >
      <div className="grid size-9 place-items-center rounded-xl bg-[#cbff3d] text-[#141713] shadow-[0_0_0_4px_rgba(203,255,61,.12)]">
        <IndianRupee className={cn("size-5 stroke-[2.6]")} />
      </div>
      <span className={cn("text-[17px] font-semibold tracking-tighter text-white", `${isTitle ? "" : "hidden"}`) }>
        kharcha<span className="text-[#cbff3d]">baki</span>
      </span>
    </Link>
  );
}
