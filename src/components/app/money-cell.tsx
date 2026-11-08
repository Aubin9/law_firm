import * as React from "react";
import { cn } from "@/lib/utils";

export function formatMoney(
  amount: number | string | null | undefined,
  currency = "XAF",
  locale: "fr" | "en" = "fr",
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "-";
  }

  const numericValue =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;

  if (Number.isNaN(numericValue)) {
    return "-";
  }

  const isZeroDecimals = currency.toUpperCase() === "XAF";
  const formattedNumber = new Intl.NumberFormat(
    locale === "en" ? "en-US" : "fr-FR",
    {
      minimumFractionDigits: isZeroDecimals ? 0 : 2,
      maximumFractionDigits: isZeroDecimals ? 0 : 2,
    },
  ).format(isZeroDecimals ? Math.round(numericValue) : numericValue);

  return `${formattedNumber} ${currency.toUpperCase()}`;
}

export interface MoneyCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | string | null | undefined;
  currency?: string;
  locale?: "fr" | "en";
  tone?: "default" | "positive" | "danger" | "muted";
  align?: "right" | "left";
}

export function MoneyCell({
  amount,
  currency = "XAF",
  locale = "fr",
  tone = "default",
  align = "right",
  className,
  ...props
}: MoneyCellProps) {
  const formatted = formatMoney(amount, currency, locale);

  return (
    <span
      className={cn(
        "inline-block font-mono text-body-sm tabular-nums whitespace-nowrap",
        align === "right" ? "w-full text-right" : "text-left",
        tone === "default" && "font-medium text-foreground",
        tone === "positive" && "font-semibold text-success",
        tone === "danger" && "font-semibold text-danger",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
      {...props}
    >
      {formatted}
    </span>
  );
}
