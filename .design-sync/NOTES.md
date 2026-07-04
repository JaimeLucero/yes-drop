# Design-sync notes — YesDrop UI kit

Scope: the shadcn-style UI primitives in `frontend/src/components/ui/` only (9 components:
Button, Badge, Input, Label, Textarea, Calendar, Card, Dialog, AlertDialog). App-coupled
components (dashboard/requests/reminders/modals) are intentionally excluded — they depend on
Supabase, react-query, and next/navigation and won't render standalone.

## Build setup (this is an app repo, not a packaged design system)

- **No dist / no published entry.** Discovery is driven by `cfg.componentSrcMap` (pins the 9
  primaries + their src paths); the esbuild bundle is built from a hand-written barrel,
  `frontend/_ds-entry.ts` (re-exports the 9 UI files → `window.YesDrop`). Pass it via
  `--entry ./frontend/_ds-entry.ts`. This also makes `PKG_DIR` resolve to `frontend/` (the
  entry-walk finds `frontend/package.json`, name `yesdrop`).
- **Do NOT self-symlink the package into its own node_modules** (`frontend/node_modules/yesdrop`
  → `..`). It's cyclic (frontend contains node_modules) and sends the converter's `walk()` into
  infinite recursion → V8 stack overflow. The `--entry` barrel is the correct way to resolve
  `PKG_DIR`.
- `--node-modules frontend/node_modules`; `cfg.tsconfig: tsconfig.json` (resolves the `@/*`
  alias the components import through).

## CSS — Tailwind v4 must be compiled to a static stylesheet

The styling is Tailwind v4 **source** (`@import "tailwindcss"` in globals.css), not a shipped
stylesheet. Before each build, compile it:

```sh
cd frontend
TWV=$(node -p "require('./node_modules/tailwindcss/package.json').version")
npx --yes @tailwindcss/cli@$TWV -i .ds-tw-input.css -o .design-sync-tw.css --minify
```

- `frontend/.ds-tw-input.css` imports the app's real `src/app/globals.css` + `@source` globs for
  the UI components and `.design-sync/previews/` (so preview-only utility classes compile).
  `cfg.cssEntry` points at the compiled `.design-sync-tw.css`.

## Dark-theme `.dark {` selector — FIXED (was a pre-existing repo bug)

`frontend/src/app/globals.css` previously had its dark-theme token block floating with **no
`.dark {` opener** (after `:root` closed ~line 97), so Next's PostCSS silently dropped those
declarations and **dark mode was dead**, and the standalone Tailwind CLI errored
(`CssSyntaxError: Missing opening {`). Fixed 2026-07-04 by inserting `.dark {` at line 99 (committed
alongside this sync). The earlier workaround (compiling against a repaired copy `.ds-globals-fixed.css`)
is no longer needed and was removed. If a future globals.css edit re-breaks the block, the CLI will
error again — restore the `.dark {` opener.

## Fonts

The app loads Geist / Geist Mono / Outfit / IBM Plex Sans via `next/font` (injects `--font-*`
at runtime). The standalone bundle has no next/font, so `.design-sync/ds-fonts.css` defines those
CSS vars and pulls the families from Google Fonts (imported into the TW compile). Validate reports
`[FONT_REMOTE]` (loads at runtime) — accepted.

## Known render warns (checked, benign — do not chase)

- `[RENDER_THIN]` on **Dialog** and **AlertDialog**: "rendered height 0px". Base UI dialogs use
  `position: fixed` popups portaled to body, which measure 0 in the flow. The screenshots show both
  rendering correctly (centered, styled, buttons present). Both cells grade `good`.
- `[TOKENS_MISSING] --tw`: Tailwind internal placeholder, not a real token. Ignore.

## Re-sync risks (what can silently go stale)

- **`.design-sync-tw.css` is a generated build input, not committed** — regenerate it (compile
  command above) before every build. If globals.css changes tokens, the compiled CSS must be
  regenerated or cards ship stale colors.
- **Fonts are remote** — if the design runtime blocks the Google Fonts host, cards fall back to
  system sans. Consider self-hosting woff2 via `cfg.extraFonts` if that happens.
- **Barrel `frontend/_ds-entry.ts`** must list every UI file you want bundled; a new primitive
  needs adding both here and to `cfg.componentSrcMap`.
