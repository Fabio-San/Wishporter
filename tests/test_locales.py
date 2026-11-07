# -*- coding: utf-8 -*-
"""Locale catalog consistency and key coverage tests."""

import json
import os
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import i18n  # noqa: E402

LOCALES = ROOT / "locales"
PLACEHOLDER = re.compile(r"\{(\w+)\}")
USED_KEY = re.compile(r"i18n\.t\(\s*['\"]([A-Za-z0-9_]+)['\"]")


def load_catalog(lang):
    return json.loads((LOCALES / (lang + ".json")).read_text(encoding="utf-8"))


class LocaleTests(unittest.TestCase):
    def test_all_supported_catalogs_exist(self):
        for lang in i18n.SUPPORTED:
            self.assertTrue((LOCALES / (lang + ".json")).is_file(), lang)

    def test_catalogs_have_the_same_keys(self):
        base = load_catalog("en")
        self.assertTrue(base)
        for lang in i18n.SUPPORTED:
            catalog = load_catalog(lang)
            self.assertEqual(set(catalog), set(base), lang)
            for key, value in catalog.items():
                self.assertTrue(str(value).strip(), "%s: empty value for %s" % (lang, key))

    def test_placeholders_match_english(self):
        base = load_catalog("en")
        for lang in i18n.SUPPORTED:
            catalog = load_catalog(lang)
            for key in base:
                self.assertEqual(
                    set(PLACEHOLDER.findall(catalog[key])),
                    set(PLACEHOLDER.findall(base[key])),
                    "%s: placeholders differ for %s" % (lang, key),
                )

    def test_every_key_used_in_code_exists(self):
        base = load_catalog("en")
        for filename in ("convert.py", "run.py"):
            text = (ROOT / filename).read_text(encoding="utf-8")
            for key in USED_KEY.findall(text):
                self.assertIn(key, base, "%s uses missing key %s" % (filename, key))

    def test_language_detection_and_override(self):
        with mock.patch.dict(os.environ, {"PAIMON_LANG": "fr"}, clear=False):
            self.assertEqual(i18n.detect_language(), "fr")
        with mock.patch.dict(os.environ, {"PAIMON_LANG": "xx"}, clear=False):
            self.assertIn(i18n.detect_language(), i18n.SUPPORTED)

    def test_missing_key_falls_back_to_the_key(self):
        i18n.set_language("en")
        self.assertEqual(i18n.t("this_key_does_not_exist"), "this_key_does_not_exist")

    def test_language_switch(self):
        self.assertEqual(i18n.set_language("it"), "it")
        self.assertEqual(i18n.t("cancelled"), "Annullato.")
        self.assertEqual(i18n.set_language("en"), "en")
        self.assertEqual(i18n.t("cancelled"), "Cancelled.")


if __name__ == "__main__":
    unittest.main()
