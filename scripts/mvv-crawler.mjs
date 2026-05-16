#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const companiesDir = path.join(rootDir, "data", "companies");
const today = new Date().toISOString().slice(0, 10);
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");

const fieldTerms = {
  mission: [
    "mission",
    "purpose",
    "belief",
    "our belief",
    "使命",
    "企业使命",
    "宗旨",
    "信念"
  ],
  vision: [
    "vision",
    "aspiration",
    "愿景",
    "长期愿景"
  ],
  values: [
    "values",
    "core values",
    "value set",
    "价值观",
    "核心价值观"
  ]
};

const missingPatterns = [
  "未单列",
  "未明确",
  "未找到",
  "当前官网未",
  "当前 reviewed 官方页面未"
];

function parseArgs(argv) {
  const args = {
    all: false,
    company: "",
    dryRun: false,
    write: false,
    json: false,
    saveUnchangedEvidence: false,
    headful: false,
    allSources: false,
    fetchOnly: false,
    fetchFallback: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") args.all = true;
    else if (arg === "--company") args.company = argv[++i] || "";
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--save-unchanged-evidence") args.saveUnchangedEvidence = true;
    else if (arg === "--headful") args.headful = true;
    else if (arg === "--all-sources") args.allSources = true;
    else if (arg === "--fetch-only") args.fetchOnly = true;
    else if (arg === "--no-fetch-fallback") args.fetchFallback = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.all && !args.company) {
    throw new Error("Use --company <company_id> or --all.");
  }
  if (args.write) args.dryRun = false;
  if (!args.write) args.dryRun = true;
  return args;
}

function printHelp() {
  console.log(`MVV crawler

Usage:
  node scripts/mvv-crawler.mjs --company google --write
  node scripts/mvv-crawler.mjs --all --write
  node scripts/mvv-crawler.mjs --company google --dry-run --json

Options:
  --company <id>               Crawl one company directory under data/companies.
  --all                        Crawl all company directories.
  --write                      Write current.json, versions, evidence, and logs when needed.
  --dry-run                    Run without writing files. Default unless --write is passed.
  --json                       Print machine-readable JSON only.
  --save-unchanged-evidence    Save screenshots even when MVV has not changed.
  --headful                    Open Playwright browser visibly for difficult pages.
  --all-sources                Crawl every official URL even after a standard MVV is found.
  --fetch-only                 Use HTTP fetch only; no screenshots, but text extraction still works.
  --no-fetch-fallback          Do not fall back to fetch when Playwright is unavailable or blocked.
`);
}

async function loadPlaywright() {
  try {
    const mod = await import("playwright");
    return mod.chromium;
  } catch {
    const candidates = [
      "/Users/liyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/",
      "/Users/liyi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
    ];

    for (const candidate of candidates) {
      try {
        const require = createRequire(candidate);
        return require("playwright").chromium;
      } catch {
        // Try the next runtime path.
      }
    }
  }
  throw new Error("Playwright is not available. Install playwright or run inside the Codex runtime.");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function uniquePath(target) {
  if (!(await pathExists(target))) return target;
  const parsed = path.parse(target);
  for (let index = 2; index < 1000; index += 1) {
    const candidate = path.join(parsed.dir, `${parsed.name}-${index}${parsed.ext}`);
    if (!(await pathExists(candidate))) return candidate;
  }
  throw new Error(`Could not create a unique file path for ${target}`);
}

function stripQuotes(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const data = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    const listItem = line.match(/^\s*-\s*(.*)$/);

    if (keyValue) {
      currentKey = keyValue[1];
      const raw = keyValue[2].trim();
      if (raw === "[]") data[currentKey] = [];
      else if (raw === "") data[currentKey] = [];
      else data[currentKey] = stripQuotes(raw);
      continue;
    }

    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(stripQuotes(listItem[1]));
    }
  }

  return data;
}

function extractProfileSection(markdown, field) {
  const regex = new RegExp(`### ${field}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`);
  const match = markdown.match(regex);
  if (!match) return "";

  const current = match[1].match(/- 当前正式表述：([^\n]*)/);
  if (!current) return "";
  return current[1].trim().replace(/\\"/g, "\"");
}

function isMeaningfulValue(value) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return !missingPatterns.some((pattern) => normalized.includes(pattern));
}

function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/[\s\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ")
    .trim();
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, "");
}

