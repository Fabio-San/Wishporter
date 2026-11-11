# -*- coding: utf-8 -*-
"""End-to-end tests using a synthetic HoYo Excel export and fixture data."""

import contextlib
import csv
import io
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import convert  # noqa: E402

DATA_DIR = ROOT / "tests" / "fixtures" / "data"
HEADERS = ["No.", "UID", "Wish type", "Wish award", "Wish time"]
ROWS = [
    (10, "700000001", "Character Event Wish", "Test Four Star", "2024-01-05 12:00:00"),
    (9, "700000001", "Character Event Wish", "Test Five Star", "2024-01-05 12:00:00"),
    (8, "700000001", "Weapon Event Wish", "Test Weapon", "2024-01-06 12:00:00"),
    (7, "700000001", "Standard Wish", "Test Sword", "2024-01-07 12:00:00"),
    (5, "700000001", "Standard Wish", "Test Sword", "2024-01-07 12:01:00"),
    (4, "700000001", "Standard Wish", "Test Weapon", "2024-01-07 12:02:00"),
    (6, "700000001", "Novice Wishes", "Test Four Star", "2024-01-08 12:00:00"),
    (11, "700000001", "Character Event Wish-2", "Test Four Star", "2024-01-09 12:00:00"),
]
SHEETS = ["Character Event", "Weapon Event", "Standard", "Beginners' Wish", "Chronicled Wish"]


def write_xlsx(path):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(HEADERS)
    for row in ROWS:
        sheet.append(row)
    workbook.save(path)
    workbook.close()


def write_csv(path):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADERS)
        writer.writerows(ROWS)


def run_converter(source, output):
    stdout = io.StringIO()
    with contextlib.redirect_stdout(stdout):
        code = convert.main([
            str(source),
            "-o", str(output),
            "--offline",
            "--data-dir", str(DATA_DIR),
            "--yes",
            "--lang", "en",
        ])
    return code, stdout.getvalue()


class ConversionTests(unittest.TestCase):
    def test_xlsx_conversion(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source = temporary / "history.xlsx"
            output = temporary / "history_paimonmoe.xlsx"
            write_xlsx(source)

            code, log = run_converter(source, output)
            self.assertEqual(code, 0, log)
            self.assertTrue(output.is_file())

            workbook = openpyxl.load_workbook(output, data_only=True)
            try:
                self.assertEqual(
                    workbook.sheetnames,
                    SHEETS + ["Banner List", "Information"],
                )
                for sheet_name in SHEETS:
                    headers = [workbook[sheet_name].cell(row=1, column=i).value for i in range(1, 10)]
                    self.assertEqual(
                        headers,
                        ["Type", "Name", "Time", "⭐", "Pity", "#Roll", "Group", "Banner", "Part"],
                    )

                characters = list(workbook["Character Event"].iter_rows(min_row=2, values_only=True))
                self.assertEqual(len(characters), 3)
                self.assertEqual(
                    [(row[1], row[3], row[4], row[5], row[6], row[7], row[8]) for row in characters],
                    [
                        ("Test Five Star", 5, 1, 1, 1, "Test Character Banner", None),
                        ("Test Four Star", 4, 2, 2, 1, "Test Character Banner", None),
                        ("Test Four Star", 4, 1, 3, 2, "Test Character Banner 2", "Wish 2"),
                    ],
                )

                weapons = list(workbook["Weapon Event"].iter_rows(min_row=2, values_only=True))
                self.assertEqual(len(weapons), 1)
                self.assertEqual(weapons[0][7], "Test Weapon Banner")

                standard = list(workbook["Standard"].iter_rows(min_row=2, values_only=True))
                # 3-star pulls always report Pity 1; the 4-star closes the streak.
                self.assertEqual([row[4] for row in standard], [1, 1, 3])
                self.assertEqual([row[5] for row in standard], [1, 2, 3])
                self.assertEqual({row[7] for row in standard}, {"Wanderlust Invocation"})
                self.assertEqual([row[2] for row in standard], sorted(row[2] for row in standard))

                beginners = list(workbook["Beginners' Wish"].iter_rows(min_row=2, values_only=True))
                self.assertEqual(len(beginners), 1)
                self.assertEqual(beginners[0][7], "Beginners' Wish")

                information = workbook["Information"]
                self.assertEqual(information["A1"].value, "Paimon.moe Wish History Export")
                self.assertEqual(information["B2"].value, 3)

                banner_list = list(workbook["Banner List"].iter_rows(min_row=2, values_only=True))
                self.assertEqual(len(banner_list), 4)
            finally:
                workbook.close()

    def test_csv_conversion_matches_xlsx(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source_xlsx = temporary / "history.xlsx"
            source_csv = temporary / "history.csv"
            output_xlsx = temporary / "from_xlsx.xlsx"
            output_csv = temporary / "from_csv.xlsx"
            write_xlsx(source_xlsx)
            write_csv(source_csv)

            code, log = run_converter(source_xlsx, output_xlsx)
            self.assertEqual(code, 0, log)
            code, log = run_converter(source_csv, output_csv)
            self.assertEqual(code, 0, log)

            first = openpyxl.load_workbook(output_xlsx, data_only=True)
            second = openpyxl.load_workbook(output_csv, data_only=True)
            try:
                self.assertEqual(first.sheetnames, second.sheetnames)
                for sheet_name in SHEETS + ["Banner List"]:
                    left = list(first[sheet_name].iter_rows(values_only=True))
                    right = list(second[sheet_name].iter_rows(values_only=True))
                    self.assertEqual(left, right, sheet_name)
            finally:
                first.close()
                second.close()

    def test_unsupported_format_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            temporary = Path(temporary)
            source = temporary / "history.json"
            source.write_text("{}", encoding="utf-8")

            code, log = run_converter(source, temporary / "out.xlsx")
            self.assertEqual(code, 1)
            self.assertIn("Unsupported", log)

    def test_fixture_data_parses(self):
        texts = {
            key: (DATA_DIR / filename).read_text(encoding="utf-8")
            for key, filename in (
                ("characters", "characters.js"),
                ("weapons", "weaponList.js"),
                ("banners", "banners.js"),
                ("dual", "bannersDual.js"),
            )
        }

        items, errors = convert.parse_items_texts(texts)
        self.assertEqual(errors, [])
        self.assertEqual(items["Test Five Star"], ("Character", 5))
        self.assertEqual(items["Test Sword"], ("Weapon", 3))

        banners, banner_list = convert.parse_banners_texts(texts, "Europe")
        self.assertIsNotNone(banners)
        self.assertEqual(len(banner_list), 4)
        character_banner = banners["characters"][0]
        self.assertEqual(character_banner["_dual_name"], "Test Character Banner 2")


if __name__ == "__main__":
    unittest.main()
