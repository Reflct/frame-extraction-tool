// StreamSaver Service Worker
// This service worker is required for StreamSaver.js to function properly
// It intercepts fetch requests and allows streaming downloads to disk

const PROTOCOL_VERSION = 4;
const VERSION = '1.0.0';

self.addEventListener('install', (event) => {
  console.log('[StreamSaver SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[StreamSaver SW] Activating service worker');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { url, method } = event.request;

  // Only handle POST requests to /download
  if (method !== 'POST' || !url.includes('/download')) {
    return;
  }

  event.respondWith(
    event.request.blob().then((body) => {
      return new Response(body, {
        headers: {
          'Content-Disposition': 'attachment',
        },
      });
    })
  );
});

// Message handler for StreamSaver communication
self.addEventListener('message', (event) => {
  console.log('[StreamSaver SW] Received message:', event.data);
  // StreamSaver sends protocol version here
  if (event.data && event.data.type === 'PING') {
    event.ports[0].postMessage({ type: 'PONG', version: PROTOCOL_VERSION });
  }
});
