// converter.js — core conversion logic (port of convert.py)
// Requires: parser.js (loaded before this)

const FALLBACK_ITEMS = {
  "Albedo": ["Character", 5], "Alhaitham": ["Character", 5], "Aloy": ["Character", 5],
  "Arataki Itto": ["Character", 5], "Arlecchino": ["Character", 5], "Baizhu": ["Character", 5],
  "Chasca": ["Character", 5], "Chiori": ["Character", 5], "Citlali": ["Character", 5],
  "Clorinde": ["Character", 5], "Cyno": ["Character", 5], "Dehya": ["Character", 5],
  "Diluc": ["Character", 5], "Emilie": ["Character", 5], "Escoffier": ["Character", 5],
  "Eula": ["Character", 5], "Furina": ["Character", 5], "Ganyu": ["Character", 5],
  "Hu Tao": ["Character", 5], "Ineffa": ["Character", 5], "Jean": ["Character", 5],
  "Kaedehara Kazuha": ["Character", 5], "Kamisato Ayaka": ["Character", 5],
  "Kamisato Ayato": ["Character", 5], "Keqing": ["Character", 5], "Kinich": ["Character", 5],
  "Klee": ["Character", 5], "Lauma": ["Character", 5], "Lyney": ["Character", 5],
  "Mavuika": ["Character", 5], "Mona": ["Character", 5], "Mualani": ["Character", 5],
  "Nahida": ["Character", 5], "Navia": ["Character", 5], "Nefer": ["Character", 5],
  "Neuvillette": ["Character", 5], "Nilou": ["Character", 5], "Qiqi": ["Character", 5],
  "Raiden Shogun": ["Character", 5], "Sangonomiya Kokomi": ["Character", 5],
  "Shenhe": ["Character", 5], "Sigewinne": ["Character", 5], "Skirk": ["Character", 5],
  "Tartaglia": ["Character", 5], "Tighnari": ["Character", 5], "Varesa": ["Character", 5],
  "Venti": ["Character", 5], "Wanderer": ["Character", 5], "Wriothesley": ["Character", 5],
  "Xianyun": ["Character", 5], "Xiao": ["Character", 5], "Xilonen": ["Character", 5],
  "Yae Miko": ["Character", 5], "Yelan": ["Character", 5], "Yoimiya": ["Character", 5],
  "Yumemizuki Mizuki": ["Character", 5], "Zhongli": ["Character", 5], "Zibai": ["Character", 5],
  "Aino": ["Character", 4], "Amber": ["Character", 4], "Barbara": ["Character", 4],
  "Beidou": ["Character", 4], "Bennett": ["Character", 4], "Candace": ["Character", 4],
  "Charlotte": ["Character", 4], "Chevreuse": ["Character", 4], "Chongyun": ["Character", 4],
  "Collei": ["Character", 4], "Diona": ["Character", 4], "Dori": ["Character", 4],
  "Faruzan": ["Character", 4], "Fischl": ["Character", 4], "Freminet": ["Character", 4],
  "Gaming": ["Character", 4], "Gorou": ["Character", 4], "Iansan": ["Character", 4],
  "Kachina": ["Character", 4], "Kaeya": ["Character", 4], "Kaveh": ["Character", 4],
  "Kirara": ["Character", 4], "Kujou Sara": ["Character", 4], "Kuki Shinobu": ["Character", 4],
  "Lan Yan": ["Character", 4], "Layla": ["Character", 4], "Lisa": ["Character", 4],
  "Lynette": ["Character", 4], "Mika": ["Character", 4], "Ningguang": ["Character", 4],
  "Noelle": ["Character", 4], "Ororon": ["Character", 4], "Razor": ["Character", 4],
  "Rosaria": ["Character", 4], "Sayu": ["Character", 4], "Sethos": ["Character", 4],
  "Shikanoin Heizou": ["Character", 4], "Sucrose": ["Character", 4], "Thoma": ["Character", 4],
  "Xiangling": ["Character", 4], "Xingqiu": ["Character", 4], "Xinyan": ["Character", 4],
  "Yanfei": ["Character", 4], "Yaoyao": ["Character", 4], "Yun Jin": ["Character", 4],
  "Black Tassel": ["Weapon", 3], "Bloodtainted Greatsword": ["Weapon", 3],
  "Cool Steel": ["Weapon", 3], "Debate Club": ["Weapon", 3], "Emerald Orb": ["Weapon", 3],
  "Ferrous Shadow": ["Weapon", 3], "Harbinger of Dawn": ["Weapon", 3],
  "Magic Guide": ["Weapon", 3], "Raven Bow": ["Weapon", 3],
  "Sharpshooter's Oath": ["Weapon", 3], "Skyrider Sword": ["Weapon", 3],
  "Slingshot": ["Weapon", 3], "Thrilling Tales of Dragon Slayers": ["Weapon", 3],
  "Akuoumaru": ["Weapon", 4], "Beyond the Chrysalis": ["Weapon", 4],
  "Breezeborne Refrain": ["Weapon", 4], "Dragon's Bane": ["Weapon", 4],
  "Eye of Perception": ["Weapon", 4], "Favonius Codex": ["Weapon", 4],
  "Favonius Greatsword": ["Weapon", 4], "Favonius Lance": ["Weapon", 4],
  "Favonius Sword": ["Weapon", 4], "Favonius Warbow": ["Weapon", 4],
  "Lion's Roar": ["Weapon", 4], "Rainslasher": ["Weapon", 4], "Rust": ["Weapon", 4],
  "Sacrificial Bow": ["Weapon", 4], "Sacrificial Fragments": ["Weapon", 4],
  "Sacrificial Greatsword": ["Weapon", 4], "Sacrificial Sword": ["Weapon", 4],
  "The Bell": ["Weapon", 4], "The Flute": ["Weapon", 4], "The Stringless": ["Weapon", 4],
  "The Widsith": ["Weapon", 4], "Xiphos' Moonlight": ["Weapon", 4],
  "Amos' Bow": ["Weapon", 5], "Aquila Favonia": ["Weapon", 5],
  "Engulfing Lightning": ["Weapon", 5], "Freedom-Sworn": ["Weapon", 5],
  "Lost Prayer to the Sacred Winds": ["Weapon", 5], "Skyward Atlas": ["Weapon", 5],
  "Skyward Blade": ["Weapon", 5], "Verdict": ["Weapon", 5],
};

