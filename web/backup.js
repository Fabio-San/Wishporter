// backup.js — build a Paimon.moe localforage backup JSON from enriched records
(function () {
  "use strict";

  const STORAGE_KEY = {
    characters: "wish-counter-character-event",
    weapons: "wish-counter-weapon-event",
    standard: "wish-counter-standard",
    beginners: "wish-counter-beginners",
    chronicled: "wish-counter-chronicled",
  };
  const GACHA_TYPE = {
    characters: 301,
    weapons: 302,
    standard: 200,
    beginners: 100,
    chronicled: 500,
  };
  const RATE_CATEGORIES = new Set(["characters", "weapons", "chronicled"]);

  function slugId(name) {
    return String(name == null ? "" : name).trim().toLowerCase()
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function computeRates(rows) {
    let rateUp5 = false, rateUp4 = false;
    const off5 = { win: 0, lose: 0, maxStreak: 0, currentStreak: 0 };
    const off4 = { win: 0, lose: 0, maxStreak: 0, currentStreak: 0 };
    let latest5 = null, latest4 = null;
    let has5 = false, has4 = false;

    for (const row of rows) {
      if (row.rarity === 5) {
        const featured = row._featured || [];
        if (featured.length) {
          has5 = true;
          const guaranteed = rateUp5;
          const win = featured.includes(row._itemId);
          rateUp5 = !win;
          row.rate = (guaranteed ? 1 : 0) + (win ? 1 : 0);
          latest5 = row.rate;
          if (rateUp5) {
            off5.lose++;
            off5.maxStreak = Math.max(off5.maxStreak, off5.currentStreak);
            off5.currentStreak = 0;
          } else if (!guaranteed) {
            off5.win++;
            off5.currentStreak++;
          }
        }
      } else if (row.rarity === 4) {
        const featured = row._featured_rare || [];
        if (featured.length) {
          has4 = true;
          const guaranteed = rateUp4;
          const win = featured.includes(row._itemId);
          rateUp4 = !win;
          row.rate = (guaranteed ? 1 : 0) + (win ? 1 : 0);
          latest4 = row.rate;
          if (rateUp4) {
            off4.lose++;
            off4.maxStreak = Math.max(off4.maxStreak, off4.currentStreak);
            off4.currentStreak = 0;
          } else if (!guaranteed) {
            off4.win++;
            off4.currentStreak++;
          }
        }
      }
    }
    off5.maxStreak = Math.max(off5.maxStreak, off5.currentStreak);
    off4.maxStreak = Math.max(off4.maxStreak, off4.currentStreak);
    return {
      off5, off4,
      g5: (latest5 === 0),
      g4: (latest4 === 0),
      has5, has4,
    };
  }

  function buildJson(records, itemIds, uid) {
    const byCategory = {};
    for (const row of records) {
      if (!byCategory[row.category]) byCategory[row.category] = [];
      byCategory[row.category].push(row);
    }

    const data = {};
    for (const [category, rows] of Object.entries(byCategory)) {
      if (!STORAGE_KEY[category] || !rows.length) continue;

      for (const row of rows) {
        row._itemId = (itemIds && itemIds[row.itemName]) || slugId(row.itemName);
      }

      let rateResult = null;
      if (RATE_CATEGORIES.has(category)) rateResult = computeRates(rows);

      let legendary = 0, rare = 0;
      const pulls = [];
      for (const row of rows) {
        legendary++;
        rare++;
        if (row.rarity === 5) legendary = 0;
        else if (row.rarity === 4) rare = 0;

        const code = (category === "characters" && row.wish2) ? 400 : GACHA_TYPE[category];
        const pull = {
          id: row._itemId,
          time: row.time,
          type: String(row.type).toLowerCase(),
          pity: row.pity,
          code: code,
        };
        if (row.rate !== undefined) pull.rate = row.rate;
        pulls.push(pull);
      }

      const counter = { total: rows.length, legendary, rare, pulls };
      if (rateResult && (rateResult.has5 || rateResult.has4)) {
        counter.guaranteed = { legendary: !!rateResult.g5, rare: !!rateResult.g4 };
        counter.rateoff = { legendary: rateResult.off5, rare: rateResult.off4 };
      }
      data[STORAGE_KEY[category]] = counter;
    }

    if (uid) data["wish-uid"] = String(uid).trim();
    data["wish-counter-setting"] = { firstTime: false, manualInput: false };
    data["update-time"] = new Date().toISOString();

    return JSON.stringify(data);
  }

  window.backup = { buildJson, slugId };
})();
