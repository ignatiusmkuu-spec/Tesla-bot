'use strict';

const identity = require('./Identity');

const DEFAULT_INVITE_LINK = 'https://chat.whatsapp.com/GqrEipIrnK1CKFLgaZ6Xh9';
const DEFAULT_OWNER_CONTACT = '254706535581';
let targetGroupJid = null;

function getInviteLink() {
  return process.env.AUTO_JOIN_GROUP_INVITE || DEFAULT_INVITE_LINK;
}

function getInviteCode(link = getInviteLink()) {
  const value = String(link || '').trim();
  if (/^[A-Za-z0-9_-]{10,}$/.test(value)) return value;

  let url;
  try {
    url = new URL(value.includes('://') ? value : `https://${value}`);
  } catch {
    throw new Error('The group invite link is missing or invalid.');
  }
  const code = url.pathname.split('/').filter(Boolean)[0];
  if (url.hostname.toLowerCase() !== 'chat.whatsapp.com' || !/^[A-Za-z0-9_-]{10,}$/.test(code || '')) {
    throw new Error('The group invite link is missing or invalid.');
  }
  return code;
}

function getOwnerContact() {
  return String(process.env.BOT_OWNER_CONTACT || DEFAULT_OWNER_CONTACT).replace(/\D/g, '');
}

async function initializeTargetGroup(client) {
  const code = getInviteCode();
  const inviteInfo = await client.groupGetInviteInfo(code);
  let jid = inviteInfo && (inviteInfo.id || inviteInfo.jid);

  if (!jid || !jid.endsWith('@g.us')) {
    jid = await client.groupAcceptInvite(code);
  } else {
    const botIds = await identity.expand(client, identity.botIds(client));
    const metadata = await client.groupMetadata(jid).catch(() => null);
    const alreadyJoined = (metadata?.participants || []).some((participant) =>
      identity.participantIds(participant).some((id) => botIds.has(id))
    );

    if (!alreadyJoined) {
      try {
        const acceptedJid = await client.groupAcceptInvite(code);
        if (acceptedJid) jid = acceptedJid;
      } catch (error) {
        const refreshed = await client.groupMetadata(jid).catch(() => null);
        const joinedAfterAttempt = (refreshed?.participants || []).some((participant) =>
          identity.participantIds(participant).some((id) => botIds.has(id))
        );
        if (!joinedAfterAttempt) throw error;
      }
    }
  }

  if (typeof jid !== 'string' || !jid.endsWith('@g.us')) {
    throw new Error('WhatsApp did not return a valid destination group.');
  }
  targetGroupJid = jid;
  return jid;
}

async function addOptedInUser(client, senderIds) {
  if (!targetGroupJid) {
    throw new Error('The destination group is not ready yet. Please try again shortly.');
  }

  const userIds = await identity.expand(client, [...senderIds].filter(Boolean));
  const participantJid =
    [...userIds].find((id) => id.endsWith('@s.whatsapp.net')) ||
    [...userIds].find((id) => id.endsWith('@lid'));
  if (!participantJid) {
    throw new Error('WhatsApp could not identify your account for the group request.');
  }

  const metadata = await client.groupMetadata(targetGroupJid);
  const knownUserIds = new Set(userIds);
  const existingMember = (metadata.participants || []).some((participant) =>
    identity.participantIds(participant).some((id) => knownUserIds.has(id))
  );
  if (existingMember) return { status: 'already_member', groupJid: targetGroupJid };

  const botIds = await identity.expand(client, identity.botIds(client));
  const adminIds = identity.adminIdSet(metadata.participants);
  if (!identity.overlaps(botIds, adminIds)) {
    throw new Error('The bot must be a group admin before it can add members.');
  }

  const results = await client.groupParticipantsUpdate(targetGroupJid, [participantJid], 'add');
  const result = Array.isArray(results) ? results[0] : results;
  const status = String((result && result.status) || '');
  if (status === '200') return { status: 'added', groupJid: targetGroupJid };
  if (status === '403') return { status: 'invite_required', groupJid: targetGroupJid };
  throw new Error(`WhatsApp could not add this account${status ? ` (status ${status})` : ''}.`);
}

module.exports = {
  DEFAULT_INVITE_LINK,
  getInviteLink,
  getInviteCode,
  getOwnerContact,
  initializeTargetGroup,
  addOptedInUser,
};
