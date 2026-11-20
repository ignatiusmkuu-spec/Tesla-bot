'use strict';

const DOWNLOAD_MEDIA_COMMANDS = new Set(['video', 'song', 'music', 'play']);
const SONG_DOWNLOAD_CAPTION = [
  '╭━━━〔 🎧 𝑻𝑬𝑺𝑳𝑨 𝑴𝑫 〕━━━╮',
  '',
  '⏳ 𝑰𝒏𝒊𝒕𝒊𝒂𝒍𝒊𝒛𝒊𝒏𝒈 𝒔𝒐𝒏𝒈 𝒆𝒏𝒈𝒊𝒏𝒆...',
  '🔌 𝑪𝒐𝒏𝒏𝒆𝒄𝒕𝒊𝒏𝒈 𝒕𝒐 𝑻𝒆𝒔𝒍𝒂 𝒔𝒆𝒓𝒗𝒆𝒓𝒔...',
  '🔍 𝑺𝒆𝒂𝒓𝒄𝒉𝒊𝒏𝒈 𝒂𝒖𝒅𝒊𝒐 𝒍𝒊𝒃𝒓𝒂𝒓𝒚...',
  '🎵 𝑴𝒂𝒕𝒄𝒉𝒊𝒏𝒈 𝒔𝒐𝒏𝒈 𝒅𝒆𝒕𝒂𝒊𝒍𝒔...',
  '📥 𝑷𝒓𝒆𝒑𝒂𝒓𝒊𝒏𝒈 𝒂𝒖𝒅𝒊𝒐 𝒅𝒐𝒘𝒏𝒍𝒐𝒂𝒅...',
  '',
  '╭━━〔 ⚡ 𝑺𝒀𝑺𝑻𝑬𝑴 〕━━╮',
  '┃ ◈ 𝑺𝒆𝒓𝒗𝒆𝒓: 𝑻𝑬𝑺𝑳𝑨 🟢',
  '┃ ◈ 𝑨𝒖𝒅𝒊𝒐: 𝑯𝑫',
  '┃ ◈ 𝑬𝒏𝒈𝒊𝒏𝒆: 𝑨𝑪𝑻𝑰𝑽𝑬 ⚡',
  '╰━━━━━━━━━━━━━━━━━━╯',
  '',
  '🎶 𝑷𝒓𝒐𝒄𝒆𝒔𝒔𝒊𝒏𝒈 𝒚𝒐𝒖𝒓 𝒔𝒐𝒏𝒈...',
  '',
  '⚡ 𝑷𝑶𝑾𝑬𝑹𝑬𝑫 𝑩𝒀 𝑻𝑬𝑺𝑳𝑨 𝑴𝑫',
].join('\n');
const PLAY_DOWNLOAD_CAPTION = [
  '╭━━〔 ⚡ 𝑻𝑬𝑺𝑳𝑨 𝑴𝑫 〕━━╮',
  '',
  '🎧 𝑰𝒏𝒊𝒕𝒊𝒂𝒍𝒊𝒛𝒊𝒏𝒈 𝒑𝒍𝒂𝒚𝒆𝒓...',
  '🔌 𝑪𝒐𝒏𝒏𝒆𝒄𝒕𝒊𝒏𝒈 𝒕𝒐 𝑻𝒆𝒔𝒍𝒂...',
  '🎶 𝑳𝒐𝒂𝒅𝒊𝒏𝒈 𝒕𝒓𝒂𝒄𝒌...',
  '🎼 𝑺𝒕𝒂𝒕𝒖𝒔: 𝑹𝑬𝑨𝑫𝒀 🟢',
  '⚡ 𝑨𝒖𝒅𝒊𝒐: 𝑨𝑪𝑻𝑰𝑽𝑬',
].join('\n');
const VIDEO_DOWNLOAD_CAPTION = [
  '⚡ TESLA MD',
  '',
  '⏳ Initializing...',
  '🔌 Connecting to Tesla servers...',
  '📥 Downloading video...',
  '',
  '🟢 Server: CONNECTED',
  '🚀 Engine: TURBO',
  '',
  '⚡ POWERED BY TESLA MD',
].join('\n');

function mergeCaption(status, caption) {
  const existing = typeof caption === 'string' ? caption.trim() : '';
  return existing && !status.includes(existing) ? `${status}\n\n${existing}` : status;
}

function isDownloadWaitMessage(value) {
  return typeof value === 'string'
    && value.replace(/[*_]/g, '').trim().toLowerCase() === 'please wait your download is in progress';
}

function createDownloadClient(client, command) {
  return new Proxy(client, {
    get(target, property) {
      if (property !== 'sendMessage') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      const sendMessage = Reflect.get(target, property, target);
      return async (jid, message, options) => {
        if (message && typeof message === 'object') {
          if ((command === 'song' || command === 'music') && message.audio) {
            const { audio, ...rest } = message;
            message = {
              ...rest,
              document: audio,
              caption: mergeCaption(SONG_DOWNLOAD_CAPTION, message.caption),
            };
          } else if (command === 'play' && message.audio) {
            const { audio, ...rest } = message;
            message = {
              ...rest,
              document: audio,
              caption: mergeCaption(PLAY_DOWNLOAD_CAPTION, message.caption),
            };
          } else if (
            command === 'video'
            && (message.video || (message.document && /^video\//i.test(message.mimetype || '')))
          ) {
            message = {
              ...message,
              caption: mergeCaption(VIDEO_DOWNLOAD_CAPTION, message.caption),
            };
          }
        }
        return Reflect.apply(sendMessage, target, [jid, message, options]);
      };
    },
  });
}

module.exports = {
  DOWNLOAD_MEDIA_COMMANDS,
  SONG_DOWNLOAD_CAPTION,
  PLAY_DOWNLOAD_CAPTION,
  VIDEO_DOWNLOAD_CAPTION,
  isDownloadWaitMessage,
  createDownloadClient,
};
