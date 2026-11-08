# Self-Hosted Fonts (`next/font/local`)

In compliance with `CLAUDE.md` (Section 6, Rule 11) and `DESIGN.md` (Section 2.2), **no external font CDNs (such as Google Fonts) are permitted**. All typography assets are self-hosted from this directory.

## Required Font Files

Drop the following `.woff2` variable or static font files into `public/fonts/`:

1. **Inter (UI & Tabular Numbers)**
   - `public/fonts/Inter-Variable.woff2` (weights `400`, `500`, `600`)
2. **Source Serif 4 (Executive Display — Dashboard & Login Headings)**
   - `public/fonts/SourceSerif4-Variable.woff2` (weights `400`, `600`)
3. **JetBrains Mono (Case Numbers, Matter References, IDs, Hashes)**
   - `public/fonts/JetBrainsMono-Variable.woff2` (weights `400`, `500`, `600`)

## How They Are Loaded

- `@font-face` declarations in `src/app/globals.css` and font definitions in `src/lib/fonts.ts` reference these local files and expose `--font-inter`, `--font-source-serif`, and `--font-jetbrains-mono`.
- Until the `.woff2` files are placed in this folder, the platform gracefully falls back to local system equivalents without making any external network requests.

