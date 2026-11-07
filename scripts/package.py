#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the release ZIP containing only public, redistributable files.

The archive extracts to a single ``wishporter-<version>/`` folder with the
Windows and Linux launchers side by side. Personal data, the local cache,
work/ and .venv are never included.
"""

import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from version import __version__  # noqa: E402

TOP_LEVEL = (
    "convert.py",
    "run.py",
    "run.sh",
    "run.bat",
    "i18n.py",
    "version.py",
    "requirements.txt",
    "README.md",
    "README.it.md",
    "ROADMAP.md",
    "CHANGELOG.md",
    "LICENSE",
    "NOTICE",
)


def collect():
    files = []
    missing = []
    for name in TOP_LEVEL:
        path = ROOT / name
        if path.is_file():
            files.append(path)
        else:
            missing.append(name)

    allowed = {
        "locales": (".json",),
        "assets": (".png", ".svg", ".ico", ".jpg", ".jpeg"),
    }
    for directory, suffixes in allowed.items():
        folder = ROOT / directory
        if not folder.is_dir():
            continue
        for path in sorted(folder.iterdir()):
            if path.is_file() and path.suffix.lower() in suffixes:
                files.append(path)

    if missing:
        raise SystemExit("Missing required files: " + ", ".join(missing))
    return files


def main():
    output_dir = ROOT / "dist"
    output_dir.mkdir(exist_ok=True)
    archive = output_dir / ("wishporter-%s.zip" % __version__)
    folder = "wishporter-%s" % __version__

    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in collect():
            bundle.write(path, "%s/%s" % (folder, path.relative_to(ROOT).as_posix()))

    size = archive.stat().st_size
    print("Created %s (%.1f KiB)" % (archive, size / 1024.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
