"use client";
import { IndianRupee } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-[#cbff3d] text-[#141713] shadow-[0_0_0_4px_rgba(203,255,61,.12)]">
        <IndianRupee className="size-5 stroke-[2.6]" />
      </div>
      <span className="text-[17px] font-semibold tracking-tighter text-white">
        kharcha<span className="text-[#cbff3d]">baki</span>
      </span>
    </Link>
  );
}
