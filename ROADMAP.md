# Roadmap

This file tracks what is planned beyond v1.0. Priorities can change based on
community feedback; open an issue if you want to push a specific item.

## v1.0 — current release

- HoYo Excel/CSV export (columns `No.`, `UID`, `Wish type`, `Wish award`, `Wish time`)
- Character Event, Weapon Event, Standard and Beginners' Wish
- Banner names from Paimon.moe, including dual banners (`Wish 2`)
- Windows and Linux launchers with dependency checks and local `.venv`
- UI in English, Italian, French, German, Spanish, Portuguese and Russian
- Paimon.moe metadata cache, offline mode and `--reference` fallback

## v1.1 — more input formats

- **UIGF JSON import**: support UIGF v2.2, v3 and v4 exports from tools such as
  Snap Hutao and Genshin Wish Export.
- **CSV header auto-detection**: accept CSV files whose columns are ordered
  differently, or use localized headers.
- Clear validation messages when a JSON/CSV file is not a wish export.

## v1.2 — better data coverage

- Localized item-name mapping (the HoYo Excel export uses English item names;
  players on other game languages can produce localized names).
- Improved banner matching for Chronicled Wish and reruns.
- Optional automatic refresh of the Paimon.moe cache when it is older than N days.

## v2.0 — broader UX

- Optional desktop GUI (tkinter) for users who prefer not to use a terminal.
- Optional standalone executable as an alternative release channel.
- Drag & drop support documented for Windows and desktop Linux.

## Not planned

- Direct account login or unofficial API calls. Wishporter only reads the
  official HoYo Excel export and never asks for HoYoverse credentials.
- Uploading wish data anywhere. Everything stays on the user's computer.
