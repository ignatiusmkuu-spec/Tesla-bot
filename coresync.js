const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const https = require('https');
const http = require('http');

const ROOT = __dirname;
const REPO = process.env.CORE_REPO || 'McrayNick/tesla-md-files';
const BRANCH = process.env.CORE_BRANCH || 'main';
const CORE_DIR = (process.env.CORE_PATH || 'core').replace(/^\.?\/*|\/+$/g, '');
const SOURCES = (process.env.CORE_SOURCES || `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH},https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz`)
  .split(',').map((url) => url.trim()).filter(Boolean);
const ATTEMPTS = Math.max(1, Number(process.env.CORE_ATTEMPTS) || 4);
const RETRY_MS = Number(process.env.CORE_RETRY_MS) || 3000;
const MAX_BYTES = 60 * 1024 * 1024;
const PROTECTED = new Set(['start.js', 'coresync.js']);
const MANIFEST = path.join(ROOT, '.core-synced.json');
const PLUGIN_MANIFEST = path.join(ROOT, 'plugins', '.synced.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const coreAllowed = (file) => {
  if (PROTECTED.has(file) || !/^[\w.-]+(\/[\w.-]+)*\.js$/.test(file) || file.split('/').includes('..')) return false;
  return file === 'index.js' || file === 'tesla.js' || file.startsWith('lib/') || file.startsWith('database/');
};
const pluginAllowed = (name) => /^[\w.-]+\.js$/.test(name);

function checkSyntax(code) {
  new vm.Script(`(function (require, module, exports, __dirname, __filename) {${code}\n})`);
}

function get(url, hops = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const request = lib.get(url, { headers: { 'User-Agent': 'tesla-md-core-sync', Accept: '*/*' }, timeout: 45000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (hops >= 5) return reject(new Error('too many redirects'));
        return resolve(get(new URL(res.headers.location, url).toString(), hops + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) return request.destroy(new Error('download too large'));
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('timed out')));
    request.on('error', reject);
  });
}

function field(buf, start, end) {
  const slice = buf.subarray(start, end);
  const stop = slice.indexOf(0);
  return slice.subarray(0, stop === -1 ? slice.length : stop).toString('utf8');
}

function parseTar(buf) {
  const out = new Map();
  let offset = 0;
  let pendingPath = null;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = parseInt(field(header, 124, 136).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const body = buf.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      const match = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8'));
      if (match) pendingPath = match[1];
      continue;
    }
    if (type === 'g') continue;
    let name = pendingPath || [field(header, 345, 500), field(header, 0, 100)].filter(Boolean).join('/');
    pendingPath = null;
    if (type !== '0' && type !== '\0') continue;
    const slash = name.indexOf('/');
    if (slash === -1) continue;
    name = name.slice(slash + 1);
    out.set(name, body.toString('utf8'));
  }
  return out;
}

async function fetchTree() {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    for (const source of SOURCES) {
      try {
        const tar = zlib.gunzipSync(await get(source));
        const files = parseTar(tar);
        if (!files.size) throw new Error('archive was empty');
        return files;
      } catch (error) {
        lastError = error;
        console.warn(`[CORE] Attempt ${attempt}/${ATTEMPTS} failed (${new URL(source).host}): ${error.message}`);
      }
    }
    if (attempt < ATTEMPTS) await sleep(RETRY_MS * attempt);
  }
  throw lastError || new Error('download failed');
}

function writeIfChanged(target, code) {
  let current = null;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch {
    current = null;
  }
  if (current === code) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(`${target}.tmp`, code, 'utf8');
  fs.renameSync(`${target}.tmp`, target);
  return true;
}

async function run() {
  if (String(process.env.CORE_SYNC || '').toLowerCase() === 'false') {
    console.log('[CORE] Sync disabled (CORE_SYNC=false); using the files that were deployed.');
    return { updated: [], skipped: true };
  }

  let tree;
  try {
    tree = await fetchTree();
  } catch (error) {
    console.error(`[CORE] Download failed: ${error.message}`);
    return { updated: [], error };
  }

  const prefix = CORE_DIR ? `${CORE_DIR}/` : '';
  const core = new Map();
  const plugins = new Map();
  for (const [name, code] of tree) {
    if (name.startsWith(prefix)) {
      const rel = name.slice(prefix.length);
      if (coreAllowed(rel)) core.set(rel, code);
    } else if (name.startsWith('plugins/')) {
      const rel = name.slice('plugins/'.length);
      if (pluginAllowed(rel)) plugins.set(rel, code);
    }
  }

  if (!core.has('index.js')) {
    const error = new Error(`${prefix}index.js is not in ${REPO}@${BRANCH}`);
    console.error(`[CORE] ${error.message}`);
    return { updated: [], error };
  }

  for (const [file, code] of core) {
    try {
      if (!code.trim()) throw new Error('empty file');
      checkSyntax(code);
    } catch (error) {
      const failure = new Error(`${file}: ${error.message}`);
      console.error(`[CORE] Nothing was updated, keeping the deployed files: ${failure.message}`);
      return { updated: [], error: failure };
    }
  }

  const updated = [];
  for (const [file, code] of core) {
    if (writeIfChanged(path.join(ROOT, file), code)) updated.push(file);
  }
  try {
    fs.writeFileSync(MANIFEST, JSON.stringify([...core.keys()].sort(), null, 2));
  } catch {
    console.error('[CORE] Could not write the sync list.');
  }

  const seeded = [];
  for (const [name, code] of plugins) {
    try {
      if (!code.trim()) throw new Error('empty file');
      checkSyntax(code);
      if (writeIfChanged(path.join(ROOT, 'plugins', name), code)) seeded.push(name);
    } catch (error) {
      console.error(`[CORE] Plugin ${name} skipped: ${error.message}`);
    }
  }
  if (plugins.size) {
    try {
      fs.mkdirSync(path.dirname(PLUGIN_MANIFEST), { recursive: true });
      fs.writeFileSync(PLUGIN_MANIFEST, JSON.stringify([...plugins.keys()].sort(), null, 2));
    } catch {
      console.error('[CORE] Could not write the plugin list.');
    }
  }

  console.log(`[CORE] ${core.size} core file(s) and ${plugins.size} plugin(s) Confirmed ${updated.length} core and ${seeded.length} plugin file(s) updated.`);
  return { updated, seeded };
}

let running = null;

function syncCore() {
  if (!running) running = run().catch((error) => {
    console.error('[CORE] Sync failed:', error.message || error);
    return { updated: [], error };
  });
  return running;
}

module.exports = { syncCore };
