# Tooling security and upstream compatibility

The npm overrides select upstream minimatch 11.0.5 only for the affected
7–10 majors, and glob 14.0.4 only for the affected 9–14.0.1 majors. Older
consumers are unchanged. These address GHSA-g3hv-75wg-m249 and
GHSA-3g3m-2fjr-6pw4 without modifying dependency files after installation.

Minimatch 11 removes regex APIs. `eslint-plugin-import-x` 4.18.0 explicitly
supports that major; 4.17.1 does not. Keep the compatible parent update together
with the lockfile/overrides. Version 4.18.0 satisfies this project's existing
three-day release-age policy. Do not disable that policy to select a newer patch.

Validation includes the configured ESLint file selection (1,833 tracked files),
TypeScript/ESLint without cache, real icon generation, application/transport tests
and the Vercel preview before production. Icon glyphs, mappings and font binaries
must stay identical; locally regenerated cache-busting hashes can differ because
the generator hashes source bytes and Windows checks out CRLF.

Remove the overrides when upstream parent ranges admit the patched versions,
after rechecking both the resolved graph and these tool contracts.

## Remaining upstream issues (11 November 2026)

`rollup-plugin-bundle-stats` / `@bundle-stats/cli-utils` still require stream-json
1.x, even in the latest 4.23.1. The fixed stream-json 3.6+ has a different ESM /
assembler API, so a forced version override would break the build report plugin.
The three moderate advisories remain visible. This chain is development-only,
for bundle reports; it is not included in the browser application. Preserve the
HTML/JSON reports and baseline comparison when migrating to a supported adapter.
Do not remove those capabilities or suppress advisories to get a zero count.

The desktop-only GTK3 chain uses glib 0.18.5. GHSA-wrw7-89jp-8q8g is fixed in
glib 0.20+, which is not a drop-in replacement for that dependency graph. The
web deployment does not build or ship Rust/GTK. Desktop publishing remains
disabled; any re-enablement requires an upstream-compatible desktop migration
and platform checks. No Rust warning is treated as resolved by this web update.

Sources: https://github.com/advisories/GHSA-g3hv-75wg-m249,
https://github.com/advisories/GHSA-3g3m-2fjr-6pw4,
https://github.com/advisories/GHSA-mjw6-4jj6-33hc,
https://github.com/advisories/GHSA-wrw7-89jp-8q8g.
