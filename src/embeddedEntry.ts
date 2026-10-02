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
      window.location.replace('/legalmonsta/access.html');
      return;
    }

    await import('./index');
  } catch {
    window.location.replace('/legalmonsta/access.html');
  }
}

void startEmbeddedClient();
