# Roadmap

This document tracks the current state of Wishporter and possible future plans.
Priorities may change based on feedback, bug reports, and maintenance capacity.
Open an issue to propose or prioritize an item.

## Current status (v1.0.x)

Delivered in the 1.0 series:

- **Inputs:** HoYo Excel/CSV wish exports (`No.`, `UID`, `Wish type`, `Wish award`, `Wish time`).
- **Banners/categories:** Character Event, Weapon Event, Standard, Beginners' Wish, and Chronicled Wish (including dual banners / `Wish 2`).
- **Outputs:** Paimon.moe-ready Excel and Paimon.moe backup JSON (full restore path for 50/50 stats and Chronicled Wish).
- **Merge mode:** optional existing Paimon.moe backup JSON to preserve server/account fields, achievements, wish list, and collectables.
- **Desktop (CLI):** Windows (`run.bat`) and Linux (`bash run.sh`), local `.venv`/`openpyxl` setup with user confirmation, offline mode, cache, and `--reference` fallback.
- **Web app (PWA):** GitHub Pages version with drag & drop, 7 UI languages, offline support after first load, and result summary (including Chronicled + total) with JSON-backup reminder.
- **Data/quality:** Paimon.moe metadata fetch/cache, ongoing fixes for pity/banner edge cases and localized/type-label recognition (e.g. Chronicled variants such as `Collected Gachas`).

## Near term (quality and compatibility)

- **Import diagnostics:** clearer reporting when source and output totals differ (skipped/unknown rows, unrecognized wish types, duplicate handling).
- **Validation UX:** more explicit errors for malformed/unsupported files (wrong columns, empty exports, partially corrupted sheets).
- **Chronicled/banner coverage:** continue improving banner matching and wish-type recognition for new HoYo labels/localizations and edge-case reruns.
- **Cache freshness:** optional prompt or setting to refresh Paimon.moe metadata when cache is stale.
- **Regression coverage:** expand fixtures/tests for real-world export variants and locale-specific wish type strings.

## Input/output roadmap

- **UIGF JSON import:** support common UIGF versions used by tools such as Snap Hutao and Genshin Wish Export.
- **Paimon.moe export as input:** allow converting/reconciling from Paimon.moe export formats where useful.
- **CSV flexibility:** header auto-detection and tolerance for reordered/localized column names.
- **Localized item names:** mapping support for exports where item names are not in English.
- **Output options:** clearer guidance/controls for append-safe Excel import vs full JSON restore workflows.

## UX and distribution ideas

- **Web UX:** progress/detail improvements, stronger offline/cache status messaging, and accessibility refinements.
- **Desktop UX:** optional lightweight GUI and improved drag-and-drop/documentation for Windows/Linux.
- **Packaging:** evaluate optional standalone executables as an additional release channel (without replacing script-based distribution).
- **Docs/i18n:** keep README/locales/changelog aligned; continue welcoming community translations.

## Not planned

- Direct HoYoverse account login, password/cookie handling, or unofficial API calls.
- Uploading user wish data to external services. Conversion remains local (except downloading public Paimon.moe metadata when online/cache refresh is needed).