function containsFuzzy(haystack, needle) {
  const target = compactText(needle);
  const source = compactText(haystack);
  if (!target || !source) return false;
  if (source.includes(target)) return true;

  const tokens = normalizeText(needle)
    .split(/\s+/)
    .filter((token) => token.length >= 4 || /[\u4e00-\u9fff]/.test(token));
  if (tokens.length < 3) return false;

  let hits = 0;
  for (const token of tokens) {
    if (source.includes(token.replace(/\s+/g, ""))) hits += 1;
  }
  return hits / tokens.length >= 0.82;
}

function canonicalRecord(structured) {
  const values = Array.isArray(structured.values) ? structured.values : [];
  return {
    mission: normalizeText(structured.mission || ""),
    vision: normalizeText(structured.vision || ""),
    values: values.map(normalizeText).filter(Boolean).sort()
  };
}

function hashRecord(structured) {
  const canonical = JSON.stringify(canonicalRecord(structured));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function classifyStructured(structured) {
  const hasMission = Boolean(structured.mission);
  const hasVision = Boolean(structured.vision);
  const hasValues = Array.isArray(structured.values) && structured.values.length > 0;
  return hasMission && hasVision && hasValues ? "standard_mvv" : "partial_mvv";
}

function splitCandidateValues(text) {
  return text
    .split(/[;；|｜、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.length <= 120);
}

function hasValueListShape(text) {
  const value = cleanCandidateText(text);
  if (!value) return false;
  const navigationLike = [
    "get started",
    "learn more",
    "read more",
    "dive deeper",
    "find training",
    "resources",
    "career",
    "business",
    "outreach",
    "initiatives",
    "sustainability",
    "accessibility",
    "community engagement"
  ];
  const normalized = normalizeText(value);
  if (navigationLike.some((term) => normalized.includes(term))) return false;

  if (/[;；|｜、]/.test(value)) return splitCandidateValues(value).length >= 2;
  if (/[\u4e00-\u9fff]/.test(value) && value.length >= 6) return true;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 18 && /[.!?。！？]/.test(value)) return false;
  return words.length >= 3 && value.length >= 24;
}

function cleanCandidateText(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .replace(/^[：:;；,\-—–\s]+/, "")
    .trim();
}

function isFieldLabel(line, field) {
  const normalized = normalizeText(line);
  return fieldTerms[field].some((term) => normalized.includes(normalizeText(term)));
}

function extractAfterLabel(line, field) {
  for (const term of fieldTerms[field]) {
    const pattern = new RegExp(`${escapeRegExp(term)}\\s*[:：\\-—–]?\\s*(.+)$`, "i");
    const match = line.match(pattern);
    if (match) return cleanCandidateText(match[1]);
  }
  return "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyFailure(errorOrMessage = "", status = null) {
  const message = String(errorOrMessage || "");
  if (status && status >= 500) return "server_error";
  if (status && status >= 400) return "http_error";
  if (/timeout|timed out/i.test(message)) return "timeout";
  if (/permission denied|operation not permitted|bootstrap_check_in|EPERM/i.test(message)) return "browser_permission";
  if (/net::ERR_NAME_NOT_RESOLVED|ENOTFOUND|dns/i.test(message)) return "dns";
  if (/net::ERR_CERT|certificate|SSL/i.test(message)) return "tls";
  if (/bot|captcha|access denied|forbidden|403|akamai|cloudflare/i.test(message)) return "anti_bot";
  if (/fetch failed|ECONNRESET|ECONNREFUSED|socket|network/i.test(message)) return "network";
  return message ? "unknown_error" : "";
}

function summarizeError(errorOrMessage = "") {
  const lines = String(errorOrMessage || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const fatal = lines.find((line) => /FATAL|Permission denied|Operation not permitted|timeout|fetch failed|ERR_/i.test(line));
  return fatal || lines[0] || "";
}

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractHtmlTitle(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtmlToText(match[1]).replace(/\s+/g, " ").trim() : "";
}

function extractByNearbyLabels(pageText, field) {
  const lines = pageText
    .split(/\r?\n/)
    .map((line) => cleanCandidateText(line))
    .filter(Boolean)
    .filter((line) => line.length <= 260);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!isFieldLabel(line, field)) continue;

    if (field === "mission" && /\b(our\s+)?(mission|purpose|belief)\s+is\b/i.test(line)) {
      return line;
    }

    if (field === "vision" && /\b(our\s+)?(vision|aspiration)\s+is\b/i.test(line)) {
      return line;
    }

    const inline = extractAfterLabel(line, field);
    if (inline && !isFieldLabel(inline, field)) {
      if (field !== "values" || hasValueListShape(inline)) return inline;
    }

    const collected = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 7); j += 1) {
      const next = lines[j];
      if (isFieldLabel(next, "mission") || isFieldLabel(next, "vision") || isFieldLabel(next, "values")) break;
      if (next.length > 8) collected.push(next);
      if (collected.join(" ").length >= 180) break;
    }

    if (collected.length > 0) {
      const candidate = collected.join("; ");
      if (field !== "values" || hasValueListShape(candidate)) return candidate;
    }
  }

  return "";
}

