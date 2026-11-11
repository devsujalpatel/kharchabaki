"use client";

import { createElement, useId, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { categoryIcon, formatLabel } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function CategoryPicker({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((option) =>
    formatLabel(option).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-2">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-full items-center gap-2 rounded-xl border border-input bg-background/40 px-3 text-left text-sm transition hover:bg-muted disabled:opacity-50"
      >
        {createElement(categoryIcon(value), {
          className: "size-4 shrink-0 text-primary",
        })}
        <span
          id={`${id}-value`}
          className={cn(
            "min-w-0 flex-1 truncate",
            !value && "text-muted-foreground",
          )}
        >
          {value ? formatLabel(value) : `Choose ${label.toLowerCase()}`}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={id} className="rounded-2xl border bg-background/40 p-2">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label={`Search ${label.toLowerCase()}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          <div
            className="grid max-h-64 grid-cols-3 gap-1 overflow-y-auto overscroll-contain"
            aria-label={label}
          >
            {filtered.map((option) => {
              const OptionIcon = categoryIcon(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  aria-pressed={value === option}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl p-2 text-center text-xs transition hover:bg-muted",
                    value === option &&
                      "bg-primary/10 font-semibold text-primary",
                  )}
                >
                  <OptionIcon className="size-4 shrink-0" />
                  <span
                    className="min-w-0 max-w-full truncate"
                    title={formatLabel(option)}
                  >
                    {formatLabel(option)}
                  </span>
                  {value === option && (
                    <Check className="absolute right-1 top-1 size-3" />
                  )}
                </button>
              );
            })}
            {!filtered.length && (
              <p className="col-span-2 py-4 text-center text-xs text-muted-foreground">
                No matches
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
