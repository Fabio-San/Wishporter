// parser.js — parsing logic (port of convert.py)
// Requires: ExcelJS (loaded from CDN)
// Exposes: window.parser

(function () {
  "use strict";

  // ── Server detection ──────────────────────────────────────────────
  const SERVER_OFFSETS = { Asia: 8, China: 8, America: -5, Europe: 1 };
  const SERVER_BY_UID_PREFIX = {
    "1": "China", "2": "China", "3": "China", "4": "China",
    "5": "Asia", "6": "America", "7": "Europe", "8": "Asia", "9": "Asia",
  };

  function detectServer(uid) {
    const prefix = String(uid == null ? "" : uid).trim()[0];
    return SERVER_BY_UID_PREFIX[prefix] || "Europe";
  }

  // ── Text helpers ──────────────────────────────────────────────────
  function cleanItemName(name) {
    if (name == null) return "";
    return String(name)
      .trim()
      .replace(/''/g, "'")
      .replace(/\u2019/g, "'")
      .replace(/\u2018/g, "'");
  }

  // ── Date/time helpers ─────────────────────────────────────────────
  function parseDatetime(value) {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) throw new Error(`Invalid date/time: ${value}`);
      const d = new Date(value);
      d.setMilliseconds(0);
      return d;
    }

    // Excel serial date (1900 date system). ExcelJS normally converts these to
    // Date objects, but handle the raw number as a fallback.
    if (typeof value === "number" && isFinite(value)) {
      const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
      return new Date(
        utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(),
        utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds()
      );
    }

    const text = String(value == null ? "" : value).trim();
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/,
    ];
    for (const fmt of formats) {
      const m = text.match(fmt);
      if (m) {
        const [, y, mo, d, h, mi, s] = m;
        return new Date(
          parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10),
          parseInt(h, 10), parseInt(mi, 10), s ? parseInt(s, 10) : 0
        );
      }
    }

    const iso = new Date(text);
    if (!isNaN(iso.getTime())) {
      iso.setMilliseconds(0);
      return iso;
    }
    throw new Error(`Invalid date/time: ${value}`);
  }

  function formatDatetime(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // ── Wish type detection ───────────────────────────────────────────
  function normalizeWishType(rawType) {
    const text = String(rawType == null ? "" : rawType).trim().toLowerCase();

    const characterWords = [
      "character event", "personaggio", "personnage", "figur",
      "personaje", "personagem", "персонаж",
    ];
    if (characterWords.some((w) => text.includes(w))) {
      const isWish2 = /-\s*2\b|wish\s*2\b/.test(text);
      return { category: "characters", wish2: isWish2 };
    }

    const weaponWords = ["weapon", "arma", "arme", "waffe", "оружие"];
    if (weaponWords.some((w) => text.includes(w))) {
      return { category: "weapons", wish2: false };
    }

    const standardWords = ["standard", "estándar", "estandar", "padrão", "padrao", "стандарт"];
    if (standardWords.some((w) => text.includes(w))) {
      return { category: "standard", wish2: false };
    }

    const beginnerWords = [
      "novice", "beginner", "principiante", "débutant", "debutant",
      "anfänger", "anfanger", "iniciante", "новичок",
    ];
    if (beginnerWords.some((w) => text.includes(w))) {
      return { category: "beginners", wish2: false };
    }

    const chronicledWords = [
      "chronicled", "chronicle", "cronache", "cronaca", "chronique",
      "nostalgique", "nostalgie", "segensreich", "kollektion",
      "recopilación", "recopilacion", "recopilatorio",
      "registro", "registros", "хроник", "collected", "collection",
      "colección", "coleccion", "raccolta", "collectées", "collectees",
      "sammlung",
    ];
    if (chronicledWords.some((w) => text.includes(w))) {
      return { category: "chronicled", wish2: false };
    }

    throw new Error(`Unrecognized wish type: ${rawType}`);
  }

  // ── Minimal JavaScript literal parser for Paimon.moe data files ───
  class JsLiteralParser {
    constructor(text, pos = 0) {
      this.text = text;
      this.pos = pos;
      this.length = text.length;
    }

    error(msg) {
      const snippet = this.text.slice(this.pos, this.pos + 80);
      throw new Error(`${msg} (position ${this.pos}): ${JSON.stringify(snippet)}`);
    }

    skipSpaceAndComments() {
      while (this.pos < this.length) {
        const ch = this.text[this.pos];
        if (/\s/.test(ch)) {
          this.pos++;
        } else if (this.text.startsWith("//", this.pos)) {
          const nl = this.text.indexOf("\n", this.pos);
          this.pos = nl === -1 ? this.length : nl + 1;
        } else if (this.text.startsWith("/*", this.pos)) {
          const end = this.text.indexOf("*/", this.pos);
          this.pos = end === -1 ? this.length : end + 2;
        } else {
          break;
        }
      }
    }

    parse() {
      this.skipSpaceAndComments();
      return this.parseValue();
    }

    parseValue() {
      this.skipSpaceAndComments();
      if (this.pos >= this.length) this.error("Unexpected end of input");
      const ch = this.text[this.pos];
      if (ch === "{") return this.parseObject();
      if (ch === "[") return this.parseArray();
      if (ch === "'" || ch === '"' || ch === "`") return this.parseString(ch);
      if (ch === "-" || /\d/.test(ch)) return this.parseNumber();

      const start = this.pos;
      while (this.pos < this.length && /[A-Za-z0-9_.$]/.test(this.text[this.pos])) {
        this.pos++;
      }
      const word = this.text.slice(start, this.pos);
      if (word === "true") return true;
      if (word === "false") return false;
      if (word === "null" || word === "undefined") return null;
      return word;
    }

    parseString(quote) {
      this.pos++; // skip opening quote
      const chars = [];
      const escapes = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", "0": "\0" };
      while (this.pos < this.length) {
        const ch = this.text[this.pos];
        if (ch === quote) {
          this.pos++;
          return chars.join("");
        }
        if (ch === "\\") {
          this.pos++;
          if (this.pos >= this.length) this.error("Unterminated escape");
          const esc = this.text[this.pos];
          if (escapes[esc] !== undefined) {
            chars.push(escapes[esc]);
            this.pos++;
          } else if (esc === "u") {
            chars.push(String.fromCharCode(parseInt(this.text.slice(this.pos + 1, this.pos + 5), 16)));
            this.pos += 5;
          } else if (esc === "x") {
            chars.push(String.fromCharCode(parseInt(this.text.slice(this.pos + 1, this.pos + 3), 16)));
            this.pos += 3;
          } else {
            chars.push(esc);
            this.pos++;
          }
        } else {
          chars.push(ch);
          this.pos++;
        }
      }
      this.error("Unterminated string");
    }

    parseNumber() {
      const start = this.pos;
      if (this.text[this.pos] === "-") this.pos++;
      while (this.pos < this.length && /[\d.eE+-]/.test(this.text[this.pos])) {
        this.pos++;
      }
      const raw = this.text.slice(start, this.pos);
      return /[.eE]/.test(raw) ? parseFloat(raw) : parseInt(raw, 10);
    }

    parseArray() {
      this.pos++; // skip [
      const values = [];
      while (true) {
        this.skipSpaceAndComments();
        if (this.pos >= this.length) this.error("Unterminated array");
        if (this.text[this.pos] === "]") {
          this.pos++;
          return values;
        }
        values.push(this.parseValue());
        this.skipSpaceAndComments();
        if (this.pos < this.length && this.text[this.pos] === ",") {
          this.pos++;
        } else if (this.pos < this.length && this.text[this.pos] === "]") {
          continue;
        } else {
          this.error("Expected ',' or ']'");
        }
      }
    }

    parseObject() {
      this.pos++; // skip {
      const result = {};
      while (true) {
        this.skipSpaceAndComments();
        if (this.pos >= this.length) this.error("Unterminated object");
        if (this.text[this.pos] === "}") {
          this.pos++;
          return result;
        }
        let key;
        if (this.text[this.pos] === "'" || this.text[this.pos] === '"' || this.text[this.pos] === "`") {
          key = this.parseString(this.text[this.pos]);
        } else {
          const start = this.pos;
          while (this.pos < this.length && /[A-Za-z0-9_.$-]/.test(this.text[this.pos])) {
            this.pos++;
          }
          key = this.text.slice(start, this.pos);
          if (!key) this.error("Invalid key");
        }
        this.skipSpaceAndComments();
        if (this.pos >= this.length || this.text[this.pos] !== ":") this.error("Expected ':'");
        this.pos++;
        result[key] = this.parseValue();
        this.skipSpaceAndComments();
        if (this.pos < this.length && this.text[this.pos] === ",") {
          this.pos++;
        } else if (this.pos < this.length && this.text[this.pos] === "}") {
          continue;
        } else {
          this.error("Expected ',' or '}'");
        }
      }
    }
  }

  function parseJsExport(text, exportName) {
    const marker = `export const ${exportName} =`;
    const index = text.indexOf(marker);
    if (index === -1) throw new Error(`Export '${exportName}' not found`);
    const positions = [text.indexOf("{", index), text.indexOf("[", index)].filter((p) => p !== -1);
    if (positions.length === 0) throw new Error(`Value for '${exportName}' not found`);
    return new JsLiteralParser(text, Math.min(...positions)).parse();
  }

  // ── Paimon.moe item parsing ───────────────────────────────────────
  function parseItemsTexts(texts) {
    const items = {};
    const itemIds = {};
    const errors = [];
    for (const [key, exportName, itemType] of [
      ["characters", "characters", "Character"],
      ["weapons", "weaponList", "Weapon"],
    ]) {
      const text = texts[key];
      if (!text) continue;
      try {
        const data = parseJsExport(text, exportName);
        for (const [entryKey, entry] of Object.entries(data)) {
          if (entry && typeof entry === "object" && entry.name && entry.rarity) {
            const name = cleanItemName(entry.name);
            items[name] = [itemType, parseInt(entry.rarity, 10)];
            itemIds[name] = String(entry.id || entryKey);
          }
        }
      } catch (e) {
        errors.push(`${exportName}: ${e.message}`);
      }
    }
    return { items, itemIds, errors };
  }

  // ── Paimon.moe banner parsing ─────────────────────────────────────
  function prepareRemoteBanners(banners, dual, server) {
    const diff = 8 - SERVER_OFFSETS[server];
    for (const category of ["beginners", "standard", "characters", "weapons", "chronicled"]) {
      for (const banner of (banners[category] || [])) {
        const start = parseDatetime(banner.start);
        const end = parseDatetime(banner.end);
        if (banner.timezoneDependent === true) {
          banner._start = new Date(start.getTime() - diff * 3600000);
        } else {
          banner._start = start;
        }
        if (banner.timezoneDependentEnd === true) {
          banner._end = new Date(end.getTime() - diff * 3600000);
        } else {
          banner._end = end;
        }
        banner._dual_name = null;
      }
    }

    for (const pair of Object.values(dual || {})) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [first, second] = pair;
      if (!first || !second || typeof first !== "object" || typeof second !== "object") continue;
      const firstName = cleanItemName(first.name);
      const firstImage = first.image;
      const secondName = cleanItemName(second.name);
      for (const banner of (banners.characters || [])) {
        if (banner.name === firstName && banner.image === firstImage) {
          banner._dual_name = secondName;
          break;
        }
      }
    }
    return banners;
  }

  function buildBannerListRows(banners, server) {
    const diff = 8 - SERVER_OFFSETS[server];
    const rows = [];
    for (const category of ["beginners", "standard", "characters", "weapons", "chronicled"]) {
      for (const banner of (banners[category] || [])) {
        const start = new Date(parseDatetime(banner.start).getTime() - diff * 3600000);
        const end = new Date(parseDatetime(banner.end).getTime() - diff * 3600000);
        rows.push([banner.name, formatDatetime(start), formatDatetime(end)]);
      }
    }
    return rows;
  }

  function parseBannersTexts(texts, server) {
    const bannersText = texts.banners;
    if (!bannersText) return null;
    const banners = parseJsExport(bannersText, "banners");
    const dualText = texts.dual;
    const dual = dualText ? parseJsExport(dualText, "bannersDual") : {};
    const prepared = prepareRemoteBanners(banners, dual, server);
    return { banners: prepared, bannerListRows: buildBannerListRows(banners, server) };
  }

  // ── Reference file (a Paimon.moe export) ──────────────────────────
  function normalizeCellValue(value) {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object") {
      if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join("");
      if (value.text != null) return value.text;
      if (value.result != null) return value.result;
      if (value.hyperlink != null) return value.text || value.hyperlink;
      return null;
    }
    return value;
  }

  async function loadReferenceFile(arrayBuffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const items = {};
    const bannerRows = [];
    const dualHints = [];

    const sheets = ["Character Event", "Weapon Event", "Standard", "Beginners' Wish"];
    for (const sheetName of sheets) {
      const ws = wb.getWorksheet(sheetName);
      if (!ws) continue;

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const vals = row.values; // 1-indexed: vals[1] is column A
        if (!vals || vals.length < 4) continue;

        const itemType = String(normalizeCellValue(vals[1]) || "").trim();
        const itemName = cleanItemName(normalizeCellValue(vals[2]));
        const rarity = parseInt(normalizeCellValue(vals[4]), 10);
        if ((itemType === "Character" || itemType === "Weapon") && itemName && !isNaN(rarity)) {
          items[itemName] = [itemType, rarity];
        }

        if (sheetName === "Character Event" && vals.length >= 9 &&
            String(normalizeCellValue(vals[9]) || "").trim() === "Wish 2") {
          try {
            const moment = parseDatetime(normalizeCellValue(vals[3]));
            dualHints.push([moment, String(normalizeCellValue(vals[8]) || "").trim()]);
          } catch (_) { /* ignore malformed rows */ }
        }
      }
    }

    const bl = wb.getWorksheet("Banner List");
    if (bl) {
      for (let r = 2; r <= bl.rowCount; r++) {
        const vals = bl.getRow(r).values;
        if (!vals || !vals[1]) continue;
        try {
          const start = parseDatetime(normalizeCellValue(vals[2]));
          const end = parseDatetime(normalizeCellValue(vals[3]));
          bannerRows.push([String(normalizeCellValue(vals[1])).trim(), start, end]);
        } catch (_) { /* ignore malformed rows */ }
      }
    }

    return { items, bannerRows, dualHints };
  }

  function buildBannerScheduleFromReference(bannerRows, dualHints) {
    const entries = bannerRows.map(([name, start, end]) => ({
      name, _start: start, _end: end, image: 1, _dual_name: null,
    }));

    const beginners = entries.filter((e) => e.name === "Beginners' Wish");
    const standard = entries.filter((e) => e.name === "Wanderlust Invocation");
    const epitomeIndexes = entries
      .map((e, i) => (e.name === "Epitome Invocation" ? i : -1))
      .filter((i) => i >= 0);

    let characters, weapons, chronicled;
    if (epitomeIndexes.length > 0) {
      const firstWeapon = Math.min(...epitomeIndexes);
      const lastWeapon = Math.max(...epitomeIndexes);
      characters = entries
        .slice(0, firstWeapon)
        .filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
      weapons = entries.slice(firstWeapon, lastWeapon + 1).filter((e) => e.name === "Epitome Invocation");
      chronicled = entries.slice(lastWeapon + 1);
    } else {
      characters = entries.filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
      weapons = [];
      chronicled = [];
    }

    for (const [moment, name] of (dualHints || [])) {
      for (const banner of characters) {
        if (banner._start <= moment && moment < banner._end) {
          banner._dual_name = name;
          break;
        }
      }
    }

    return { beginners, standard, characters, weapons, chronicled };
  }

  function makeGenericBanners() {
    const begin = new Date(2000, 0, 1);
    const end = new Date(2200, 0, 1);
    const banner = (name, dualName = null) => ({
      name, _start: begin, _end: end, image: 1, _dual_name: dualName,
    });
    return {
      beginners: [banner("Beginners' Wish")],
      standard: [banner("Wanderlust Invocation")],
      characters: [banner("Character Event Wish", "Character Event Wish 2")],
      weapons: [banner("Epitome Invocation")],
      chronicled: [banner("Chronicled Wish")],
    };
  }

  // ── Source file parsing ───────────────────────────────────────────
  const COLUMN_KEYWORDS = {
    no: ["no.", "no ", "#", "index", "number", "num", "序号", "번호", "番号", "номер"],
    uid: ["uid", "user id", "user_id", "ユーザー", "用户", "player", "player id"],
    type: ["type", "wish type", "wish_type", "tipo", "typ", "тип", "类型", "種類", "gacha", "gacha type"],
    name: ["award", "name", "item", "oggetto", "nom", "nombre", "название", "名称", "아이템", "prize", "wish award"],
    time: ["time", "date", "ora", "temps", "zeit", "hora", "время", "時間", "日時", "datetime", "timestamp", "wish time"],
  };

  function detectHeaderAndColumns(rows) {
    const max = Math.min(rows.length, 30);
    for (let idx = 0; idx < max; idx++) {
      const row = rows[idx];
      if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
      const first = row[0];
      if (first != null && /^\d+$/.test(String(first).trim())) continue;

      const cells = row.map((c) => (c != null ? String(c).trim().toLowerCase() : ""));
      const map = {};
      for (let i = 0; i < cells.length; i++) {
        let bestField = null;
        let bestLen = 0;
        for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS)) {
          if (field in map) continue;
          for (const kw of keywords) {
            if (cells[i].includes(kw) && kw.length > bestLen) {
              bestField = field;
              bestLen = kw.length;
            }
          }
        }
        if (bestField) map[bestField] = i;
      }

      if (Object.keys(map).length >= 2) {
        const defaults = { no: 0, uid: 1, type: 2, name: 3, time: 4 };
        for (const [field, fallback] of Object.entries(defaults)) {
          if (!(field in map) && fallback < row.length) map[field] = fallback;
        }
        return { headerIndex: idx, columns: map };
      }
    }
    return null;
  }

  function parsePullNumber(raw) {
    if (raw == null) return null;
    let text = String(raw);
    // Remove invisible characters (BOM, zero-width spaces, NBSP, bidi marks).
    for (const cp of [0xFEFF, 0x200B, 0x200C, 0x200D, 0x00A0, 0x200E, 0x200F]) {
      text = text.split(String.fromCharCode(cp)).join("");
    }
    text = text.trim().replace(/^[#.\s]+/, "").replace(/[.\s]+$/, "");

    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.trunc(parseFloat(text));
    const m = text.match(/^\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function parseCsv(text) {
    text = String(text || "").replace(/^\uFEFF/, "");

    // Detect the delimiter from the first line (comma / semicolon / tab).
    const firstLine = text.split(/\r?\n/, 1)[0] || "";
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch in counts) counts[ch]++;
    }
    let delimiter = ",";
    if (counts[";"] > counts[delimiter]) delimiter = ";";
    if (counts["\t"] > counts[delimiter]) delimiter = "\t";

    const rows = [];
    let row = [];
    let field = "";
    inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // handled together with \n
      } else {
        field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function makeRecord(noRaw, uid, wishType, itemName, timeValue, lineNumber) {
    const number = parseInt(String(noRaw == null ? "" : noRaw).trim(), 10);
    if (isNaN(number)) throw new Error(`Line ${lineNumber}: invalid pull number (${noRaw})`);

    let moment;
    try {
      moment = parseDatetime(timeValue);
    } catch (e) {
      throw new Error(`Line ${lineNumber}: ${e.message}`);
    }

    const { category, wish2 } = normalizeWishType(wishType);
    return {
      no: number,
      uid: uid != null ? String(uid).trim() : "",
      wishType: String(wishType == null ? "" : wishType).trim(),
      category,
      wish2,
      itemName: cleanItemName(itemName),
      dt: moment,
      time: formatDatetime(moment),
      line: lineNumber,
    };
  }

  async function parseSourceFile(file) {
    if (!file || !file.name) throw new Error("No file selected.");
    const name = String(file.name).toLowerCase();

    if (name.endsWith(".xls") && !name.endsWith(".xlsx")) {
      throw new Error("Old Excel format (.xls) is not supported. Please save it as .xlsx or .csv first.");
    }

    const sheets = [];

    if (name.endsWith(".csv")) {
      sheets.push({ name: "CSV", rows: parseCsv(await file.text()) });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      wb.eachSheet((ws) => {
        const rows = [];
        const rowCount = Math.min(ws.rowCount || 0, 100000);
        const columnCount = Math.min(Math.max(ws.columnCount || 0, 5), 30);
        for (let r = 1; r <= rowCount; r++) {
          const excelRow = ws.getRow(r);
          const row = [];
          for (let c = 1; c <= columnCount; c++) {
            row.push(normalizeCellValue(excelRow.getCell(c).value));
          }
          rows.push(row);
        }
        sheets.push({ name: ws.name, rows });
      });
    } else {
      throw new Error("Unsupported file type. Please choose an .xlsx or .csv file.");
    }

    const records = [];
    for (const sheet of sheets) {
      const { rows } = sheet;
      if (!rows || rows.length === 0) continue;

      const detected = detectHeaderAndColumns(rows);
      const dataStart = detected ? detected.headerIndex + 1 : 0;
      const columns = detected
        ? detected.columns
        : { no: 0, uid: 1, type: 2, name: 3, time: 4 };

      for (let i = dataStart; i < rows.length; i++) {
        const raw = rows[i];
        if (!raw || raw.every((c) => c == null || String(c).trim() === "")) continue;

        const no = parsePullNumber(raw[columns.no]);
        if (no == null) continue;

        try {
          records.push(makeRecord(
            no,
            raw[columns.uid],
            raw[columns.type],
            raw[columns.name],
            raw[columns.time],
            i + 1
          ));
        } catch (_) {
          // Skip rows we cannot parse (headers, notes, unknown wish types).
        }
      }
    }

    if (records.length === 0) {
      throw new Error(
        "No valid pulls found. Expected columns: No., UID, Wish type, Wish award, Wish time."
      );
    }

    // The HoYo export is newest-first. Within the same second the lower "No."
    // is the newer pull, so chronological order is time ascending, No. descending.
    // Detect No. convention: if No. 1 is the newest pull, sort descending
    // within same timestamp; otherwise ascending.
    const minNoRec = records.reduce((a, b) => (a.no < b.no ? a : b));
    const maxNoRec = records.reduce((a, b) => (a.no > b.no ? a : b));
    const desc = minNoRec.dt.getTime() > maxNoRec.dt.getTime();
    records.sort((a, b) => {
      if (a.dt.getTime() !== b.dt.getTime()) return a.dt.getTime() - b.dt.getTime();
      return desc ? (b.no - a.no) : (a.no - b.no);
    });

    return records;
  }

  // ── Public API ────────────────────────────────────────────────────
  window.parser = {
    SERVER_OFFSETS,
    SERVER_BY_UID_PREFIX,
    detectServer,
    cleanItemName,
    parseDatetime,
    formatDatetime,
    normalizeWishType,
    parseJsExport,
    parseItemsTexts,
    prepareRemoteBanners,
    buildBannerListRows,
    parseBannersTexts,
    loadReferenceFile,
    buildBannerScheduleFromReference,
    makeGenericBanners,
    makeRecord,
    parseSourceFile,
    normalizeCellValue,
    parseCsv,
  };
})();