function buildStructuredFromText(pageText, profileValues) {
  const structured = {
    mission: "",
    vision: "",
    values: [],
    raw_terms: {}
  };

  for (const field of ["mission", "vision"]) {
    const expected = profileValues[field];
    if (isMeaningfulValue(expected) && containsFuzzy(pageText, expected)) {
      structured[field] = expected;
      structured.raw_terms[field] = "profile_verified";
    } else {
      const extracted = extractByNearbyLabels(pageText, field);
      if (isMeaningfulValue(extracted)) {
        structured[field] = extracted;
        structured.raw_terms[field] = "label_extracted";
      }
    }
  }

  const expectedValues = profileValues.values;
  if (isMeaningfulValue(expectedValues) && containsFuzzy(pageText, expectedValues)) {
    structured.values = splitCandidateValues(expectedValues);
    structured.raw_terms.values = "profile_verified";
  } else {
    const extracted = extractByNearbyLabels(pageText, "values");
    if (isMeaningfulValue(extracted)) {
      structured.values = splitCandidateValues(extracted);
      structured.raw_terms.values = "label_extracted";
    }
  }

  return structured;
}

function pickPrimaryUrls(company) {
  const urls = Array.isArray(company.official_urls) ? company.official_urls : [];
  if (!urls.length) return [];

  const languages = Array.isArray(company.language_scope) ? company.language_scope : [];
  const preferZh = languages.includes("zh") || /China|中国/i.test(company.country_or_region || "");

  const scored = urls.map((url, index) => {
    let score = 100 - index;
    if (preferZh && /(\.cn|\/cn|zh|chinese|locale=zh)/i.test(url)) score += 30;
    if (!preferZh && /(\/en|en_|english|intl\/en|locale=en)/i.test(url)) score += 30;
    if (/about|culture|mission|values|vision|company|brand|who-we-are/i.test(url)) score += 15;
    return { url, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((item) => item.url);
}

async function loadCompany(dirName) {
  const companyDir = path.join(companiesDir, dirName);
  const profilePath = path.join(companyDir, "profile.md");
  const markdown = await fs.readFile(profilePath, "utf8");
  const frontmatter = parseFrontmatter(markdown);

  return {
    dirName,
    companyDir,
    profilePath,
    markdown,
    ...frontmatter,
    company_id: frontmatter.company_id || dirName,
    profileValues: {
      mission: extractProfileSection(markdown, "Mission"),
      vision: extractProfileSection(markdown, "Vision"),
      values: extractProfileSection(markdown, "Values")
    }
  };
}

async function listCompanies() {
  const entries = await fs.readdir(companiesDir, { withFileTypes: true });
  const companies = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await pathExists(path.join(companiesDir, entry.name, "profile.md"))) {
      companies.push(entry.name);
    }
  }
  return companies.sort();
}

async function dismissCommonPopups(page) {
  const labels = [
    "Accept All Cookies",
    "Accept All",
    "Accept",
    "I agree",
    "Agree",
    "同意",
    "全部接受",
    "接受全部",
    "允许"
  ];

  for (const label of labels) {
    await page.getByRole("button", { name: label, exact: false }).click({ timeout: 900 }).catch(() => {});
  }
}

async function highlightBestMatch(page, target, field) {
  return page.evaluate(({ target, field }) => {
    function normalize(value) {
      return (value || "")
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, "\"")
        .replace(/[\s\r\n\t]+/g, " ")
        .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ")
        .trim()
        .replace(/\s+/g, "");
    }

    document.querySelectorAll("[data-mvv-highlight]").forEach((element) => {
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.style.backgroundColor = "";
      element.removeAttribute("data-mvv-highlight");
    });
    document.querySelectorAll("[data-mvv-evidence-badge]").forEach((element) => element.remove());

    const normalizedTarget = normalize(target);
    const candidates = Array.from(document.body.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return false;
        const text = normalize(element.innerText || element.textContent || "");
        return text && (normalizedTarget ? text.includes(normalizedTarget) : text.includes(normalize(field)));
      })
      .map((element) => ({
        element,
        length: (element.innerText || element.textContent || "").length
      }))
      .sort((a, b) => a.length - b.length);

    const best = candidates[0]?.element;
    if (!best) return false;

    best.setAttribute("data-mvv-highlight", field);
    best.style.outline = "4px solid #d32020";
    best.style.outlineOffset = "6px";
    best.style.backgroundColor = "rgba(255, 230, 0, 0.28)";
    best.scrollIntoView({ block: "center", inline: "nearest" });

    const badge = document.createElement("div");
    badge.textContent = `MVV evidence: ${field}`;
    badge.setAttribute("data-mvv-evidence-badge", "true");
    badge.style.position = "fixed";
    badge.style.left = "16px";
    badge.style.top = "16px";
    badge.style.zIndex = "2147483647";
    badge.style.padding = "8px 10px";
    badge.style.border = "2px solid #d32020";
    badge.style.background = "#fff";
    badge.style.color = "#111";
    badge.style.font = "700 13px Arial, sans-serif";
    badge.style.boxShadow = "0 4px 16px rgba(0,0,0,.18)";
    document.body.appendChild(badge);

    return true;
  }, { target, field });
}

