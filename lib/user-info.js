'use strict';

const identity = require('./Identity');

function resolveTarget({ message, sender, botJid }) {
  if (!message.quoted) return sender || '';

  const quotedSender = message.quoted.sender
    || (message.msg && message.msg.contextInfo && message.msg.contextInfo.participant)
    || '';

  if (message.isGroup) return quotedSender;
  if (message.quoted.fromMe || (quotedSender && identity.bare(quotedSender) === identity.bare(botJid))) {
    return quotedSender || botJid || '';
  }
  return quotedSender || message.chat || sender || '';
}

function phoneNumberFromIds(ids) {
  const jid = [...ids].map(identity.bare).find((value) => value.endsWith('@s.whatsapp.net'));
  return jid ? jid.split('@')[0] : '';
}

function isOwnerTarget(ids, ownerNumbers, ownerIds) {
  return identity.isOwner(ids, ownerNumbers, ownerIds);
}

function isUnavailableName(value) {
  return !value || /^[+\d\s().-]+$/.test(String(value).trim());
}

function formatUserInfo({ username, number, time }) {
  return [
    '👤 Profile information',
    `Username: ${username || 'Unavailable'}`,
    `Number: ${number || 'Unavailable'}`,
    `Time (Nairobi): ${time}`,
  ].join('\n');
}

module.exports = {
  resolveTarget,
  phoneNumberFromIds,
  isOwnerTarget,
  isUnavailableName,
  formatUserInfo,
};
