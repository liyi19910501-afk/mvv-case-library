#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const companiesDir = path.join(rootDir, "data", "companies");
const today = new Date().toISOString().slice(0, 10);

function parseArgs(argv) {
  const args = {
    company: "",
    all: false,
    write: false,
    json: false,
    yearStart: ""
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--company") args.company = argv[++i] || "";
    else if (arg === "--all") args.all = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--year-start") args.yearStart = argv[++i] || "";
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  if (!args.company && !args.all) {
    throw new Error("Use --company <company_id> or --all.");
  }
  return args;
}

function printHelp() {
  console.log(`MVV historical research brief generator

Usage:
  node scripts/mvv-history-brief.mjs --company google --write
  node scripts/mvv-history-brief.mjs --company anker-innovations --year-start 2011 --write
  node scripts/mvv-history-brief.mjs --all --json

Options:
  --company <id>       Generate one company history brief.
  --all                Generate briefs for all companies.
  --write              Write markdown into data/companies/<id>/research-briefs/.
  --json               Print machine-readable JSON.
  --year-start <year>  Optional founding/listing/start year hint for search queries.
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

async function listCompanies() {
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

async function loadCompany(dirName) {
  const companyDir = path.join(companiesDir, dirName);
  const profilePath = path.join(companyDir, "profile.md");
  const markdown = await fs.readFile(profilePath, "utf8");
  const data = parseFrontmatter(markdown);
  return {
    dirName,
    companyDir,
    company_id: data.company_id || dirName,
    company_name_cn: data.company_name_cn || "",
    company_name_en: data.company_name_en || "",
    country_or_region: data.country_or_region || "",
    official_urls: Array.isArray(data.official_urls) ? data.official_urls : [],
    language_scope: Array.isArray(data.language_scope) ? data.language_scope : []
  };
}

function quoted(value) {
  return `"${value}"`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function buildQueries(company, yearStart) {
  const cn = company.company_name_cn;
  const en = company.company_name_en;
  const names = unique([cn, en, company.company_id]);
  const isChina = company.language_scope.includes("zh") || /China|中国/i.test(company.country_or_region);
  const yearTerms = yearStart ? [`${yearStart}`, `${yearStart}..${new Date().getFullYear()}`] : [];
  const officialHosts = company.official_urls.map(hostFromUrl).filter(Boolean);
  const officialHost = officialHosts[0] || "";

  const termSets = isChina
    ? ["使命 愿景 价值观", "企业文化 价值观", "使命 愿景", "核心价值观", "宗旨 信念"]
    : ["mission vision values", "mission values", "purpose values", "core values", "belief purpose"];

  const general = [];
  for (const name of names) {
    for (const terms of termSets) {
      general.push(`${quoted(name)} ${terms}`);
      if (yearTerms[0]) general.push(`${quoted(name)} ${terms} ${yearTerms[0]}`);
    }
  }

  const official = [];
  for (const host of officialHosts) {
    for (const terms of termSets) {
      official.push(`site:${host} ${terms}`);
    }
  }

  const archive = company.official_urls.map((url) => `https://web.archive.org/web/*/${url}`);

  const pdf = [];
  for (const name of names) {
    if (isChina) {
      pdf.push(`${quoted(name)} 使命 愿景 价值观 filetype:pdf`);
      pdf.push(`${quoted(name)} ESG 报告 企业文化 filetype:pdf`);
      pdf.push(`${quoted(name)} 招股书 企业文化 filetype:pdf`);
    } else {
      pdf.push(`${quoted(name)} mission values annual report filetype:pdf`);
      pdf.push(`${quoted(name)} purpose values ESG report filetype:pdf`);
      pdf.push(`${quoted(name)} culture code filetype:pdf`);
    }
  }

  const wechat = isChina ? unique([
    `${quoted(cn || en)} 使命 愿景 价值观 site:mp.weixin.qq.com`,
    `${quoted(cn || en)} 企业文化 核心价值观 site:mp.weixin.qq.com`,
    `${quoted(cn || en)} 创始人 使命 愿景 site:mp.weixin.qq.com`,
    `${quoted(cn || en)} 价值观 搜狗微信`,
    `${quoted(cn || en)} 企业文化 微信公众号`
  ]) : [];

  const thirdParty = [];
  for (const name of names) {
    if (isChina) {
      thirdParty.push(`${quoted(name)} 企业文化 价值观 媒体`);
      thirdParty.push(`${quoted(name)} 招聘 价值观`);
      thirdParty.push(`${quoted(name)} 使命 愿景 价值观 历史`);
    } else {
      thirdParty.push(`${quoted(name)} mission statement history`);
      thirdParty.push(`${quoted(name)} values history`);
      thirdParty.push(`${quoted(name)} culture values interview`);
    }
  }

  return {
    officialHost,
    general: unique(general),
    official: unique(official),
    archive: unique(archive),
    pdf: unique(pdf),
    wechat,
    thirdParty: unique(thirdParty)
  };
}

function markdownList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- ";
}

function briefMarkdown(company, queries, yearStart) {
  const title = company.company_name_cn || company.company_name_en || company.company_id;
  return `# ${title} MVV 历史回溯 Brief

- 生成日期：${today}
- 公司 ID：${company.company_id}
- 语言优先级：${company.language_scope.join(", ") || "未配置"}
- 起始年份线索：${yearStart || "未配置"}

## 研究目标

1. 回溯企业成立以来 Mission / Vision / Values 的历史表述。
2. 区分正式官网表述、官方社媒表述、媒体转述和搜索线索。
3. 只有证据充分时才创建正式版本记录。

## 官方来源优先搜索

${markdownList(queries.official)}

## 网页历史快照

${markdownList(queries.archive)}

## PDF / 年报 / ESG / 招股书

${markdownList(queries.pdf)}

## Google / 百度通用搜索

${markdownList(queries.general)}

## 微信与国内渠道

${markdownList(queries.wechat)}

## 三方验证

${markdownList(queries.thirdParty)}

## 候选来源登记

复制下面模板登记每个候选来源。搜索摘要只能做线索，不能直接作为正式版本。

\`\`\`yaml
candidate_id:
company_id: ${company.company_id}
found_at: ${today}
source_level: A/B/C/D
source_type: official_archive / annual_report / wechat / media / search_snippet / job_site / other
source_title:
source_url:
source_org:
published_date:
language:
raw_mission:
raw_vision:
raw_values:
raw_other_terms:
evidence_assets:
  - 
verification_note:
recommended_action: ignore / needs_more_sources / create_version
\`\`\`

## 转正式版本前检查

- 是否看到了原文，而不是搜索结果摘要。
- 是否有截图、PDF、页面文本或网页快照。
- 是否能确认来源机构与发布日期。
- 是否能说明这是正式 MVV、品牌口号、招聘文化宣传，还是媒体转述。
- 是否能与上一版本比较并判断是否为实质变化。
`;
}

async function generateCompany(dirName, args) {
  const company = await loadCompany(dirName);
  const queries = buildQueries(company, args.yearStart);
  const markdown = briefMarkdown(company, queries, args.yearStart);
  let output = "";

  if (args.write) {
    const briefDir = path.join(company.companyDir, "research-briefs");
    await fs.mkdir(briefDir, { recursive: true });
    output = path.join(briefDir, `${today}-history-research.md`);
    await fs.writeFile(output, markdown, "utf8");
  }

  return {
    company_id: company.company_id,
    company_name_cn: company.company_name_cn,
    company_name_en: company.company_name_en,
    output: output ? path.relative(rootDir, output) : "",
    queries
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = args.all ? await listCompanies() : [args.company];
  const results = [];

  for (const target of targets) {
    results.push(await generateCompany(target, args));
  }

  if (args.json) {
    console.log(JSON.stringify({ date: today, results }, null, 2));
    return;
  }

  for (const result of results) {
    console.log(`${result.company_id}: ${result.output || "dry-run"}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

