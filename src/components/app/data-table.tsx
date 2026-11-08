"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  Search,
  ChevronLeft,
  ChevronRight,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "./empty-state";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  skeletonRowCount?: number;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  enableColumnMenu?: boolean;
  enableDensityToggle?: boolean;
  defaultDensity?: "comfortable" | "compact";
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  renderMobileCard?: (row: TData) => React.ReactNode;
  toolbarActions?: React.ReactNode;
  locale?: "fr" | "en";
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  skeletonRowCount = 5,
  searchPlaceholder,
  enableSearch = true,
  enableColumnMenu = true,
  enableDensityToggle = true,
  defaultDensity = "comfortable",
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  renderMobileCard,
  toolbarActions,
  locale = "fr",
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [density, setDensity] = React.useState<"comfortable" | "compact">(
    defaultDensity,
  );
  const [columnMenuOpen, setColumnMenuOpen] = React.useState(false);
  const columnMenuRef = React.useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(e.target as Node)
      ) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultSearchPlaceholder =
    locale === "en" ? "Filter records..." : "Filtrer les éléments...";
  const defaultEmptyTitle =
    locale === "en" ? "No records found" : "Aucun élément trouvé";
  const defaultEmptyDesc =
    locale === "en"
      ? "There are no items matching your current criteria."
      : "Aucun enregistrement ne correspond aux critères sélectionnés.";

  const rowHeightClass =
    density === "compact" ? "h-[36px] py-1.5" : "h-[44px] py-2.5";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar */}
      {(enableSearch ||
        enableColumnMenu ||
        enableDensityToggle ||
        toolbarActions) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {enableSearch ? (
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder ?? defaultSearchPlaceholder}
                aria-label={searchPlaceholder ?? defaultSearchPlaceholder}
                className="flex min-h-[40px] w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-1.5 text-body-sm text-foreground shadow-card placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex flex-wrap items-center gap-2">
            {toolbarActions}

            {enableDensityToggle && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDensity((prev) =>
                    prev === "comfortable" ? "compact" : "comfortable",
                  )
                }
                aria-label={
                  locale === "en"
                    ? `Switch row density (current: ${density})`
                    : `Changer la densité d'affichage (actuel : ${density})`
                }
                title={
                  locale === "en"
                    ? "Toggle comfortable / compact density"
                    : "Basculer densité confortable / compacte"
                }
              >
                <Rows3 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {density === "compact"
                    ? locale === "en"
                      ? "Compact"
                      : "Compact"
                    : locale === "en"
                      ? "Comfortable"
                      : "Confortable"}
                </span>
              </Button>
            )}

            {enableColumnMenu && (
              <div ref={columnMenuRef} className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setColumnMenuOpen((prev) => !prev)}
                  aria-expanded={columnMenuOpen}
                  aria-haspopup="menu"
                >
                  <Columns3 className="h-4 w-4" aria-hidden="true" />
                  <span>{locale === "en" ? "Columns" : "Colonnes"}</span>
                </Button>

                {columnMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-30 mt-1.5 w-52 rounded-lg border border-border bg-surface p-2 shadow-popover"
                  >
                    <p className="px-2 py-1 text-caption font-semibold text-muted-foreground">
                      {locale === "en"
                        ? "Visible columns"
                        : "Colonnes affichées"}
                    </p>
                    <div className="mt-1 space-y-1">
                      {table
                        .getAllLeafColumns()
                        .filter((col) => col.getCanHide())
                        .map((column) => (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm text-foreground hover:bg-surface-muted"
                          >
                            <input
                              type="checkbox"
                              checked={column.getIsVisible()}
                              onChange={column.getToggleVisibilityHandler()}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                            />
                            <span className="truncate capitalize">
                              {typeof column.columnDef.header === "string"
                                ? column.columnDef.header
                                : column.id}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-card">
          <div className="border-b border-border bg-surface-muted px-4 py-3">
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: skeletonRowCount }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 rounded-chip" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      ) : table.getRowModel().rows.length === 0 ? (
        <EmptyState
          title={emptyTitle ?? defaultEmptyTitle}
          description={emptyDescription ?? defaultEmptyDesc}
          action={emptyAction}
        />
      ) : (
        <>
          {/* Mobile Stacked Cards (< md) when renderMobileCard is provided, or responsive table */}
          {renderMobileCard && (
            <div className="space-y-2.5 md:hidden">
              {table.getRowModel().rows.map((row) => (
                <div
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(
                    "rounded-lg border border-border bg-surface p-4 shadow-card transition-colors",
                    onRowClick && "cursor-pointer hover:border-primary/40",
                  )}
                >
                  {renderMobileCard(row.original)}
                </div>
              ))}
            </div>
          )}

          {/* Desktop & Tablet Table */}
          <div
            className={cn(
              "overflow-x-auto rounded-lg border border-border bg-surface shadow-card",
              renderMobileCard && "hidden md:block",
            )}
          >
            <table className="w-full border-collapse text-left text-body-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-muted text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          className="px-4 py-3 font-semibold whitespace-nowrap"
                        >
                          {header.isPlaceholder ? null : canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1.5 text-left font-semibold text-muted-foreground hover:text-primary transition-colors"
                            >
                              <span>
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                              </span>
                              {sorted === "asc" ? (
                                <ArrowUp
                                  className="h-3.5 w-3.5 text-primary"
                                  aria-hidden="true"
                                />
                              ) : sorted === "desc" ? (
                                <ArrowDown
                                  className="h-3.5 w-3.5 text-primary"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArrowUpDown
                                  className="h-3.5 w-3.5 opacity-50"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onRowClick(row.original);
                      }
                    }}
                    className={cn(
                      "transition-colors hover:bg-surface-muted/60",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("px-4 align-middle", rowHeightClass)}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-caption text-muted-foreground">
            <div>
              {locale === "en"
                ? `Showing ${table.getRowModel().rows.length} of ${table.getFilteredRowModel().rows.length} record(s)`
                : `${table.getRowModel().rows.length} sur ${table.getFilteredRowModel().rows.length} élément(s)`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={
                  locale === "en" ? "Previous page" : "Page précédente"
                }
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>{locale === "en" ? "Previous" : "Précédent"}</span>
              </Button>
              <span className="font-mono tabular-nums px-2">
                {table.getState().pagination.pageIndex + 1} /{" "}
                {Math.max(1, table.getPageCount())}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={locale === "en" ? "Next page" : "Page suivante"}
              >
                <span>{locale === "en" ? "Next" : "Suivant"}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