function slugify(value) {
  return normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/gi, "")
    .slice(0, 70) || "source";
}

function emptyStructured() {
  return { mission: "", vision: "", values: [], raw_terms: {} };
}

function failedResult(url, started, error, extra = {}) {
  const message = summarizeError(error?.message || String(error || ""));
  return {
    ok: false,
    status: extra.status ?? null,
    url,
    final_url: extra.final_url || url,
    title: extra.title || "",
    elapsed_ms: Date.now() - started,
    text_length: 0,
    page_text: "",
    structured: emptyStructured(),
    classification: "partial_mvv",
    transport: extra.transport || "",
    fallback_from: extra.fallback_from || "",
    failure_type: classifyFailure(message, extra.status ?? null),
    failure_reason: message,
    error: message
  };
}

async function crawlUrlFetch(company, url, args, fallbackFrom = "") {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "accept-language": (company.language_scope || []).includes("zh") ? "zh-CN,zh;q=0.9,en;q=0.7" : "en-US,en;q=0.9",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      },
      redirect: "follow"
    });
    const body = await response.text();
    const title = extractHtmlTitle(body);
    const pageText = stripHtmlToText(body);
    const structured = buildStructuredFromText(pageText, company.profileValues);
    const classification = classifyStructured(structured);
    const failureType = response.ok ? "" : classifyFailure("", response.status);

    return {
      ok: response.ok,
      status: response.status,
      url,
      final_url: response.url || url,
      title,
      elapsed_ms: Date.now() - started,
      text_length: pageText.length,
      page_text: pageText,
      structured,
      classification,
      transport: "fetch",
      fallback_from: fallbackFrom,
      failure_type: failureType,
      failure_reason: failureType ? `HTTP ${response.status}` : ""
    };
  } catch (error) {
    return failedResult(url, started, error, {
      transport: "fetch",
      fallback_from: fallbackFrom
    });
  } finally {
    clearTimeout(timer);
  }
}

async function crawlUrlBrowser(browser, company, url) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
    locale: (company.language_scope || []).includes("zh") ? "zh-CN" : "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  });

  const started = Date.now();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 75000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await dismissCommonPopups(page);
    await page.waitForTimeout(700);

    const pageText = await page.evaluate(() => document.body?.innerText || "");
    const title = await page.title().catch(() => "");
    const structured = buildStructuredFromText(pageText, company.profileValues);
    const classification = classifyStructured(structured);

    return {
      ok: response ? response.ok() : true,
      status: response ? response.status() : null,
      url,
      final_url: page.url(),
      title,
      elapsed_ms: Date.now() - started,
      text_length: pageText.length,
      page_text: pageText,
      structured,
      classification,
      transport: "browser",
      failure_type: "",
      failure_reason: "",
      page
    };
  } catch (error) {
    await page.close().catch(() => {});
    return {
      ok: false,
      status: null,
      url,
      final_url: url,
      title: "",
      elapsed_ms: Date.now() - started,
      text_length: 0,
      page_text: "",
      structured: emptyStructured(),
      classification: "partial_mvv",
      transport: "browser",
      failure_type: classifyFailure(error.message),
      failure_reason: error.message,
      error: error.message
    };
  }
}

