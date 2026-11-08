/**
 * Pure, locale-aware formatting utilities (CLAUDE.md Section 11, DESIGN.md Section 2.1)
 *
 * - Locale: 'fr' (default) or 'en'
 * - Timezone: Africa/Douala (UTC+1, WAT)
 * - Currency: XAF (Central African CFA Franc, no decimals)
 */

export const DEFAULT_LOCALE = "fr";
export const DEFAULT_TIMEZONE = "Africa/Douala";
export const DEFAULT_CURRENCY = "XAF";

export function formatLegalDate(
  value: Date | string | number | null | undefined,
  locale: "fr" | "en" = "fr",
  includeTime = false,
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const langTag = locale === "en" ? "en-GB" : "fr-FR";

  try {
    const datePart = new Intl.DateTimeFormat(langTag, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: DEFAULT_TIMEZONE,
    }).format(date);

    if (!includeTime) return datePart;

    const timePart = new Intl.DateTimeFormat(langTag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: DEFAULT_TIMEZONE,
    }).format(date);

    return `${datePart} · ${timePart}`;
  } catch {
    // Graceful fallback if ICU data is incomplete
    return "—";
  }
}

export function formatLegalTime(
  value: Date | string | number | null | undefined,
  locale: "fr" | "en" = "fr",
): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const langTag = locale === "en" ? "en-GB" : "fr-FR";

  try {
    return new Intl.DateTimeFormat(langTag, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: DEFAULT_TIMEZONE,
    }).format(date);
  } catch {
    return "—";
  }
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency = DEFAULT_CURRENCY,
  locale: "fr" | "en" = "fr",
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const numericValue =
    typeof amount === "string" ? Number.parseFloat(amount) : amount;

  if (Number.isNaN(numericValue)) {
    return "—";
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

export function formatNumber(
  value: number | string | null | undefined,
  locale: "fr" | "en" = "fr",
  decimals = 0,
): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";

  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
