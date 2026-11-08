// parser.js — port of convert.py parsing logic to JavaScript
// Requires: ExcelJS (loaded from CDN)

// Ensure window.parser exists
window.parser = window.parser || {};

// ── Minimal JavaScript literal parser for Paimon.moe data files ──

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
    while (this.pos < this.length && /[\d.eE+]/.test(this.text[this.pos])) {
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

// ── Clean item name ──
function cleanItemName(name) {
  if (name == null) return "";
  return String(name).trim()
    .replace(/''/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'");
}

// ── Parse datetime ──
function parseDatetime(value) {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setMilliseconds(0);
    return d;
  }
  const text = String(value).trim();
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/,
  ];
  for (const fmt of formats) {
    const m = text.match(fmt);
    if (m) {
      const [, y, mo, d, h, mi, s] = m;
      return new Date(
        parseInt(y), parseInt(mo) - 1, parseInt(d),
        parseInt(h), parseInt(mi), s ? parseInt(s) : 0
      );
    }
  }
  // ISO fallback
  const iso = new Date(text);
  if (!isNaN(iso.getTime())) {
    iso.setMilliseconds(0);
    return iso;
  }
  throw new Error(`Invalid date/time: ${value}`);
}

function formatDatetime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── Normalize wish type ──
function normalizeWishType(rawType) {
  const text = String(rawType).trim().toLowerCase();
  const characterWords = ["character event", "personaggio", "personnage", "figur", "personaje", "personagem", "персонаж"];
  if (characterWords.some((w) => text.includes(w))) {
    const isWish2 = /-\s*2\b|wish\s*2\b/.test(text);
    return { category: "characters", wish2: isWish2 };
  }
  const weaponWords = ["weapon", "arma", "arme", "waffe", "оружие"];
  if (weaponWords.some((w) => text.includes(w))) return { category: "weapons", wish2: false };
  const standardWords = ["standard", "estándar", "estandar", "padrão", "padrao", "стандарт"];
  if (standardWords.some((w) => text.includes(w))) return { category: "standard", wish2: false };
  const beginnerWords = ["novice", "beginner", "principiante", "débutant", "debutant", "anfänger", "anfanger", "iniciante", "новичок"];
  if (beginnerWords.some((w) => text.includes(w))) return { category: "beginners", wish2: false };
  throw new Error(`Unrecognized wish type: ${rawType}`);
}

// ── Server detection ──
const SERVER_OFFSETS = { Asia: 8, China: 8, America: -5, Europe: 1 };
const SERVER_BY_UID_PREFIX = { "1": "China", "2": "China", "3": "China", "4": "China", "5": "Asia", "6": "America", "7": "Europe", "8": "Asia", "9": "Asia" };
function detectServer(uid) { return SERVER_BY_UID_PREFIX[String(uid).trim()[0]] || "Europe"; }

// ── Parse items from Paimon.moe data ──
function parseItemsTexts(texts) {
  const items = {};
  const errors = [];
  for (const [key, exportName, itemType] of [["characters", "characters", "Character"], ["weapons", "weaponList", "Weapon"]]) {
    const text = texts[key];
    if (!text) continue;
    try {
      const data = parseJsExport(text, exportName);
      for (const entry of Object.values(data)) {
        if (entry && typeof entry === "object" && entry.name && entry.rarity) {
          items[cleanItemName(entry.name)] = [itemType, parseInt(entry.rarity, 10)];
        }
      }
    } catch (e) {
      errors.push(`${exportName}: ${e.message}`);
    }
  }
  return { items, errors };
}

// ── Parse banners ──
function parseDatetime2(value) { return parseDatetime(value); }

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
  // dual mapping
  for (const pair of Object.values(dual)) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [first, second] = pair;
    if (!first || !second || typeof first !== "object") continue;
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

// ── Load reference file (Paimon.moe export) ──
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
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const vals = row.values;
      if (!vals || vals.length < 4) return;
      const itemType = String(vals[1] || "").trim();
      const itemName = cleanItemName(vals[2]);
      const rarity = parseInt(vals[4], 10);
      if ((itemType === "Character" || itemType === "Weapon") && itemName && !isNaN(rarity)) {
        items[itemName] = [itemType, rarity];
      }
      // dual hints from Character Event
      if (sheetName === "Character Event" && vals.length >= 9 && String(vals[9] || "").trim() === "Wish 2") {
        try {
          const moment = parseDatetime(vals[3]);
          dualHints.push([moment, String(vals[8] || "").trim()]);
        } catch {}
      }
    });
  }

  const bl = wb.getWorksheet("Banner List");
  if (bl) {
    bl.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const vals = row.values;
      if (!vals || !vals[1]) return;
      try {
        const start = parseDatetime(vals[2]);
        const end = parseDatetime(vals[3]);
        bannerRows.push([String(vals[1]).trim(), start, end]);
      } catch {}
    });
  }

  return { items, bannerRows, dualHints };
}