async function crawlUrl(browser, company, url, args) {
  if (args.fetchOnly || !browser) {
    return crawlUrlFetch(company, url, args, args.fetchOnly ? "fetch_only" : "browser_unavailable");
  }

  const result = await crawlUrlBrowser(browser, company, url);
  const shouldFallback = args.fetchFallback
    && (result.error || !result.text_length || (result.status && result.status >= 400));

  if (!shouldFallback) return result;

  const fallback = await crawlUrlFetch(company, url, args, result.failure_type || "browser_error");
  if (fallback.ok || fallback.text_length > result.text_length) {
    fallback.browser_error = result.error || result.failure_reason || "";
    return fallback;
  }

  return result;
}

function scoreCrawlResult(result) {
  let score = 0;
  if (result.ok) score += 20;
  if (result.structured.mission) score += 35;
  if (result.structured.vision) score += 25;
  if (result.structured.values?.length) score += 30;
  if (result.text_length > 1000) score += 8;
  if (/about|culture|mission|values|vision|company/i.test(result.url)) score += 8;
  if (result.status && result.status >= 400) score -= 40;
  if (result.error) score -= 50;
  return score;
}

function sourceScoreSignals(result) {
  return {
    transport: result.transport || "",
    ok: Boolean(result.ok),
    hasMission: Boolean(result.structured?.mission),
    hasVision: Boolean(result.structured?.vision),
    hasValues: Boolean(result.structured?.values?.length),
    textLength: result.text_length || 0,
    urlLooksRelevant: /about|culture|mission|values|vision|company/i.test(result.url || ""),
    failureType: result.failure_type || ""
  };
}

function mergeStructured(results) {
  const ordered = [...results].sort((a, b) => scoreCrawlResult(b) - scoreCrawlResult(a));
  const merged = {
    mission: "",
    vision: "",
    values: [],
    raw_terms: {}
  };

  for (const result of ordered) {
    const structured = result.structured || {};
    if (!merged.mission && structured.mission) {
      merged.mission = structured.mission;
      merged.raw_terms.mission = structured.raw_terms?.mission || "extracted";
    }
    if (!merged.vision && structured.vision) {
      merged.vision = structured.vision;
      merged.raw_terms.vision = structured.raw_terms?.vision || "extracted";
    }
    if (!merged.values.length && structured.values?.length) {
      merged.values = structured.values;
      merged.raw_terms.values = structured.raw_terms?.values || "extracted";
    }
  }

  return merged;
}

async function readCurrent(companyDir) {
  const currentPath = path.join(companyDir, "current.json");
  if (!(await pathExists(currentPath))) return null;
  return JSON.parse(await fs.readFile(currentPath, "utf8"));
}

function compareWithCurrent(current, structured) {
  const hasAnyField = Boolean(structured.mission || structured.vision || structured.values?.length);
  if (!hasAnyField) {
    return {
      change_status: "failed",
      previous_hash: current?.normalized_mvv_hash || "",
      next_hash: "",
      changed_fields: []
    };
  }

  const nextHash = hashRecord(structured);
  if (!current) {
    return {
      change_status: "new",
      previous_hash: "",
      next_hash: nextHash,
      changed_fields: ["mission", "vision", "values"].filter((field) => {
        if (field === "values") return structured.values?.length;
        return Boolean(structured[field]);
      })
    };
  }

  const previousHash = current.normalized_mvv_hash || hashRecord(current.structured || current);
  const changed = previousHash !== nextHash;
  const previousStructured = current.structured || {};
  const changedFields = [];

  if (normalizeText(previousStructured.mission || "") !== normalizeText(structured.mission || "")) changedFields.push("mission");
  if (normalizeText(previousStructured.vision || "") !== normalizeText(structured.vision || "")) changedFields.push("vision");
  if (JSON.stringify(canonicalRecord({ values: previousStructured.values || [] }).values) !== JSON.stringify(canonicalRecord({ values: structured.values || [] }).values)) changedFields.push("values");

  return {
    change_status: changed ? "changed" : "unchanged",
    previous_hash: previousHash,
    next_hash: nextHash,
    changed_fields: changedFields
  };
}

