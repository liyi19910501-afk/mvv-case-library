#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const crawlerPath = path.join(__dirname, "mvv-crawler.mjs");
const forwardedArgs = process.argv.slice(2);
const args = forwardedArgs.length ? forwardedArgs : ["--all", "--write"];

console.warn("[deprecated] scripts/capture-evidence.mjs has been replaced by scripts/mvv-crawler.mjs.");
console.warn(`[deprecated] Forwarding to: node scripts/mvv-crawler.mjs ${args.join(" ")}`);

const child = spawn(process.execPath, [crawlerPath, ...args], {
  stdio: "inherit",
  cwd: path.join(__dirname, "..")
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
