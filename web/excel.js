// excel.js — write Paimon.moe Excel files using ExcelJS
// Requires: converter.js (loaded before this)
// Exposes: window.excel

(function () {
  "use strict";

  const HEADERS = ["Type", "Name", "Time", "⭐", "Pity", "#Roll", "Group", "Banner", "Part"];
  const COLUMN_WIDTHS = [9, 32, 22, 2.5, 4, 7, 7, 30, 9];

  const THIN_BORDER = {
    top: { style: "thin", color: { argb: "FFDDDDDD" } },
    left: { style: "thin", color: { argb: "FFDDDDDD" } },
    bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
    right: { style: "thin", color: { argb: "FFDDDDDD" } },
  };

  function writeHistorySheet(sheet, rows) {
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const headerRow = sheet.addRow(HEADERS);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });
    HEADERS.forEach((_, i) => {
      sheet.getColumn(i + 1).width = COLUMN_WIDTHS[i];
    });

    for (const row of rows) {
      const fill = row.striped ? "FFEEEEEE" : "FFFFFFFF";
      let fontColor = "FF000000";
      if (row.rarity === 5) fontColor = "FFCC9832";
      else if (row.rarity === 4) fontColor = "FF8A6995";

      const values = [
        row.type, row.itemName, row.time, row.rarity, row.pity,
        row.roll, row.group, row.banner, row.part,
      ];
      const r = sheet.addRow(values);
      r.eachCell((cell, colNumber) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        cell.font = { color: { argb: fontColor }, bold: row.rarity >= 4 };
        cell.border = THIN_BORDER;
        if (colNumber >= 4 && colNumber <= 7) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    }
  }

  function writeBannerListSheet(sheet, bannerRows) {
    const headerRow = sheet.addRow(["Name", "Start", "End"]);
    headerRow.eachCell((cell) => { cell.font = { bold: true }; });
    sheet.getColumn(1).width = 32;
    sheet.getColumn(2).width = 19;
    sheet.getColumn(3).width = 19;
    for (const [name, start, end] of bannerRows) {
      sheet.addRow([name, start, end]);
    }
  }

  function writeInformationSheet(sheet) {
    sheet.getColumn(1).width = 28;
    sheet.getColumn(2).width = 28;
    const r1 = sheet.addRow(["Paimon.moe Wish History Export"]);
    r1.getCell(1).font = { bold: true };
    sheet.mergeCells("A1:B1");
    sheet.addRow(["Version", 3]);
    sheet.addRow(["Export Date", new Date().toISOString().replace("T", " ").slice(0, 19)]);
  }

  function buildExcel(records, bannerListRows) {
    const byCategory = {};
    for (const row of records) {
      if (!byCategory[row.category]) byCategory[row.category] = [];
      byCategory[row.category].push(row);
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "Wishporter";
    wb.properties = { creator: "Wishporter" };

    const sheetMap = window.converter.CATEGORY_TO_SHEET;
    for (const category of ["characters", "weapons", "standard", "beginners", "chronicled"]) {
      const ws = wb.addWorksheet(sheetMap[category]);
      writeHistorySheet(ws, byCategory[category] || []);
    }

    const bl = wb.addWorksheet("Banner List");
    writeBannerListSheet(bl, bannerListRows || []);

    const info = wb.addWorksheet("Information");
    writeInformationSheet(info);

    return wb.xlsx.writeBuffer();
  }

  window.excel = { buildExcel, HEADERS };
})();
