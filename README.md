<p align="center">
  <img src="assets/banner.png" alt="Wishporter — Genshin Impact wish history to Paimon.moe converter" width="100%">
</p>

<h1 align="center">Wishporter</h1>

<p align="center"><em>Genshin Impact wish history → Paimon.moe converter</em></p>

<p align="center">
  <a href="https://github.com/Fabio-San/Wishporter/actions/workflows/ci.yml"><img src="https://github.com/Fabio-San/Wishporter/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/python-3.9%2B-3776AB?logo=python&logoColor=white" alt="Python 3.9+">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey" alt="Platforms">
  <img src="https://img.shields.io/badge/languages-7-yellow" alt="7 languages">
  <img src="https://img.shields.io/badge/translations-welcome-brightgreen" alt="Translations welcome">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

<p align="center"><a href="README.it.md">Leggi in italiano</a></p>

Wishporter turns the official Genshin Impact wish history export (`.xlsx` or
`.csv`) into an Excel file that [Paimon.moe](https://paimon.moe) can import,
with banner names, item types, rarity and pity information filled in.

- Windows and Linux launchers, same behavior on both
- Checks Python and `openpyxl`, asks permission before installing anything
- Installs only in a local `.venv`, never system-wide
- UI in English, Italian, French, German, Spanish, Portuguese and Russian
- Downloads Paimon.moe metadata once, then works offline
- No account login, no telemetry, no wish data leaves your computer

## Why Wishporter exists

It can happen that old or new Travelers lose track of their in-game Wish History.
When this happens, recovering it fully on your own is rarely possible.

HoYoverse support can provide a copy of your wish history on request. The exact
steps to ask for it are described in this Reddit discussion:
https://www.reddit.com/r/Genshin_Impact/comments/1wz77km/i_got_my_entire_wish_history_from_hoyo_since/

The file you receive from support is **not** in a format Paimon.moe can import,
and converting thousands of pulls by hand is not realistic. Wishporter automates
that step: feed it the file you got from HoYo support and you get a
Paimon.moe-ready Excel file.

> If you received your export through a different channel, Wishporter still
> works as long as the file has the five columns `No.`, `UID`, `Wish type`,
> `Wish award`, `Wish time`.

## Quick start

### Windows

1. Download the ZIP from [Releases](https://github.com/Fabio-San/Wishporter/releases)
   and extract it anywhere.
2. Double-click **`run.bat`**.
3. Drag your export file into the window, or type its path/name.

If Python is missing, `run.bat` explains what it is and offers to install it
with `winget` (only after your confirmation). Otherwise it opens the official
Python download page.

### Linux / macOS

```bash
bash run.sh
```

The ZIP may lose the executable bit, so `bash run.sh` is the recommended way to
start it. Linux is the tested platform; macOS should work the same way, and
feedback is welcome.

On the first run the launcher checks the environment and asks before creating a
local `.venv` and installing `openpyxl` with pip. Nothing is installed globally
and `sudo` is never used for Python packages.

## Get your export from the game

In Genshin Impact, open **Wish History** and use the **Export** button. The game
creates an `.xlsx` file (a `.csv` with the same columns also works). Keep the
file anywhere; Wishporter only reads it.

## Usage

Interactive, the easiest way:

```text
run.bat
```

or

```bash
bash run.sh
```

Pass a file directly:

```bat
run.bat "C:\Users\you\Downloads\wish_history.xlsx"
```

```bash
bash run.sh ~/Downloads/wish_history.xlsx
```

Advanced users can call the converter directly:

```bash
python convert.py history.xlsx
python convert.py history.xlsx -o my_history_paimonmoe.xlsx
```

### Options

| Option | Description |
|---|---|
| `source` | Source `.xlsx` or `.csv`. If omitted, you are asked for it. |
| `-o`, `--output` | Output file. Default: `<source>_paimonmoe.xlsx` next to the source. |
| `--offline` | Never download Paimon.moe data; use the local cache. |
| `--reference FILE` | Use an existing Paimon.moe export as banner fallback. |
| `--data-dir DIR` | Read Paimon.moe JS data files from a folder (read-only). |
| `--server NAME` | `Asia`, `China`, `America` or `Europe`. Default: inferred from the UID. |
| `--lang CODE` | `en`, `it`, `fr`, `de`, `es`, `pt`, `ru`. |
| `--yes` | Overwrite the output and accept setup questions. |
| `--check` | Environment check only (launcher). |
| `--debug` | Show the full error traceback. |
| `--debug-rows` | Print the first rows of each sheet for diagnosis. |
| `--version` | Show the version and exit. |

If the output file already exists, Wishporter asks before overwriting; if you
say no, it writes a timestamped file instead.

## Input and output

The HoYo Excel export has five columns: `No.`, `UID`, `Wish type`, `Wish award`,
`Wish time`. The header row is skipped automatically. Any UID, server and
number of pulls is supported, as long as the file comes from the official
HoYo Excel export. Item names are expected in English (the default game language);
localized names are on the roadmap.

The generated workbook contains:

- `Character Event`, `Weapon Event`, `Standard`, `Beginners' Wish`
- `Banner List` with every known banner and its start/end time
- `Information` with the Paimon.moe export marker

Paimon.moe reads columns **A (Type)**, **B (Name)**, **C (Time)** and
**I (Part)**; the other columns are informational.

## Import into Paimon.moe

1. Open [paimon.moe](https://paimon.moe) and go to **Wish History**.
2. Choose **Import** and select the generated `.xlsx` file.
3. Check the counters and save.

> **Important:** Paimon.moe merges imports instead of replacing them. It only
> adds pulls newer than your newest and older than your oldest existing pull.
> For a complete restore, clear your current Paimon.moe wish data first (export
> a backup if you need it), then import.

## Languages

English, Italian, French, German, Spanish, Portuguese and Russian are included.
The language is detected from the operating system; force it with `--lang` or
the `PAIMON_LANG` environment variable. Missing keys fall back to English.

Want to add a language? See [`locales/README.md`](locales/README.md). The
catalogs are small and community translations are very welcome.

## Translations are open to everyone, for free

Wishporter is translated by the community, and **anyone can add a new language
at no cost**: no account, no fee, no contributor agreement.

1. Fork the repository and copy `locales/en.json` to `locales/<code>.json`.
2. Translate the values (keep the keys and the `{placeholders}`).
3. Add the code to `SUPPORTED` in `i18n.py`.
4. Open a pull request.

If you do not use Git, open an issue with your translation and we will add it
for you. See [`locales/README.md`](locales/README.md) for the full guide.

## Privacy

Wishporter does not ask for a HoYoverse account, a password or a cookie. It
reads your local export and writes a local Excel file. There is no telemetry
and no upload of wish data.

On the first online run it downloads four public metadata files (characters,
weapons, banners, dual banners) from the
[Paimon.moe repository](https://github.com/MadeBaruna/paimon-moe) and caches
them in `cache/`. From then on it works offline. Use `--offline` to forbid all
network access, or `--reference` to rely on an existing Paimon.moe export.

## Troubleshooting

| Problem | Solution |
|---|---|
| Python not found | Let `run.bat` / `run.sh` offer the package-manager install, or install Python 3.9+ from [python.org](https://www.python.org/downloads/). On Windows, tick **Add python.exe to PATH**. |
| `openpyxl` missing | Start the tool through `run.bat` / `run.sh` and accept the local install. |
| `externally-managed-environment` on Debian/Ubuntu | Install the venv package: `sudo apt install python3-venv`, then run again. |
| Windows SmartScreen / antivirus warning | Wishporter is a readable Python script, not a compiled binary. Choose **More info → Run anyway**, or inspect the source before running. |
| File not found | Drag the file into the window or paste the full path. On Windows, quotes are handled automatically. |
| Unknown item names | Run once online to refresh the item database. If an item is still unknown, open an issue with the item name (no UID needed). |
| No banner schedule found | Run online to refresh the cache, or pass `--reference` with a recent Paimon.moe export. Check `--server` if your UID is unusual. |
| Import seems to be ignored | Paimon.moe is append-only; clear the current data before a full import. |
| Cache is stale | Delete the `cache/` folder and run online again. |

## Development

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

Tests use synthetic wish data and public fixture metadata; no personal data is
required. The release ZIP is built with:

```bash
python scripts/package.py
```

Project layout:

```text
convert.py          conversion logic and CLI
run.py              environment check, local venv, launcher logic
run.bat / run.sh    thin Windows / Linux wrappers
i18n.py             language detection and catalog lookup
version.py          single source of truth for the version
locales/            UI translations
tests/              synthetic fixtures and unit tests
scripts/package.py  release ZIP builder
```

## Roadmap

UIGF JSON import, CSV column auto-detection, localized item names and an
optional GUI are planned. See [`ROADMAP.md`](ROADMAP.md).

## License

MIT. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) for the Paimon.moe
attribution.

Wishporter is an unofficial fan tool. It is not affiliated with, endorsed by, or
sponsored by HoYoverse or Paimon.moe. Genshin Impact and all related names and
assets are trademarks or registered trademarks of HoYoverse.

**AI disclosure:** Wishporter is developed by Fabio-San with the assistance of
an AI coding agent (OpenCode). All requirements, design decisions, testing and
verification are performed by the author. The AI accelerated implementation; it
did not replace human review.
