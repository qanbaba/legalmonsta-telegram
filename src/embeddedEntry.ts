const EMBEDDED_RELEASE_PARAM = 'lm-release';
const EMBEDDED_RELEASE_PATTERN = /^[a-zA-Z0-9._-]{1,64}$/;

async function startEmbeddedClient() {
  if (import.meta.env.DEV) {
    await import('./index');
    return;
  }

  try {
    const response = await fetch('/api/session', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      redirectToAccessGate();
      return;
    }

    await import('./index');
  } catch {
    redirectToAccessGate();
  }
}

function redirectToAccessGate() {
  window.location.replace(buildEmbeddedUrl('/legalmonsta/access.html'));
}

function buildEmbeddedUrl(pathname: string) {
  const url = new URL(pathname, window.location.origin);
  const release = new URLSearchParams(window.location.search).get(EMBEDDED_RELEASE_PARAM);

  if (release && EMBEDDED_RELEASE_PATTERN.test(release)) {
    url.searchParams.set(EMBEDDED_RELEASE_PARAM, release);
  }

  return `${url.pathname}${url.search}`;
}

void startEmbeddedClient();
