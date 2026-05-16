#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const companiesDir = path.join(rootDir, "data", "companies");
const today = new Date().toISOString().slice(0, 10);

function parseArgs(argv) {
  const args = {
    company: "",
    candidate: "",
    all: false,
    write: false,
    json: false,
    headful: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--company") args.company = argv[++i] || "";
    else if (arg === "--candidate") args.candidate = argv[++i] || "";
    else if (arg === "--all") args.all = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--headful") args.headful = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.all && !args.company) {
    throw new Error("Use --company <company_id> or --all.");
  }

  return args;
}

function printHelp() {
  console.log(`MVV candidate evidence capture

Usage:
  node scripts/mvv-candidate-capture.mjs --company openai --write
  node scripts/mvv-candidate-capture.mjs --candidate openai-2018-charter-mission --write
  node scripts/mvv-candidate-capture.mjs --all --write --json

Options:
  --company <id>     Capture all candidates for one company.
  --candidate <id>   Capture one candidate by candidate_id.
  --all              Capture all candidates.
  --write            Save evidence and update candidate files.
  --json             Print JSON summary.
  --headful          Open browser visibly.
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
        // Try the next bundled runtime path.
      }
    }
  }
  throw new Error("Playwright is not available.");
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
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
      data[currentKey] = raw === "" || raw === "[]" ? [] : stripQuotes(raw);
      continue;
    }

    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(stripQuotes(listItem[1]));
    }
  }

  return data;
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/[\s\r\n\t]+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

async function listCompanyDirs() {
  const entries = await fs.readdir(companiesDir, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await pathExists(path.join(companiesDir, entry.name, "profile.md"))) dirs.push(entry.name);
  }
  return dirs.sort();
}

async function listCandidateFiles(companySlug) {
  const dir = path.join(companiesDir, companySlug, "candidates");
  if (!(await pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files.filter((file) => file.endsWith(".md")).sort().map((file) => path.join(dir, file));
}

async function loadCandidates(args) {
  const slugs = args.all ? await listCompanyDirs() : [args.company];
  const candidates = [];

  for (const slug of slugs) {
    for (const filePath of await listCandidateFiles(slug)) {
      const markdown = await fs.readFile(filePath, "utf8");
      const meta = parseFrontmatter(markdown);
      if (args.candidate && meta.candidate_id !== args.candidate) continue;
      candidates.push({ slug, filePath, markdown, meta });
    }
  }

  if (args.candidate && candidates.length === 0) {
    throw new Error(`Candidate not found: ${args.candidate}`);
  }

  return candidates;
}

async function dismissCommonPopups(page) {
  const labels = ["Accept All", "Accept All Cookies", "Accept", "Agree", "I agree", "同意", "全部接受", "接受全部"];
  for (const label of labels) {
    await page.getByRole("button", { name: label, exact: false }).click({ timeout: 900 }).catch(() => {});
  }
}

async function highlight(page, target, label) {
  if (!target) return false;
  return page.evaluate(({ target, label }) => {
    const clean = (value) => (value || "").toLowerCase().replace(/\s+/g, " ").trim();
    const needle = clean(target);
    if (!needle) return false;

    document.querySelectorAll("[data-mvv-candidate-highlight]").forEach((element) => {
      element.style.outline = "";
      element.style.outlineOffset = "";
      element.style.backgroundColor = "";
      element.removeAttribute("data-mvv-candidate-highlight");
    });
    document.querySelectorAll("[data-mvv-candidate-badge]").forEach((element) => element.remove());

    const candidates = Array.from(document.body.querySelectorAll("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return false;
        return clean(element.innerText || element.textContent).includes(needle);
      })
      .map((element) => ({ element, length: (element.innerText || element.textContent || "").length }))
      .sort((a, b) => a.length - b.length);

    const best = candidates[0]?.element;
    if (!best) return false;

    best.setAttribute("data-mvv-candidate-highlight", "true");
    best.style.outline = "4px solid #d32020";
    best.style.outlineOffset = "6px";
    best.style.backgroundColor = "rgba(255, 230, 0, 0.28)";
    best.scrollIntoView({ block: "center", inline: "nearest" });

    const badge = document.createElement("div");
    badge.setAttribute("data-mvv-candidate-badge", "true");
    badge.textContent = `MVV candidate evidence: ${label}`;
    badge.style.position = "fixed";
    badge.style.left = "16px";
    badge.style.top = "16px";
    badge.style.zIndex = "2147483647";
    badge.style.padding = "8px 10px";
    badge.style.border = "2px solid #d32020";
    badge.style.background = "#fff";
    badge.style.color = "#111";
    badge.style.font = "700 13px Arial, sans-serif";
    document.body.appendChild(badge);

    return true;
  }, { target, label });
}

function updateEvidenceAssets(markdown, assets) {
  const lines = assets.map((asset) => `  - "${asset}"`).join("\n");
  if (/evidence_assets:\s*\[\]/.test(markdown)) {
    return markdown.replace(/evidence_assets:\s*\[\]/, `evidence_assets:\n${lines}`);
  }
  if (/evidence_assets:\s*\n(?:\s*-\s*.*\n)*/.test(markdown)) {
    return markdown.replace(/evidence_assets:\s*\n(?:\s*-\s*.*\n)*/, `evidence_assets:\n${lines}\n`);
  }
  return markdown.replace(/^---\n/, `---\nevidence_assets:\n${lines}\n`);
}

async function captureCandidate(browser, candidate, args) {
  const { slug, filePath, markdown, meta } = candidate;
  const companyDir = path.join(companiesDir, slug);
  const candidateId = meta.candidate_id || path.basename(filePath, ".md");
  const evidenceDir = path.join(companyDir, "evidence", today, "candidates", candidateId);
  const sourceUrl = meta.source_url;
  const assets = [];

  if (!sourceUrl) {
    return { candidate_id: candidateId, ok: false, error: "Missing source_url." };
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
    locale: meta.language === "zh" ? "zh-CN" : "en-US",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  });

  try {
    const response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 75000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await dismissCommonPopups(page);
    await page.waitForTimeout(700);

    const title = await page.title().catch(() => "");
    const finalUrl = page.url();
    const pageText = await page.evaluate(() => document.body?.innerText || "");
    const target = meta.raw_mission || meta.raw_values || meta.raw_vision || meta.source_title || "";
    const highlighted = await highlight(page, target, meta.raw_mission ? "mission" : meta.raw_values ? "values" : "source").catch(() => false);
    await page.waitForTimeout(400).catch(() => {});

    if (args.write) {
      await fs.mkdir(evidenceDir, { recursive: true });
      const textAsset = path.join("evidence", today, "candidates", candidateId, `page-text-${slugify(title)}.txt`);
      await fs.writeFile(path.join(companyDir, textAsset), pageText, "utf8");
      assets.push(textAsset);

      const screenshotAsset = path.join("evidence", today, "candidates", candidateId, `screenshot-${slugify(title)}.png`);
      await page.screenshot({ path: path.join(companyDir, screenshotAsset), fullPage: false });
      assets.push(screenshotAsset);

      const metadataAsset = path.join("evidence", today, "candidates", candidateId, "metadata.json");
      await fs.writeFile(path.join(companyDir, metadataAsset), JSON.stringify({
        candidate_id: candidateId,
        source_url: sourceUrl,
        final_url: finalUrl,
        title,
        status: response?.status() ?? null,
        ok: response?.ok() ?? false,
        text_length: pageText.length,
        highlighted,
        captured_at: new Date().toISOString()
      }, null, 2), "utf8");
      assets.push(metadataAsset);

      await fs.writeFile(filePath, updateEvidenceAssets(markdown, assets), "utf8");
    }

    await page.close().catch(() => {});
    return {
      candidate_id: candidateId,
      company_id: meta.company_id || slug,
      ok: response?.ok() ?? false,
      status: response?.status() ?? null,
      title,
      final_url: finalUrl,
      text_length: pageText.length,
      highlighted,
      evidence_assets: assets.map((asset) => `data/companies/${slug}/${asset}`)
    };
  } catch (error) {
    await page.close().catch(() => {});
    return {
      candidate_id: candidateId,
      company_id: meta.company_id || slug,
      ok: false,
      source_url: sourceUrl,
      error: error.message
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const candidates = await loadCandidates(args);
  const chromium = await loadPlaywright();
  const browser = await chromium.launch({ headless: !args.headful });

  try {
    const results = [];
    for (const candidate of candidates) {
      const result = await captureCandidate(browser, candidate, args);
      results.push(result);
      if (!args.json) {
        console.log(`${result.candidate_id}: ${result.ok ? "ok" : "failed"}`);
      }
    }

    if (args.json) {
      console.log(JSON.stringify({ date: today, write: args.write, results }, null, 2));
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

