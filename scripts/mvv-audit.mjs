#!/usr/bin/env node

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const companiesDir = path.join(dataDir, "companies");
const dbPath = path.join(dataDir, "mvv.sqlite");
const uiDataPath = path.join(dataDir, "mvv-ui-data.json");
const indexPath = path.join(rootDir, "index.html");

function parseArgs(argv) {
  const args = { json: false, strict: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`MVV audit

Usage:
  node scripts/mvv-audit.mjs
  node scripts/mvv-audit.mjs --json
  node scripts/mvv-audit.mjs --strict

Checks data/companies, current snapshots, version evidence, SQLite, UI export, and stale UI labels.
`);
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

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listCompanyDirs() {
  const entries = await fs.readdir(companiesDir, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await pathExists(path.join(companiesDir, entry.name, "profile.md"))) {
      dirs.push(entry.name);
    }
  }
  return dirs.sort();
}

async function listFiles(dir, predicate = () => true) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => entry.name).sort();
}

function rel(...parts) {
  return path.relative(rootDir, path.join(...parts));
}

function addIssue(issues, severity, code, message, file = "") {
  issues.push({ severity, code, message, file });
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

async function auditCompany(slug, issues) {
  const companyDir = path.join(companiesDir, slug);
  const profilePath = path.join(companyDir, "profile.md");
  const profile = await fs.readFile(profilePath, "utf8");
  const meta = parseFrontmatter(profile);
  const companyId = meta.company_id || slug;

  if (!arrayValue(meta.official_urls).length) {
    addIssue(issues, "error", "missing_official_urls", `${companyId} has no official_urls.`, rel(profilePath));
  }

  if (!meta.logo_asset) {
    addIssue(issues, "warn", "missing_logo_asset", `${companyId} has no logo_asset.`, rel(profilePath));
  } else if (!(await pathExists(path.join(companyDir, meta.logo_asset)))) {
    addIssue(issues, "error", "missing_logo_file", `${companyId} logo file is missing: ${meta.logo_asset}`, rel(profilePath));
  }

  const currentPath = path.join(companyDir, "current.json");
  if (!(await pathExists(currentPath))) {
    addIssue(issues, "error", "missing_current_json", `${companyId} has no current.json.`, rel(companyDir));
  } else {
    const current = JSON.parse(await fs.readFile(currentPath, "utf8"));
    const structured = current.structured || {};
    const hasAny = Boolean(structured.mission || structured.vision || structured.values?.length);
    if (!hasAny) addIssue(issues, "error", "empty_current_structured", `${companyId} current.json has no MVV fields.`, rel(currentPath));
    if (!current.normalized_mvv_hash) addIssue(issues, "error", "missing_current_hash", `${companyId} current.json has no normalized_mvv_hash.`, rel(currentPath));
    if (!arrayValue(current.source_urls).length) addIssue(issues, "warn", "missing_current_sources", `${companyId} current.json has no source_urls.`, rel(currentPath));

    for (const asset of arrayValue(current.evidence_assets)) {
      if (!(await pathExists(path.join(companyDir, asset)))) {
        addIssue(issues, "error", "missing_current_evidence", `${companyId} current evidence is missing: ${asset}`, rel(currentPath));
      }
    }
  }

  const versions = await listFiles(path.join(companyDir, "versions"), (file) => file.endsWith(".md"));
  if (!versions.length) {
    addIssue(issues, "warn", "missing_versions", `${companyId} has no version records.`, rel(companyDir));
  }

  for (const fileName of versions) {
    const versionPath = path.join(companyDir, "versions", fileName);
    const markdown = await fs.readFile(versionPath, "utf8");
    const versionMeta = parseFrontmatter(markdown);
    if (!versionMeta.record_id && !markdown.includes("- 日期：")) {
      addIssue(issues, "warn", "legacy_version_format", `${companyId}/${fileName} has no frontmatter record_id.`, rel(versionPath));
    }
    const sourceUrl = versionMeta.source_url || markdown.match(/- 来源：([^\n]*)/)?.[1] || "";
    if (!sourceUrl) addIssue(issues, "warn", "missing_version_source", `${companyId}/${fileName} has no source_url.`, rel(versionPath));

    const evidenceAssets = arrayValue(versionMeta.evidence_assets);
    for (const asset of evidenceAssets) {
      if (!(await pathExists(path.join(companyDir, asset)))) {
        addIssue(issues, "error", "missing_version_evidence", `${companyId}/${fileName} evidence is missing: ${asset}`, rel(versionPath));
      }
      if (/hang-tight|botfailover|404/i.test(asset)) {
        addIssue(issues, "warn", "suspicious_evidence_name", `${companyId}/${fileName} evidence may be a waiting/error page: ${asset}`, rel(versionPath));
      }
    }
  }

  const candidates = await listFiles(path.join(companyDir, "candidates"), (file) => file.endsWith(".md"));
  for (const fileName of candidates) {
    const candidatePath = path.join(companyDir, "candidates", fileName);
    const markdown = await fs.readFile(candidatePath, "utf8");
    const candidateMeta = parseFrontmatter(markdown);
    if (!candidateMeta.source_level) addIssue(issues, "warn", "missing_candidate_level", `${companyId}/${fileName} has no source_level.`, rel(candidatePath));
    if (!candidateMeta.source_url) addIssue(issues, "warn", "missing_candidate_url", `${companyId}/${fileName} has no source_url.`, rel(candidatePath));
    for (const asset of arrayValue(candidateMeta.evidence_assets)) {
      if (!(await pathExists(path.join(companyDir, asset)))) {
        addIssue(issues, "error", "missing_candidate_evidence", `${companyId}/${fileName} evidence is missing: ${asset}`, rel(candidatePath));
      }
    }
  }
}

async function auditUi(companies, issues) {
  if (!(await pathExists(uiDataPath))) {
    addIssue(issues, "error", "missing_ui_data", "data/mvv-ui-data.json is missing.", rel(uiDataPath));
    return null;
  }

  const uiData = JSON.parse(await fs.readFile(uiDataPath, "utf8"));
  const uiCompanies = uiData.companies || [];
  if (uiCompanies.length !== companies.length) {
    addIssue(issues, "error", "ui_company_count_mismatch", `UI data has ${uiCompanies.length} companies, file data has ${companies.length}.`, rel(uiDataPath));
  }

  for (const company of uiCompanies) {
    for (const key of ["logo", "profile", "version", "evidence"]) {
      if (company[key] && !(await pathExists(path.join(rootDir, company[key])))) {
        addIssue(issues, "error", "missing_ui_asset", `${company.id} UI ${key} is missing: ${company[key]}`, rel(uiDataPath));
      }
    }
    if (!["标准 MVV", "非标准 MVV", "需复核"].includes(company.typeLabel)) {
      addIssue(issues, "error", "bad_ui_type_label", `${company.id} has unexpected typeLabel: ${company.typeLabel}`, rel(uiDataPath));
    }
    if ((company.evidence || "").includes("/assets/logo.")) {
      addIssue(issues, "error", "ui_evidence_is_logo", `${company.id} evidence points to logo asset.`, rel(uiDataPath));
    }
  }

  if (await pathExists(indexPath)) {
    const html = await fs.readFile(indexPath, "utf8");
    const stale = ["完整/接近完整", "字段不完整", "叙事型表达", "待复核", "Current Snapshot", "data-filter=\"narrative\""];
    for (const pattern of stale) {
      if (html.includes(pattern)) addIssue(issues, "error", "stale_ui_label", `index.html still contains stale label: ${pattern}`, rel(indexPath));
    }
  }

  return uiData;
}

function auditDatabase(companies, issues) {
  if (!fsSync.existsSync(dbPath)) {
    addIssue(issues, "error", "missing_database", "data/mvv.sqlite is missing.", rel(dbPath));
    return {};
  }

  const db = new DatabaseSync(dbPath);
  try {
    const counts = {
      companies: db.prepare("SELECT count(*) value FROM companies").get().value,
      current_snapshots: db.prepare("SELECT count(*) value FROM current_snapshots").get().value,
      version_records: db.prepare("SELECT count(*) value FROM version_records").get().value,
      source_candidates: db.prepare("SELECT count(*) value FROM source_candidates").get().value,
      evidence_assets: db.prepare("SELECT count(*) value FROM evidence_assets").get().value
    };
    if (counts.companies !== companies.length) {
      addIssue(issues, "error", "db_company_count_mismatch", `SQLite has ${counts.companies} companies, file data has ${companies.length}.`, rel(dbPath));
    }
    if (counts.current_snapshots !== companies.length) {
      addIssue(issues, "error", "db_current_count_mismatch", `SQLite has ${counts.current_snapshots} current snapshots, expected ${companies.length}.`, rel(dbPath));
    }
    return counts;
  } finally {
    db.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const issues = [];
  const companies = await listCompanyDirs();

  for (const slug of companies) {
    await auditCompany(slug, issues);
  }

  await auditUi(companies, issues);
  const dbCounts = auditDatabase(companies, issues);

  const summary = {
    companies: companies.length,
    dbCounts,
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warn").length,
    issues
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`MVV audit: ${summary.companies} companies, ${summary.errors} errors, ${summary.warnings} warnings`);
    for (const issue of issues) {
      console.log(`[${issue.severity}] ${issue.code}: ${issue.message}${issue.file ? ` (${issue.file})` : ""}`);
    }
  }

  if (args.strict && (summary.errors > 0 || summary.warnings > 0)) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
