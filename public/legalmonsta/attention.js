(() => {
  const BRIDGE_VERSION = 1;
  const MESSAGE_TYPE = 'legalmonsta:telegram:attention';
  const CLIENT_MESSAGE_TYPE = 'legalmonsta:telegram:attention-changed';
  const CACHE_NAME = 'lm-telegram-attention-v1';
  const STATE_PATH = '/legalmonsta/attention-state.json';
  const CHANNEL_NAME = 'legalmonsta:telegram:attention';
  const ALLOWED_PARENT_ORIGINS = new Set([
    'https://legalmonsta.kz',
    'https://www.legalmonsta.kz',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  function resolveParentOrigin() {
    if (window.parent === window) return undefined;

    const candidates = [];
    if (document.referrer) {
      try {
        candidates.push(new URL(document.referrer).origin);
      } catch {
        // Ignore malformed referrers and use the browser-provided ancestor origin.
      }
    }

    const ancestorOrigin = window.location.ancestorOrigins?.[0];
    if (ancestorOrigin) candidates.push(ancestorOrigin);
    return candidates.find((origin) => ALLOWED_PARENT_ORIGINS.has(origin));
  }

  const parentOrigin = resolveParentOrigin();
  if (!parentOrigin) return;

  function publish(hasUnread) {
    window.parent.postMessage({
      type: MESSAGE_TYPE,
      version: BRIDGE_VERSION,
      payload: { hasUnread },
    }, parentOrigin);
  }

  async function publishCachedState() {
    if (!('caches' in window)) {
      publish(false);
      return;
    }

    try {
      const cache = await window.caches.open(CACHE_NAME);
      const stateUrl = new URL(STATE_PATH, window.location.origin);
      const response = await cache.match(stateUrl);
      if (!response) {
        publish(false);
        return;
      }

      const state = await response.json();
      publish(Boolean(state && state.hasUnread));
    } catch {
      publish(false);
    }
  }

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event) => {
      if (typeof event.data?.hasUnread === 'boolean') publish(event.data.hasUnread);
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (
        event.data?.type === CLIENT_MESSAGE_TYPE
        && typeof event.data.hasUnread === 'boolean'
      ) publish(event.data.hasUnread);
    });
  }

  window.addEventListener('pageshow', publishCachedState);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void publishCachedState();
  });
  void publishCachedState();
})();
