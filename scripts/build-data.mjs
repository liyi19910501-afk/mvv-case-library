#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const uiDataPath = path.join(rootDir, "data", "mvv-ui-data.json");
const indexPath = path.join(rootDir, "index.html");

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await pathExists(uiDataPath))) {
    throw new Error("data/mvv-ui-data.json is missing. Run `npm run sync` first.");
  }

  const uiData = JSON.parse(await fs.readFile(uiDataPath, "utf8"));
  const companies = Array.isArray(uiData.companies) ? uiData.companies : [];
  if (!companies.length) {
    throw new Error("data/mvv-ui-data.json contains no companies.");
  }

  const html = await fs.readFile(indexPath, "utf8");
  if (!html.includes('fetch("data/mvv-ui-data.json"')) {
    throw new Error("index.html must load data/mvv-ui-data.json via fetch().");
  }
  if (html.includes("const companies = [")) {
    throw new Error("index.html still contains injected company data.");
  }

  console.log(`Verified static frontend uses data/mvv-ui-data.json (${companies.length} companies).`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
