import { getActions } from '../global';

import {
  ASSET_CACHE_PREFIX, DEBUG, DEBUG_MORE, IS_TEST,
} from '../config';
// eslint-disable-next-line import-x/default
import serviceWorkerUrl from '../serviceWorker/service.worker.ts?worker&url';
import { IS_ANDROID, IS_IOS, IS_SERVICE_WORKER_SUPPORTED } from './browser/windowEnvironment';
import { formatShareText } from './deeplink';
import { validateFiles } from './files';
import { notifyClientReady, playNotifySoundDebounced } from './notifications';

type WorkerAction = {
  type: string;
  payload: Record<string, any>;
};

const IGNORE_WORKER_PATH = '/k/';
const SERVICE_WORKER_OPTIONS: RegistrationOptions = import.meta.env.DEV
  ? { scope: './', type: 'module' }
  : { type: 'module' };

export async function reloadWithFreshServiceWorker() {
  // The worker URL is content-hashed, so the current worker cannot discover its successor.
  // The next navigation loads a fresh app shell, whose bundle registers the new worker URL.
  await Promise.allSettled([
    clearAssetCaches(),
    unregisterAppServiceWorkers(),
  ]);

  window.location.reload();
}

async function clearAssetCaches() {
  if (!('caches' in window)) return;

  const cacheNames = await caches.keys();
  const assetCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith(ASSET_CACHE_PREFIX));
  await Promise.all(assetCacheNames.map((cacheName) => caches.delete(cacheName)));
}

async function unregisterAppServiceWorkers() {
  if (!IS_SERVICE_WORKER_SUPPORTED) return;

  const registrations = await fetchAppServiceWorkerRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}

async function fetchAppServiceWorkerRegistrations() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  return registrations.filter((registration) => !registration.scope.includes(IGNORE_WORKER_PATH));
}

function handleWorkerMessage(e: MessageEvent) {
  const action: WorkerAction = e.data;
  if (DEBUG_MORE) {
    // eslint-disable-next-line no-console
    console.log('[SW] Message from worker', action);
  }
  if (!action.type) return;
  const dispatch = getActions();
  const payload = action.payload;
  switch (action.type) {
    case 'focusMessage':
      dispatch.focusMessage?.(payload as any);
      break;
    case 'playNotificationSound':
      playNotifySoundDebounced(action.payload.id);
      break;
    case 'share':
      dispatch.openChatWithDraft({
        text: formatShareText(payload.url, payload.text, payload.title),
        files: validateFiles(payload.files),
      });
      break;
  }
}

function subscribeToWorker() {
  navigator.serviceWorker.removeEventListener('message', handleWorkerMessage);
  navigator.serviceWorker.addEventListener('message', handleWorkerMessage);
  // Notify web worker that client is ready to receive messages
  notifyClientReady();
}

if (IS_SERVICE_WORKER_SUPPORTED) {
  window.addEventListener('load', async () => {
    try {
      const controller = navigator.serviceWorker.controller;
      if (!controller || controller.scriptURL.includes(IGNORE_WORKER_PATH)) {
        const ourRegistrations = await fetchAppServiceWorkerRegistrations();
        if (ourRegistrations.length) {
          if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[SW] Hard reload detected, re-enabling Service Worker');
          }
          await Promise.all(ourRegistrations.map((r) => r.unregister()));
        }
      }

      await navigator.serviceWorker.register(serviceWorkerUrl, SERVICE_WORKER_OPTIONS);

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[SW] ServiceWorker registered');
      }

      await navigator.serviceWorker.ready;

      // Wait for registration to be available
      await navigator.serviceWorker.getRegistration();

      if (navigator.serviceWorker.controller) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.log('[SW] ServiceWorker ready');
        }
        subscribeToWorker();
      } else {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('[SW] ServiceWorker not available');
        }

        if (!IS_IOS && !IS_ANDROID && !IS_TEST) {
          getActions().showDialog?.({ data: { type: 'error', message: 'SERVICE_WORKER_DISABLED', hasErrorKey: true } });
        }
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[SW] ServiceWorker registration failed: ', err);
      }
    }
  });
  window.addEventListener('focus', async () => {
    await navigator.serviceWorker.ready;
    subscribeToWorker();
  });
}
