import {
  ACCESS_COOKIE_NAME,
  readCookie,
  verifyAccessSession,
} from './access-session.js';

const ACCESS_PAGE_PATH = '/legalmonsta/access.html';
const PUBLIC_PATH_PREFIXES = ['/api/', '/assets/', '/legalmonsta/'];
const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/robots.txt',
]);
const ALLOWED_EMBED_ORIGINS = new Set([
  'https://legalmonsta.kz',
  'https://www.legalmonsta.kz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

export const config = {
  matcher: '/:path*',
  runtime: 'nodejs',
};

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isHtmlNavigation(request: Request, pathname: string) {
  const destination = request.headers.get('sec-fetch-dest');
  if (destination === 'document' || destination === 'iframe') return true;
  const finalSegment = pathname.split('/').pop() || '';
  if (!finalSegment.includes('.') || finalSegment.endsWith('.html')) return true;
  return Boolean(request.headers.get('accept')?.includes('text/html'));
}

function isTrustedEmbedNavigation(request: Request) {
  if (request.headers.get('sec-fetch-dest') !== 'iframe') return false;

  const referrer = request.headers.get('referer');
  if (!referrer) return false;
  try {
    const referrerOrigin = new URL(referrer).origin;
    return referrerOrigin === new URL(request.url).origin || ALLOWED_EMBED_ORIGINS.has(referrerOrigin);
  } catch {
    return false;
  }
}

function redirectToAccessPage(request: Request) {
  const accessUrl = new URL(ACCESS_PAGE_PATH, request.url);
  return Response.redirect(accessUrl, 307);
}

export default function routeTelegramNavigation(request: Request) {
  const { pathname } = new URL(request.url);
  if (
    (request.method !== 'GET' && request.method !== 'HEAD')
    || isPublicPath(pathname)
    || !isHtmlNavigation(request, pathname)
  ) return undefined;

  if (!isTrustedEmbedNavigation(request)) return redirectToAccessPage(request);

  try {
    const token = readCookie(request.headers.get('cookie'), ACCESS_COOKIE_NAME);
    return verifyAccessSession(token) ? undefined : redirectToAccessPage(request);
  } catch {
    return redirectToAccessPage(request);
  }
}