const CATEGORY_TO_SHEET = {
  characters: "Character Event",
  weapons: "Weapon Event",
  standard: "Standard",
  beginners: "Beginners' Wish",
};

function cleanItemName(name) { return window.parser.cleanItemName(name); }
function parseDatetime(v) { return window.parser.parseDatetime(v); }
function formatDatetime(d) { return window.parser.formatDatetime(d); }
function normalizeWishType(raw) { return window.parser.normalizeWishType(raw); }
function detectServer(uid) { return window.parser.detectServer(uid); }

function makeRecord(noRaw, uid, wishType, itemName, timeValue, lineNumber) {
  let number;
  try { number = parseInt(String(noRaw).trim(), 10); } catch { throw new Error(`Line ${lineNumber}: invalid pull number`); }
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

function parseSourceFile(file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const name = file.name.toLowerCase();
      const records = [];

      if (name.endsWith(".csv")) {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const rows = [];
        for (const line of lines) {
          if (!line.trim()) continue;
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
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        for (const ws of wb.worksheets) {
          ws.eachRow((row, rowNum) => {
            const vals = row.values || [];
            while (vals.length < 6) vals.push(null);
            // ExcelJS is 1-indexed: vals[0] is null, vals[1] is column A
            const colA = vals[1];
            if (colA == null) return;
            const text = String(colA).trim();
            // Handle floats like 1.0
            let numVal = null;
            try { numVal = parseInt(parseFloat(text), 10); } catch {}
            if (isNaN(numVal) || numVal === null) {
              // Try extracting leading digits
              const m = text.match(/^(\d+)/);
              if (m) numVal = parseInt(m[1], 10);
            }
            if (numVal === null || isNaN(numVal)) return;
            try {
              records.push(makeRecord(numVal, vals[2], vals[3], vals[4], vals[5], rowNum));
            } catch {}
          });
        }
      }

      records.sort((a, b) => {
        if (a.dt.getTime() !== b.dt.getTime()) return a.dt.getTime() - b.dt.getTime();
        return b.no - a.no;
      });
      resolve(records);
    } catch (e) {
      reject(e);
    }
  });
}

