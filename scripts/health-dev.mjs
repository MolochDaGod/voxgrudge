/**
 * Smoke-check local dev servers (static :3000 + GRUDOX :8787).
 */
import { loadDevEnv, applyEnv } from './load-env.mjs';

applyEnv(loadDevEnv());

const DEV_PORT = Number(process.env.DEV_PORT || 3000);
const GRUDOX_PORT = Number(process.env.GRUDOX_PORT || 8787);

async function probe(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const ok = res.ok;
    console.log(`${label}: ${ok ? 'ok' : 'fail'} (${res.status}) ${url}`);
    return ok;
  } catch (err) {
    console.log(`${label}: fail — ${err.message}`);
    return false;
  }
}

const gameOk = await probe(`http://127.0.0.1:${DEV_PORT}/`, 'game');
const roomOk = await probe(`http://127.0.0.1:${GRUDOX_PORT}/health`, 'grudox');

process.exit(gameOk && roomOk ? 0 : 1);