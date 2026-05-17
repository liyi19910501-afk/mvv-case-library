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
const uiDataJsPath = path.join(dataDir, "mvv-ui-data.js");

function parseArgs(argv) {
  const args = {
    rebuild: false,
    json: false
  };

  for (const arg of argv) {
    if (arg === "--rebuild") args.rebuild = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`MVV database sync

Usage:
  node scripts/mvv-db-sync.mjs --rebuild
  node scripts/mvv-db-sync.mjs --rebuild --json

Options:
  --rebuild  Recreate data/mvv.sqlite from data/companies.
  --json     Print sync summary as JSON.
`);
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

function extractMatch(regex, text, fallback = "") {
  const match = text.match(regex);
  return match ? match[1].trim() : fallback;
}

function extractProfileStatement(markdown, field) {
  const section = markdown.match(new RegExp(`### ${field}\\s*\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`));
  if (!section) return "";
  return extractMatch(/- 当前正式表述：([^\n]*)/, section[1]);
}

function extractAnalysisNote(markdown) {
  return extractMatch(/## 战略与文化解读\n- ([\s\S]*?)(?:\n\n|$)/, markdown);
}

function extractSectionText(markdown, heading) {
  return extractMatch(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`), markdown);
}

function json(value) {
  return JSON.stringify(value ?? null);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
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

async function readJsonIfExists(target) {
  if (!(await pathExists(target))) return null;
  return JSON.parse(await fs.readFile(target, "utf8"));
}

async function listFilesIfExists(dir, predicate = () => true) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => entry.name).sort();
}

function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    DROP TABLE IF EXISTS source_candidates;
    DROP TABLE IF EXISTS research_briefs;
    DROP TABLE IF EXISTS crawl_logs;
    DROP TABLE IF EXISTS evidence_assets;
    DROP TABLE IF EXISTS version_records;
    DROP TABLE IF EXISTS current_snapshots;
    DROP TABLE IF EXISTS companies;

    CREATE TABLE companies (
      company_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      company_name_cn TEXT,
      company_name_en TEXT,
      country_or_region TEXT,
      category_label TEXT,
      industry_primary TEXT,
      industry_secondary TEXT,
      pool_type TEXT,
      status TEXT,
      priority_level TEXT,
      tracking_start_date TEXT,
      language_scope_json TEXT,
      official_urls_json TEXT,
      logo_asset TEXT,
      logo_source_url TEXT,
      related_terms_json TEXT,
      profile_path TEXT NOT NULL,
      last_reviewed_at TEXT
    );

    CREATE TABLE current_snapshots (
      company_id TEXT PRIMARY KEY REFERENCES companies(company_id),
      captured_at TEXT,
      captured_date TEXT,
      primary_language TEXT,
      classification TEXT,
      mission TEXT,
      vision TEXT,
      values_json TEXT,
      raw_terms_json TEXT,
      normalized_mvv_hash TEXT,
      confidence_level TEXT,
      review_status TEXT,
      analyst_note TEXT,
      source_urls_json TEXT,
      evidence_assets_json TEXT
    );

    CREATE TABLE version_records (
      record_id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(company_id),
      record_date TEXT,
      captured_at TEXT,
      effective_period_guess TEXT,
      source_type TEXT,
      source_level TEXT,
      source_title TEXT,
      source_url TEXT,
      source_org TEXT,
      language TEXT,
      change_type TEXT,
      confidence_level TEXT,
      review_status TEXT,
      classification TEXT,
      evidence_assets_json TEXT,
      verification_sources_json TEXT,
      mission TEXT,
      vision TEXT,
      values_text TEXT,
      analysis_note TEXT,
      file_path TEXT NOT NULL
    );

    CREATE TABLE evidence_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(company_id),
      record_id TEXT,
      asset_path TEXT NOT NULL,
      asset_type TEXT,
      captured_date TEXT
    );

    CREATE TABLE crawl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(company_id),
      captured_at TEXT,
      change_status TEXT,
      log_path TEXT NOT NULL
    );

    CREATE TABLE research_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id TEXT NOT NULL REFERENCES companies(company_id),
      generated_date TEXT,
      brief_path TEXT NOT NULL
    );

    CREATE TABLE source_candidates (
      candidate_id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(company_id),
      found_at TEXT,
      source_level TEXT,
      source_type TEXT,
      source_title TEXT,
      source_url TEXT,
      source_org TEXT,
      published_date TEXT,
      language TEXT,
      raw_mission TEXT,
      raw_vision TEXT,
      raw_values TEXT,
      raw_other_terms TEXT,
      evidence_assets_json TEXT,
      verification_note TEXT,
      recommended_action TEXT,
      status TEXT DEFAULT 'candidate'
    );
  `);
}

function insertCompany(db, company) {
  db.prepare(`
    INSERT INTO companies (
      company_id, slug, company_name_cn, company_name_en, country_or_region,
      category_label, industry_primary, industry_secondary, pool_type, status, priority_level,
      tracking_start_date, language_scope_json, official_urls_json, logo_asset,
      logo_source_url, related_terms_json,
      profile_path, last_reviewed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    company.company_id,
    company.slug,
    company.company_name_cn || "",
    company.company_name_en || "",
    company.country_or_region || "",
    company.category_label || "",
    company.industry_primary || "",
    company.industry_secondary || "",
    company.pool_type || "",
    company.status || "",
    company.priority_level || "",
    company.tracking_start_date || "",
    json(toArray(company.language_scope)),
    json(toArray(company.official_urls)),
    company.logo_asset || "",
    company.logo_source_url || "",
    json(toArray(company.related_terms)),
    company.profile_path,
    company.last_reviewed_at || ""
  );
}

function insertCurrent(db, companyId, current) {
  if (!current) return;
  db.prepare(`
    INSERT INTO current_snapshots (
      company_id, captured_at, captured_date, primary_language, classification,
      mission, vision, values_json, raw_terms_json, normalized_mvv_hash,
      confidence_level, review_status, analyst_note, source_urls_json, evidence_assets_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    companyId,
    current.captured_at || "",
    current.captured_date || "",
    current.primary_language || "",
    current.classification || "",
    current.structured?.mission || "",
    current.structured?.vision || "",
    json(current.structured?.values || []),
    json(current.structured?.raw_terms || {}),
    current.normalized_mvv_hash || "",
    current.confidence_level || "",
    current.review_status || "",
    current.analyst_note || "",
    json(current.source_urls || []),
    json(current.evidence_assets || [])
  );
}

function insertVersion(db, companyId, slug, fileName, markdown) {
  const meta = parseFrontmatter(markdown);
  const recordId = meta.record_id || `${companyId}-${fileName.replace(/\.md$/, "")}`;
  const legacySourceUrl = extractMatch(/- 来源：([^\n]*)/, markdown);
  const legacySourceTitle = extractMatch(/- 页面标题：([^\n]*)/, markdown);
  const legacyEvidenceAsset = extractMatch(/- 证据截图：([^\n]*)/, markdown);
  const evidenceAssets = toArray(meta.evidence_assets).length
    ? toArray(meta.evidence_assets)
    : legacyEvidenceAsset
      ? [legacyEvidenceAsset]
      : [];
  const mission = extractMatch(/### Mission \/ Purpose(?: \/ Belief)?\n- ([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown);
  const vision = extractMatch(/### Vision(?: \/ Aspiration)?\n- ([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown);
  const valuesText = extractMatch(/### Values \/ Principles(?: \/ Beliefs)?\n([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown);
  const analysisNote = extractAnalysisNote(markdown) || extractMatch(/- 分析备注：([^\n]*)/, markdown);
  const filePath = `data/companies/${slug}/versions/${fileName}`;

  db.prepare(`
    INSERT INTO version_records (
      record_id, company_id, record_date, captured_at, effective_period_guess,
      source_type, source_level, source_title, source_url, source_org, language,
      change_type, confidence_level, review_status, classification, evidence_assets_json,
      verification_sources_json, mission, vision, values_text, analysis_note, file_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    companyId,
    meta.record_date || fileName.slice(0, 10),
    meta.captured_at || "",
    meta.effective_period_guess || "",
    meta.source_type || (legacySourceUrl ? "official website" : ""),
    meta.source_level || "",
    meta.source_title || legacySourceTitle || "",
    meta.source_url || legacySourceUrl || "",
    meta.source_org || "",
    meta.language || "",
    meta.change_type || "record",
    meta.confidence_level || "",
    meta.review_status || "",
    meta.classification || "",
    json(evidenceAssets),
    json(toArray(meta.verification_sources)),
    mission.trim(),
    vision.trim(),
    valuesText.trim(),
    analysisNote.trim(),
    filePath
  );

  for (const asset of evidenceAssets) {
    insertEvidence(db, companyId, recordId, `data/companies/${slug}/${asset}`, meta.record_date || fileName.slice(0, 10));
  }
}

function insertEvidence(db, companyId, recordId, assetPath, capturedDate = "") {
  const lower = assetPath.toLowerCase();
  let type = "other";
  if (/\.(png|jpg|jpeg|webp)$/.test(lower)) type = "screenshot";
  else if (/\.txt$/.test(lower)) type = "page_text";
  else if (/\.json$/.test(lower)) type = "metadata";
  else if (/\.pdf$/.test(lower)) type = "pdf";

  db.prepare(`
    INSERT INTO evidence_assets (company_id, record_id, asset_path, asset_type, captured_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(companyId, recordId || "", assetPath, type, capturedDate);
}

function isMeaningfulStatement(value) {
  if (!value) return false;
  return ![
    "未单列",
    "未明确",
    "未找到",
    "当前官网未",
    "当前 reviewed 官方页面未"
  ].some((pattern) => value.includes(pattern));
}

function insertCrawlLog(db, companyId, slug, fileName, log) {
  db.prepare(`
    INSERT INTO crawl_logs (company_id, captured_at, change_status, log_path)
    VALUES (?, ?, ?, ?)
  `).run(companyId, log.captured_at || "", log.change_status || "", `data/companies/${slug}/crawl-logs/${fileName}`);
}

function insertResearchBrief(db, companyId, slug, fileName) {
  db.prepare(`
    INSERT INTO research_briefs (company_id, generated_date, brief_path)
    VALUES (?, ?, ?)
  `).run(companyId, fileName.slice(0, 10), `data/companies/${slug}/research-briefs/${fileName}`);
}

function insertCandidate(db, companyId, slug, fileName, markdown) {
  const meta = parseFrontmatter(markdown);
  const candidateId = meta.candidate_id || `${companyId}-${fileName.replace(/\.md$/, "")}`;

  db.prepare(`
    INSERT INTO source_candidates (
      candidate_id, company_id, found_at, source_level, source_type, source_title,
      source_url, source_org, published_date, language, raw_mission, raw_vision,
      raw_values, raw_other_terms, evidence_assets_json, verification_note,
      recommended_action, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    candidateId,
    companyId,
    meta.found_at || "",
    meta.source_level || "",
    meta.source_type || "",
    meta.source_title || "",
    meta.source_url || "",
    meta.source_org || "",
    meta.published_date || "",
    meta.language || "",
    meta.raw_mission || extractMatch(/### Mission \/ Purpose \/ Belief\n- ([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown),
    meta.raw_vision || extractMatch(/### Vision\n- ([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown),
    meta.raw_values || extractMatch(/### Values \/ Principles\n([\s\S]*?)(?:\n\n###|\n###|\n##|$)/, markdown),
    meta.raw_other_terms || extractSectionText(markdown, "Other Terms"),
    json(toArray(meta.evidence_assets)),
    meta.verification_note || extractSectionText(markdown, "Verification Note").trim(),
    meta.recommended_action || "needs_more_sources",
    meta.status || "candidate"
  );

  for (const asset of toArray(meta.evidence_assets)) {
    insertEvidence(db, companyId, candidateId, `data/companies/${slug}/${asset}`, meta.found_at || "");
  }
}

async function syncCompany(db, slug) {
  const companyDir = path.join(companiesDir, slug);
  const profilePath = path.join(companyDir, "profile.md");
  const profile = await fs.readFile(profilePath, "utf8");
  const meta = parseFrontmatter(profile);
  const companyId = meta.company_id || slug;

  insertCompany(db, {
    ...meta,
    company_id: companyId,
    slug,
    profile_path: `data/companies/${slug}/profile.md`
  });

  const current = await readJsonIfExists(path.join(companyDir, "current.json"));
  insertCurrent(db, companyId, current);

  const versions = await listFilesIfExists(path.join(companyDir, "versions"), (file) => file.endsWith(".md"));
  for (const fileName of versions) {
    const markdown = await fs.readFile(path.join(companyDir, "versions", fileName), "utf8");
    insertVersion(db, companyId, slug, fileName, markdown);
  }

  if (current?.evidence_assets?.length) {
    for (const asset of current.evidence_assets) {
      insertEvidence(db, companyId, "", `data/companies/${slug}/${asset}`, current.captured_date || "");
    }
  }

  const legacyAssets = await listFilesIfExists(path.join(companyDir, "assets"), (file) => {
    if (/^logo(?:-metadata)?\./i.test(file)) return false;
    return /\.(png|jpg|jpeg|webp|pdf|txt|json)$/i.test(file);
  });
  for (const fileName of legacyAssets) {
    insertEvidence(db, companyId, "", `data/companies/${slug}/assets/${fileName}`, fileName.slice(0, 10));
  }

  const crawlLogs = await listFilesIfExists(path.join(companyDir, "crawl-logs"), (file) => file.endsWith(".json"));
  for (const fileName of crawlLogs) {
    const log = JSON.parse(await fs.readFile(path.join(companyDir, "crawl-logs", fileName), "utf8"));
    insertCrawlLog(db, companyId, slug, fileName, log);
  }

  const briefs = await listFilesIfExists(path.join(companyDir, "research-briefs"), (file) => file.endsWith(".md"));
  for (const fileName of briefs) {
    insertResearchBrief(db, companyId, slug, fileName);
  }

  const candidates = await listFilesIfExists(path.join(companyDir, "candidates"), (file) => file.endsWith(".md"));
  for (const fileName of candidates) {
    const markdown = await fs.readFile(path.join(companyDir, "candidates", fileName), "utf8");
    insertCandidate(db, companyId, slug, fileName, markdown);
  }

  return { company_id: companyId, versions: versions.length, crawl_logs: crawlLogs.length, research_briefs: briefs.length, candidates: candidates.length };
}

function queryAll(db, sql, ...params) {
  return db.prepare(sql).all(...params);
}

function queryOne(db, sql, ...params) {
  return db.prepare(sql).get(...params);
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function dedupeSources(sources) {
  const seen = new Set();
  const result = [];

  for (const source of sources) {
    const url = (source?.url || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push({
      url,
      title: (source.title || "").trim(),
      level: source.level || "",
      type: source.type || ""
    });
  }

  return result;
}

function buildUiData(db) {
  const companies = queryAll(db, `
    SELECT c.*, s.captured_at, s.captured_date, s.primary_language, s.classification,
           s.mission, s.vision, s.values_json, s.confidence_level, s.review_status,
           s.analyst_note, s.source_urls_json, s.evidence_assets_json
    FROM companies c
    LEFT JOIN current_snapshots s ON s.company_id = c.company_id
    ORDER BY c.slug
  `);

  return companies.map((company) => {
    const versions = queryAll(db, `
      SELECT record_date, change_type, confidence_level, review_status, classification,
             source_title, source_url, source_level, source_type, evidence_assets_json,
             analysis_note, file_path
      FROM version_records
      WHERE company_id = ?
      ORDER BY record_date, file_path
    `, company.company_id);
    const candidates = queryAll(db, `
      SELECT candidate_id, found_at, source_level, source_type, source_title,
             source_url, source_org, published_date, language, raw_mission,
             raw_vision, raw_values, verification_note, recommended_action, status
      FROM source_candidates
      WHERE company_id = ?
      ORDER BY published_date, found_at, candidate_id
    `, company.company_id);

    const latestVersion = versions.at(-1);
    const values = JSON.parse(company.values_json || "[]");
    const profileMarkdown = fsSync.readFileSync(path.join(rootDir, company.profile_path), "utf8");
    const mission = company.mission || extractProfileStatement(profileMarkdown, "Mission");
    const vision = company.vision || extractProfileStatement(profileMarkdown, "Vision");
    const valuesText = values.length ? values.join("；") : extractProfileStatement(profileMarkdown, "Values");
    const sourceUrls = safeJsonParse(company.source_urls_json, []);
    const officialUrls = safeJsonParse(company.official_urls_json, []);
    const evidenceAssets = safeJsonParse(company.evidence_assets_json, []);
    const historicalVersions = versions
      .filter((version) => version.file_path !== latestVersion?.file_path)
      .slice()
      .reverse();
    const officialSources = dedupeSources([
      ...sourceUrls.map((source) => ({
        url: source.final_url || source.url,
        title: source.title || "",
        level: "official",
        type: "current"
      })),
      {
        url: latestVersion?.source_url,
        title: latestVersion?.source_title || "",
        level: latestVersion?.source_level || "official",
        type: latestVersion?.source_type || "current"
      },
      ...officialUrls.map((url) => ({
        url,
        title: "",
        level: "official",
        type: "profile"
      })),
      ...historicalVersions.map((version) => ({
        url: version.source_url,
        title: version.source_title || "",
        level: version.source_level || "official",
        type: version.source_type || "version"
      }))
    ]);
    const source = officialSources[0]?.url || "";
    const latestEvidence = evidenceAssets.find((asset) => /\.(png|jpg|jpeg|webp)$/i.test(asset));
    const latestVersionEvidenceAsset = safeJsonParse(latestVersion?.evidence_assets_json, [])
      .find((asset) => /\.(png|jpg|jpeg|webp)$/i.test(asset));
    const latestVersionEvidence = latestVersionEvidenceAsset
      ? `data/companies/${company.slug}/${latestVersionEvidenceAsset}`
      : "";
    const fallbackEvidence = queryOne(db, `
      SELECT asset_path FROM evidence_assets
      WHERE company_id = ? AND asset_type = 'screenshot'
        AND asset_path NOT LIKE '%/assets/logo.%'
      ORDER BY captured_date DESC, id DESC
    `, company.company_id)?.asset_path || "";
    const isPlanned = company.status === "planned";
    const hasStandardFields = isMeaningfulStatement(mission) && isMeaningfulStatement(vision) && isMeaningfulStatement(valuesText);
    const type = isPlanned
      ? "planned"
      : company.review_status === "needs_review"
        ? "review"
        : company.classification === "standard_mvv" || hasStandardFields
          ? "complete"
          : "partial";
    const typeLabel = type === "complete"
      ? "标准 MVV"
      : type === "review"
        ? "需复核"
        : type === "planned"
          ? "待建档"
          : "非标准 MVV";

    return {
      id: company.company_id,
      name: company.company_name_cn,
      en: company.company_name_en,
      region: company.country_or_region,
      categoryLabel: company.category_label || "未分类",
      industry: [company.industry_primary, company.industry_secondary].filter(Boolean).join(" / "),
      type,
      typeLabel,
      trackingStatus: company.status || "",
      classification: company.classification || "",
      confidence: company.confidence_level || (isPlanned ? "" : "high"),
      reviewStatus: company.review_status || "",
      reviewed: company.captured_date || company.last_reviewed_at || "",
      capturedAt: company.captured_at || "",
      mission,
      vision,
      values: valuesText,
      research: company.analyst_note || (isPlanned ? "已进入 Wave 2 建档队列，尚未完成官方 MVV 抓取与人工确认。" : ""),
      source,
      sourceTitle: officialSources[0]?.title || "",
      officialSources,
      logo: company.logo_asset ? `data/companies/${company.slug}/${company.logo_asset}` : "",
      logoSource: company.logo_source_url || "",
      profile: company.profile_path,
      version: latestVersion?.file_path || "",
      evidence: latestEvidence ? `data/companies/${company.slug}/${latestEvidence}` : latestVersionEvidence || fallbackEvidence,
      evidenceAssets: evidenceAssets.map((asset) => `data/companies/${company.slug}/${asset}`),
      history: versions.map((version) => ({
        date: version.record_date,
        changeType: version.change_type,
        confidence: version.confidence_level,
        reviewStatus: version.review_status,
        classification: version.classification,
        sourceTitle: version.source_title,
        sourceUrl: version.source_url,
        note: version.analysis_note,
        file: version.file_path
      })),
      candidates
    };
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(dataDir, { recursive: true });
  if (args.rebuild && await pathExists(dbPath)) {
    await fs.rm(dbPath);
  }

  const db = new DatabaseSync(dbPath);
  createSchema(db);

  const dirs = await listCompanyDirs();
  const summary = [];

  db.exec("BEGIN");
  try {
    for (const slug of dirs) {
      summary.push(await syncCompany(db, slug));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const uiData = {
    generated_at: new Date().toISOString(),
    companies: buildUiData(db)
  };
  const uiDataJson = JSON.stringify(uiData, null, 2);
  await fs.writeFile(uiDataPath, uiDataJson, "utf8");
  await fs.writeFile(
    uiDataJsPath,
    `// Auto-generated by scripts/mvv-db-sync.mjs. Do not edit by hand.\n` +
      `// This wrapper lets index.html load data via <script src> so it also works from file://.\n` +
      `window.__MVV_DATA = ${uiDataJson};\n`,
    "utf8"
  );

  const result = {
    database: path.relative(rootDir, dbPath),
    ui_data: path.relative(rootDir, uiDataPath),
    ui_data_js: path.relative(rootDir, uiDataJsPath),
    companies: summary.length,
    summary
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Synced ${summary.length} companies into ${result.database}`);
    console.log(`Exported ${result.ui_data}`);
    console.log(`Exported ${result.ui_data_js}`);
  }

  db.close();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