function analystNote(status, changedFields, structured, company) {
  if (status === "failed") {
    return "本轮没有从官方页面中抓到可用的 MVV 字段；需要人工复核页面是否被反爬、跳转、改版或配置了错误来源。";
  }

  if (status === "unchanged") {
    return "本轮复核未发现结构化 MVV 表述发生实质变化。";
  }

  const companyName = company.company_name_cn || company.company_name_en || company.company_id;
  const hasMission = Boolean(structured.mission);
  const hasVision = Boolean(structured.vision);
  const hasValues = structured.values?.length > 0;
  const completeness = hasMission && hasVision && hasValues
    ? "当前呈现为标准 MVV 结构。"
    : "当前不是完整标准 MVV，按可确认字段记录，空缺字段不做推断。";

  if (status === "new") {
    return `${companyName} 本轮建立当前官方表述基线。${completeness}`;
  }

  const changed = changedFields.length ? changedFields.join(", ") : "MVV wording";
  return `${companyName} 本轮检测到 ${changed} 发生变化。建议结合官网页面上下文判断这是正式战略文化表述调整，还是页面改版带来的文案变化。${completeness}`;
}

function buildCurrentRecord(company, structured, classification, comparison, sourceResults, evidenceAssets) {
  const sourceUrls = sourceResults
    .filter((result) => result.ok || result.text_length > 0)
    .map((result) => ({
      url: result.url,
      final_url: result.final_url,
      title: result.title,
      status: result.status,
      text_length: result.text_length
    }));

  return {
    company_id: company.company_id,
    company_name_cn: company.company_name_cn || "",
    company_name_en: company.company_name_en || "",
    captured_at: new Date().toISOString(),
    captured_date: today,
    primary_language: Array.isArray(company.language_scope) ? company.language_scope[0] || "" : "",
    classification,
    structured,
    normalized_mvv_hash: comparison.next_hash,
    source_urls: sourceUrls,
    evidence_assets: evidenceAssets,
    confidence_level: confidenceLevel(structured, sourceResults),
    review_status: reviewStatus(sourceResults, structured),
    analyst_note: analystNote(comparison.change_status, comparison.changed_fields, structured, company)
  };
}

function confidenceLevel(structured, sourceResults) {
  const hasOfficialText = sourceResults.some((result) => result.ok && result.text_length > 300);
  const hasAnyField = structured.mission || structured.vision || structured.values?.length;
  if (hasOfficialText && hasAnyField) return "high";
  if (hasAnyField) return "medium";
  return "low";
}

function reviewStatus(sourceResults, structured) {
  const hasAnyField = structured.mission || structured.vision || structured.values?.length;
  const allFailed = sourceResults.length > 0 && sourceResults.every((result) => result.error || (result.status && result.status >= 400));
  if (!hasAnyField || allFailed) return "needs_review";
  return "reviewed";
}