function buildBannerScheduleFromReference(bannerRows, dualHints) {
  const entries = bannerRows.map(([name, start, end]) => ({
    name, _start: start, _end: end, image: 1, _dual_name: null,
  }));

  const beginners = entries.filter((e) => e.name === "Beginners' Wish");
  const standard = entries.filter((e) => e.name === "Wanderlust Invocation");
  const epitomeIndexes = entries.map((e, i) => e.name === "Epitome Invocation" ? i : -1).filter((i) => i >= 0);

  let characters, weapons, chronicled;
  if (epitomeIndexes.length > 0) {
    const firstWeapon = Math.min(...epitomeIndexes);
    const lastWeapon = Math.max(...epitomeIndexes);
    characters = entries.slice(0, firstWeapon).filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
    weapons = entries.slice(firstWeapon, lastWeapon + 1).filter((e) => e.name === "Epitome Invocation");
    chronicled = entries.slice(lastWeapon + 1);
  } else {
    characters = entries.filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
    weapons = [];
    chronicled = [];
  }

  for (const [moment, name] of dualHints) {
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
  const banner = (name, dualName = null) => ({ name, _start: begin, _end: end, image: 1, _dual_name: dualName });
  return {
    beginners: [banner("Beginners' Wish")],
    standard: [banner("Wanderlust Invocation")],
    characters: [banner("Character Event Wish", "Character Event Wish 2")],
    weapons: [banner("Epitome Invocation")],
    chronicled: [],
  };
}

// ── Source file parsing ──
// SERVER_OFFSETS and SERVER_BY_UID_PREFIX already declared above.
function detectServer(uid) { return SERVER_BY_UID_PREFIX[String(uid).trim()[0]] || "Europe"; }

function cleanItemName(name) {
  if (name == null) return "";
  return String(name).trim().replace(/''/g, "'").replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

function parseDatetime(value) {
  if (value instanceof Date) {
    const d = new Date(value);
    d.setMilliseconds(0);
    return d;
  }
  const text = String(value).trim();
  const fmts = [
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/,
  ];
  for (const fmt of fmts) {
    const m = text.match(fmt);
    if (m) {
      const [, y, mo, d, h, mi, s] = m;
      return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi), s ? parseInt(s) : 0);
    }
  }
  const iso = new Date(text);
  if (!isNaN(iso.getTime())) { iso.setMilliseconds(0); return iso; }
  throw new Error(`Invalid date/time: ${value}`);
}

function formatDatetime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeWishType(rawType) {
  const text = String(rawType).trim().toLowerCase();
  const characterWords = ["character event", "personaggio", "personnage", "figur", "personaje", "personagem", "персонаж"];
  if (characterWords.some((w) => text.includes(w))) {
    const isWish2 = /-\s*2\b|wish\s*2\b/.test(text);
    return { category: "characters", wish2: isWish2 };
  }
  const weaponWords = ["weapon", "arma", "arme", "waffe", "оружие"];
  if (weaponWords.some((w) => text.includes(w))) return { category: "weapons", wish2: false };
  const standardWords = ["standard", "estándar", "estandar", "padrão", "padrao", "стандарт"];
  if (standardWords.some((w) => text.includes(w))) return { category: "standard", wish2: false };
  const beginnerWords = ["novice", "beginner", "principiante", "débutant", "debutant", "anfänger", "anfanger", "iniciante", "новичок"];
  if (beginnerWords.some((w) => text.includes(w))) return { category: "beginners", wish2: false };
  throw new Error(`Unrecognized wish type: ${rawType}`);
}

function makeRecord(noRaw, uid, wishType, itemName, timeValue, lineNumber) {
  let number;
  try { number = parseInt(String(noRaw).trim(), 10); } catch { throw new Error(`Line ${lineNumber}: invalid pull number (${noRaw})`); }
  if (isNaN(number)) throw new Error(`Line ${lineNumber}: invalid pull number (${noRaw})`);

  let moment;
  try { moment = parseDatetime(timeValue); } catch (e) { throw new Error(`Line ${lineNumber}: ${e.message}`); }

  const { category, wish2 } = normalizeWishType(wishType);
  return {
    no: number,
    uid: uid != null ? String(uid).trim() : "",
    wishType: String(wishType).trim(),
    category,
    wish2,
    itemName: cleanItemName(itemName),
    dt: moment,
    time: formatDatetime(moment),
    line: lineNumber,
  };
}

