'use strict';

function unwrapMessage(message) {
  let current = message || {};
  for (let i = 0; i < 5; i += 1) {
    const wrapped =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message ||
      current.documentWithCaptionMessage?.message;
    if (!wrapped) break;
    current = wrapped;
  }
  return current;
}

function classifyChat(jid, message) {
  const chat = String(jid || '');
  if (message?.isGroup || chat.endsWith('@g.us')) return 'group';
  if (chat === 'status@broadcast' || chat.endsWith('@broadcast') || chat.endsWith('@newsletter')) return null;
  if (chat.endsWith('@s.whatsapp.net') || chat.endsWith('@lid')) return 'dm';
  return null;
}

function normalizeMode(mode) {
  const value = String(mode || '').trim().toLowerCase();
  if (['on', 'private'].includes(value)) return 'dm';
  return ['off', 'dm', 'group', 'chat', 'both'].includes(value) ? value : 'off';
}

function modeAllows(mode, chatType) {
  const selected = normalizeMode(mode);
  if (selected === 'off') return false;
  if (selected === 'dm' || selected === 'both') return chatType === 'dm' || chatType === 'group';
  if (selected === 'chat') return chatType === 'dm';
  return selected === chatType;
}

function reportDestinations(mode, chatType, sourceChat, ownerChat) {
  const selected = normalizeMode(mode);
  if (selected === 'dm') return ownerChat ? [ownerChat] : [];
  if (selected === 'chat' && chatType === 'dm') return sourceChat ? [sourceChat] : [];
  if (selected === 'group' && chatType === 'group') return sourceChat ? [sourceChat] : [];
  if (selected === 'both' && (chatType === 'dm' || chatType === 'group')) {
    return [...new Set([sourceChat, ownerChat].filter(Boolean))];
  }
  return [];
}

function formatUser(name, jid, altJid) {
  const preferredJid = String(altJid || '').endsWith('@s.whatsapp.net') ? altJid : jid;
  const identifier = String(preferredJid || '').split('@')[0].replace(/:\d+$/, '');
  const displayName = String(name || '').trim();
  if (displayName && displayName !== identifier) {
    return identifier ? `${displayName} (@${identifier})` : displayName;
  }
  return identifier ? `@${identifier}` : 'Unknown user';
}

function formatTimestamp(value) {
  let seconds = value;
  if (seconds && typeof seconds.toNumber === 'function') seconds = seconds.toNumber();
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'Time unavailable';
  const date = new Date(numeric > 1e12 ? numeric : numeric * 1000);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
    timeZoneName: 'short',
  }).format(date);
}

function messageDetails(message) {
  const msg = unwrapMessage(message);
  const text = msg.conversation ?? msg.extendedTextMessage?.text;
  if (typeof text === 'string') return { type: 'Text', content: text };

  if (msg.imageMessage) {
    return {
      type: 'Image',
      content: msg.imageMessage.caption || '[Image]',
      media: { message: msg.imageMessage, kind: 'image', captionable: true },
    };
  }
  if (msg.videoMessage) {
    return {
      type: 'Video',
      content: msg.videoMessage.caption || '[Video]',
      media: { message: msg.videoMessage, kind: 'video', captionable: true },
    };
  }
  if (msg.documentMessage) {
    const doc = msg.documentMessage;
    const name = doc.fileName ? `: ${doc.fileName}` : '';
    return {
      type: 'Document',
      content: `${doc.caption || '[Document]'}${name}`,
      media: { message: doc, kind: 'document', captionable: true },
    };
  }
  if (msg.stickerMessage) {
    return {
      type: 'Sticker',
      content: '[Sticker]',
      media: { message: msg.stickerMessage, kind: 'sticker', captionable: false },
    };
  }
  if (msg.audioMessage) {
    return {
      type: msg.audioMessage.ptt ? 'Voice message' : 'Audio',
      content: msg.audioMessage.ptt ? '[Voice message]' : '[Audio message]',
      media: { message: msg.audioMessage, kind: 'audio', captionable: false },
    };
  }
  if (msg.locationMessage) {
    const location = msg.locationMessage;
    const details = [
      location.name,
      location.address,
      Number.isFinite(location.degreesLatitude) && Number.isFinite(location.degreesLongitude)
        ? `${location.degreesLatitude}, ${location.degreesLongitude}`
        : '',
    ].filter(Boolean);
    return { type: 'Location', content: details.join('\n') || '[Location]' };
  }
  if (msg.liveLocationMessage) {
    const location = msg.liveLocationMessage;
    const coordinates = Number.isFinite(location.degreesLatitude) && Number.isFinite(location.degreesLongitude)
      ? `\n${location.degreesLatitude}, ${location.degreesLongitude}`
      : '';
    return { type: 'Live location', content: `[Live location]${coordinates}` };
  }
  if (msg.contactMessage) {
    const contact = msg.contactMessage;
    return {
      type: 'Contact',
      content: [contact.displayName, contact.vcard].filter(Boolean).join('\n') || '[Contact]',
    };
  }
  if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) {
    const poll = msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3;
    const options = (poll.options || []).map((option) => `• ${option.optionName}`).join('\n');
    return { type: 'Poll', content: [poll.name, options].filter(Boolean).join('\n') || '[Poll]' };
  }

  const kind = Object.keys(msg).find((key) => key.endsWith('Message'));
  return {
    type: kind ? kind.replace(/Message$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') : 'Unknown',
    content: kind ? `[${kind.replace(/Message$/, ' message')}]` : '[Content unavailable]',
  };
}

function formatReport({ deletedBy, sentBy, deletedAt, chatLocation, contentType, content }) {
  return [
    '╭━━━〔 🛡️ 𝗔𝗡𝗧𝗜-𝗗𝗘𝗟𝗘𝗧𝗘 〕━━━╮',
    '┃ A deleted message was recovered',
    '┣━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `👤 Deleted by: ${deletedBy || 'Unknown user'}`,
    `✍️ Originally sent by: ${sentBy || 'Unknown user'}`,
    `🕒 Deleted at: ${deletedAt || 'Time unavailable'}`,
    `📍 Deleted in: ${chatLocation || 'Unknown chat'}`,
    `🗂️ Message type: ${contentType || 'Unknown'}`,
    '┣━━━〔 🗑️ 𝗥𝗘𝗖𝗢𝗩𝗘𝗥𝗘𝗗 𝗖𝗢𝗡𝗧𝗘𝗡𝗧 〕━━━',
    content || '[No text content]',
    '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
  ].join('\n');
}

module.exports = {
  unwrapMessage,
  classifyChat,
  normalizeMode,
  modeAllows,
  reportDestinations,
  formatUser,
  formatTimestamp,
  messageDetails,
  formatReport,
};
