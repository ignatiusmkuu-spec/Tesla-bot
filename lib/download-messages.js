'use strict';

const DOWNLOAD_MEDIA_CAPTION = '𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗧𝗘𝗦𝗟𝗔-𝗠𝗗';
const DOWNLOAD_MEDIA_COMMANDS = new Set(['video', 'song', 'music', 'play']);

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
      return (jid, message, options) => {
        if ((command === 'song' || command === 'music') && message && message.audio) {
          const { audio, ...rest } = message;
          message = {
            ...rest,
            document: audio,
            caption: message.caption || DOWNLOAD_MEDIA_CAPTION,
          };
        }
        return Reflect.apply(sendMessage, target, [jid, message, options]);
      };
    },
  });
}

module.exports = {
  DOWNLOAD_MEDIA_CAPTION,
  DOWNLOAD_MEDIA_COMMANDS,
  isDownloadWaitMessage,
  createDownloadClient,
};
