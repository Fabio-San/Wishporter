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
  let resultJsonBuffer = null;
  let resultJsonFileName = null;

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
  const downloadJsonBtn = $("#downloadJsonBtn");
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
    document.documentElement.lang = window.i18n.currentLanguage();
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
    updateFormatHint();
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
  function updateFormatHint() {
    if (!currentFile) return;
    const t = window.i18n.t;
    const key =
      detectedFormat === "uigf-json"
        ? "web_detected_uigf"
        : detectedFormat === "hoyo-excel"
        ? "web_detected_hoyo"
        : "web_detected_unknown";
    formatHint.textContent = t(key);
  }

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
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
      detectedFormat = "hoyo-excel";
      sourceFormat.value = "hoyo-excel";
    } else {
      detectedFormat = "unknown";
      sourceFormat.value = "hoyo-excel";
    }
    updateFormatHint();

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
      const t = window.i18n.t;
      setProgress(5, t("web_progress_reading"));
      const records = await window.parser.parseSourceFile(currentFile);
      if (!records || records.length === 0) {
        throw new Error(t("web_no_pulls"));
      }

      const uid = records[0].uid;
      const server = serverSelect.value === "auto" ? window.parser.detectServer(uid) : serverSelect.value;

      setProgress(15, t("web_progress_loading"));
      let referenceData = null;
      // Check if user provided a reference file (not in this UI, but for future)
      const offline = offlineMode.checked;

      const { items, itemIds, banners, bannerListRows, notes } = await window.converter.loadEverything(
        referenceData, server, offline
      );

      // Print notes
      for (const note of notes) {
        console.log(note);
      }

      setProgress(60, t("web_progress_enriching"));

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
        throw new Error(t("web_unknown_items", { items: unique.join(", ") }));
      }

      // Group by category
      const byCategory = {};
      for (const row of records) {
        if (!byCategory[row.category]) byCategory[row.category] = [];
        byCategory[row.category].push(row);
      }

      setProgress(70, t("web_progress_computing"));
      for (const [cat, rows] of Object.entries(byCategory)) {
        const selectedBanners = banners[cat] || [];
        if (selectedBanners.length === 0) {
          throw new Error(t("web_no_banner", { time: rows[0].time, item: rows[0].itemName }));
        }
        window.converter.enrichCategory(rows, selectedBanners);
        window.converter.applyStripes(rows);
      }

      setProgress(85, t("web_progress_generating"));
      const buffer = await window.excel.buildExcel(records, bannerListRows);

      resultBuffer = buffer;
      const baseName = currentFile.name.replace(/\.[^.]+$/, "");
      resultFileName = baseName + "_paimonmoe.xlsx";

      // Paimon.moe localforage backup JSON
      try {
        if (typeof window.backup === "undefined" || !window.backup.buildJson) {
          throw new Error("Backup module not loaded.");
        }
        const jsonText = window.backup.buildJson(records, itemIds, uid);
        resultJsonBuffer = new TextEncoder().encode(jsonText);
        resultJsonFileName = baseName + "_paimonmoe.json";
      } catch (e) {
        console.error("JSON build failed", e);
        resultJsonBuffer = null;
        showError("JSON export failed: " + (e.message || e));
      }

      // Summary
      resultSummary.innerHTML = "";
      for (const cat of ["characters", "weapons", "standard", "beginners"]) {
        const sheetName = window.converter.CATEGORY_TO_SHEET[cat];
        const count = (byCategory[cat] || []).length;
        const li = document.createElement("li");
        li.textContent = t("web_summary_line", { sheet: sheetName, count });
        resultSummary.appendChild(li);
      }

      setProgress(100, t("web_progress_done"));
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

  downloadJsonBtn.addEventListener("click", () => {
    if (!resultJsonBuffer) {
      showError(window.i18n.t("web_json_failed"));
      return;
    }
    const blob = new Blob([resultJsonBuffer], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultJsonFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ── Refresh data ──
  refreshDataBtn.addEventListener("click", async () => {
    try {
      const t = window.i18n.t;
      await window.cache.clearCache();
      dataStatus.textContent = t("web_cleared");
      dataStatus.className = "status-badge";
      alert(t("web_cache_cleared_alert"));
    } catch (e) {
      showError(t("web_cache_clear_failed", { error: e.message }));
    }
  });

  // ── Theme ──
  themeToggle.addEventListener("click", toggleTheme);

  // ── Init ──
  async function init() {
    initTheme();
    await initLanguage();
    await updateDataStatus();

    // Check if ExcelJS is loaded
    if (typeof ExcelJS === "undefined") {
      showError(window.i18n.t("web_exceljs_failed"));
      return;
    }
  }

  init();
})();
