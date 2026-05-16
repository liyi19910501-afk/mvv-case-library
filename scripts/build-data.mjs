import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data/companies');
const indexHtmlPath = path.join(__dirname, '../index.html');
const uiDataPath = path.join(__dirname, '../data/mvv-ui-data.json');

function extractMatch(regex, text, defaultValue = '') {
  const match = text.match(regex);
  return match ? match[1].trim().replace(/^"|"$/g, '') : defaultValue;
}

function extractSection(regex, text) {
  const match = text.match(regex);
  if (!match) return '';
  return match[1].split('\n')
    .map(line => line.replace(/^- /, '').trim())
    .filter(Boolean)
    .join(' ');
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const data = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    const listItem = line.match(/^\s*-\s*"?(.*?)"?\s*$/);
    if (keyValue) {
      currentKey = keyValue[1];
      const value = keyValue[2].trim();
      data[currentKey] = value === '' || value === '[]'
        ? []
        : value.replace(/^"|"$/g, '');
      continue;
    }
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(listItem[1].replace(/^"|"$/g, ''));
    }
  }

  return data;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function latestFile(dirPath, predicate) {
  if (!fs.existsSync(dirPath)) return '';
  return fs.readdirSync(dirPath)
    .filter(predicate)
    .sort()
    .at(-1) || '';
}

