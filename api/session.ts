import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_MAX_AGE_SECONDS,
  createAccessSession,
  readCookie,
  verifyAccessSession,
  verifyAccessTicket,
} from '../access-session.js';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
};

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function getSessionCookie(token: string) {
  return [
    `${ACCESS_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${ACCESS_SESSION_MAX_AGE_SECONDS}`,
  ].join('; ');
}

function getExpiredSessionCookie() {
  return [
    `${ACCESS_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0',
  ].join('; ');
}

export function GET(request: Request) {
  try {
    const token = readCookie(request.headers.get('cookie'), ACCESS_COOKIE_NAME);
    const claims = verifyAccessSession(token);
    return new Response(undefined, {
      status: claims ? 204 : 401,
      headers: RESPONSE_HEADERS,
    });
  } catch {
    return new Response(undefined, { status: 503, headers: RESPONSE_HEADERS });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'forbidden' }, {
      status: 403,
      headers: RESPONSE_HEADERS,
    });
  }

  let ticket: unknown;
  try {
    const body: unknown = await request.json();
    ticket = body && typeof body === 'object' && 'ticket' in body
      ? (body as { ticket?: unknown }).ticket
      : undefined;
  } catch {
    return Response.json({ ok: false, error: 'invalid_request' }, {
      status: 400,
      headers: RESPONSE_HEADERS,
    });
  }

  if (typeof ticket !== 'string' || ticket.length > 4_096) {
    return Response.json({ ok: false, error: 'invalid_ticket' }, {
      status: 400,
      headers: RESPONSE_HEADERS,
    });
  }

  try {
    const claims = verifyAccessTicket(ticket);
    if (!claims) {
      return Response.json({ ok: false, error: 'invalid_ticket' }, {
        status: 401,
        headers: RESPONSE_HEADERS,
      });
    }

    const session = createAccessSession(claims.sub);
    return Response.json({ ok: true }, {
      headers: {
        ...RESPONSE_HEADERS,
        'Set-Cookie': getSessionCookie(session),
      },
    });
  } catch {
    return Response.json({ ok: false, error: 'access_unavailable' }, {
      status: 503,
      headers: RESPONSE_HEADERS,
    });
  }
}

export function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'forbidden' }, {
      status: 403,
      headers: RESPONSE_HEADERS,
    });
  }

  return new Response(undefined, {
    status: 204,
    headers: {
      ...RESPONSE_HEADERS,
      'Set-Cookie': getExpiredSessionCookie(),
    },
  });
}
