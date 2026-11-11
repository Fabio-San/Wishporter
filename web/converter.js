// converter.js — core conversion logic (port of convert.py)
// Requires: parser.js and cache.js (loaded before this)
// Exposes: window.converter

(function () {
  "use strict";

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
    chronicled: "Chronicled Wish",
  };

  // ── Pity / banner / roll / group enrichment ───────────────────────
  function enrichCategory(rows, banners) {
    let pity4 = 0, pity5 = 0;
    let currentBanner = null;
    let roll = 0, group = 0;
    let lastTime = null;

    for (const row of rows) {
      const rarity = row.rarity;
      // Game8's documented rule: a 5-star resets both pity counters, a 4-star
      // resets only the 4-star counter, and every pull counts as one pull
      // towards 4-star pity. Paimon.moe recomputes pity when importing the
      // Excel file (it ignores this column); the JSON backup keeps these values.
      pity4 += 1;
      pity5 += 1;
      if (rarity === 5) { row.pity = pity5; pity5 = 0; pity4 = 0; }
      else if (rarity === 4) { row.pity = pity4; pity4 = 0; }
      else { row.pity = 1; }

      if (!currentBanner || currentBanner._end < row.dt) {
        let found = null;
        let newBanner = false;
        const startIndex = currentBanner ? banners.indexOf(currentBanner) + 1 : 0;
        for (let i = startIndex; i < banners.length; i++) {
          const candidate = banners[i];
          if (candidate._start <= row.dt && row.dt < candidate._end) {
            found = candidate;
            newBanner = true;
            break;
          }
        }
        if (!found) {
          if (!currentBanner) {
            throw new Error(`No banner schedule found for ${row.time} (${row.itemName})`);
          }
          found = currentBanner;
          newBanner = false;
        }
        currentBanner = found;
        if (newBanner) {
          roll = 0;
          group = 0;
        }
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
      row._featured = (currentBanner.featured || currentBanner._featured || []).slice();
      row._featured_rare = (currentBanner.featuredRare || currentBanner._featured_rare || []).slice();
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

  // ── Load everything ───────────────────────────────────────────────
  async function loadEverything(referenceData, server, offline) {
    const items = { ...FALLBACK_ITEMS };
    const itemIds = {};
    let banners = null;
    let bannerListRows = null;
    const notes = [];

    // Optional reference file (a previous Paimon.moe export).
    if (referenceData) {
      try {
        const { items: refItems, bannerRows, dualHints } = referenceData;
        if (refItems) Object.assign(items, refItems);
        if (bannerRows && bannerRows.length) {
          banners = window.parser.buildBannerScheduleFromReference(bannerRows, dualHints || []);
          bannerListRows = bannerRows.map(([name, start, end]) => [
            name,
            window.parser.formatDatetime(start),
            window.parser.formatDatetime(end),
          ]);
          notes.push("reference_used");
        }
      } catch (e) {
        notes.push("error: " + e.message);
      }
    }

    // Cached / downloaded Paimon.moe data.
    const { texts, notes: dataNotes } = await window.cache.loadPaimonData(offline);
    notes.push(...dataNotes);

    if (Object.keys(texts).length > 0) {
      const { items: parsedItems, itemIds: parsedIds, errors: itemErrors } = window.parser.parseItemsTexts(texts);
      Object.assign(items, parsedItems);
      Object.assign(itemIds, parsedIds);
      for (const error of itemErrors) notes.push("data_parse_failed:" + error);

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
      bannerListRows = ["beginners", "standard", "characters", "weapons"].map((category) => [
        banners[category][0].name,
        window.parser.formatDatetime(banners[category][0]._start),
        window.parser.formatDatetime(banners[category][0]._end),
      ]);
      notes.push("generic_banners");
    }

    return { items, itemIds, banners, bannerListRows, notes };
  }

  window.converter = {
    FALLBACK_ITEMS,
    CATEGORY_TO_SHEET,
    enrichCategory,
    applyStripes,
    loadEverything,
  };
})();
