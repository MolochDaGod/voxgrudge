/**
 * Minimal .env loader (no dependencies). Loads .env.local then .env.development.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function loadDevEnv() {
  const files = ['.env.local', '.env.development', '.env'];
  const merged = {};
  for (const name of files) {
    Object.assign(merged, parseEnvFile(path.join(ROOT, name)));
  }
  return merged;
}

export function applyEnv(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

export const ROOT_DIR = ROOT;