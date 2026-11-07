# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the
project adheres to [Semantic Versioning](https://semver.org/).

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
