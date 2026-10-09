(() => {
  const BRIDGE_VERSION = 1;
  const READY_MESSAGE_TYPE = 'legalmonsta:telegram:access-ready';
  const GRANT_MESSAGE_TYPE = 'legalmonsta:telegram:access-grant';
  const DENIED_MESSAGE_TYPE = 'legalmonsta:telegram:access-denied';
  const EMBEDDED_RELEASE_PARAM = 'lm-release';
  const EMBEDDED_RELEASE_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;
  const VERSIONED_RELEASE_PATTERN = /^\d+\.\d+(?:\.\d+)?$/;
  const APPLIED_RELEASE_STORAGE_KEY = 'lm-embedded-release';
  const ASSET_CACHE_PREFIX = 'tt-assets';
  const IGNORE_WORKER_PATH = '/k/';
  const ALLOWED_PARENT_ORIGINS = new Set([
    'https://legalmonsta.kz',
    'https://www.legalmonsta.kz',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);
  const status = document.getElementById('access-status');
  let isComplete = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.dataset.error = isError ? 'true' : 'false';
  }

  function resolveParentOrigin() {
    if (window.parent === window) return undefined;

    const candidateOrigins = [];
    if (document.referrer) {
      try {
        candidateOrigins.push(new URL(document.referrer).origin);
      } catch {
        // Ignore malformed referrers and use the browser-provided ancestor origin.
      }
    }

    const ancestorOrigin = window.location.ancestorOrigins?.[0];
    if (ancestorOrigin) candidateOrigins.push(ancestorOrigin);

    return candidateOrigins.find((origin) => ALLOWED_PARENT_ORIGINS.has(origin));
  }

  const parentOrigin = resolveParentOrigin();
  if (!parentOrigin) {
    setStatus('Доступ возможен только из авторизованного кабинета Legal Monsta.', true);
    return;
  }

  function requestAccess() {
    if (isComplete) return;
    window.parent.postMessage({
      type: READY_MESSAGE_TYPE,
      version: BRIDGE_VERSION,
    }, parentOrigin);
  }

  window.addEventListener('message', async (event) => {
    if (
      isComplete
      || event.origin !== parentOrigin
      || event.source !== window.parent
      || !event.data
      || typeof event.data !== 'object'
      || event.data.version !== BRIDGE_VERSION
    ) return;

    if (event.data.type === DENIED_MESSAGE_TYPE) {
      isComplete = true;
      setStatus('Сессия Legal Monsta не подтверждена. Войдите в кабинет и попробуйте снова.', true);
      return;
    }

    if (event.data.type !== GRANT_MESSAGE_TYPE || typeof event.data.ticket !== 'string') return;

    isComplete = true;
    setStatus('Запускаем Telegram…');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: event.data.ticket }),
      });
      if (!response.ok) throw new Error('Access was denied');
      await prepareEmbeddedRelease();
      window.location.replace(buildClientUrl());
    } catch {
      setStatus('Не удалось подтвердить доступ. Обновите страницу кабинета и попробуйте снова.', true);
    }
  });

  requestAccess();
  window.setInterval(requestAccess, 1_500);

  async function prepareEmbeddedRelease() {
    const release = getEmbeddedRelease();
    if (!release || !VERSIONED_RELEASE_PATTERN.test(release)) return;

    try {
      if (window.localStorage.getItem(APPLIED_RELEASE_STORAGE_KEY) === release) return;
    } catch {
      // Continue without the optimization when storage is unavailable.
    }

    try {
      await Promise.all([
        clearAssetCaches(),
        unregisterAppServiceWorkers(),
      ]);
      window.localStorage.setItem(APPLIED_RELEASE_STORAGE_KEY, release);
    } catch {
      // The versioned navigation still prevents an old shell from blocking startup.
    }
  }

  async function clearAssetCaches() {
    if (!('caches' in window)) return;

    const cacheNames = await window.caches.keys();
    const assetCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith(ASSET_CACHE_PREFIX));
    await Promise.all(assetCacheNames.map((cacheName) => window.caches.delete(cacheName)));
  }

  async function unregisterAppServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;

    const registrations = await navigator.serviceWorker.getRegistrations();
    const appRegistrations = registrations.filter((registration) => (
      !registration.scope.includes(IGNORE_WORKER_PATH)
    ));
    await Promise.all(appRegistrations.map((registration) => registration.unregister()));
  }

  function buildClientUrl() {
    const url = new URL('/', window.location.origin);
    const release = getEmbeddedRelease();

    if (release && EMBEDDED_RELEASE_PATTERN.test(release)) {
      url.searchParams.set(EMBEDDED_RELEASE_PARAM, release);
    }

    return `${url.pathname}${url.search}`;
  }

  function getEmbeddedRelease() {
    return new URLSearchParams(window.location.search).get(EMBEDDED_RELEASE_PARAM);
  }
})();
