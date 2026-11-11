# Dependency security update — 11 November 2026

Update Vite/Vitest, undici, source-map-js, fast-uri and ip-address through the
normal npm resolver. The web release remains on Node 24 and the existing Vercel
project. No Telegram session, message, API credential or account setting changes.

The unused reference to missing `tests/init.ts` is removed from Vitest config so
the checked-in security/URL/transport tests can actually execute. Assertions and
test inclusion are preserved.

The standalone `serve` development tool pins compression 1.8.1. A scoped npm
override uses the compatible upstream patch 1.8.2 for the premature-close memory
leak. Remove it when serve publishes a fixed dependency; this does not affect
Vercel's static hosting runtime.

The desktop updater is upgraded together in JavaScript and Rust to 2.14.1.
Its official dependency moves ZIP to major 9, resolving the critical dual-header
archive parsing advisory without forcing a ZIP major into an older updater.
rustls is updated within 0.23. Desktop packaging/signing remains disabled and is
not silently enabled by this web security release.

Residual upstream constraints must remain visible: GTK3's glib 0.18 chain cannot
be substituted with 0.20 without migrating its native parents; build tooling
still uses older glob/minimatch and stream-json majors. A successful web release
does not constitute a desktop-platform build or close those remaining alerts.

Validate the existing synthetic transport/security suites and a Vercel preview
before merging master. Preserve the previous READY production deployment for
instant rollback; never retrieve session data or send real messages for a smoke
test.

References: [ZIP advisory](https://github.com/advisories/GHSA-m665-v7pm-7grj),
[compression advisory](https://github.com/advisories/GHSA-vc2v-76pw-4v95),
[npm overrides](https://docs.npmjs.com/cli/configuring-npm/package-json/#overrides).
