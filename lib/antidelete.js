'use strict';

const fs = require('fs');
const path = require('path');
const identity = require('./Identity');
const groupCache = require('./Groupcache');
const {
  unwrapMessage,
  classifyChat,
  normalizeMode,
  modeAllows,
  reportDestinations,
  formatUser,
  formatTimestamp,
  messageDetails,
  formatReport,
} = require('./antidelete-format');

const BASE_DIR = path.resolve(process.env.ANTIDELETE_DIR || 'message_data');
const KEEP_MS = (Number(process.env.ANTIDELETE_KEEP_HOURS) || 48) * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
let lastPrune = 0;

let baileys;
async function loadBaileys() {
  if (!baileys) {
    try {
      baileys = await import('@whiskeysockets/baileys');
    } catch (error) {
      baileys = {}; 
    }
  }
  return baileys;
}

const safe = (name) => String(name).replace(/[^a-zA-Z0-9@._-]/g, '_');
const fileFor = (chat, id) => path.join(BASE_DIR, safe(chat), `${safe(id)}.json`);

async function save(message) {
  try {
    const key = message && message.key;
    if (!key || !key.remoteJid || !key.id || !message.message) return;
    if (key.remoteJid === 'status@broadcast' || key.fromMe) return;
    const { BufferJSON } = await loadBaileys();
    const file = fileFor(key.remoteJid, key.id);
    await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await fs.promises.writeFile(file, JSON.stringify(message, BufferJSON ? BufferJSON.replacer : undefined), { mode: 0o600 });
    prune();
  } catch (error) {
    console.error('Antidelete: could not save a message:', error.message || error);
  }
}

async function load(chat, id) {
  try {
    const { BufferJSON } = await loadBaileys();
    const text = await fs.promises.readFile(fileFor(chat, id), 'utf8');
    return JSON.parse(text, BufferJSON ? BufferJSON.reviver : undefined);
  } catch (error) {
    return null;
  }
}

