'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
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
} = require('../lib/antidelete-format');
const messageDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tesla-antidelete-test-'));
process.env.ANTIDELETE_DIR = messageDataDir;
const antidelete = require('../lib/antidelete');

test.after(() => {
  fs.rmSync(messageDataDir, { recursive: true, force: true });
});

test('classifies private chats, groups, and non-chat broadcasts', () => {
  assert.equal(classifyChat('254700000001@s.whatsapp.net'), 'dm');
  assert.equal(classifyChat('123456789-123456@g.us'), 'group');
  assert.equal(classifyChat('status@broadcast'), null);
  assert.equal(classifyChat('123@newsletter'), null);
  assert.equal(classifyChat('unknown-jid'), null);
});

test('filters DM, group, chat, both, and off modes', () => {
  assert.equal(normalizeMode('private'), 'dm');
  assert.equal(normalizeMode('on'), 'dm');
  assert.equal(normalizeMode('both'), 'both');
  assert.equal(normalizeMode('unexpected'), 'off');
  assert.equal(modeAllows('dm', 'dm'), true);
  assert.equal(modeAllows('dm', 'group'), true);
  assert.equal(modeAllows('group', 'group'), true);
  assert.equal(modeAllows('group', 'dm'), false);
  assert.equal(modeAllows('chat', 'dm'), true);
  assert.equal(modeAllows('chat', 'group'), false);
  assert.equal(modeAllows('both', 'dm'), true);
  assert.equal(modeAllows('both', 'group'), true);
  assert.equal(modeAllows('off', 'group'), false);
});

test('routes reports to the selected destination', () => {
  const sourceChat = '123456789-123456@g.us';
  const dmChat = '254700000003@s.whatsapp.net';
  const ownerChat = '254700000002@s.whatsapp.net';
  assert.deepEqual(reportDestinations('dm', 'group', sourceChat, ownerChat), [ownerChat]);
  assert.deepEqual(reportDestinations('chat', 'dm', dmChat, ownerChat), [dmChat]);
  assert.deepEqual(reportDestinations('chat', 'group', sourceChat, ownerChat), []);
  assert.deepEqual(reportDestinations('group', 'group', sourceChat, ownerChat), [sourceChat]);
  assert.deepEqual(reportDestinations('group', 'dm', dmChat, ownerChat), []);
  assert.deepEqual(reportDestinations('both', 'group', sourceChat, ownerChat), [sourceChat, ownerChat]);
  assert.deepEqual(reportDestinations('both', 'dm', dmChat, ownerChat), [dmChat, ownerChat]);
});

test('unwraps common WhatsApp message wrappers', () => {
  const message = {
    ephemeralMessage: {
      message: {
        viewOnceMessageV2: {
          message: { conversation: 'Recovered text' },
        },
      },
    },
  };
  assert.deepEqual(unwrapMessage(message), { conversation: 'Recovered text' });
});

test('extracts deleted text and media details', () => {
  assert.deepEqual(messageDetails({ conversation: 'Hello again' }), {
    type: 'Text',
    content: 'Hello again',
  });
  assert.deepEqual(messageDetails({
    imageMessage: { caption: 'The photo caption', mimetype: 'image/jpeg' },
  }), {
    type: 'Image',
    content: 'The photo caption',
    media: {
      message: { caption: 'The photo caption', mimetype: 'image/jpeg' },
      kind: 'image',
      captionable: true,
    },
  });
  assert.equal(messageDetails({ audioMessage: { ptt: true } }).content, '[Voice message]');
});

test('formats names and deletion time for reports', () => {
  assert.equal(formatUser('Amina', '254700000001@s.whatsapp.net'), 'Amina (@254700000001)');
  assert.match(formatTimestamp(1795136963), /EAT|GMT\+3/);
  assert.equal(formatTimestamp(undefined), 'Time unavailable');
});

test('formats all requested anti-delete report details', () => {
  const report = formatReport({
    deletedBy: 'Amina (@254700000001)',
    sentBy: 'Amina (@254700000001)',
    deletedAt: '20 Nov 2026, 02:09 EAT',
    chatLocation: 'Group: Project team',
    contentType: 'Text',
    content: 'Please review this update.',
  });
  assert.match(report, /A deleted message was recovered/);
  assert.match(report, /Deleted by: Amina/);
  assert.match(report, /Originally sent by: Amina/);
  assert.match(report, /Deleted at:/);
  assert.match(report, /Deleted in: Group: Project team/);
  assert.match(report, /Please review this update\./);
});

test('group mode reports to the group with full context', async () => {
  const sent = [];
  const groupJid = '123456789-123456@g.us';
  const ownerJid = '254700000002@s.whatsapp.net';
  const client = {
    user: { id: ownerJid },
    decodeJid: (jid) => jid,
    groupMetadata: async () => ({ subject: 'Project team', participants: [] }),
    sendMessage: async (jid, message) => sent.push({ jid, message }),
  };
  const original = {
    key: {
      id: 'message-1',
      remoteJid: groupJid,
      participant: '254700000001@s.whatsapp.net',
    },
    pushName: 'Amina',
    message: { conversation: 'Please review this update.' },
  };
  const revoke = {
    key: { id: 'revoke-1', remoteJid: groupJid },
    participant: '254700000001@s.whatsapp.net',
    pushName: 'Amina',
    messageTimestamp: 1795136963,
    message: {
      protocolMessage: {
        type: 0,
        key: { id: 'message-1' },
      },
    },
  };

  await antidelete.handle(client, { isGroup: true }, original, 'group');
  await antidelete.handle(client, { isGroup: true }, revoke, 'group');

  assert.deepEqual(sent.map((item) => item.jid), [groupJid]);
  assert.match(sent[0].message.text, /Deleted by: Amina/);
  assert.match(sent[0].message.text, /Deleted at:/);
  assert.match(sent[0].message.text, /Deleted in: Group: Project team/);
  assert.match(sent[0].message.text, /Please review this update\./);

  sent.length = 0;
  await antidelete.handle(client, { isGroup: true }, revoke, 'both');
  assert.deepEqual(sent.map((item) => item.jid), [groupJid, ownerJid]);
});

test('DM mode sends the report to the bot owner DM', async () => {
  const sent = [];
  const chatJid = '254700000003@s.whatsapp.net';
  const ownerJid = '254700000002@s.whatsapp.net';
  const client = {
    user: { id: ownerJid },
    decodeJid: (jid) => jid,
    sendMessage: async (jid, message) => sent.push({ jid, message }),
  };
  const original = {
    key: { id: 'dm-message-1', remoteJid: chatJid },
    pushName: 'Jane',
    message: { extendedTextMessage: { text: 'A direct message' } },
  };
  const revoke = {
    key: { id: 'dm-revoke-1', remoteJid: chatJid },
    pushName: 'Jane',
    messageTimestamp: 1795136963,
    message: {
      protocolMessage: {
        type: 'REVOKE',
        key: { id: 'dm-message-1' },
      },
    },
  };

  await antidelete.handle(client, { isGroup: false }, original, 'dm');
  await antidelete.handle(client, { isGroup: false }, revoke, 'dm');

  assert.deepEqual(sent.map((item) => item.jid), [ownerJid]);
  assert.match(sent[0].message.text, /Deleted by: Jane/);
  assert.match(sent[0].message.text, /Deleted in: Direct message with Jane/);
  assert.match(sent[0].message.text, /A direct message/);

  sent.length = 0;
  await antidelete.handle(client, { isGroup: false }, revoke, 'chat');
  assert.deepEqual(sent.map((item) => item.jid), [chatJid]);
});
