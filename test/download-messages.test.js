'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SONG_DOWNLOAD_CAPTION,
  VIDEO_DOWNLOAD_CAPTION,
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
    caption: SONG_DOWNLOAD_CAPTION,
  }, options]);
  assert.ok(SONG_DOWNLOAD_CAPTION.length <= 1024);
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

test('combines the video status and downloaded media caption in one message', async () => {
  const calls = [];
  const client = {
    sendMessage(...args) {
      calls.push(args);
      return Promise.resolve('sent');
    },
  };
  const videoMessage = {
    video: { url: 'https://example.com/video.mp4' },
    mimetype: 'video/mp4',
    caption: 'DOWNLOADED BY TESLA-MD',
  };

  await createDownloadClient(client, 'video').sendMessage('chat-id', videoMessage);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].video, videoMessage.video);
  assert.equal(calls[0][1].caption, `${VIDEO_DOWNLOAD_CAPTION}\n\nDOWNLOADED BY TESLA-MD`);
  assert.ok(calls[0][1].caption.length <= 1024);
});

test('combines the video status and caption for downloaded video documents too', async () => {
  const calls = [];
  const client = {
    sendMessage(...args) {
      calls.push(args);
      return Promise.resolve('sent');
    },
  };
  const documentMessage = {
    document: { url: 'https://example.com/video.mp4' },
    mimetype: 'video/mpeg',
    fileName: 'video.mp4',
  };

  await createDownloadClient(client, 'video').sendMessage('chat-id', documentMessage);

  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].document, documentMessage.document);
  assert.equal(calls[0][1].caption, VIDEO_DOWNLOAD_CAPTION);
  assert.ok(calls[0][1].caption.length <= 1024);
});
