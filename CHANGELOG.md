# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.13] - 2026-11-12

### Fixed

- **Localized wish-type detection** (web + CLI): Chronicled Wish now recognized in
  all supported languages, including Spanish "Gachapón recopilatorio", French
  "Vœux nostalgie", German "Kollektionsgebet", Italian "Desiderio delle
  cronache", and the "Collected Gachas"/"Collection" variants.
- **Weapon / Novice detection** for Russian (genitive "оружия") and Portuguese
  ("Novatos") exports.
- Expanded Chronicled keyword list with collection-related terms.

## [1.0.10] - 2026-11-12

### Fixed

- **Web result summary** now lists all five categories (including Chronicled Wish)
  and shows a total, so the displayed pull count matches the source file.
- **Chronicled Wish detection** in HoYo exports now covers the official
  localized names in all supported languages (e.g. Spanish "Gachapón
  recopilatorio", French "Vœux nostalgie", German "Kollektionsgebet",
  Russian genitive forms).
- **Weapon / Novice detection** for Russian and Portuguese exports.
- Added a visible warning on the web result when Chronicled Wish pulls are
  present, reminding users to import the JSON backup (Paimon.moe's Excel
  importer ignores Chronicled Wish).

## [1.0.9] - 2026-11-10

### Fixed

- **Sort order:** the converter now detects the `No.` convention used by each
  HoYo export (No. 1 = newest for some accounts, No. 1 = oldest for others)
  and sorts pulls chronologically while preserving the export's order inside
  same-timestamp ten-pulls. This fixes wrong pity values in both conventions
  (e.g. Lion's Roar showing 23 instead of 9, Fischl showing 5 instead of 6).
- **4-star pity:** the 4-star counter is independent from the 5-star counter.
  Every pull counts towards 4-star pity, a 4-star resets it, and a 5-star
  resets only the 5-star counter. Verified against a 5,152-pull history
  (86 five-stars): the next 4-star always arrived within the 10-pull window
  measured from the previous 4-star, so a 5-star does not reset 4-star pity.
  This also matches Paimon.moe's own Excel importer. Note: Paimon.moe
  recomputes pity when importing the Excel file and ignores this column; the
  JSON backup keeps these values.

## [1.0.8] - 2026-11-10

### Fixed

- **Banner gaps:** pulls that land in the maintenance gap between two
  banners (e.g. a 3-star weapon pulled during the rollover window) no longer
  abort the conversion. Wishporter now falls back to the previous banner,
  matching Paimon.moe's own behaviour. This fixes mismatched pity on
  exports whose UID is missing (default server fallback).

## [1.0.7] - 2026-11-10

### Fixed

- **Web layout:** fixed a CSS regression where the backup file input rule
  overwrote `.theme-toggle`, breaking the centered layout. Page is centered
  again.
- **Auto-update:** version gate + no-cache meta + `cache: no-store` fetches so
  returning visitors get the latest version automatically.

### Added

- **Merge mode:** Wishporter can now merge an existing Paimon.moe backup JSON
  (`--paimon-backup` in CLI, optional file input in web) so that `server`,
  `ar`, `wl`, collectables and todos are preserved instead of reset.

## [1.0.6] - 2026-11-10

### Added

- **Chronicled Wish** support: `normalize_wish_type` now recognizes Chronicled
  Wish exports in 7 languages; a dedicated `Chronicled Wish` sheet is written to
  the Excel output and enriched with pity/roll/group data.
- **Paimon.moe backup JSON** (`*_paimonmoe.json`): full localforage-compatible
  backup that restores the 50/50 win/loss statistic and Chronicled Wish. Import
  via Paimon.moe Settings → Export & Import Data → Import Data.
- Web UI: download button for the JSON backup plus import instructions, and
  version badge next to "Wishporter" in the header.
- Web UI fully localized into IT/FR/DE/ES/PT/RU (dynamic strings included).

### Fixed

- Web localization: `formatHint`, progress, errors, alerts and summary lines now
  use translated strings; `<html lang>` is set on language change.

## [1.0.5] - 2026-11-07

### Fixed

- **Merged cells / sparse rows**: switched from `read_only` to normal mode, which
  properly fills empty/merged cells with `None` instead of returning short rows.
  This fixes HoYo support exports where openpyxl's read-only mode returned only
  the first column of each row.
- Added merged-cell propagation: if a merged range covers multiple columns, the
  top-left value is copied to all cells in the range.
- Error message now detects when all rows have a single column and suggests
  re-saving the file from Excel.
- Added `--debug-rows` flag (prints raw cell values and merged ranges).

## [1.0.4] - 2026-11-07

### Fixed

- HoYo support exports where the wish number is stored as a float (e.g. `1.0`)
  or contains invisible characters (BOM, zero-width spaces) are now recognized.
- Numeric detection now also extracts leading digits from prefixed values
  (e.g. "No. 1", "#1", "1st").
- Header detection now uses longest-keyword matching to avoid false positives
  (e.g. "nombre" no longer misclassified).
- Added `--debug-rows` flag that prints the first rows of each sheet for
  diagnosis.

## [1.0.3] - 2026-11-07

### Changed

- **Robust source parser**: now tries all sheets (not just the active one),
  auto-detects the header row by scanning the first 30 rows, and maps columns
  by name (with positional fallback). This fixes imports of HoYo support
  exports that have a slightly different structure.
- Detailed error messages: reports which sheets were tried, how many rows were
  skipped and why, and lists unknown wish types.
- Added support for `.xls` files with a clear error message (convert to
  `.xlsx` or `.csv` first).

## [1.0.2] - 2026-11-07

### Added

- First-run interactive prompt: when no Paimon.moe export and no cached data
  are found, Wishporter explains the situation and lets the user drag & drop an
  export or press Enter to download the public banner data once (online) or
  continue with generic banner names (offline).
- Four new translated UI strings for the first-run prompt (7 languages).

## [1.0.1] - 2026-11-07

### Changed

- Refreshed the logo (gold star, teal trail, Primogem diamond, magenta Paimon.moe accent)
  and added a social preview banner.
- README: added the HoYoverse support wish-history recovery context and a
  "translations are open to everyone, for free" guide.
- CI: run Python 3.9 on `ubuntu-22.04`, bump GitHub Actions to Node 24 versions,
  silencing the Node 20 deprecation warnings.

### Fixed

- None functional; the converter and tests are unchanged.

## [1.0.0] - 2026-11-07

### Added

- Convert the official Genshin Impact wish history export (`.xlsx` or `.csv`)
  into an Excel file that Paimon.moe can import.
- Support for Character Event, Weapon Event, Standard and Beginners' Wish,
  including dual banners (`Wish 2`).
- Automatic UID-to-server detection and banner time-zone handling.
- Windows launcher (`run.bat`) and Linux/macOS launcher (`run.sh`), both backed
  by the same `run.py` logic.
- Environment check with explicit permission before creating a local `.venv`
  or installing `openpyxl`; no system-wide changes.
- Python-missing flow: optional installation through `winget` or the Linux
  package manager, with the official download page as a fallback.
- UI in English, Italian, French, German, Spanish, Portuguese and Russian,
  detected from the operating system and overridable with `--lang`.
- Paimon.moe metadata cache in `cache/`, offline mode (`--offline`) and
  support for an existing Paimon.moe export (`--reference`).
- Tests with synthetic fixture data; no personal wish history is included.
- MIT license and Paimon.moe attribution in `NOTICE`.

[1.0.0]: https://github.com/Fabio-San/Wishporter/releases/tag/v1.0.0
