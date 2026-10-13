"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { FormDialog } from "@/components/ui/form-dialog";
import { Button } from "@/components/ui/button";

const months = Array.from({ length: 12 }, (_, index) => ({
  number: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2024, index, 1))),
}));

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
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(selected.slice(0, 4)));

  function choose(value: string) {
    onChange(value);
    setOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-xl bg-card"
          aria-label="Previous month"
          title="Previous month"
          disabled={selected === "1900-01"}
          onClick={() => onChange(shiftMonth(selected, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-w-0 flex-1 gap-2 rounded-xl bg-card px-3"
          aria-label={`Select month: ${month ? monthLabel(month) : "All history"}`}
          aria-haspopup="dialog"
          onClick={() => {
            setYear(Number(selected.slice(0, 4)));
            setOpen(true);
          }}
        >
          {month ? (
            <CalendarDays className="size-4 shrink-0 text-primary" />
          ) : (
            <History className="size-4 shrink-0 text-primary" />
          )}
          <span className="min-w-0 truncate text-sm font-medium">
            {month ? monthLabel(month) : "All history"}
          </span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-xl bg-card"
          aria-label="Next month"
          title="Next month"
          disabled={selected === "9999-12"}
          onClick={() => onChange(shiftMonth(selected, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      {open && (
        <FormDialog
          title="Choose month"
          icon={CalendarDays}
          onClose={() => setOpen(false)}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-xl"
                aria-label="Previous year"
                title="Previous year"
                disabled={year <= 1900}
                onClick={() => setYear(year - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p
                className="text-lg font-semibold tabular-nums"
                aria-live="polite"
              >
                {year}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-xl"
                aria-label="Next year"
                title="Next year"
                disabled={year >= 9999}
                onClick={() => setYear(year + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
              aria-label={`Months in ${year}`}
            >
              {months.map((option) => {
                const value = `${year}-${option.number}`;
                return (
                  <Button
                    key={option.number}
                    type="button"
                    variant={month === value ? "default" : "ghost"}
                    aria-label={monthLabel(value)}
                    aria-pressed={month === value}
                    onClick={() => choose(value)}
                    className={cn(
                      "h-12 rounded-xl border border-transparent text-sm",
                      month === value &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      month !== value &&
                        value === currentMonth() &&
                        "border-primary/30 text-primary",
                    )}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
            <div
              className={cn(
                "grid gap-2 border-t pt-4",
                allowAll && "grid-cols-2",
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => choose(currentMonth())}
              >
                <CalendarDays className="size-4" />
                This month
              </Button>
              {allowAll && (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-11 rounded-xl",
                    !month && "border-primary/30 bg-primary/10 text-primary",
                  )}
                  onClick={() => choose("")}
                >
                  <History className="size-4" />
                  All history
                </Button>
              )}
            </div>
          </div>
        </FormDialog>
      )}
    </>
  );
}
