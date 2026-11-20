'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const groupJoin = require('../lib/group-join');

test('extracts the invite code from a WhatsApp group link with query parameters', () => {
  assert.equal(
    groupJoin.getInviteCode('https://chat.whatsapp.com/GqrEipIrnK1CKFLgaZ6Xh9?s=cl&p=a'),
    'GqrEipIrnK1CKFLgaZ6Xh9'
  );
});

test('rejects malformed group invite links', () => {
  assert.throws(() => groupJoin.getInviteCode('not a group link'), /missing or invalid/);
  assert.throws(() => groupJoin.getInviteCode('https://example.com/GqrEipIrnK1CKFLgaZ6Xh9'), /missing or invalid/);
});

test('returns the configured owner contact for the owner command', () => {
  const original = process.env.BOT_OWNER_CONTACT;
  process.env.BOT_OWNER_CONTACT = '+254 706 535 581';
  try {
    assert.equal(groupJoin.getOwnerContact(), '254706535581');
  } finally {
    if (original === undefined) delete process.env.BOT_OWNER_CONTACT;
    else process.env.BOT_OWNER_CONTACT = original;
  }
});

test('adds a user only after the target group is initialized and the bot is admin', async () => {
  const calls = [];
  const client = {
    user: { id: '254700000001@s.whatsapp.net' },
    groupGetInviteInfo: async () => ({ id: '12345@g.us' }),
    groupMetadata: async () => ({
      participants: [{ id: '254700000001@s.whatsapp.net', admin: 'admin' }],
    }),
    groupParticipantsUpdate: async (...args) => {
      calls.push(args);
      return [{ status: '200' }];
    },
  };

  await groupJoin.initializeTargetGroup(client);
  const result = await groupJoin.addOptedInUser(
    client,
    new Set(['254700000002@s.whatsapp.net'])
  );

  assert.equal(result.status, 'added');
  assert.deepEqual(calls, [[
    '12345@g.us',
    ['254700000002@s.whatsapp.net'],
    'add',
  ]]);
});

test('joins the destination group from its invite when the bot is not a member', async () => {
  let acceptedCode;
  const client = {
    user: { id: '254700000001@s.whatsapp.net' },
    groupGetInviteInfo: async () => ({ id: '12347@g.us' }),
    groupMetadata: async () => {
      throw new Error('bot is not in the group yet');
    },
    groupAcceptInvite: async (code) => {
      acceptedCode = code;
      return '12347@g.us';
    },
  };

  const jid = await groupJoin.initializeTargetGroup(client);
  assert.equal(jid, '12347@g.us');
  assert.equal(acceptedCode, 'GqrEipIrnK1CKFLgaZ6Xh9');
});

test('returns the invite-link fallback when WhatsApp blocks direct addition', async () => {
  const client = {
    user: { id: '254700000001@s.whatsapp.net' },
    groupGetInviteInfo: async () => ({ id: '12348@g.us' }),
    groupMetadata: async () => ({
      participants: [{ id: '254700000001@s.whatsapp.net', admin: 'admin' }],
    }),
    groupParticipantsUpdate: async () => [{ status: '403' }],
  };

  await groupJoin.initializeTargetGroup(client);
  const result = await groupJoin.addOptedInUser(
    client,
    new Set(['254700000002@s.whatsapp.net'])
  );

  assert.equal(result.status, 'invite_required');
  assert.equal(
    groupJoin.getInviteLink(),
    'https://chat.whatsapp.com/GqrEipIrnK1CKFLgaZ6Xh9'
  );
});

test('does not add users when the bot is not a group admin', async () => {
  const client = {
    user: { id: '254700000001@s.whatsapp.net' },
    groupGetInviteInfo: async () => ({ id: '12346@g.us' }),
    groupAcceptInvite: async () => '12346@g.us',
    groupMetadata: async () => ({ participants: [] }),
    groupParticipantsUpdate: async () => {
      assert.fail('must not attempt to add a participant');
    },
  };

  await groupJoin.initializeTargetGroup(client);
  await assert.rejects(
    groupJoin.addOptedInUser(client, new Set(['254700000002@s.whatsapp.net'])),
    /must be a group admin/
  );
});