// ── Enrichment ──
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
    } else if (!grouped) {
      striped = !striped;
    }
    row.striped = striped;
  }
}

// ── Load everything ──
async function loadEverything(referenceData, server, offline) {
  const items = { ...FALLBACK_ITEMS };
  let banners = null;
  let bannerListRows = null;
  const notes = [];

  // Reference file (if provided)
  if (referenceData) {
    try {
      const { items: refItems, bannerRows, dualHints } = referenceData;
      if (refItems) Object.assign(items, refItems);
      if (bannerRows && bannerRows.length) {
        const entries = bannerRows.map(([name, start, end]) => ({
          name, _start: start, _end: end, image: 1, _dual_name: null,
        }));
        const beginners = entries.filter((e) => e.name === "Beginners' Wish");
        const standard = entries.filter((e) => e.name === "Wanderlust Invocation");
        const epitomeIdx = entries.map((e, i) => e.name === "Epitome Invocation" ? i : -1).filter((i) => i >= 0);
        let characters, weapons, chronicled;
        if (epitomeIdx.length > 0) {
          const fw = Math.min(...epitomeIdx);
          const lw = Math.max(...epitomeIdx);
          characters = entries.slice(0, fw).filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
          weapons = entries.slice(fw, lw + 1).filter((e) => e.name === "Epitome Invocation");
          chronicled = entries.slice(lw + 1);
        } else {
          characters = entries.filter((e) => e.name !== "Beginners' Wish" && e.name !== "Wanderlust Invocation");
          weapons = [];
          chronicled = [];
        }
        for (const [moment, name] of dualHints) {
          for (const b of characters) {
            if (b._start <= moment && moment < b._end) { b._dual_name = name; break; }
          }
        }
        banners = { beginners, standard, characters, weapons, chronicled };
        bannerListRows = bannerRows.map(([name, start, end]) => [name, formatDatetime(start), formatDatetime(end)]);
        notes.push("reference_used");
      }
    } catch (e) {
      notes.push("error: " + e.message);
    }
  }

  // Load Paimon.moe data
  const { texts, notes: dataNotes, fetchedAny } = await window.cache.loadPaimonData(offline);
  notes.push(...dataNotes);

  if (Object.keys(texts).length > 0) {
    const { items: parsedItems, errors: itemErrors } = window.parser.parseItemsTexts(texts);
    Object.assign(items, parsedItems);
    for (const e of itemErrors) notes.push("data_parse_failed:" + e);

    try {
      const parsed = window.parser.parseBannersTexts(texts, server);
      if (parsed) {
        banners = parsed.banners;
        bannerListRows = parsed.bannerListRows;
      }
    } catch (e) {
      notes.push("data_parse_failed:" + e.message);
    }
  }

  if (!banners) {
    banners = window.parser.makeGenericBanners();
    bannerListRows = [
      ...["beginners", "standard", "characters", "weapons"].map((cat) => [
        banners[cat][0].name,
        formatDatetime(banners[cat][0]._start),
        formatDatetime(banners[cat][0]._end),
      ]),
    ];
    notes.push("generic_banners");
  }

  return { items, banners, bannerListRows, notes };
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

// Expose converter API
window.converter = {
  enrichCategory,
  applyStripes,
  CATEGORY_TO_SHEET,
  FALLBACK_ITEMS,
  makeGenericBanners,
  buildBannerScheduleFromReference,
  loadEverything,
  normalizeWishType,
  detectServer,
  makeRecord,
  cleanItemName,
  parseDatetime,
  formatDatetime,
};

// Attach to window.parser
window.parser.makeGenericBanners = makeGenericBanners;
window.parser.buildBannerScheduleFromReference = buildBannerScheduleFromReference;
window.parser.loadReferenceFile = loadReferenceFile;
window.parser.enrichCategory = enrichCategory;
window.parser.applyStripes = applyStripes;
window.parser.makeRecord = makeRecord;
window.parser.parseSourceFile = parseSourceFile;
window.parser.loadEverything = loadEverything;
window.parser.CATEGORY_TO_SHEET = CATEGORY_TO_SHEET;
window.parser.FALLBACK_ITEMS = FALLBACK_ITEMS;
