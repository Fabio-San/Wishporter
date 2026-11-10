# -*- coding: utf-8 -*-
"""Genshin Impact wish history -> Paimon.moe Excel converter.

This is the public entry point. It accepts the HoYo Excel/CSV export
(columns: No., UID, Wish type, Wish award, Wish time), fills in the banner
information using Paimon.moe's official data, and writes an Excel file that
Paimon.moe can import.

Run it directly if openpyxl is already installed:

    python convert.py my_history.xlsx

or use run.py / run.bat / run.sh, which can install openpyxl in a local venv.
"""

import argparse
import csv
import datetime
import json
import os
import re
import sys
import traceback
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

import i18n
from version import __version__ as VERSION

try:
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("openpyxl is required. Run run.py to install it, or run:")
    print("  python -m pip install openpyxl")
    raise SystemExit(1)


BASE_URL = "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/"
DATA_FILES = (
    ("characters", "characters.js", BASE_URL + "characters.js"),
    ("weapons", "weaponList.js", BASE_URL + "weaponList.js"),
    ("banners", "banners.js", BASE_URL + "banners.js"),
    ("dual", "bannersDual.js", BASE_URL + "bannersDual.js"),
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CACHE_DIR = SCRIPT_DIR / "cache"

SERVER_OFFSETS = {
    "Asia": 8,
    "China": 8,
    "America": -5,
    "Europe": 1,
}
SERVER_BY_UID_PREFIX = {
    "1": "China",
    "2": "China",
    "3": "China",
    "4": "China",
    "5": "Asia",
    "6": "America",
    "7": "Europe",
    "8": "Asia",
    "9": "Asia",
}

DATA_SHEETS = ["Character Event", "Weapon Event", "Standard", "Beginners' Wish", "Chronicled Wish"]
CATEGORY_TO_SHEET = {
    "characters": "Character Event",
    "weapons": "Weapon Event",
    "standard": "Standard",
    "beginners": "Beginners' Wish",
    "chronicled": "Chronicled Wish",
}

# Paimon.moe localforage keys for wish history (default "Main" account).
CATEGORY_TO_STORAGE_KEY = {
    "characters": "wish-counter-character-event",
    "weapons": "wish-counter-weapon-event",
    "standard": "wish-counter-standard",
    "beginners": "wish-counter-beginners",
    "chronicled": "wish-counter-chronicled",
}
CATEGORY_TO_GACHA_TYPE = {
    "characters": 301,
    "weapons": 302,
    "standard": 200,
    "beginners": 100,
    "chronicled": 500,
}
# Categories where Paimon.moe computes the 50/50 win/loss statistic.
RATE_CATEGORIES = ("characters", "weapons", "chronicled")

# Small built-in item database. The full database is downloaded from Paimon.moe
# on the first online run and cached locally.
FALLBACK_ITEMS = {
    # 5-star characters
    "Albedo": ("Character", 5), "Alhaitham": ("Character", 5), "Aloy": ("Character", 5),
    "Arataki Itto": ("Character", 5), "Arlecchino": ("Character", 5), "Baizhu": ("Character", 5),
    "Chasca": ("Character", 5), "Chiori": ("Character", 5), "Citlali": ("Character", 5),
    "Clorinde": ("Character", 5), "Columbina": ("Character", 5), "Cyno": ("Character", 5),
    "Dehya": ("Character", 5), "Diluc": ("Character", 5), "Emilie": ("Character", 5),
    "Escoffier": ("Character", 5), "Eula": ("Character", 5), "Furina": ("Character", 5),
    "Ganyu": ("Character", 5), "Hu Tao": ("Character", 5), "Ineffa": ("Character", 5),
    "Jean": ("Character", 5), "Kaedehara Kazuha": ("Character", 5), "Kamisato Ayaka": ("Character", 5),
    "Kamisato Ayato": ("Character", 5), "Keqing": ("Character", 5), "Kinich": ("Character", 5),
    "Klee": ("Character", 5), "Lauma": ("Character", 5), "Lyney": ("Character", 5),
    "Mavuika": ("Character", 5), "Mona": ("Character", 5), "Mualani": ("Character", 5),
    "Nahida": ("Character", 5), "Navia": ("Character", 5), "Nefer": ("Character", 5),
    "Neuvillette": ("Character", 5), "Nilou": ("Character", 5), "Nicole": ("Character", 5),
    "Odette": ("Character", 5), "Qiqi": ("Character", 5), "Raiden Shogun": ("Character", 5),
    "Sandrone": ("Character", 5), "Sangonomiya Kokomi": ("Character", 5), "Shenhe": ("Character", 5),
    "Sigewinne": ("Character", 5), "Skirk": ("Character", 5), "Tartaglia": ("Character", 5),
    "Tighnari": ("Character", 5), "Varesa": ("Character", 5), "Venti": ("Character", 5),
    "Vesna": ("Character", 5), "Vodyanitsa": ("Character", 5), "Wanderer": ("Character", 5),
    "Wriothesley": ("Character", 5), "Xianyun": ("Character", 5), "Xiao": ("Character", 5),
    "Xilonen": ("Character", 5), "Yae Miko": ("Character", 5), "Yelan": ("Character", 5),
    "Yoimiya": ("Character", 5), "Yumemizuki Mizuki": ("Character", 5), "Zhongli": ("Character", 5),
    "Zibai": ("Character", 5),

    # 4-star characters
    "Aino": ("Character", 4), "Alyosha": ("Character", 4), "Amber": ("Character", 4),
    "Barbara": ("Character", 4), "Beidou": ("Character", 4), "Bennett": ("Character", 4),
    "Candace": ("Character", 4), "Charlotte": ("Character", 4), "Chevreuse": ("Character", 4),
    "Chongyun": ("Character", 4), "Collei": ("Character", 4), "Dahlia": ("Character", 4),
    "Diona": ("Character", 4), "Dori": ("Character", 4), "Faruzan": ("Character", 4),
    "Fischl": ("Character", 4), "Freminet": ("Character", 4), "Gaming": ("Character", 4),
    "Gorou": ("Character", 4), "Iansan": ("Character", 4), "Ifa": ("Character", 4),
    "Illuga": ("Character", 4), "Jahoda": ("Character", 4), "Kachina": ("Character", 4),
    "Kaeya": ("Character", 4), "Kaveh": ("Character", 4), "Kirara": ("Character", 4),
    "Kujou Sara": ("Character", 4), "Kuki Shinobu": ("Character", 4), "Lan Yan": ("Character", 4),
    "Layla": ("Character", 4), "Lisa": ("Character", 4), "Lynette": ("Character", 4),
    "Mika": ("Character", 4), "Ningguang": ("Character", 4), "Noelle": ("Character", 4),
    "Ororon": ("Character", 4), "Prune": ("Character", 4), "Razor": ("Character", 4),
    "Rosaria": ("Character", 4), "Sayu": ("Character", 4), "Sethos": ("Character", 4),
    "Shikanoin Heizou": ("Character", 4), "Sucrose": ("Character", 4), "Thoma": ("Character", 4),
    "Xiangling": ("Character", 4), "Xingqiu": ("Character", 4), "Xinyan": ("Character", 4),
    "Yanfei": ("Character", 4), "Yaoyao": ("Character", 4), "Yun Jin": ("Character", 4),

    # 3-star weapons
    "Black Tassel": ("Weapon", 3), "Bloodtainted Greatsword": ("Weapon", 3), "Cool Steel": ("Weapon", 3),
    "Debate Club": ("Weapon", 3), "Emerald Orb": ("Weapon", 3), "Ferrous Shadow": ("Weapon", 3),
    "Harbinger of Dawn": ("Weapon", 3), "Magic Guide": ("Weapon", 3), "Raven Bow": ("Weapon", 3),
    "Sharpshooter's Oath": ("Weapon", 3), "Skyrider Sword": ("Weapon", 3), "Slingshot": ("Weapon", 3),
    "Thrilling Tales of Dragon Slayers": ("Weapon", 3),

    # 4-star weapons
    "Akuoumaru": ("Weapon", 4), "Beyond the Chrysalis": ("Weapon", 4), "Breezeborne Refrain": ("Weapon", 4),
    "Dragon's Bane": ("Weapon", 4), "Eye of Perception": ("Weapon", 4), "Favonius Codex": ("Weapon", 4),
    "Favonius Greatsword": ("Weapon", 4), "Favonius Lance": ("Weapon", 4), "Favonius Sword": ("Weapon", 4),
    "Favonius Warbow": ("Weapon", 4), "Lion's Roar": ("Weapon", 4), "Moonweaver's Dawn": ("Weapon", 4),
    "Mouun's Moon": ("Weapon", 4), "New Bough": ("Weapon", 4), "Portable Power Saw": ("Weapon", 4),
    "Rainslasher": ("Weapon", 4), "Rust": ("Weapon", 4), "Sacrificial Bow": ("Weapon", 4),
    "Sacrificial Fragments": ("Weapon", 4), "Sacrificial Greatsword": ("Weapon", 4), "Sacrificial Sword": ("Weapon", 4),
    "Sacrificer's Staff": ("Weapon", 4), "The Bell": ("Weapon", 4), "The Dockhand's Assistant": ("Weapon", 4),
    "The Flute": ("Weapon", 4), "The Stringless": ("Weapon", 4), "The Widsith": ("Weapon", 4),
    "Xiphos' Moonlight": ("Weapon", 4),

    # 5-star weapons
    "A Teaspoon of Transcendence": ("Weapon", 5), "Amos' Bow": ("Weapon", 5), "Aquila Favonia": ("Weapon", 5),
    "Crimson Moon's Semblance": ("Weapon", 5), "Engulfing Lightning": ("Weapon", 5), "Freedom-Sworn": ("Weapon", 5),
    "Lost Prayer to the Sacred Winds": ("Weapon", 5), "Reliquary of Truth": ("Weapon", 5),
    "Silvershower Heartstrings": ("Weapon", 5), "Skyward Atlas": ("Weapon", 5), "Skyward Blade": ("Weapon", 5),
    "Starcaller's Watch": ("Weapon", 5), "Surf's Up": ("Weapon", 5), "The First Great Magic": ("Weapon", 5),
    "Verdict": ("Weapon", 5),
}


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def clean_item_name(name):
    if name is None:
        return ""
    name = str(name).strip()
    name = name.replace("''", "'")
    name = name.replace("\u2019", "'").replace("\u2018", "'")
    return name


def parse_datetime(value):
    if isinstance(value, datetime.datetime):
        return value.replace(microsecond=0)
    if isinstance(value, datetime.date):
        return datetime.datetime.combine(value, datetime.time())
    text = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M"):
        try:
            return datetime.datetime.strptime(text, fmt)
        except ValueError:
            pass
    try:
        return datetime.datetime.fromisoformat(text).replace(microsecond=0, tzinfo=None)
    except ValueError:
        raise ValueError(f"Invalid date/time: {value!r}")


def format_datetime(value):
    return value.strftime("%Y-%m-%d %H:%M:%S")


def normalize_wish_type(raw_type):
    text = str(raw_type).strip().lower()
    character_words = (
        "character event", "personaggio", "personnage", "figur",
        "personaje", "personagem", "персонаж",
    )
    if any(word in text for word in character_words):
        is_wish_2 = bool(re.search(r"-\s*2\b|wish\s*2\b", text))
        return "characters", is_wish_2
    weapon_words = ("weapon", "arma", "arme", "waffe", "оружие")
    if any(word in text for word in weapon_words):
        return "weapons", False
    standard_words = ("standard", "estándar", "estandar", "padrão", "padrao", "стандарт")
    if any(word in text for word in standard_words):
        return "standard", False
    beginner_words = (
        "novice", "beginner", "principiante", "débutant", "debutant",
        "anfänger", "anfanger", "iniciante", "новичок",
    )
    if any(word in text for word in beginner_words):
        return "beginners", False
    chronicled_words = (
        "chronicled", "chronicle", "cronache", "cronaca", "chronique",
        "nostalgique", "segensreich", "recopilación", "recopilacion",
        "registro", "registros", "хроник",
    )
    if any(word in text for word in chronicled_words):
        return "chronicled", False
    raise ValueError(f"Unrecognized wish type: {raw_type!r}")


def detect_server(uid):
    prefix = str(uid).strip()[:1]
    return SERVER_BY_UID_PREFIX.get(prefix, "Europe")


def fetch_text(url, timeout=15):
    request = urllib.request.Request(url, headers={"User-Agent": "wishporter/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8")


# ---------------------------------------------------------------------------
# Minimal JavaScript literal parser for Paimon.moe data files
# ---------------------------------------------------------------------------

class JsLiteralParser:
    def __init__(self, text, pos=0):
        self.text = text
        self.pos = pos
        self.length = len(text)

    def error(self, message):
        snippet = self.text[self.pos:self.pos + 80]
        raise ValueError(f"{message} (position {self.pos}): {snippet!r}")

    def skip_space_and_comments(self):
        while self.pos < self.length:
            char = self.text[self.pos]
            if char.isspace():
                self.pos += 1
            elif self.text.startswith("//", self.pos):
                newline = self.text.find("\n", self.pos)
                self.pos = self.length if newline == -1 else newline + 1
            elif self.text.startswith("/*", self.pos):
                end = self.text.find("*/", self.pos)
                self.pos = self.length if end == -1 else end + 2
            else:
                break

    def parse(self):
        self.skip_space_and_comments()
        return self.parse_value()

    def parse_value(self):
        self.skip_space_and_comments()
        if self.pos >= self.length:
            self.error("Unexpected end of input")
        char = self.text[self.pos]
        if char == "{":
            return self.parse_object()
        if char == "[":
            return self.parse_array()
        if char in "'\"`":
            return self.parse_string(char)
        if char == "-" or char.isdigit():
            return self.parse_number()

        start = self.pos
        while self.pos < self.length and (self.text[self.pos].isalnum() or self.text[self.pos] in "_.$"):
            self.pos += 1
        word = self.text[start:self.pos]
        if word == "true":
            return True
        if word == "false":
            return False
        if word in ("null", "undefined"):
            return None
        return word

    def parse_string(self, quote):
        self.pos += 1
        chars = []
        escapes = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}
        while self.pos < self.length:
            char = self.text[self.pos]
            if char == quote:
                self.pos += 1
                return "".join(chars)
            if char == "\\":
                self.pos += 1
                if self.pos >= self.length:
                    self.error("Unterminated escape")
                escaped = self.text[self.pos]
                if escaped in escapes:
                    chars.append(escapes[escaped])
                    self.pos += 1
                elif escaped == "u":
                    chars.append(chr(int(self.text[self.pos + 1:self.pos + 5], 16)))
                    self.pos += 5
                elif escaped == "x":
                    chars.append(chr(int(self.text[self.pos + 1:self.pos + 3], 16)))
                    self.pos += 3
                else:
                    chars.append(escaped)
                    self.pos += 1
            else:
                chars.append(char)
                self.pos += 1
        self.error("Unterminated string")

    def parse_number(self):
        start = self.pos
        if self.text[self.pos] == "-":
            self.pos += 1
        while self.pos < self.length and (self.text[self.pos].isdigit() or self.text[self.pos] in ".eE+"):
            self.pos += 1
        raw = self.text[start:self.pos]
        return float(raw) if any(char in raw for char in ".eE") else int(raw)

    def parse_array(self):
        self.pos += 1
        values = []
        while True:
            self.skip_space_and_comments()
            if self.pos >= self.length:
                self.error("Unterminated array")
            if self.text[self.pos] == "]":
                self.pos += 1
                return values
            values.append(self.parse_value())
            self.skip_space_and_comments()
            if self.pos < self.length and self.text[self.pos] == ",":
                self.pos += 1
            elif self.pos < self.length and self.text[self.pos] == "]":
                continue
            else:
                self.error("Expected ',' or ']'")

    def parse_object(self):
        self.pos += 1
        result = {}
        while True:
            self.skip_space_and_comments()
            if self.pos >= self.length:
                self.error("Unterminated object")
            if self.text[self.pos] == "}":
                self.pos += 1
                return result

            if self.text[self.pos] in "'\"`":
                key = self.parse_string(self.text[self.pos])
            else:
                start = self.pos
                while self.pos < self.length and (
                    self.text[self.pos].isalnum() or self.text[self.pos] in "_.$-"
                ):
                    self.pos += 1
                key = self.text[start:self.pos]
                if not key:
                    self.error("Invalid key")

            self.skip_space_and_comments()
            if self.pos >= self.length or self.text[self.pos] != ":":
                self.error("Expected ':'")
            self.pos += 1
            result[key] = self.parse_value()
            self.skip_space_and_comments()
            if self.pos < self.length and self.text[self.pos] == ",":
                self.pos += 1
            elif self.pos < self.length and self.text[self.pos] == "}":
                continue
            else:
                self.error("Expected ',' or '}'")


def parse_js_export(text, export_name):
    marker = f"export const {export_name} ="
    index = text.find(marker)
    if index == -1:
        raise ValueError(f"Export '{export_name}' not found")
    positions = [pos for pos in (text.find("{", index), text.find("[", index)) if pos != -1]
    if not positions:
        raise ValueError(f"Value for '{export_name}' not found")
    return JsLiteralParser(text, min(positions)).parse()


# ---------------------------------------------------------------------------
# Data loading: network -> cache -> reference export -> generic fallback
# ---------------------------------------------------------------------------

def read_text_file(directory, filename):
    path = Path(directory) / filename
    if path.is_file():
        try:
            return path.read_text(encoding="utf-8")
        except OSError:
            return None
    return None


def write_text_file(directory, filename, text):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / filename
    temporary = directory / (filename + ".tmp")
    temporary.write_text(text, encoding="utf-8")
    temporary.replace(target)


def read_cache_meta(directory):
    path = Path(directory) / "meta.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def write_cache_meta(directory):
    data = {
        "updated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": BASE_URL,
    }
    write_text_file(directory, "meta.json", json.dumps(data, ensure_ascii=False, indent=2))


def has_cached_data(directory):
    return all((Path(directory) / filename).is_file() for _, filename, _ in DATA_FILES)


def load_data_texts(data_dir, offline, writable):
    texts = {}
    notes = []
    failures = []
    fetched_any = False
    had_cache = has_cached_data(data_dir)

    for key, filename, url in DATA_FILES:
        if not offline:
            try:
                text = fetch_text(url)
                texts[key] = text
                if writable:
                    write_text_file(data_dir, filename, text)
                fetched_any = True
                continue
            except Exception as exc:
                failures.append(f"{filename}: {exc}")
        cached = read_text_file(data_dir, filename)
        if cached is not None:
            texts[key] = cached

    if failures:
        notes.append(i18n.t("remote_failed", error="; ".join(failures)))
    if texts and not fetched_any and not offline:
        meta = read_cache_meta(data_dir)
        notes.append(i18n.t("cache_used", date=meta.get("updated_at") or i18n.t("status_never")))
    if fetched_any and writable:
        write_cache_meta(data_dir)
        if not had_cache:
            notes.append(i18n.t("cache_saved", dir=str(data_dir)))
    if not texts:
        notes.append(i18n.t("cache_missing"))
    return texts, notes


def parse_items_texts(texts):
    items = {}
    errors = []
    for key, export_name, item_type in (
        ("characters", "characters", "Character"),
        ("weapons", "weaponList", "Weapon"),
    ):
        text = texts.get(key)
        if not text:
            continue
        try:
            data = parse_js_export(text, export_name)
            for entry in data.values():
                if isinstance(entry, dict) and entry.get("name") and entry.get("rarity"):
                    items[clean_item_name(entry["name"])] = (item_type, int(entry["rarity"]))
        except Exception as exc:
            errors.append(f"{export_name}: {exc}")
    return items, errors


def parse_item_ids(texts):
    """Map item names to Paimon.moe ids (the keys of characters/weaponList)."""
    ids = {}
    for key, export_name in (("characters", "characters"), ("weapons", "weaponList")):
        text = texts.get(key)
        if not text:
            continue
        try:
            data = parse_js_export(text, export_name)
            for item_id, entry in data.items():
                if isinstance(entry, dict) and entry.get("name"):
                    ids[clean_item_name(entry["name"])] = str(item_id)
        except Exception:
            continue
    return ids


def slug_item_id(name):
    """Best-effort Paimon.moe id from an item name (offline fallback)."""
    text = clean_item_name(name).lower().replace("'", "").replace("\u2019", "")
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def prepare_remote_banners(banners, dual, server):
    diff = 8 - SERVER_OFFSETS[server]
    for category in ("beginners", "standard", "characters", "weapons", "chronicled"):
        for banner in banners.get(category, []):
            start = parse_datetime(banner["start"])
            end = parse_datetime(banner["end"])
            if banner.get("timezoneDependent") is True:
                start -= datetime.timedelta(hours=diff)
            if banner.get("timezoneDependentEnd") is True:
                end -= datetime.timedelta(hours=diff)
            banner["_start"] = start
            banner["_end"] = end
            banner["_dual_name"] = None

    for pair in dual.values():
        if not isinstance(pair, list) or len(pair) < 2:
            continue
        first, second = pair[0], pair[1]
        if not isinstance(first, dict) or not isinstance(second, dict):
            continue
        first_name = clean_item_name(first.get("name"))
        first_image = first.get("image")
        second_name = clean_item_name(second.get("name"))
        for banner in banners.get("characters", []):
            if banner.get("name") == first_name and banner.get("image") == first_image:
                banner["_dual_name"] = second_name
                break
    return banners


def build_banner_list_rows(banners, server):
    diff = 8 - SERVER_OFFSETS[server]
    rows = []
    for category in ("beginners", "standard", "characters", "weapons", "chronicled"):
        for banner in banners.get(category, []):
            start = parse_datetime(banner["start"]) - datetime.timedelta(hours=diff)
            end = parse_datetime(banner["end"]) - datetime.timedelta(hours=diff)
            rows.append((banner["name"], format_datetime(start), format_datetime(end)))
    return rows


def parse_banners_texts(texts, server):
    banners_text = texts.get("banners")
    if not banners_text:
        return None
    banners = parse_js_export(banners_text, "banners")
    dual_text = texts.get("dual")
    dual = parse_js_export(dual_text, "bannersDual") if dual_text else {}
    prepared = prepare_remote_banners(banners, dual, server)
    return prepared, build_banner_list_rows(banners, server)


def load_reference_file(path):
    items = {}
    banner_rows = []
    dual_hints = []

    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    try:
        for sheet_name in DATA_SHEETS:
            if sheet_name not in workbook.sheetnames:
                continue
            for row in workbook[sheet_name].iter_rows(min_row=2, values_only=True):
                if not row or len(row) < 4:
                    continue
                item_type = str(row[0] or "").strip()
                item_name = clean_item_name(row[1])
                try:
                    rarity = int(row[3])
                except (TypeError, ValueError):
                    continue
                if item_type in ("Character", "Weapon") and item_name:
                    items[item_name] = (item_type, rarity)

        if "Character Event" in workbook.sheetnames:
            for row in workbook["Character Event"].iter_rows(min_row=2, values_only=True):
                if not row or len(row) < 9:
                    continue
                if str(row[8] or "").strip() == "Wish 2":
                    try:
                        dual_hints.append((parse_datetime(row[2]), str(row[7] or "").strip()))
                    except ValueError:
                        pass

        if "Banner List" in workbook.sheetnames:
            for row in workbook["Banner List"].iter_rows(min_row=2, values_only=True):
                if not row or not row[0]:
                    continue
                try:
                    start = parse_datetime(row[1])
                    end = parse_datetime(row[2])
                except (ValueError, IndexError):
                    continue
                banner_rows.append((str(row[0]).strip(), start, end))
    finally:
        workbook.close()

    return items, banner_rows, dual_hints


def build_banner_schedule_from_reference(banner_rows, dual_hints):
    entries = []
    for name, start, end in banner_rows:
        entries.append({
            "name": name,
            "_start": start,
            "_end": end,
            "image": 1,
            "_dual_name": None,
        })

    beginners = [entry for entry in entries if entry["name"] == "Beginners' Wish"]
    standard = [entry for entry in entries if entry["name"] == "Wanderlust Invocation"]
    epitome_indexes = [index for index, entry in enumerate(entries) if entry["name"] == "Epitome Invocation"]

    if epitome_indexes:
        first_weapon = min(epitome_indexes)
        last_weapon = max(epitome_indexes)
        characters = [
            entry for entry in entries[:first_weapon]
            if entry["name"] not in ("Beginners' Wish", "Wanderlust Invocation")
        ]
        weapons = [entry for entry in entries[first_weapon:last_weapon + 1] if entry["name"] == "Epitome Invocation"]
        chronicled = entries[last_weapon + 1:]
    else:
        characters = [
            entry for entry in entries
            if entry["name"] not in ("Beginners' Wish", "Wanderlust Invocation")
        ]
        weapons = []
        chronicled = []

    for moment, name in dual_hints:
        for banner in characters:
            if banner["_start"] <= moment < banner["_end"]:
                banner["_dual_name"] = name
                break

    return {
        "beginners": beginners,
        "standard": standard,
        "characters": characters,
        "weapons": weapons,
        "chronicled": chronicled,
    }


def make_generic_banners():
    begin = datetime.datetime(2000, 1, 1)
    end = datetime.datetime(2200, 1, 1)

    def banner(name, dual_name=None):
        return {"name": name, "_start": begin, "_end": end, "image": 1, "_dual_name": dual_name}

    return {
        "beginners": [banner("Beginners' Wish")],
        "standard": [banner("Wanderlust Invocation")],
        "characters": [banner("Character Event Wish", "Character Event Wish 2")],
        "weapons": [banner("Epitome Invocation")],
        "chronicled": [banner("Chronicled Wish")],
    }


def is_paimon_export(path):
    try:
        workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    except Exception:
        return False
    try:
        return "Banner List" in workbook.sheetnames and "Information" in workbook.sheetnames
    finally:
        workbook.close()


def find_reference_file(source_path, output_path):
    source = Path(source_path).resolve() if source_path else None
    output = Path(output_path).resolve() if output_path else None
    directories = []
    for directory in (Path.cwd(), SCRIPT_DIR):
        if directory.is_dir() and directory.resolve() not in [item.resolve() for item in directories]:
            directories.append(directory)

    for directory in directories:
        for entry in sorted(directory.iterdir()):
            if not entry.is_file() or entry.suffix.lower() != ".xlsx" or entry.name.startswith("~$"):
                continue
            resolved = entry.resolve()
            if resolved in (source, output):
                continue
            name = entry.name.lower()
            if name == "paimonmoe_wish_history_import.xlsx" or entry.stem.lower().endswith("_paimonmoe"):
                continue
            if is_paimon_export(entry):
                return str(entry)
    return None


def load_everything(reference_path, server, offline, data_dir):
    items = dict(FALLBACK_ITEMS)
    item_ids = {}
    banners = None
    banner_list_rows = None
    notes = []

    reference_banners = []
    reference_dual = []
    if reference_path:
        try:
            reference_items, reference_banners, reference_dual = load_reference_file(reference_path)
            items.update(reference_items)
            notes.append(i18n.t("reference_used", file=str(reference_path)))
        except Exception as exc:
            notes.append(i18n.t("error", error=exc))

    writable = not offline and Path(data_dir).resolve() == DEFAULT_CACHE_DIR.resolve()
    texts, data_notes = load_data_texts(data_dir, offline, writable)
    notes.extend(data_notes)

    if texts:
        parsed_items, item_errors = parse_items_texts(texts)
        items.update(parsed_items)
        item_ids.update(parse_item_ids(texts))
        for error in item_errors:
            notes.append(i18n.t("data_parse_failed", error=error))

        try:
            parsed_banners = parse_banners_texts(texts, server)
        except Exception as exc:
            parsed_banners = None
            notes.append(i18n.t("data_parse_failed", error=exc))
        if parsed_banners:
            banners, banner_list_rows = parsed_banners

    if banners is None and reference_banners:
        banners = build_banner_schedule_from_reference(reference_banners, reference_dual)
        banner_list_rows = [
            (name, format_datetime(start), format_datetime(end))
            for name, start, end in reference_banners
        ]

    if banners is None:
        banners = make_generic_banners()
        banner_list_rows = [
            (name, format_datetime(start), format_datetime(end))
            for category in ("beginners", "standard", "characters", "weapons", "chronicled")
            for name, start, end in [
                (banners[category][0]["name"], banners[category][0]["_start"], banners[category][0]["_end"])
            ]
        ]
        notes.append(i18n.t("generic_banners"))

    return items, item_ids, banners, banner_list_rows, notes


# ---------------------------------------------------------------------------
# Source parsing
# ---------------------------------------------------------------------------

def make_record(no_raw, uid, wish_type, item_name, time_value, line_number):
    try:
        number = int(str(no_raw).strip())
    except ValueError:
        raise ValueError(f"Line {line_number}: invalid pull number ({no_raw!r})")

    try:
        moment = parse_datetime(time_value)
    except ValueError as exc:
        raise ValueError(f"Line {line_number}: {exc}")

    category, is_wish_2 = normalize_wish_type(wish_type)
    return {
        "no": number,
        "uid": str(uid).strip() if uid is not None else "",
        "wish_type": str(wish_type).strip(),
        "category": category,
        "wish2": is_wish_2,
        "item_name": clean_item_name(item_name),
        "dt": moment,
        "time": format_datetime(moment),
        "line": line_number,
    }


def _debug_print_rows(file_path):
    """Print the first rows of each sheet for diagnosis."""
    suffix = Path(file_path).suffix.lower()
    if suffix == ".csv":
        with open(file_path, mode="r", encoding="utf-8-sig", errors="replace", newline="") as handle:
            reader = csv.reader(handle)
            rows = [r for r in reader][:8]
        print("[debug] CSV rows:")
        for i, row in enumerate(rows, start=1):
            print("  row %d: %r" % (i, row))
        return
    try:
        workbook = openpyxl.load_workbook(file_path, data_only=True, read_only=False)
    except Exception as exc:
        print("[debug] Could not open file: %s" % exc)
        return
    try:
        for name in workbook.sheetnames:
            sheet = workbook[name]
            rows = list(sheet.iter_rows(min_row=1, max_row=8, values_only=True))
            merged = list(sheet.merged_cells.ranges)
            print("[debug] Sheet '%s' (%d rows, %d merged):" % (name, sheet.max_row, len(merged)))
            if merged:
                    print('  merged: %s' % merged[:10])
            for i, row in enumerate(rows, start=1):
                print("  row %d: %r" % (i, row))
    finally:
        workbook.close()


_COLUMN_KEYWORDS = {
    "no": ("no.", "no ", "#", "index", "number", "num", "序号", "번호", "番号", "номер"),
    "uid": ("uid", "user id", "user_id", "ユーザー", "用户", "player", "player id"),
    "type": ("type", "wish type", "wish_type", "tipo", "typ", "тип", "类型", "種類", "gacha", "gacha type"),
    "name": ("award", "name", "item", "oggetto", "nom", "nombre", "название", "名称", "아이템", "prize", "wish award"),
    "time": ("time", "date", "ora", "temps", "zeit", "hora", "время", "時間", "日時", "datetime", "timestamp", "wish time"),
}


def _detect_header_and_columns(rows):
    """Detect header row and column mapping from a list of row tuples.

    Scans the first 30 rows for a header row containing recognizable column
    names.  Returns (header_index, column_map) where column_map maps field
    names to column indices, or (None, None) if no header is detected.
    """
    for idx, row in enumerate(rows[:30]):
        if not row or all(c is None for c in row):
            continue
        first_cell = row[0] if row else None
        if first_cell is not None and str(first_cell).strip().isdigit():
            continue

        cells = [str(c).strip().lower() if c is not None else "" for c in row]

        col_map = {}
        for i, cell in enumerate(cells):
            best_field = None
            best_len = 0
            for field, keywords in _COLUMN_KEYWORDS.items():
                if field in col_map:
                    continue
                for kw in keywords:
                    if kw in cell and len(kw) > best_len:
                        best_field = field
                        best_len = len(kw)
            if best_field:
                col_map[best_field] = i

        if len(col_map) >= 2:
            defaults = {"no": 0, "uid": 1, "type": 2, "name": 3, "time": 4}
            for field, default in defaults.items():
                if field not in col_map and default < len(row):
                    col_map[field] = default
            return idx, col_map

    return None, None


def parse_source_file(file_path):
    suffix = Path(file_path).suffix.lower()

    if suffix == ".xls":
        raise ValueError(
            "Old Excel format (.xls) is not supported. "
            "Please convert the file to .xlsx or .csv first."
        )
    if suffix not in (".xlsx", ".csv"):
        raise ValueError(i18n.t("unsupported_format", ext=suffix or "?"))

    # Reset diagnostic state
    parse_source_file._sample_first_col = []

    sheets = []

    if suffix == ".csv":
        with open(file_path, mode="r", encoding="utf-8-sig", errors="replace", newline="") as handle:
            sample = handle.read(4096)
            handle.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
            except csv.Error:
                dialect = csv.excel
            reader = csv.reader(handle, dialect)
            rows = [r for r in reader]
        sheets.append(("CSV", rows))
    else:
        # Use normal mode (not read_only) because read_only mode does not
        # handle merged cells or sparse rows correctly: it returns only the
        # cells actually defined in the XML, which can be a single column
        # even when the sheet visually has five.  Normal mode fills missing
        # cells with None so every row has a consistent length.
        try:
            workbook = openpyxl.load_workbook(file_path, data_only=True, read_only=False)
        except Exception as exc:
            raise ValueError("Could not read the Excel file. Is it a valid .xlsx? (%s)" % exc)
        try:
            for name in workbook.sheetnames:
                ws = workbook[name]
                # Read all rows; normal mode fills merged/empty cells with None.
                sheet_rows = list(ws.iter_rows(values_only=True))
                # If the sheet has merged cells, ensure values propagate.
                if ws.merged_cells.ranges:
                    for merged in ws.merged_cells.ranges:
                        top_left = ws.cell(row=merged.min_row, column=merged.min_col).value
                        for r in range(merged.min_row, merged.max_row + 1):
                            for c in range(merged.min_col, merged.max_col + 1):
                                if r >= 1 and c >= 1:
                                    # Find the row in sheet_rows (0-based)
                                    row_idx = r - 1
                                    col_idx = c - 1
                                    if row_idx < len(sheet_rows):
                                        row_list = list(sheet_rows[row_idx])
                                        while len(row_list) <= col_idx:
                                            row_list.append(None)
                                        if row_list[col_idx] is None and top_left is not None:
                                            row_list[col_idx] = top_left
                                        sheet_rows[row_idx] = tuple(row_list)
                sheets.append((name, sheet_rows))
        finally:
            workbook.close()

    all_records = []
    sheets_tried = []
    sheets_with_data = []
    skipped_no_digit = 0
    skipped_parse_error = 0
    unknown_types = set()

    for sheet_name, rows in sheets:
        sheets_tried.append(sheet_name)
        if not rows:
            continue

        header_idx, col_map = _detect_header_and_columns(rows)

        if header_idx is not None:
            data_start = header_idx + 1
        else:
            data_start = 0
            col_map = {"no": 0, "uid": 1, "type": 2, "name": 3, "time": 4}

        sheet_records = []
        for line_number, raw in enumerate(rows[data_start:], start=data_start + 1):
            if not raw or all(c is None for c in raw):
                continue

            row = list(raw)
            while len(row) < 5:
                row.append(None)

            no_col = col_map.get("no", 0)
            no_raw = row[no_col] if no_col < len(row) else None
            # Accept integers, floats (1.0), and strings containing a number.
            no_value = None
            if no_raw is not None:
                text = str(no_raw).strip()
                # Remove invisible characters (BOM, zero-width spaces, etc.)
                for cp in (0xFEFF, 0x200B, 0x200C, 0x200D, 0x00A0, 0x200E, 0x200F):
                    text = text.replace(chr(cp), "")
                text = text.strip()
                # Remove common non-numeric prefixes/suffixes
                text = text.strip("#").strip(".").strip()
                # Try direct numeric conversion
                try:
                    no_value = int(float(text))
                except (ValueError, TypeError):
                    # Fallback: extract leading digits from text like "No. 1", "1st", "#1"
                    import re as _re
                    match = _re.match(r"^\\s*(\\d+)", text)
                    if match:
                        no_value = int(match.group(1))
            if no_value is None:
                skipped_no_digit += 1
                # Track the actual value for diagnostics
                if not hasattr(parse_source_file, "_sample_first_col"):
                    parse_source_file._sample_first_col = []
                if len(parse_source_file._sample_first_col) < 5:
                    parse_source_file._sample_first_col.append(repr(no_raw))
                continue

            no_raw = no_value
            uid_col = col_map.get("uid", 1)
            type_col = col_map.get("type", 2)
            name_col = col_map.get("name", 3)
            time_col = col_map.get("time", 4)

            uid = row[uid_col] if uid_col < len(row) else None
            wish_type = row[type_col] if type_col < len(row) else None
            item_name = row[name_col] if name_col < len(row) else None
            time_value = row[time_col] if time_col < len(row) else None

            try:
                record = make_record(no_raw, uid, wish_type, item_name, time_value, line_number)
                sheet_records.append(record)
            except ValueError as exc:
                skipped_parse_error += 1
                msg = str(exc)
                if "Unrecognized wish type" in msg:
                    unknown_types.add(str(wish_type))
                continue

        if sheet_records:
            sheets_with_data.append((sheet_name, len(sheet_records)))
            all_records.extend(sheet_records)

    if not all_records:
        parts = []
        parts.append("Sheets tried: %s." % ", ".join(sheets_tried))
        if sheets_with_data:
            parts.append("Sheets with data: %s." % ", ".join(
                "%s (%d rows)" % (n, c) for n, c in sheets_with_data))
        else:
            parts.append("No sheet contained recognizable pull data.")
        if skipped_no_digit:
            parts.append("%d row(s) skipped (first column not numeric)." % skipped_no_digit)
            if getattr(parse_source_file, "_sample_first_col", None):
                samples = ", ".join(parse_source_file._sample_first_col)
                parts.append("Sample first-column values: %s." % samples)
        if skipped_parse_error:
            parts.append("%d row(s) skipped (parse errors, e.g. unknown wish type or invalid date)." % skipped_parse_error)
        if unknown_types:
            parts.append("Unknown wish types: %s." % ", ".join(sorted(unknown_types)))
        # Check if all rows had only 1 column (possible merged cells or sparse data)
        if skipped_no_digit > 0 and not sheets_with_data:
            parts.append("All rows appear to have a single column. This may indicate merged cells or a different file layout. Try: open the file in Excel, select all, copy, paste into a new workbook, and save as .xlsx.")
        parts.append("Expected columns: No., UID, Wish type, Wish award, Wish time.")
        parts.append("Tip: run with --debug-rows to see the raw cell values.")
        raise ValueError(" ".join(parts))

    if skipped_no_digit or skipped_parse_error:
        if skipped_no_digit:
            print("[!] %d row(s) skipped (non-numeric first column, likely header or empty rows)." % skipped_no_digit)
        if skipped_parse_error:
            print("[!] %d row(s) skipped (parse errors, e.g. unknown wish type or invalid date)." % skipped_parse_error)
        if unknown_types:
            print("[!] Unknown wish types: %s." % ", ".join(sorted(unknown_types)))

    # The HoYo export is newest-first. Within the same second, the lower
    # "No." is the newer pull, so the chronological order is time ascending,
    # No. descending.
    all_records.sort(key=lambda row: (row["dt"], -row["no"]))
    return all_records


# ---------------------------------------------------------------------------
# Pity, banner, #Roll, Group
# ---------------------------------------------------------------------------

def enrich_category(rows, banners, category):
    pity_4 = 0
    pity_5 = 0
    current_index = -1
    current_banner = None
    roll = 0
    group = 0
    last_time = None

    for row in rows:
        rarity = row["rarity"]

        pity_4 += 1
        pity_5 += 1
        if rarity == 5:
            row["pity"] = pity_5
            pity_5 = 0
        elif rarity == 4:
            row["pity"] = pity_4
            pity_4 = 0
        else:
            row["pity"] = 1

        if current_banner is None or current_banner["_end"] < row["dt"]:
            found = None
            new_banner = False
            for index in range(current_index + 1, len(banners)):
                candidate = banners[index]
                if candidate["_start"] <= row["dt"] < candidate["_end"]:
                    found = (index, candidate)
                    new_banner = True
                    break
            if found is None:
                if current_banner is None:
                    raise ValueError(i18n.t("no_banner", time=row["time"], item=row["item_name"]))
                found = (current_index, current_banner)
                new_banner = False
            current_index, current_banner = found
            if new_banner:
                roll = 0
                group = 0

        roll += 1
        if last_time != row["time"]:
            group += 1
        row["roll"] = roll
        row["group"] = group
        last_time = row["time"]

        if row["wish2"]:
            row["banner"] = current_banner.get("_dual_name") or current_banner["name"]
            row["part"] = "Wish 2"
        else:
            row["banner"] = current_banner["name"]
            row["part"] = ""
        row["_featured"] = current_banner.get("featured") or []
        row["_featured_rare"] = current_banner.get("featuredRare") or []

    return rows


def apply_stripes(rows):
    grouped = False
    striped = False
    for index, row in enumerate(rows):
        next_time = rows[index + 1]["time"] if index + 1 < len(rows) else None
        if not grouped and next_time == row["time"]:
            striped = not striped
            grouped = True
        elif grouped and next_time != row["time"]:
            grouped = False
        elif grouped:
            pass
        else:
            striped = not striped
        row["striped"] = striped


# ---------------------------------------------------------------------------
# Excel writing
# ---------------------------------------------------------------------------

HEADERS = ["Type", "Name", "Time", "⭐", "Pity", "#Roll", "Group", "Banner", "Part"]
COLUMN_WIDTHS = [9, 32, 22, 2.5, 4, 7, 7, 30, 9]
THIN_BORDER = Border(
    left=Side(style="thin", color="FFDDDDDD"),
    right=Side(style="thin", color="FFDDDDDD"),
    bottom=Side(style="thin", color="FFDDDDDD"),
)


def write_history_sheet(sheet, rows):
    sheet.freeze_panes = "A2"

    for index, (header, width) in enumerate(zip(HEADERS, COLUMN_WIDTHS), start=1):
        cell = sheet.cell(row=1, column=index, value=header)
        cell.font = Font(bold=True)
        sheet.column_dimensions[get_column_letter(index)].width = width

    for row_index, row in enumerate(rows, start=2):
        fill = PatternFill(
            start_color="FFEEEEEE" if row["striped"] else "FFFFFFFF",
            end_color="FFEEEEEE" if row["striped"] else "FFFFFFFF",
            fill_type="solid",
        )

        if row["rarity"] == 5:
            font = Font(color="FFCC9832", bold=True)
        elif row["rarity"] == 4:
            font = Font(color="FF8A6995", bold=True)
        else:
            font = Font(color="FF000000")

        values = [
            row["type"],
            row["item_name"],
            row["time"],
            row["rarity"],
            row["pity"],
            row["roll"],
            row["group"],
            row["banner"],
            row["part"],
        ]

        for column_index, value in enumerate(values, start=1):
            cell = sheet.cell(row=row_index, column=column_index, value=value)
            cell.fill = fill
            cell.font = font
            cell.border = THIN_BORDER
            if column_index in (4, 5, 6, 7):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")


def write_banner_list_sheet(sheet, banner_rows):
    for index, (header, width) in enumerate(zip(["Name", "Start", "End"], [32, 19, 19]), start=1):
        cell = sheet.cell(row=1, column=index, value=header)
        cell.font = Font(bold=True)
        sheet.column_dimensions[get_column_letter(index)].width = width

    for row_index, (name, start, end) in enumerate(banner_rows, start=2):
        sheet.cell(row=row_index, column=1, value=name)
        sheet.cell(row=row_index, column=2, value=start)
        sheet.cell(row=row_index, column=3, value=end)


def write_information_sheet(sheet):
    sheet.column_dimensions["A"].width = 28
    sheet.column_dimensions["B"].width = 28
    sheet.cell(row=1, column=1, value="Paimon.moe Wish History Export").font = Font(bold=True)
    sheet.cell(row=2, column=1, value="Version")
    sheet.cell(row=2, column=2, value=3)
    sheet.cell(row=3, column=1, value="Export Date")
    sheet.cell(row=3, column=2, value=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    sheet.merge_cells("A1:B1")


def enrich_records(records, items_db, banners):
    unknown = []
    for row in records:
        item = items_db.get(row["item_name"])
        if item is None:
            unknown.append(row["item_name"])
            continue
        row["type"], row["rarity"] = item

    if unknown:
        unique = sorted(set(unknown))
        raise ValueError(i18n.t("unknown_items", items=", ".join(unique)))

    by_category = defaultdict(list)
    for row in records:
        by_category[row["category"]].append(row)

    for category, category_rows in by_category.items():
        selected_banners = banners.get(category, [])
        if not selected_banners:
            raise ValueError(i18n.t("no_banner", time=category_rows[0]["time"], item=category_rows[0]["item_name"]))
        enrich_category(category_rows, selected_banners, category)
        apply_stripes(category_rows)

    return by_category


def build_paimon_excel(records, items_db, banners, banner_list_rows, output_path):
    by_category = enrich_records(records, items_db, banners)

    workbook = openpyxl.Workbook()
    workbook.remove(workbook.active)
    workbook.properties.creator = "Wishporter"

    sheets = {}
    for category in ("characters", "weapons", "standard", "beginners", "chronicled"):
        sheet_name = CATEGORY_TO_SHEET[category]
        sheets[category] = workbook.create_sheet(title=sheet_name)

    for category, sheet in sheets.items():
        write_history_sheet(sheet, by_category.get(category, []))

    write_banner_list_sheet(workbook.create_sheet(title="Banner List"), banner_list_rows)
    write_information_sheet(workbook.create_sheet(title="Information"))

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)
    return by_category


def compute_rates(rows):
    """Mirror Paimon.moe's 50/50 win/loss calculation for a single category."""
    rate_up_5 = False
    rate_up_4 = False
    off_5 = {"win": 0, "lose": 0, "maxStreak": 0, "currentStreak": 0}
    off_4 = {"win": 0, "lose": 0, "maxStreak": 0, "currentStreak": 0}
    latest_5 = None
    latest_4 = None
    has_featured_5 = False
    has_featured_4 = False

    for row in rows:
        if row["rarity"] == 5:
            featured = row.get("_featured") or []
            if featured:
                has_featured_5 = True
                guaranteed = rate_up_5
                win = (row.get("_item_id") in featured)
                rate_up_5 = not win
                row["rate"] = int(bool(guaranteed)) + int(bool(win))
                latest_5 = row["rate"]
                if rate_up_5:
                    off_5["lose"] += 1
                    off_5["maxStreak"] = max(off_5["maxStreak"], off_5["currentStreak"])
                    off_5["currentStreak"] = 0
                elif not guaranteed:
                    off_5["win"] += 1
                    off_5["currentStreak"] += 1
        elif row["rarity"] == 4:
            featured = row.get("_featured_rare") or []
            if featured:
                has_featured_4 = True
                guaranteed = rate_up_4
                win = (row.get("_item_id") in featured)
                rate_up_4 = not win
                row["rate"] = int(bool(guaranteed)) + int(bool(win))
                latest_4 = row["rate"]
                if rate_up_4:
                    off_4["lose"] += 1
                    off_4["maxStreak"] = max(off_4["maxStreak"], off_4["currentStreak"])
                    off_4["currentStreak"] = 0
                elif not guaranteed:
                    off_4["win"] += 1
                    off_4["currentStreak"] += 1

    off_5["maxStreak"] = max(off_5["maxStreak"], off_5["currentStreak"])
    off_4["maxStreak"] = max(off_4["maxStreak"], off_4["currentStreak"])

    guaranteed_5 = (latest_5 == 0) if latest_5 is not None else False
    guaranteed_4 = (latest_4 == 0) if latest_4 is not None else False

    return off_5, off_4, guaranteed_5, guaranteed_4, has_featured_5, has_featured_4


def build_paimon_json(by_category, item_ids, uid=None, output_path=None, existing_data=None):
    if isinstance(existing_data, dict):
        data = dict(existing_data)
    else:
        data = {}
    for category, rows in (by_category or {}).items():
        if category not in CATEGORY_TO_STORAGE_KEY or not rows:
            continue
        for row in rows:
            row["_item_id"] = item_ids.get(row["item_name"]) if item_ids else None
            if not row["_item_id"]:
                row["_item_id"] = slug_item_id(row["item_name"])

        if category in RATE_CATEGORIES:
            off_5, off_4, guaranteed_5, guaranteed_4, has_5, has_4 = compute_rates(rows)

        pulls = []
        legendary = 0
        rare = 0
        for row in rows:
            legendary += 1
            rare += 1
            if row["rarity"] == 5:
                legendary = 0
            elif row["rarity"] == 4:
                rare = 0

            code = CATEGORY_TO_GACHA_TYPE[category]
            if category == "characters" and row.get("wish2"):
                code = 400

            pull = {
                "id": row["_item_id"],
                "time": row["time"],
                "type": str(row["type"]).lower(),
                "pity": row["pity"],
                "code": code,
            }
            if "rate" in row:
                pull["rate"] = row["rate"]
            pulls.append(pull)

        counter = {
            "total": len(rows),
            "legendary": legendary,
            "rare": rare,
            "pulls": pulls,
        }

        if category in RATE_CATEGORIES:
            if has_5 or has_4:
                counter["guaranteed"] = {"legendary": bool(guaranteed_5), "rare": bool(guaranteed_4)}
                counter["rateoff"] = {"legendary": off_5, "rare": off_4}

        data[CATEGORY_TO_STORAGE_KEY[category]] = counter

    if uid:
        data["wish-uid"] = str(uid).strip()

    data["wish-counter-setting"] = {"firstTime": False, "manualInput": False}
    data["update-time"] = datetime.datetime.now().replace(microsecond=0).isoformat() + "Z"

    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    return data


# ---------------------------------------------------------------------------
# Interactive input
# ---------------------------------------------------------------------------

def resolve_source(raw):
    raw = str(raw).strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
        raw = raw[1:-1]
    variants = [raw]
    if "\\ " in raw:
        variants.append(raw.replace("\\ ", " "))
    if raw.lower().startswith("file://"):
        parsed = urllib.parse.urlparse(raw)
        path = urllib.parse.unquote(parsed.path)
        if os.name == "nt" and path.startswith("/") and len(path) > 2 and path[2] == ":":
            path = path[1:]
        variants.append(path)

    for variant in variants:
        if not variant:
            continue
        path = Path(variant).expanduser()
        for candidate in (path, Path.cwd() / path, SCRIPT_DIR / path):
            try:
                if candidate.is_file():
                    return candidate.resolve()
            except OSError:
                continue
    return None


def find_candidates():
    result = []
    seen = set()
    for directory in (SCRIPT_DIR, Path.cwd()):
        try:
            entries = sorted(directory.iterdir())
        except OSError:
            continue
        for entry in entries:
            if not entry.is_file() or entry.suffix.lower() not in (".xlsx", ".csv"):
                continue
            if entry.name.startswith("~$"):
                continue
            if entry.name.lower().startswith("paimonmoe"):
                continue
            if entry.stem.lower().endswith("_paimonmoe"):
                continue
            resolved = entry.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            result.append(entry)
    return result


def prompt_for_source():
    candidates = None
    prompt = i18n.t("prompt_source")
    while True:
        print(prompt)
        try:
            raw = input("> ").strip()
        except EOFError:
            return None
        if raw.lower() in ("q", "quit", "exit"):
            return None
        if raw:
            path = resolve_source(raw)
            if path is not None:
                return path
            if raw.isdigit() and candidates:
                index = int(raw) - 1
                if 0 <= index < len(candidates):
                    return candidates[index]
            print(i18n.t("source_not_found", path=raw))

        if candidates is None:
            candidates = find_candidates()
        if candidates:
            print(i18n.t("candidates_header"))
            for index, candidate in enumerate(candidates, start=1):
                print(f"  {index}. {candidate.name}")
            print(i18n.t("candidates_pick"))
        prompt = i18n.t("prompt_source_again")


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


def default_output(source):
    return Path(source).with_name(f"{Path(source).stem}_paimonmoe.xlsx")


def timestamped_output(source):
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    return Path(source).with_name(f"{Path(source).stem}_paimonmoe_{stamp}.xlsx")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args(argv):
    parser = argparse.ArgumentParser(
        description="Convert a Genshin Impact wish history export into a Paimon.moe Excel file."
    )
    parser.add_argument("source", nargs="?", help="source .xlsx or .csv file")
    parser.add_argument("-o", "--output", help="output .xlsx file")
    parser.add_argument("--reference", help="Paimon.moe export used as offline banner fallback")
    parser.add_argument("--server", choices=sorted(SERVER_OFFSETS), help="Genshin server (default: from UID)")
    parser.add_argument("--offline", action="store_true", help="do not download data from paimon.moe")
    parser.add_argument("--data-dir", help="read Paimon.moe data files from this directory (read-only)")
    parser.add_argument("--lang", choices=i18n.available_languages(), help="UI language")
    parser.add_argument("--yes", action="store_true", help="overwrite without asking and avoid prompts")
    parser.add_argument("--debug", action="store_true", help="show full error details")
    parser.add_argument("--paimon-backup", help="existing Paimon.moe backup JSON to merge into (preserves server/ar/wl/etc.)")
    parser.add_argument("--debug-rows", action="store_true", help="print the first rows of each sheet for diagnosis")
    parser.add_argument("--version", action="store_true", help="show version and exit")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    i18n.set_language(args.lang)

    if args.version:
        print(f"{i18n.t('app_name')} {VERSION}")
        return 0

    print(f"{i18n.t('app_name')} {VERSION}")
    print(i18n.t("app_tagline"))
    print()

    try:
        source = Path(args.source).expanduser() if args.source else prompt_for_source()
        if source is None:
            print(i18n.t("cancelled"))
            return 1
        if not source.is_file():
            print(i18n.t("error", error=i18n.t("source_not_found", path=source)))
            return 1
        source = source.resolve()

        output = Path(args.output).expanduser() if args.output else default_output(source)
        if output.resolve() == source:
            print(i18n.t("error", error=i18n.t("source_is_output")))
            return 1

        if output.exists() and not args.yes:
            if not ask_yes_no(i18n.t("output_exists"), default=False):
                output = timestamped_output(source)
                print(i18n.t("output_renamed", file=str(output)))

        print(i18n.t("reading_source", file=str(source)))

        if args.debug_rows:
            _debug_print_rows(source)

        records = parse_source_file(source)
        if not records:
            print(i18n.t("no_pulls"))
            return 1

        uid = records[0]["uid"]
        server = args.server or detect_server(uid)
        print(i18n.t("detected", uid=uid or "N/A", server=server, count=len(records)))

        data_dir = Path(args.data_dir).expanduser() if args.data_dir else DEFAULT_CACHE_DIR
        reference_file = args.reference
        # Only look for a Paimon.moe export when no local data files are
        # available: an explicit --data-dir or a populated cache wins.
        if not reference_file and not has_cached_data(data_dir):
            found = find_reference_file(source, output)
            if found is not None:
                reference_file = found
            elif not args.yes and sys.stdin.isatty():
                # First run without cache or reference: give the user a chance
                # to provide a Paimon.moe export, or press Enter to download
                # the public banner data once (online) / continue with generic
                # names (offline).
                print()
                print(i18n.t("reference_missing"))
                if args.offline:
                    print(i18n.t("reference_prompt_offline"))
                else:
                    print(i18n.t("reference_prompt"))
                try:
                    raw = input("> ").strip()
                except EOFError:
                    raw = ""
                if raw:
                    resolved = resolve_source(raw)
                    if resolved is not None:
                        reference_file = resolved
                        print(i18n.t("reference_accepted", file=str(reference_file)))
                    else:
                        print(i18n.t("source_not_found", path=raw))

        if args.offline:
            print(i18n.t("offline_mode"))

        items_db, item_ids, banners, banner_list_rows, notes = load_everything(
            reference_file, server, args.offline, data_dir
        )
        for note in notes:
            print(note)

        print(i18n.t("writing"))
        by_category = build_paimon_excel(records, items_db, banners, banner_list_rows, output)

        # Optional merge with an existing Paimon.moe backup JSON so that
        # server/ar/wl/collectables/todos are preserved instead of wiped.
        existing_data = None
        backup_path = args.paimon_backup
        if not backup_path:
            for candidate in sorted(Path.cwd().iterdir()):
                if not candidate.is_file() or candidate.suffix.lower() != ".json":
                    continue
                if candidate.resolve() == output.with_suffix(".json").resolve():
                    continue
                try:
                    candidate_data = json.loads(candidate.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                if isinstance(candidate_data, dict) and any(
                    str(key).startswith("wish-counter-") for key in candidate_data
                ):
                    backup_path = candidate
                    break
        if backup_path:
            try:
                existing_data = json.loads(Path(backup_path).read_text(encoding="utf-8"))
                print(i18n.t("backup_merged", file=str(backup_path)))
            except (OSError, ValueError) as exc:
                print(i18n.t("error", error=exc))

        json_output = output.with_suffix(".json")
        build_paimon_json(by_category, item_ids, uid=uid, output_path=json_output, existing_data=existing_data)

        summary = ", ".join(
            f"{CATEGORY_TO_SHEET[category]} {len(by_category.get(category, []))}"
            for category in ("characters", "weapons", "standard", "beginners", "chronicled")
        )
        print(i18n.t("exported", summary=summary))
        print(i18n.t("success", file=str(output)))
        print(i18n.t("json_written", file=str(json_output)))
        print(i18n.t("import_note"))
        print(i18n.t("import_note_json"))
        return 0

    except KeyboardInterrupt:
        print()
        print(i18n.t("cancelled"))
        return 130
    except Exception as exc:
        if args.debug:
            traceback.print_exc()
        else:
            print(i18n.t("error", error=exc))
            print(i18n.t("debug_hint"))
        return 1


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    sys.exit(main())