async function saveEvidence(company, sourceResults, structured, comparison, args) {
  if (args.dryRun) return [];
  if (comparison.change_status === "unchanged" && !args.saveUnchangedEvidence) return [];

  const evidenceDir = path.join(company.companyDir, "evidence", today);
  await fs.mkdir(evidenceDir, { recursive: true });
  const evidenceAssets = [];
  const metadata = [];

  for (const result of sourceResults) {
    if (!result.text_length) continue;
    const sourceSlug = slugify(result.title || new URL(result.url).hostname);
    const textPath = path.join(evidenceDir, `page-text-${sourceSlug}.txt`);
    await fs.writeFile(textPath, result.page_text, "utf8");
    evidenceAssets.push(path.relative(company.companyDir, textPath));

    if (result.page) {
      const targets = [
        ["mission", structured.mission],
        ["vision", structured.vision],
        ["values", structured.values?.[0] || structured.values?.join("; ")]
      ].filter(([, value]) => isMeaningfulValue(value));

      for (const [field, value] of targets) {
        const highlighted = await highlightBestMatch(result.page, value, field).catch(() => false);
        if (!highlighted) continue;
        await result.page.waitForTimeout(400).catch(() => {});
        const screenshotPath = path.join(evidenceDir, `${field}-${sourceSlug}.png`);
        await result.page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
        evidenceAssets.push(path.relative(company.companyDir, screenshotPath));
      }
    }

    metadata.push({
      url: result.url,
      final_url: result.final_url,
      title: result.title,
      status: result.status,
      text_length: result.text_length,
      transport: result.transport || "",
      fallback_from: result.fallback_from || "",
      failure_type: result.failure_type || "",
      failure_reason: result.failure_reason || "",
      structured: result.structured
    });
  }

  await fs.writeFile(path.join(evidenceDir, "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  evidenceAssets.push(path.relative(company.companyDir, path.join(evidenceDir, "metadata.json")));
  return evidenceAssets;
}

function versionMarkdown(company, currentRecord, comparison) {
  const versionType = comparison.change_status === "new" ? "current" : "change";
  const recordId = `${company.company_id}-${today}-${versionType}`;
  const primarySource = currentRecord.source_urls[0] || {};
  const evidenceList = currentRecord.evidence_assets.map((asset) => `  - "${asset}"`).join("\n");
  const values = currentRecord.structured.values?.length
    ? currentRecord.structured.values.map((value) => `- ${value}`).join("\n")
    : "- ";

  return `---
record_id: "${recordId}"
company_id: "${company.company_id}"
record_date: "${today}"
captured_at: "${currentRecord.captured_at}"
effective_period_guess: "${today}-current"
source_type: "official website"
source_title: "${escapeYaml(primarySource.title || "")}"
source_url: "${escapeYaml(primarySource.final_url || primarySource.url || "")}"
source_org: "${escapeYaml(company.company_name_en || company.company_name_cn || company.company_id)}"
language: "${currentRecord.primary_language}"
change_type: "${comparison.change_status}"
confidence_level: "${currentRecord.confidence_level}"
review_status: "${currentRecord.review_status}"
classification: "${currentRecord.classification}"
evidence_assets:
${evidenceList || "  []"}
---

# 版本记录

## 来源信息
- 来源标题：${primarySource.title || ""}
- 来源链接：${primarySource.final_url || primarySource.url || ""}
- 来源机构：${company.company_name_cn || company.company_name_en || company.company_id}
- 来源类型：official website
- 语言：${currentRecord.primary_language}
- 实际抓取日期：${today}

## 原始表述
### Mission / Purpose / Belief
- ${currentRecord.structured.mission || ""}

### Vision
- ${currentRecord.structured.vision || ""}

### Values / Principles
${values}

## 结构化归类
- 分类：${currentRecord.classification}
- 说明：${currentRecord.classification === "standard_mvv" ? "使命、愿景、价值观三项齐全。" : "非完整标准 MVV，按可确认字段记录，空缺字段不做推断。"}

## 与上一版本比较
- 变化状态：${comparison.change_status}
- 变化字段：${comparison.changed_fields.join(", ") || "无"}
- 是否属于实质性变更：${comparison.change_status === "changed" ? "待人工确认" : comparison.change_status === "new" ? "首次建立基线" : "否"}

## 证据
${currentRecord.evidence_assets.map((asset) => `- ${asset}`).join("\n") || "- "}

## 战略与文化解读
- ${currentRecord.analyst_note}
`;
}

function escapeYaml(value) {
  return String(value).replace(/"/g, '\\"');
}

async function writeOutputs(company, currentRecord, comparison, sourceResults, args) {
  if (args.dryRun) return { version_file: "", log_file: "" };

  const logsDir = path.join(company.companyDir, "crawl-logs");
  await fs.mkdir(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `${runStamp}.json`);
  const logRecord = {
    company_id: company.company_id,
    captured_at: currentRecord.captured_at,
    change_status: comparison.change_status,
    comparison,
    current: currentRecord,
    sources: sourceResults.map((result) => ({
      url: result.url,
      final_url: result.final_url,
      status: result.status,
      ok: result.ok,
      title: result.title,
      text_length: result.text_length,
      transport: result.transport || "",
      fallback_from: result.fallback_from || "",
      score: scoreCrawlResult(result),
      score_signals: sourceScoreSignals(result),
      failure_type: result.failure_type || "",
      failure_reason: result.failure_reason || "",
      error: result.error || ""
    }))
  };
  await fs.writeFile(logPath, JSON.stringify(logRecord, null, 2), "utf8");

  if (comparison.change_status === "unchanged" || comparison.change_status === "failed") {
    return {
      version_file: "",
      log_file: path.relative(rootDir, logPath)
    };
  }

  const currentPath = path.join(company.companyDir, "current.json");
  await fs.writeFile(currentPath, JSON.stringify(currentRecord, null, 2), "utf8");

  const versionsDir = path.join(company.companyDir, "versions");
  await fs.mkdir(versionsDir, { recursive: true });
  const suffix = comparison.change_status === "new" ? "current" : "change";
  const versionPath = await uniquePath(path.join(versionsDir, `${today}-${suffix}.md`));
  await fs.writeFile(versionPath, versionMarkdown(company, currentRecord, comparison), "utf8");

  return {
    version_file: path.relative(rootDir, versionPath),
    log_file: path.relative(rootDir, logPath)
  };
}

async function crawlCompany(browser, dirName, args) {
  const company = await loadCompany(dirName);
  const urls = pickPrimaryUrls(company);

  if (!urls.length) {
    return {
      company_id: company.company_id,
      change_status: "failed",
      error: "No official_urls configured."
    };
  }

  const sourceResults = [];
  for (const url of urls) {
    const result = await crawlUrl(browser, company, url, args);
    sourceResults.push(result);
    if (!args.allSources && classifyStructured(mergeStructured(sourceResults)) === "standard_mvv") {
      break;
    }
  }

  const structured = mergeStructured(sourceResults);
  const classification = classifyStructured(structured);
  const previous = await readCurrent(company.companyDir);
  const comparison = compareWithCurrent(previous, structured);
  let currentRecord = buildCurrentRecord(company, structured, classification, comparison, sourceResults, []);
  const evidenceAssets = await saveEvidence(company, sourceResults, structured, comparison, args);
  currentRecord = buildCurrentRecord(company, structured, classification, comparison, sourceResults, evidenceAssets);
  const outputs = await writeOutputs(company, currentRecord, comparison, sourceResults, args);

  for (const result of sourceResults) {
    await result.page?.close().catch(() => {});
  }

  return {
    company_id: company.company_id,
    company_name_cn: company.company_name_cn || "",
    company_name_en: company.company_name_en || "",
    urls,
    change_status: comparison.change_status,
    classification,
    structured,
    changed_fields: comparison.changed_fields,
    confidence_level: currentRecord.confidence_level,
    review_status: currentRecord.review_status,
    analyst_note: currentRecord.analyst_note,
    evidence_assets: evidenceAssets.map((asset) => path.join("data/companies", company.dirName, asset)),
    version_file: outputs.version_file,
    log_file: outputs.log_file,
    source_results: sourceResults.map((result) => ({
      url: result.url,
      final_url: result.final_url,
      status: result.status,
      ok: result.ok,
      title: result.title,
      text_length: result.text_length,
      transport: result.transport || "",
      fallback_from: result.fallback_from || "",
      score: scoreCrawlResult(result),
      score_signals: sourceScoreSignals(result),
      failure_type: result.failure_type || "",
      failure_reason: result.failure_reason || "",
      error: result.error || ""
    }))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let browser = null;
  let browserLaunchError = "";

  if (!args.fetchOnly) {
    try {
      const chromium = await loadPlaywright();
      browser = await chromium.launch({ headless: !args.headful });
    } catch (error) {
      browserLaunchError = summarizeError(error.message || String(error));
      if (!args.fetchFallback) throw error;
      if (!args.json) {
        console.warn(`[crawler] Browser unavailable; falling back to fetch-only mode: ${browserLaunchError}`);
      }
    }
  }

  try {
    const targets = args.all ? await listCompanies() : [args.company];
    const results = [];

    for (const target of targets) {
      const result = await crawlCompany(browser, target, args);
      results.push(result);
      if (!args.json) {
        const status = `${result.company_id}: ${result.change_status} / ${result.classification || "n/a"}`;
        console.log(status);
        if (result.version_file) console.log(`  version: ${result.version_file}`);
        if (result.log_file) console.log(`  log: ${result.log_file}`);
      }
    }

    if (args.json) {
      console.log(JSON.stringify({
        dry_run: args.dryRun,
        date: today,
        browser_available: Boolean(browser),
        browser_launch_error: browserLaunchError,
        results
      }, null, 2));
    }
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
