'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTarget,
  phoneNumberFromIds,
  isOwnerTarget,
  isCommandSender,
  isUnavailableName,
  formatUserInfo,
} = require('../lib/user-info');

test('uses the command sender when no message is quoted', () => {
  assert.equal(resolveTarget({
    message: { isGroup: true },
    sender: '254700111222@s.whatsapp.net',
    botJid: '254700999888@s.whatsapp.net',
  }), '254700111222@s.whatsapp.net');
});

test('uses the quoted sender in a group and refuses unidentified quotes', () => {
  assert.equal(resolveTarget({
    message: {
      isGroup: true,
      quoted: { sender: '254700333444@s.whatsapp.net' },
    },
    sender: '254700111222@s.whatsapp.net',
  }), '254700333444@s.whatsapp.net');

  assert.equal(resolveTarget({
    message: { isGroup: true, quoted: {} },
    sender: '254700111222@s.whatsapp.net',
  }), '');
});

test('uses the direct-chat partner unless the quoted message is from the bot', () => {
  const botJid = '254700999888@s.whatsapp.net';
  assert.equal(resolveTarget({
    message: {
      isGroup: false,
      chat: '254700333444@s.whatsapp.net',
      quoted: { fromMe: false },
    },
    sender: '254700333444@s.whatsapp.net',
    botJid,
  }), '254700333444@s.whatsapp.net');

  assert.equal(resolveTarget({
    message: {
      isGroup: false,
      chat: '254700333444@s.whatsapp.net',
      quoted: { fromMe: true },
    },
    sender: '254700333444@s.whatsapp.net',
    botJid,
  }), botJid);
});

test('resolves visible phone numbers and excludes bot owners', () => {
  const targetIds = new Set(['254700111222@s.whatsapp.net', '12345@lid']);
  assert.equal(phoneNumberFromIds(targetIds), '254700111222');
  assert.equal(isOwnerTarget(targetIds, ['254700999888'], []), false);
  assert.equal(isOwnerTarget(new Set(['254700999888@s.whatsapp.net']), ['254700999888'], []), true);
  assert.equal(isOwnerTarget(new Set(['12345@lid']), [], ['12345@lid']), true);
});

test('does not mistake a direct-chat contact for the command sender', () => {
  const contactIds = new Set(['254700111222@s.whatsapp.net']);
  const ownerSenderIds = new Set(['254700999888@s.whatsapp.net']);
  assert.equal(isCommandSender(contactIds, ownerSenderIds), false);
  assert.equal(isCommandSender(ownerSenderIds, ownerSenderIds), true);
});

test('formats profile details and avoids treating a phone number as a username', () => {
  assert.equal(isUnavailableName('No Name'), false);
  assert.equal(isUnavailableName('+254 700 111 222'), true);
  assert.equal(isUnavailableName(''), true);
  assert.equal(formatUserInfo({
    username: 'Amina',
    number: '254700111222',
    time: '2026-11-20 08:30:00 EAT',
  }), [
    '👤 Profile information',
    'Username: Amina',
    'Number: 254700111222',
    'Time (Nairobi): 2026-11-20 08:30:00 EAT',
  ].join('\n'));
});
