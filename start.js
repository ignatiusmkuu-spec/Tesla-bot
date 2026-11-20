const fs = require('fs');
const path = require('path');

const ENTRY = path.join(__dirname, 'index.js');
const TRIES = Math.max(1, Number(process.env.CORE_START_TRIES) || 5);
const WAIT_MS = Number(process.env.CORE_START_WAIT_MS) || 10000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { syncCore } = require('./coresync');
  await syncCore();
  for (let attempt = 2; attempt <= TRIES && !fs.existsSync(ENTRY); attempt++) {
    console.error(`[CORE] index.js is still missing. Retrying in ${WAIT_MS / 1000}s (${attempt}/${TRIES}).`);
    await sleep(WAIT_MS);
    delete require.cache[require.resolve('./coresync')];
    await require('./coresync').syncCore();
  }
  if (!fs.existsSync(ENTRY)) {
    console.error('[CORE] index.js could not be downloaded. Exiting so the host restarts and tries again.');
    process.exit(1);
  }
  require('./index.js');
}

main().catch((error) => {
  console.error('[CORE] Fatal:', error.message || error);
  process.exit(1);
});

