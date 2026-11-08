// excel.js — write Paimon.moe Excel files using ExcelJS
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

  // Header
  const headerRow = sheet.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
  });
  HEADERS.forEach((h, i) => {
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

async function buildExcel(records, itemsDb, banners, bannerListRows) {
  // Resolve item types/rarity
  const unknown = [];
  for (const row of records) {
    const item = itemsDb[row.itemName];
    if (!item) { unknown.push(row.itemName); continue; }
    row.type = item[0];
    row.rarity = item[1];
  }
  if (unknown.length) {
    const unique = [...new Set(unknown)].sort();
    throw new Error("Unknown items: " + unique.join(", ") +
      ". Run online once to update the item database, or report the issue.");
  }

  // Group by category
  const byCategory = {};
  for (const row of records) {
    if (!byCategory[row.category]) byCategory[row.category] = [];
    byCategory[row.category].push(row);
  }

  // Enrich each category
  for (const [cat, rows] of Object.entries(byCategory)) {
    const selectedBanners = banners[cat] || [];
    if (selectedBanners.length === 0) {
      throw new Error(`No banner schedule found for ${rows[0].time} (${rows[0].itemName})`);
    }
    window.converter.enrichCategory(rows, selectedBanners);
    window.converter.applyStripes(rows);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Wishporter";
  wb.properties = { creator: "Wishporter" };

  const sheetMap = window.converter.CATEGORY_TO_SHEET;
  for (const cat of ["characters", "weapons", "standard", "beginners"]) {
    const sheetName = sheetMap[cat];
    const ws = wb.addWorksheet(sheetName);
    writeHistorySheet(ws, byCategory[cat] || []);
  }

  const bl = wb.addWorksheet("Banner List");
  writeBannerListSheet(bl, bannerListRows);

  const info = wb.addWorksheet("Information");
  writeInformationSheet(info);

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

window.excel = { buildExcel, HEADERS };
