# -*- coding: utf-8 -*-
"""Dependency-free localization helpers used by the launcher and converter.

Language catalogs live in ./locales/*.json and always fall back to English.
"""

import json
import os
import re
import sys
from pathlib import Path

SUPPORTED = ("en", "it", "fr", "de", "es", "pt", "ru")
LOCALES_DIR = Path(__file__).resolve().parent / "locales"

_current = "en"
_catalog = {}
_fallback = {}


def _read_catalog(lang):
    path = LOCALES_DIR / f"{lang}.json"
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            return {str(key): str(value) for key, value in data.items()}
    except (OSError, ValueError):
        pass
    return {}


def _normalize(code):
    """Normalize a locale code to one of SUPPORTED, or None."""
    if not code:
        return None
    code = str(code).strip().lower().replace("-", "_")
    if not code:
        return None
    code = code.split(".", 1)[0].split("@", 1)[0]
    primary = code.split("_", 1)[0]
    if primary in SUPPORTED:
        return primary
    return None


def _windows_language():
    try:
        import ctypes

        langid = ctypes.windll.kernel32.GetUserDefaultUILanguage()
        primary = langid & 0x3FF
        mapping = {
            0x09: "en",
            0x0A: "es",
            0x0C: "fr",
            0x07: "de",
            0x10: "it",
            0x16: "pt",
            0x19: "ru",
        }
        return mapping.get(primary)
    except Exception:
        return None


def _macos_language():
    try:
        import subprocess

        result = subprocess.run(
            ["defaults", "read", "-g", "AppleLanguages"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        match = re.search(r'"([a-zA-Z_-]+)"', result.stdout or "")
        return _normalize(match.group(1)) if match else None
    except Exception:
        return None


def detect_language():
    """Detect the best supported language from the OS environment."""
    for var in ("PAIMON_LANG", "PAIMON_MOE_LANG"):
        normalized = _normalize(os.environ.get(var))
        if normalized:
            return normalized

    if os.name == "nt":
        detected = _windows_language()
        if detected:
            return detected
    elif sys.platform == "darwin":
        detected = _macos_language()
        if detected:
            return detected

    for var in ("LC_ALL", "LC_MESSAGES", "LANG"):
        normalized = _normalize(os.environ.get(var))
        if normalized:
            return normalized

    try:
        import locale

        normalized = _normalize(locale.getlocale()[0])
        if normalized:
            return normalized
    except Exception:
        pass

    return "en"


def set_language(lang=None):
    """Select the active language. Returns the normalized code."""
    global _current, _catalog, _fallback
    if not _fallback:
        _fallback = _read_catalog("en")
    normalized = _normalize(lang) if lang else detect_language()
    if not normalized:
        normalized = "en"
    _current = normalized
    _catalog = dict(_fallback) if normalized == "en" else _read_catalog(normalized)
    return normalized


def current_language():
    return _current


def available_languages():
    if not LOCALES_DIR.is_dir():
        return ["en"]
    found = sorted(path.stem for path in LOCALES_DIR.glob("*.json") if path.stem in SUPPORTED)
    return found or ["en"]


def t(key, **kwargs):
    """Translate a key, falling back to English and then to the key itself."""
    global _fallback
    if not _fallback:
        _fallback = _read_catalog("en")
    template = _catalog.get(key) or _fallback.get(key) or key
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError, ValueError):
        return template
