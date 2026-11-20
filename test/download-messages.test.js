'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DOWNLOAD_MEDIA_CAPTION,
  isDownloadWaitMessage,
  createDownloadClient,
} = require('../lib/download-messages');

test('recognizes the download wait message without matching unrelated replies', () => {
  assert.equal(isDownloadWaitMessage('_Please wait your download is in progress_'), true);
  assert.equal(isDownloadWaitMessage('Please wait your download is in progress'), true);
  assert.equal(isDownloadWaitMessage('Download failed'), false);
  assert.equal(isDownloadWaitMessage({ text: 'Please wait your download is in progress' }), false);
});

test('sends song audio as one captioned downloadable file', async () => {
  const calls = [];
  const client = {
    sendMessage(...args) {
      calls.push(args);
      return Promise.resolve('sent');
    },
  };
  const audio = { url: 'https://example.com/song.mp3' };
  const options = { quoted: { key: 'original' } };
  const wrapped = createDownloadClient(client, 'song');

  await wrapped.sendMessage('chat-id', {
    audio,
    mimetype: 'audio/mpeg',
    fileName: 'song.mp3',
  }, options);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['chat-id', {
    document: audio,
    mimetype: 'audio/mpeg',
    fileName: 'song.mp3',
    caption: DOWNLOAD_MEDIA_CAPTION,
  }, options]);
});

test('keeps play audio and non-media messages unchanged', async () => {
  const calls = [];
  const client = {
    sendMessage(...args) {
      calls.push(args);
      return Promise.resolve('sent');
    },
  };
  const audioMessage = { audio: { url: 'https://example.com/song.mp3' }, mimetype: 'audio/mpeg' };
  const textMessage = { text: 'No results found.' };

  await createDownloadClient(client, 'play').sendMessage('chat-id', audioMessage);
  await createDownloadClient(client, 'song').sendMessage('chat-id', textMessage);

  assert.deepEqual(calls, [
    ['chat-id', audioMessage, undefined],
    ['chat-id', textMessage, undefined],
  ]);
});
