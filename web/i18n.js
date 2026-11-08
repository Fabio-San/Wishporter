// i18n.js — language detection and catalog loading for the web version
const SUPPORTED = ["en", "it", "fr", "de", "es", "pt", "ru"];
const LOCALE_BASE = "locales/";

let currentLang = "en";
let catalog = {};
let fallback = {};

async function loadCatalog(lang) {
  try {
    const res = await fetch(LOCALE_BASE + lang + ".json");
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    return (typeof data === "object" && data !== null) ? data : {};
  } catch {
    return {};
  }
}

function normalize(code) {
  if (!code) return null;
  code = String(code).trim().toLowerCase().replace("-", "_");
  if (!code) return null;
  code = code.split(".")[0].split("@")[0];
  const primary = code.split("_")[0];
  return SUPPORTED.includes(primary) ? primary : null;
}

function detectLanguage() {
  // 1. URL param
  const params = new URLSearchParams(window.location.search);
  const urlLang = normalize(params.get("lang"));
  if (urlLang) return urlLang;

  // 2. localStorage
  const stored = normalize(localStorage.getItem("paimon_lang"));
  if (stored) return stored;

  // 3. Browser language
  const langs = navigator.languages || [navigator.language || "en"];
  for (const lang of langs) {
    const code = normalize(lang);
    if (code) return code;
  }

  return "en";
}

async function setLanguage(lang) {
  const normalized = normalize(lang) || detectLanguage();
  currentLang = normalized;
  if (!fallback || Object.keys(fallback).length === 0) {
    fallback = await loadCatalog("en");
  }
  if (normalized === "en") {
    catalog = { ...fallback };
  } else {
    const loaded = await loadCatalog(normalized);
    catalog = Object.keys(loaded).length ? loaded : { ...fallback };
  }
  localStorage.setItem("paimon_lang", normalized);
  return normalized;
}

function t(key, ...args) {
  const template = catalog[key] || fallback[key] || key;
  // Support both t(key, {a:1}) and t(key, val1, val2)
  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
    const params = args[0];
    return template.replace(/\{(\w+)\}/g, (_, k) =>
      params[k] !== undefined ? String(params[k]) : "{" + k + "}"
    );
  }
  // Positional: not used in our catalogs, but safe fallback
  return template;
}

function currentLanguage() { return currentLang; }
function availableLanguages() { return [...SUPPORTED]; }

// Expose
window.i18n = { detectLanguage, setLanguage, t, currentLanguage, availableLanguages, SUPPORTED };
