// app.js — main application logic
(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── State ──
  let currentFile = null;
  let detectedFormat = "hoyo-excel";
  let records = null;
  let resultBuffer = null;
  let resultFileName = null;

  // ── DOM refs ──
  const loadingOverlay = $("#loadingOverlay");
  const loadingText = $("#loadingText");
  const dropZone = $("#dropZone");
  const fileInput = $("#fileInput");
  const fileName = $("#fileName");
  const sourceFormat = $("#sourceFormat");
  const formatHint = $("#formatHint");
  const serverSelect = $("#serverSelect");
  const langSelect = $("#langSelect");
  const offlineMode = $("#offlineMode");
  const convertBtn = $("#convertBtn");
  const progress = $("#progress");
  const progressFill = $("#progressFill");
  const progressText = $("#progressText");
  const result = $("#result");
  const resultSummary = $("#resultSummary");
  const downloadBtn = $("#downloadBtn");
  const errorBox = $("#errorBox");
  const errorText = $("#errorText");
  const dataStatus = $("#dataStatus");
  const refreshDataBtn = $("#refreshDataBtn");
  const themeToggle = $("#themeToggle");

  // ── Loading overlay ──
  function showLoading(text) {
    loadingText.textContent = text || "Loading...";
    loadingOverlay.classList.remove("hidden");
  }
  function hideLoading() {
    loadingOverlay.classList.add("hidden");
  }

  // ── Error handling ──
  function showError(msg) {
    errorText.textContent = msg;
    errorBox.classList.remove("hidden");
  }
  function hideError() {
    errorBox.classList.add("hidden");
  }

  // ── Progress ──
  function setProgress(pct, text) {
    progress.classList.remove("hidden");
    progressFill.style.width = pct + "%";
    progressText.textContent = text || "";
  }
  function hideProgress() {
    progress.classList.add("hidden");
  }

  // ── Theme ──
  function initTheme() {
    const stored = localStorage.getItem("paimon_theme");
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    updateThemeIcon();
  }
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("paimon_theme", next);
    updateThemeIcon();
  }
  function updateThemeIcon() {
    const icon = themeToggle.querySelector(".theme-icon");
    icon.textContent = document.documentElement.getAttribute("data-theme") === "dark" ? "☀️" : "🌙";
  }

  // ── Language selector ──
  async function initLanguage() {
    const langs = window.i18n.availableLanguages();
    langSelect.innerHTML = "";
    for (const code of langs) {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code.toUpperCase();
      langSelect.appendChild(opt);
    }
    const detected = await window.i18n.setLanguage();
    langSelect.value = detected;
    updateUIStrings();
    langSelect.addEventListener("change", async () => {
      await window.i18n.setLanguage(langSelect.value);
      localStorage.setItem("paimon_lang", langSelect.value);
      updateUIStrings();
    });
  }

  function updateUIStrings() {
    const t = window.i18n.t;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const translated = t(key);
      if (translated && translated !== key) {
        el.textContent = translated;
      }
    });
    // Update tagline (not a data-i18n element)
    const tagline = document.querySelector(".tagline");
    if (tagline) tagline.textContent = t("app_tagline");
  }

  // ── Data status ──
  async function updateDataStatus() {
    try {
      const has = await window.cache.hasCachedData();
      const t = window.i18n.t;
      if (has) {
        dataStatus.textContent = t("web_cached");
        dataStatus.className = "status-badge loaded";
      } else {
        dataStatus.textContent = t("web_not_cached");
        dataStatus.className = "status-badge";
      }
    } catch {
      dataStatus.textContent = "?";
      dataStatus.className = "status-badge";
    }
  }

  // ── File handling ──
  function handleFile(file) {
    if (!file) return;
    currentFile = file;
    fileName.textContent = file.name;
    fileName.classList.remove("hidden");
    hideError();
    result.classList.add("hidden");

    // Auto-detect format
    const name = file.name.toLowerCase();
    if (name.endsWith(".json")) {
      detectedFormat = "uigf-json";
      sourceFormat.value = "uigf-json";
      formatHint.textContent = "Detected: UIGF JSON (not yet supported)";
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      detectedFormat = "hoyo-excel";
      sourceFormat.value = "hoyo-excel";
      formatHint.textContent = "Detected: HoYo Excel";
    } else {
      detectedFormat = "hoyo-excel";
      sourceFormat.value = "hoyo-excel";
      formatHint.textContent = "Unknown format — will try HoYo Excel";
    }

    convertBtn.disabled = false;
  }

  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  // ── Convert ──
  convertBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    hideError();
    result.classList.add("hidden");
    convertBtn.disabled = true;

    try {
      setProgress(5, "Reading file...");
      const records = await window.parser.parseSourceFile(currentFile);
      if (!records || records.length === 0) {
        throw new Error("No valid pulls found in the source file.");
      }

      const uid = records[0].uid;
      const server = serverSelect.value === "auto" ? window.parser.detectServer(uid) : serverSelect.value;

      setProgress(15, "Loading banner data...");
      let referenceData = null;
      // Check if user provided a reference file (not in this UI, but for future)
      const offline = offlineMode.checked;

      const { items, banners, bannerListRows, notes } = await window.parser.loadEverything(
        referenceData, server, offline
      );

      // Print notes
      for (const note of notes) {
        console.log(note);
      }

      setProgress(60, "Enriching pull data...");

      // Resolve item types
      const unknown = [];
      for (const row of records) {
        const item = items[row.itemName];
        if (!item) { unknown.push(row.itemName); continue; }
        row.type = item[0];
        row.rarity = item[1];
      }
      if (unknown.length) {
        const unique = [...new Set(unknown)].sort();
        throw new Error("Unknown items: " + unique.join(", ") + ". Run online once to update the item database.");
      }

      // Group by category
      const byCategory = {};
      for (const row of records) {
        if (!byCategory[row.category]) byCategory[row.category] = [];
        byCategory[row.category].push(row);
      }

      setProgress(70, "Computing pity and banners...");
      for (const [cat, rows] of Object.entries(byCategory)) {
        const selectedBanners = banners[cat] || [];
        if (selectedBanners.length === 0) {
          throw new Error(`No banner schedule found for ${rows[0].time} (${rows[0].itemName})`);
        }
        window.converter.enrichCategory(rows, selectedBanners);
        window.converter.applyStripes(rows);
      }

      setProgress(85, "Generating Excel file...");
      const buffer = await window.excel.buildExcel(records, items, banners, bannerListRows);

      resultBuffer = buffer;
      const baseName = currentFile.name.replace(/\.[^.]+$/, "");
      resultFileName = baseName + "_paimonmoe.xlsx";

      // Summary
      const summary = ["characters", "weapons", "standard", "beginners"]
        .map((cat) => {
          const sheetName = window.converter.CATEGORY_TO_SHEET[cat];
          const count = (byCategory[cat] || []).length;
          return `${sheetName}: ${count}`;
        })
        .join(" · ");
      resultSummary.innerHTML = "";
      for (const cat of ["characters", "weapons", "standard", "beginners"]) {
        const sheetName = window.converter.CATEGORY_TO_SHEET[cat];
        const count = (byCategory[cat] || []).length;
        const li = document.createElement("li");
        li.textContent = `${sheetName}: ${count} pulls`;
        resultSummary.appendChild(li);
      }

      setProgress(100, "Done!");
      setTimeout(() => hideProgress(), 500);
      result.classList.remove("hidden");

      // Update data status
      updateDataStatus();

    } catch (e) {
      console.error(e);
      showError(e.message || String(e));
      hideProgress();
    } finally {
      convertBtn.disabled = false;
    }
  });

  // ── Download ──
  downloadBtn.addEventListener("click", () => {
    if (!resultBuffer) return;
    const blob = new Blob([resultBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Refresh data ──
  refreshDataBtn.addEventListener("click", async () => {
    try {
      await window.cache.clearCache();
      dataStatus.textContent = window.i18n.t("web_cleared");
      dataStatus.className = "status-badge";
      alert("Cache cleared. Data will be re-downloaded on next conversion.");
    } catch (e) {
      showError("Failed to clear cache: " + e.message);
    }
  });

  // ── Theme ──
  themeToggle.addEventListener("click", toggleTheme);

  // ── Service worker ──
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // ── Init ──
  async function init() {
    initTheme();
    await initLanguage();
    await updateDataStatus();

    // Check if ExcelJS is loaded
    if (typeof ExcelJS === "undefined") {
      showError("ExcelJS library failed to load. Please check your internet connection and refresh.");
      return;
    }
  }

  init();
})();