async function parseSourceFile(file) {
  const name = file.name.toLowerCase();
  const records = [];

  if (name.endsWith(".csv")) {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    // Simple CSV parse (handle quoted fields)
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      // Use a simple split; for proper CSV use PapaParse, but we keep it dependency-free
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      rows.push(cols);
    }
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      if (raw.length < 5) continue;
      if (!/^\d+$/.test(String(raw[0]).trim())) continue;
      try {
        records.push(makeRecord(raw[0], raw[1], raw[2], raw[3], raw[4], i + 1));
      } catch {}
    }
  } else {
    // Excel
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    for (const ws of wb.worksheets) {
      ws.eachRow((row, rowNum) => {
        const vals = row.values || [];
        // Pad to at least 5
        while (vals.length < 5) vals.push(null);
        if (vals.length < 5) return;
        const first = vals[1]; // ExcelJS is 1-indexed, values[0] is null
        // Actually ExcelJS row.values is 1-indexed: values[0] is null, values[1] is column A
        const colA = vals[1];
        if (colA == null || !/^\d+$/.test(String(colA).trim())) return;
        try {
          records.push(makeRecord(colA, vals[2], vals[3], vals[4], vals[5], rowNum));
        } catch {}
      });
    }
  }

  // Sort: time ascending, No. descending
  records.sort((a, b) => {
    if (a.dt.getTime() !== b.dt.getTime()) return a.dt.getTime() - b.dt.getTime();
    return b.no - a.no;
  });
  return records;
}

// ── Pity / banner / roll / group enrichment ──
function enrichCategory(rows, banners) {
  let pity4 = 0, pity5 = 0;
  let currentBanner = null;
  let roll = 0, group = 0;
  let lastTime = null;

  for (const row of rows) {
    const rarity = row.rarity;
    pity4 += 1;
    pity5 += 1;
    if (rarity === 5) { row.pity = pity5; pity5 = 0; }
    else if (rarity === 4) { row.pity = pity4; pity4 = 0; }
    else { row.pity = 1; }

    if (!currentBanner || currentBanner._end < row.dt) {
      let found = null;
      const startIndex = currentBanner ? banners.indexOf(currentBanner) + 1 : 0;
      for (let i = startIndex; i < banners.length; i++) {
        const cand = banners[i];
        if (cand._start <= row.dt && row.dt < cand._end) {
          found = cand;
          break;
        }
      }
      if (!found) throw new Error(`No banner schedule found for ${row.time} (${row.itemName})`);
      currentBanner = found;
      roll = 0;
      group = 0;
    }

    roll += 1;
    if (lastTime !== row.time) group += 1;
    row.roll = roll;
    row.group = group;
    lastTime = row.time;

    if (row.wish2) {
      row.banner = currentBanner._dual_name || currentBanner.name;
      row.part = "Wish 2";
    } else {
      row.banner = currentBanner.name;
      row.part = "";
    }
  }
}

function applyStripes(rows) {
  let grouped = false;
  let striped = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nextTime = i + 1 < rows.length ? rows[i + 1].time : null;
    if (!grouped && nextTime === row.time) {
      striped = !striped;
      grouped = true;
    } else if (grouped && nextTime !== row.time) {
      grouped = false;
    } else if (grouped) {
      // pass
    } else {
      striped = !striped;
    }
    row.striped = striped;
  }
}

// ── Load everything ──
const FALLBACK_ITEMS = {}; // loaded from a small inline DB or fetched

async function loadEverything(referenceItems, referenceBanners, referenceDual, server, offline, dataDir) {
  // items: start with fallback
  const items = {};
  const banners = null;
  // This will be filled by the caller with proper data
  return { items, banners };
}

// Export for use in app.js
Object.assign(window.parser, {
  cleanItemName, parseDatetime, formatDatetime, normalizeWishType,
  detectServer, parseJsExport, parseSourceFile,
  SERVER_OFFSETS, SERVER_BY_UID_PREFIX,
});

// We'll attach parseItemsTexts and parseBannersTexts after defining them
// (they're defined above as functions, just need to wire)
window.parser.parseItemsTexts = function(texts) {
  const items = {};
  const errors = [];
  for (const [key, exportName, itemType] of [["characters", "characters", "Character"], ["weapons", "weaponList", "Weapon"]]) {
    const text = texts[key];
    if (!text) continue;
    try {
      const data = parseJsExport(text, exportName);
      for (const entry of Object.values(data)) {
        if (entry && typeof entry === "object" && entry.name && entry.rarity) {
          items[cleanItemName(entry.name)] = [itemType, parseInt(entry.rarity, 10)];
        }
      }
    } catch (e) {
      errors.push(`${exportName}: ${e.message}`);
    }
  }
  return { items, errors };
};

window.parser.parseBannersTexts = parseBannersTexts;
window.parser.prepareRemoteBanners = prepareRemoteBanners;
window.parser.buildBannerListRows = buildBannerListRows;
window.parser.buildBannerScheduleFromReference = buildBannerScheduleFromReference;
window.parser.makeGenericBanners = makeGenericBanners;
window.parser.loadReferenceFile = loadReferenceFile;
