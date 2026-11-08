"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Search,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string;
  code?: string;
  badge?: string;
}

export interface EntityComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string, option?: ComboboxOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  onCreateNew?: (query: string) => void;
  createNewLabel?: string;
  duplicateWarning?: string | null;
  disabled?: boolean;
  hasError?: boolean;
  id?: string;
  locale?: "fr" | "en";
  className?: string;
}

export function EntityCombobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onCreateNew,
  createNewLabel,
  duplicateWarning,
  disabled = false,
  hasError = false,
  id,
  locale = "fr",
  className,
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.id === value),
    [options, value],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.sublabel?.toLowerCase().includes(q) ||
        opt.code?.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Detect potential duplicate if user types a query matching an existing option
  const detectedDuplicate = React.useMemo(() => {
    if (duplicateWarning) return duplicateWarning;
    const q = query.trim().toLowerCase();
    if (q.length < 3) return null;
    const match = options.find(
      (opt) =>
        opt.label.toLowerCase() === q || opt.label.toLowerCase().includes(q),
    );
    if (!match) return null;
    return locale === "en"
      ? `Similar record exists: "${match.label}"${match.code ? ` (${match.code})` : ""}`
      : `Fiche similaire existante : « ${match.label} »${match.code ? ` (${match.code})` : ""}`;
  }, [duplicateWarning, query, options, locale]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultPlaceholder =
    locale === "en" ? "Select an item..." : "Sélectionner un élément...";
  const defaultSearch =
    locale === "en" ? "Type to filter..." : "Saisir pour filtrer...";
  const defaultEmpty =
    locale === "en" ? "No matching records." : "Aucun résultat trouvé.";
  const defaultCreateNew =
    locale === "en" ? "Create new" : "Créer une nouvelle fiche";

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex min-h-[44px] sm:min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-body-sm shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
          hasError && "border-danger focus-visible:ring-danger",
        )}
      >
        {selectedOption ? (
          <span className="flex items-center gap-2 truncate">
            {selectedOption.code && (
              <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-caption font-medium text-primary border border-border">
                {selectedOption.code}
              </span>
            )}
            <span className="font-medium text-foreground truncate">
              {selectedOption.label}
            </span>
            {selectedOption.sublabel && (
              <span className="text-caption text-muted-foreground truncate">
                - {selectedOption.sublabel}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {placeholder ?? defaultPlaceholder}
          </span>
        )}
        <ChevronsUpDown
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-1.5 w-full rounded-lg border border-border bg-surface shadow-popover">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder ?? defaultSearch}
              aria-label={searchPlaceholder ?? defaultSearch}
              autoFocus
              className="w-full bg-transparent text-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {detectedDuplicate && (
            <div
              role="status"
              className="flex items-center gap-2 border-b border-warning/25 bg-warning-soft px-3 py-2 text-caption text-warning-foreground"
            >
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>{detectedDuplicate}</span>
            </div>
          )}

          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1 divide-y divide-border/50"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-body-sm text-muted-foreground">
                {emptyMessage ?? defaultEmpty}
              </li>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <li key={opt.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.id, opt);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-body-sm transition-colors hover:bg-surface-muted",
                        isSelected &&
                          "bg-primary-soft/60 font-medium text-primary",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {opt.code && (
                            <span className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-caption text-primary border border-border">
                              {opt.code}
                            </span>
                          )}
                          <span className="truncate text-foreground">
                            {opt.label}
                          </span>
                          {opt.badge && (
                            <span className="rounded-chip bg-surface-muted px-2 py-0.5 text-caption text-muted-foreground">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <p className="mt-0.5 truncate text-caption text-muted-foreground">
                            {opt.sublabel}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {onCreateNew && (
            <div className="border-t border-border bg-surface-muted/40 p-1.5">
              <button
                type="button"
                onClick={() => {
                  onCreateNew(query);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-body-sm font-medium text-primary hover:bg-primary-soft transition-colors"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {createNewLabel ?? defaultCreateNew}
                  {query.trim() ? ` « ${query.trim()} »` : ""}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