function listVersions(compDir, dirName) {
  const versionsDir = path.join(compDir, 'versions');
  if (!fs.existsSync(versionsDir)) return [];

  return fs.readdirSync(versionsDir)
    .filter(file => file.endsWith('.md'))
    .sort()
    .map(file => {
      const fullPath = path.join(versionsDir, file);
      const text = fs.readFileSync(fullPath, 'utf8');
      const meta = parseFrontmatter(text);
      const note = extractMatch(/## 战略与文化解读\n- ([\s\S]*?)(?:\n\n|$)/, text);
      return {
        date: meta.record_date || file.slice(0, 10),
        changeType: meta.change_type || 'record',
        confidence: meta.confidence_level || '',
        reviewStatus: meta.review_status || '',
        classification: meta.classification || '',
        sourceUrl: meta.source_url || '',
        note,
        file: `data/companies/${dirName}/versions/${file}`
      };
    });
}

function latestEvidenceFromCurrent(current, dirName) {
  const assets = current?.evidence_assets || [];
  const shot = assets.find(asset => /\.(png|jpg|jpeg)$/i.test(asset));
  return shot ? `data/companies/${dirName}/${shot}` : '';
}

function latestEvidenceFromAssets(compDir, dirName) {
  const assetsDir = path.join(compDir, 'assets');
  const file = latestFile(assetsDir, item => !/^logo\./i.test(item) && /\.(png|jpg|jpeg)$/i.test(item));
  return file ? `data/companies/${dirName}/assets/${file}` : '';
}

function typeFromCurrent(current, fallbackId, fallbackType) {
  if (!current) return fallbackType;
  if (current.review_status === 'needs_review') return 'review';
  if (current.classification === 'standard_mvv') return 'complete';
  return 'partial';
}

function labelFromType(type, current) {
  if (type === 'complete') return '标准 MVV';
  if (type === 'review') return '需复核';
  return '非标准 MVV';
}

function processCompany(dirName) {
  const compDir = path.join(dataDir, dirName);
  const profilePath = path.join(compDir, 'profile.md');
  
  if (!fs.existsSync(profilePath)) return null;
  
  const content = fs.readFileSync(profilePath, 'utf8');
  const profileMeta = parseFrontmatter(content);
  
  const id = extractMatch(/company_id:\s*"?(.*?)"?\n/, content);
  const name = extractMatch(/company_name_cn:\s*"?(.*?)"?\n/, content);
  const en = extractMatch(/company_name_en:\s*"?(.*?)"?\n/, content);
  const region = extractMatch(/country_or_region:\s*"?(.*?)"?\n/, content);
  
  const indPrimary = extractMatch(/industry_primary:\s*"?(.*?)"?\n/, content);
  const indSecondary = extractMatch(/industry_secondary:\s*"?(.*?)"?\n/, content);
  const industry = indSecondary ? `${indPrimary} / ${indSecondary}` : indPrimary;
  
  const reviewed = extractMatch(/last_reviewed_at:\s*"?(.*?)"?\n/, content);
  
  const sourceMatch = content.match(/official_urls:\s*\n\s*-\s*"?(.*?)"?\n/);
  const source = profileMeta.official_urls?.[0] || (sourceMatch ? sourceMatch[1].trim().replace(/^"|"$/g, '') : '');
  
  const mission = extractMatch(/### Mission\n- 当前正式表述：(.*?)\n/, content, "当前官方页面未单列 Mission 字段。");
  const vision = extractMatch(/### Vision\n- 当前正式表述：(.*?)\n/, content, "当前 reviewed 官方页面未单列 Vision 字段。");
  const values = extractMatch(/### Values\n- 当前正式表述：(.*?)\n/, content, "当前 reviewed 官方页面未单列 Values 字段。");
  
  const other = extractSection(/### Other Terms\n([\s\S]*?)\n\n## /m, content);
  const research = extractSection(/## 研究备注\n([\s\S]*?)\n\n## /m, content);
  
  let type = "partial";
  
  const isMissionOk = !mission.includes("未单列");
  const isVisionOk = !vision.includes("未单列");
  const isValuesOk = !values.includes("未单列");
  
  if (isMissionOk && isVisionOk && isValuesOk) {
    type = "complete";
  }
  
  const current = readJsonIfExists(path.join(compDir, 'current.json'));
  const versions = listVersions(compDir, dirName);
  const latestVersion = versions.at(-1);
  const latestLog = latestFile(path.join(compDir, 'crawl-logs'), file => file.endsWith('.json'));
  const effectiveType = typeFromCurrent(current, id, type);
  const typeLabel = labelFromType(effectiveType, current);
  
  const currentMission = current?.structured?.mission || mission;
  const currentVision = current?.structured?.vision || vision;
  const currentValues = Array.isArray(current?.structured?.values)
    ? current.structured.values.join('；')
    : values;
  const currentSource = current?.source_urls?.[0]?.final_url || current?.source_urls?.[0]?.url || source;
  const officialSources = [
    ...(current?.source_urls || []).map(item => ({
      url: item.final_url || item.url,
      title: item.title || '',
      level: 'official',
      type: 'current'
    })),
    ...(profileMeta.official_urls || []).map(url => ({
      url,
      title: '',
      level: 'official',
      type: 'profile'
    }))
  ].filter(item => item.url);
  const evidence = latestEvidenceFromCurrent(current, dirName) || latestEvidenceFromAssets(compDir, dirName);
  
  return {
    id,
    name,
    en,
    region,
    industry,
    type: effectiveType,
    typeLabel,
    classification: current?.classification || '',
    confidence: current?.confidence_level || "high",
    reviewStatus: current?.review_status || '',
    reviewed: current?.captured_date || reviewed,
    capturedAt: current?.captured_at || '',
    mission: currentMission,
    vision: currentVision,
    values: currentValues,
    other,
    research: current?.analyst_note || research,
    source: currentSource,
    sourceTitle: current?.source_urls?.[0]?.title || '',
    officialSources,
    logo: profileMeta.logo_asset ? `data/companies/${dirName}/${profileMeta.logo_asset}` : '',
    logoSource: profileMeta.logo_source_url || '',
    profile: `data/companies/${dirName}/profile.md`,
    version: latestVersion?.file || '',
    evidence,
    evidenceAssets: current?.evidence_assets?.map(asset => `data/companies/${dirName}/${asset}`) || [],
    history: versions,
    crawlLog: latestLog ? `data/companies/${dirName}/crawl-logs/${latestLog}` : ''
  };
}

let companies = [];

if (fs.existsSync(uiDataPath)) {
  const uiData = JSON.parse(fs.readFileSync(uiDataPath, 'utf8'));
  companies = uiData.companies || [];
} else {
  const dirs = fs.readdirSync(dataDir, { withFileTypes: true });

  for (const dir of dirs) {
    if (dir.isDirectory()) {
      const companyData = processCompany(dir.name);
      if (companyData) {
        companies.push(companyData);
      }
    }
  }
}

let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

// The array inside const companies = [ ... ]; needs to be replaced.
const targetRegex = /(const companies = )\[[\s\S]*?\];/;
if (targetRegex.test(htmlContent)) {
  const newCompaniesStr = JSON.stringify(companies, null, 2);
  htmlContent = htmlContent.replace(targetRegex, `$1${newCompaniesStr};`);
  fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
  console.log(`✅ Successfully injected ${companies.length} companies into index.html`);
} else {
  console.error("❌ Could not find 'const companies = [...];' in index.html");
}
