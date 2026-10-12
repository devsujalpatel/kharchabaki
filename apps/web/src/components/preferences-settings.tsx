"use client";
import {
  currencies,
  currencyLabel,
  themes,
  palettes,
  formatLabel,
} from "@/lib/finance";
import { usePreferences } from "@/components/providers/preferences-provider";
import { Button } from "@/components/ui/button";
export function PreferencesSettings() {
  const { currency, theme, save, saving, loading, error, retry } =
    usePreferences();
  return (
    <section className="mt-6 rounded-2xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Preferences</h2>
      {loading ? (
        <p className="mt-3 text-muted-foreground">Loading preferences...</p>
      ) : (
        <>
          <label className="mt-4 block space-y-2">
            <span className="font-medium">Default currency</span>
            <select
              aria-label="Default currency"
              disabled={saving}
              value={currency}
              onChange={(event) => save({ currency: event.target.value })}
              className="block h-10 w-full rounded-lg border bg-card px-3"
            >
              {currencies.map((code) => (
                <option value={code} key={code}>
                  {currencyLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            Applies to all amounts. Changing currency does not convert existing
            values.
          </p>
          <p className="mb-3 mt-5 font-medium">Theme</p>
          <div className="flex flex-wrap gap-3">
            {themes.map((option) => (
              <Button
                key={option}
                disabled={saving}
                variant="outline"
                onClick={() => save({ theme: option })}
                aria-pressed={theme === option}
                className={
                  theme === option ? "border-primary ring-1 ring-primary" : ""
                }
              >
                <span
                  style={{
                    backgroundColor: palettes[option].background,
                    borderColor: palettes[option].primary,
                  }}
                  className="size-5 rounded-full border-[3px]"
                />
                {formatLabel(option)}
                {theme === option && " ✓"}
              </Button>
            ))}
          </div>
        </>
      )}
      {saving && (
        <p className="mt-3 text-sm text-muted-foreground">
          Saving preferences...
        </p>
      )}
      {error && (
        <div className="mt-3">
          <p role="alert" className="text-destructive">
            {error.message}
          </p>
          <Button className="mt-2" variant="outline" onClick={() => retry()}>
            Reload preferences
          </Button>
        </div>
      )}
    </section>
  );
}
