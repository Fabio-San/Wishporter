# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

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