// removes saved messages older than ANTIDELETE_KEEP_HOURS (default 48), at most once an hour
function prune() {
  if (Date.now() - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = Date.now();
  (async () => {
    try {
      for (const chat of await fs.promises.readdir(BASE_DIR)) {
        const dir = path.join(BASE_DIR, chat);
        for (const name of await fs.promises.readdir(dir).catch(() => [])) {
          const file = path.join(dir, name);
          const stat = await fs.promises.stat(file).catch(() => null);
          if (stat && Date.now() - stat.mtimeMs > KEEP_MS) await fs.promises.unlink(file).catch(() => { });
        }
        const left = await fs.promises.readdir(dir).catch(() => ['x']);
        if (left.length === 0) await fs.promises.rmdir(dir).catch(() => { });
      }
    } catch (error) { /* nothing saved yet */ }
  })();
}

async function download(message, type) {
  const { downloadContentFromMessage } = await loadBaileys();
  if (typeof downloadContentFromMessage !== 'function') throw new Error('Baileys media download is unavailable');
  const stream = await downloadContentFromMessage(message, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function isRevocation(mek) {
  const protocol = unwrapMessage(mek && mek.message).protocolMessage;
  if (!protocol || !protocol.key) return false;
  return protocol.type === undefined || protocol.type === 0 || protocol.type === 'REVOKE';
}

function participantName(metadata, jid, altJid) {
  if (!metadata || !Array.isArray(metadata.participants)) return '';
  const ids = new Set([jid, altJid].filter(Boolean).map(identity.bare));
  const participant = metadata.participants.find((item) =>
    identity.participantIds(item).some((id) => ids.has(identity.bare(id)))
  );
  return participant && (participant.notify || participant.name || participant.verifiedName || '');
}

async function handleRevocation(client, mek, sendTo) {
  const protocol = unwrapMessage(mek.message).protocolMessage;
  const deletedId = protocol && protocol.key && protocol.key.id;
  if (!deletedId || !mek.key || !mek.key.remoteJid) return;
  const original = await load(mek.key.remoteJid, deletedId);
  if (!original) return;

  const chat = mek.key.remoteJid;
  const isGroup = classifyChat(chat, mek) === 'group';
  const deletedBy = mek.participant || mek.key.participant || mek.key.remoteJid;
  const deletedByAlt = mek.participantAlt || mek.key.participantAlt || mek.key.remoteJidAlt;
  const sentBy = original.key.participant || original.key.remoteJid;
  const sentByAlt = original.key.participantAlt || original.key.remoteJidAlt;

  // a message the bot's own account deleted is not reported
  const bot = identity.botIds(client);
  if ([deletedBy, deletedByAlt].filter(Boolean).some((id) => bot.has(identity.bare(id)))) return;

  const metadata = isGroup ? await groupCache.fetchMetadata(client, chat).catch(() => null) : null;
  const deletedByName = mek.pushName || participantName(metadata, deletedBy, deletedByAlt);
  const sentByName = original.pushName || participantName(metadata, sentBy, sentByAlt);
  const details = messageDetails(original.message);
  let chatLocation;
  if (isGroup) {
    chatLocation = metadata && metadata.subject ? `Group: ${metadata.subject}` : `WhatsApp group (${chat})`;
  } else {
    const contact = formatUser(original.pushName || mek.pushName, chat, mek.key.remoteJidAlt);
    chatLocation = `Direct message with ${contact}`;
  }
  let report = formatReport({
    deletedBy: formatUser(deletedByName, deletedBy, deletedByAlt),
    sentBy: formatUser(sentByName, sentBy, sentByAlt),
    deletedAt: formatTimestamp(mek.messageTimestamp),
    chatLocation,
    contentType: details.type,
    content: details.content,
  });

  let media = null;
  try {
    if (details.media) {
      const mediaMessage = details.media.message;
      const buffer = await download(mediaMessage, details.media.kind);
      if (details.media.kind === 'image') media = { image: buffer };
      else if (details.media.kind === 'video') media = { video: buffer };
      else if (details.media.kind === 'sticker') media = { sticker: buffer };
      else if (details.media.kind === 'audio') {
        media = {
          audio: buffer,
          ptt: mediaMessage.ptt === true,
          mimetype: mediaMessage.mimetype || 'audio/mpeg',
        };
      } else if (details.media.kind === 'document') {
        media = {
          document: buffer,
          fileName: mediaMessage.fileName || `document_${Date.now()}.dat`,
          mimetype: mediaMessage.mimetype || 'application/octet-stream',
        };
      }
    }
  } catch (error) {
    console.error('Antidelete: could not recover media:', error.message || error);
    report += '\n\n⚠️ Media could not be recovered; it may have expired.';
  }

  const self = client.decodeJid ? client.decodeJid(client.user.id) : client.user.id;
  const destinations = [...new Set((Array.isArray(sendTo) ? sendTo : [sendTo || self]).filter(Boolean))];
  for (const to of destinations) {
    try {
      if (!media) {
        await client.sendMessage(to, { text: report });
      } else if (details.media.captionable) {
        await client.sendMessage(to, { ...media, caption: report });
      } else {
        await client.sendMessage(to, { text: report });
        await client.sendMessage(to, media);
      }
    } catch (error) {
      console.error('Antidelete: could not send a recovery report:', error.message || error);
    }
  }
}

// The one entry point. Returns nothing; it never throws, so it cannot break message handling.
async function handle(client, m, mek, mode) {
  try {
    const selectedMode = normalizeMode(mode);
    if (selectedMode === 'off' || !mek || !mek.message || !mek.key) return;
    const here = mek.key.remoteJid;
    const chatType = classifyChat(here, m);
    if (!chatType || !modeAllows(selectedMode, chatType)) return;

    if (isRevocation(mek)) {
      const self = client.decodeJid ? client.decodeJid(client.user.id) : client.user.id;
      const destinations = reportDestinations(selectedMode, chatType, here, self);
      if (destinations.length) await handleRevocation(client, mek, destinations);
      return;
    }

    await save(mek);
  } catch (error) {
    console.error('Antidelete failed:', error.message || error);
  }
}

module.exports = {
  handle,
  save,
  handleRevocation,
  isRevocation,
  classifyChat,
  modeAllows,
  normalizeMode,
  BASE_DIR,
};
