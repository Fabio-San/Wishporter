#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Friendly launcher for the Paimon.moe wish converter.

It checks the Python version and the openpyxl dependency, asks permission
before creating a local ``.venv`` or installing anything, then starts
``convert.py``. Nothing is installed system-wide and no personal data leaves
the computer.

Usage:
    python run.py [convert.py options] [file]

    python run.py --check          environment check only
    python run.py --help           show this help
"""

import os
import socket
import subprocess
import sys
from pathlib import Path

from version import __version__ as VERSION

SCRIPT_DIR = Path(__file__).resolve().parent
VENV_DIR = SCRIPT_DIR / ".venv"
CONVERTER = SCRIPT_DIR / "convert.py"
REQUIREMENTS = SCRIPT_DIR / "requirements.txt"
MIN_PYTHON = (3, 9)

if sys.version_info < MIN_PYTHON:
    found = "%d.%d" % sys.version_info[:2]
    needed = "%d.%d" % MIN_PYTHON
    print("Python %s found, but Python %s+ is required." % (found, needed))
    print("Download: https://www.python.org/downloads/")
    sys.exit(1)

import i18n  # noqa: E402  (local module, dependency-free)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def reconfigure_stdout():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def ask_yes_no(prompt, default):
    affirmative = {"y", "yes", "s", "si", "sì", "o", "oui", "j", "ja", "д", "да", "1", "true"}
    negative = {"n", "no", "non", "nein", "não", "nao", "нет", "0", "false"}
    while True:
        try:
            answer = input(prompt + " ").strip().lower()
        except EOFError:
            return default
        if not answer:
            return default
        if answer in affirmative:
            return True
        if answer in negative:
            return False
        print(i18n.t("invalid_choice"))


def run_quiet(command):
    """Run a command and return (returncode, combined output)."""
    try:
        completed = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return completed.returncode, completed.stdout or ""
    except OSError as exc:
        return 1, str(exc)


def venv_python():
    """Return the python executable inside .venv, or None."""
    candidates = (
        VENV_DIR / "Scripts" / "python.exe",
        VENV_DIR / "bin" / "python3",
        VENV_DIR / "bin" / "python",
    )
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    return None


def has_openpyxl(python):
    if not python:
        return False
    code = "import openpyxl, sys; sys.exit(0 if openpyxl.__version__ else 1)"
    return run_quiet([python, "-c", code])[0] == 0


def python_version(python):
    code = "import sys; print('%d.%d.%d' % sys.version_info[:3])"
    status, output = run_quiet([python, "-c", code])
    return output.strip() if status == 0 else "?"


def cache_status():
    required = ("characters.js", "weaponList.js", "banners.js", "bannersDual.js")
    cache_dir = SCRIPT_DIR / "cache"
    present = sum(1 for name in required if (cache_dir / name).is_file())
    if present == 0:
        return i18n.t("status_never")
    if present < len(required):
        return i18n.t("status_missing")
    return i18n.t("status_yes")


def network_status():
    try:
        with socket.create_connection(("raw.githubusercontent.com", 443), timeout=2.5):
            return i18n.t("status_yes")
    except OSError:
        return i18n.t("status_no")


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

def create_local_venv(system_python):
    print(i18n.t("venv_explain"))
    if not ask_yes_no(i18n.t("venv_confirm"), default=True):
        print(i18n.t("dep_declined"))
        return None

    status, output = run_quiet([system_python, "-m", "venv", str(VENV_DIR)])
    if status != 0:
        print(i18n.t("venv_failed", error=output.strip() or "venv"))
        if os.name != "nt":
            print(i18n.t("venv_debian_hint"))
        print(i18n.t("dep_manual", cmd="python -m pip install openpyxl"))
        return None

    print(i18n.t("venv_created"))
    return venv_python()


def install_openpyxl(python):
    if not ask_yes_no(i18n.t("dep_confirm"), default=True):
        print(i18n.t("dep_declined"))
        return False

    print(i18n.t("installing"))
    command = [python, "-m", "pip", "install", "--disable-pip-version-check", "--no-input"]
    if REQUIREMENTS.is_file():
        command += ["-r", str(REQUIREMENTS)]
    else:
        command += ["openpyxl>=3.0.0"]

    status, output = run_quiet(command)

    pip_missing = (
        "No module named pip" in output
        or "No module named 'pip'" in output
        or "pip: command not found" in output
    )
    if status != 0 and pip_missing:
        print(i18n.t("pip_missing"))
        run_quiet([python, "-m", "ensurepip", "--upgrade"])
        status, output = run_quiet(command)

    if status != 0:
        print(i18n.t("dep_failed", error=output.strip().splitlines()[-1] if output.strip() else "pip"))
        print(i18n.t("dep_manual", cmd="python -m pip install openpyxl"))
        return False

    if not has_openpyxl(python):
        print(i18n.t("dep_failed", error="openpyxl import failed"))
        return False

    print(i18n.t("dep_installed"))
    return True


def prepare_python(auto_yes):
    """Decide which interpreter to use, installing only with permission."""
    system_python = sys.executable

    venv = venv_python()
    if venv and has_openpyxl(venv):
        print(i18n.t("using_existing_venv"))
        return venv

    if has_openpyxl(system_python):
        print(i18n.t("using_system_python"))
        return system_python

    print(i18n.t("dep_missing"))
    print(i18n.t("dep_explain"))

    if venv:
        if auto_yes or ask_yes_no(i18n.t("dep_confirm"), default=True):
            if install_openpyxl(venv):
                return venv
        return None

    venv = create_local_venv(system_python)
    if not venv:
        return None

    if install_openpyxl(venv):
        return venv
    return None


# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def show_help():
    print(i18n.t("app_name") + " " + VERSION)
    print(i18n.t("app_tagline"))
    print()
    print(i18n.t("help_body"))
    print()
    print(i18n.t("help_download_note"))


def doctor():
    print(i18n.t("check_header"))
    print()
    system_python = sys.executable
    venv = venv_python()
    active = venv if (venv and has_openpyxl(venv)) else system_python

    print(i18n.t("check_python", version=python_version(system_python), path=system_python))
    print(i18n.t("check_venv", status=i18n.t("status_yes") if venv else i18n.t("status_missing")))

    status = i18n.t("status_ok") if has_openpyxl(active) else i18n.t("status_missing")
    print(i18n.t("check_openpyxl", status=status))
    print(i18n.t("check_cache", status=cache_status()))
    print(i18n.t("check_network", status=network_status()))
    print(i18n.t("check_lang", lang=i18n.current_language()))
    print()

    if has_openpyxl(active):
        print(i18n.t("check_ok"))
        return 0
    print(i18n.t("check_missing"))
    return 0


def split_language(argv):
    """Return (lang, remaining args). --lang is forwarded to convert.py too."""
    lang = None
    remaining = []
    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg == "--lang" and index + 1 < len(argv):
            lang = argv[index + 1]
            remaining.extend([arg, argv[index + 1]])
            index += 2
            continue
        if arg.startswith("--lang="):
            lang = arg.split("=", 1)[1]
        remaining.append(arg)
        index += 1
    return lang, remaining


def main(argv):
    reconfigure_stdout()

    wants_help = any(arg in ("-h", "--help", "--usage") for arg in argv)
    wants_version = "--version" in argv
    check_only = "--check" in argv or "--doctor" in argv
    auto_yes = "--yes" in argv or "-y" in argv

    lang, forwarded = split_language([arg for arg in argv if arg not in ("--check", "--doctor")])
    i18n.set_language(lang)

    if wants_help:
        show_help()
        return 0
    if wants_version:
        print("%s %s" % (i18n.t("app_name"), VERSION))
        return 0

    print("%s %s" % (i18n.t("app_name"), VERSION))
    print(i18n.t("app_tagline"))
    print()

    if check_only:
        return doctor()

    python = prepare_python(auto_yes)
    if not python:
        return 1

    if not CONVERTER.is_file():
        print(i18n.t("error", error="convert.py not found next to run.py"))
        return 1

    print(i18n.t("launching"))
    print()
    try:
        return subprocess.call([python, str(CONVERTER)] + forwarded, cwd=str(Path.cwd()))
    except KeyboardInterrupt:
        print()
        print(i18n.t("cancelled"))
        return 130
    except OSError as exc:
        print(i18n.t("error", error=exc))
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
