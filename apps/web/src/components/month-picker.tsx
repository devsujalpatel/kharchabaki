"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, shiftMonth } from "@/lib/finance";
import { Button } from "@/components/ui/button";
export function MonthPicker({
  month,
  onChange,
  allowAll = false,
}: {
  month: string;
  onChange: (month: string) => void;
  allowAll?: boolean;
}) {
  const selected = month || currentMonth();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(shiftMonth(selected, -1))}
      >
        <ChevronLeft />
      </Button>
      <input
        aria-label="Selected month"
        type="month"
        min="1900-01"
        value={month}
        onChange={(event) => {
          if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value))
            onChange(event.target.value);
        }}
        className="h-9 rounded-lg border bg-card px-3 text-foreground [color-scheme:light_dark]"
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => onChange(shiftMonth(selected, 1))}
      >
        <ChevronRight />
      </Button>
      <Button variant="ghost" onClick={() => onChange(currentMonth())}>
        This month
      </Button>
      {allowAll && (
        <Button
          variant={month ? "ghost" : "outline"}
          onClick={() => onChange("")}
        >
          All history
        </Button>
      )}
    </div>
  );
}
