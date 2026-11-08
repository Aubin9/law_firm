/**
 * Self-hosted font configuration (DESIGN.md Section 2.2)
 *
 * No external font CDNs (Google Fonts, etc.) are ever used.
 * Drop the following files into `public/fonts/`:
 *   - Inter-Variable.woff2
 *   - SourceSerif4-Variable.woff2
 *   - JetBrainsMono-Variable.woff2
 *
 * If using `next/font/local` directly after placing the `.woff2` files:
 *
 * import localFont from "next/font/local";
 * export const inter = localFont({
 *   src: "../../public/fonts/Inter-Variable.woff2",
 *   variable: "--font-inter",
 *   weight: "400 600",
 *   display: "swap",
 * });
 */

export const fontVariablesClassName = "font-sans antialiased";

