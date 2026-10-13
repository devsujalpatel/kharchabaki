"use client";

import {
  Check,
  Flower2,
  Loader2,
  Moon,
  Palette,
  RotateCw,
  Sun,
  Sunset,
  TreePine,
  Waves,
} from "lucide-react";
import {
  currencies,
  currencyLabel,
  themes,
  palettes,
  formatLabel,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";

const themeIcons = {
  light: Sun,
  dark: Moon,
  ocean: Waves,
  forest: TreePine,
  sunset: Sunset,
  rose: Flower2,
};

export function PreferencesSettings() {
  const { currency, theme, save, saving, loading, error, retry } =
    usePreferences();
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Palette className="size-4 text-primary" />
          Preferences
        </h2>
        {saving && (
          <Loader2
            className="size-4 animate-spin text-primary"
            role="status"
            aria-label="Saving preferences"
          />
        )}
      </div>
      {loading ? (
        <div
          className="mt-4 h-11 animate-pulse rounded-xl bg-muted"
          role="status"
          aria-label="Loading preferences"
        />
      ) : (
        <>
          <label className="mt-5 block space-y-2">
            <span className="text-sm font-medium">Currency</span>
            <select
              aria-label="Default currency"
              disabled={saving}
              value={currency}
              onChange={(event) => save({ currency: event.target.value })}
              className="block h-11 w-full min-w-0 rounded-xl border border-input bg-background/40 px-3 text-sm"
            >
              {currencies.map((code) => (
                <option value={code} key={code}>
                  {currencyLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Display currency; existing amounts stay the same.
          </p>
          <p className="mb-3 mt-5 text-sm font-medium">Theme</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {themes.map((option) => {
              const Icon = themeIcons[option];
              return (
                <button
                  key={option}
                  type="button"
                  disabled={saving}
                  onClick={() => save({ theme: option })}
                  aria-pressed={theme === option}
                  aria-label={`${formatLabel(option)} theme`}
                  className={cn(
                    "relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-xs transition hover:opacity-90 disabled:opacity-50",
                    theme === option &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                  style={{
                    backgroundColor: palettes[option].background,
                    color: palettes[option].foreground,
                    borderColor: palettes[option].border,
                  }}
                >
                  <Icon
                    className="size-5"
                    style={{ color: palettes[option].primary }}
                  />
                  <span className="truncate">{formatLabel(option)}</span>
                  {theme === option && (
                    <Check
                      className="absolute right-1.5 top-1.5 size-3"
                      style={{ color: palettes[option].primary }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
      {error && (
        <div className="mt-4 flex items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 text-xs text-destructive">
            {error.message}
          </p>
          <Button
            variant="outline"
            size="icon"
            aria-label="Reload preferences"
            title="Retry"
            onClick={() => retry()}
            className="size-10 shrink-0 rounded-xl"
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
