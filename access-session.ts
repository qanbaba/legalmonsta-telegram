/// <reference types="node" />

import { createHmac, timingSafeEqual } from 'node:crypto';

export const ACCESS_COOKIE_NAME = '__Host-legalmonsta-telegram';
export const ACCESS_SESSION_MAX_AGE_SECONDS = 30 * 60;

const ACCESS_TICKET_ISSUER = 'legalmonsta.kz';
const ACCESS_TICKET_AUDIENCE = 'telegram.legalmonsta.kz';
const ACCESS_TICKET_TYPE = 'legalmonsta-telegram-access';
const ACCESS_SESSION_TYPE = 'legalmonsta-telegram-session';
const MAX_TICKET_LIFETIME_SECONDS = 2 * 60;
const CLOCK_TOLERANCE_SECONDS = 15;

type AccessTicketClaims = {
  iss: typeof ACCESS_TICKET_ISSUER;
  aud: typeof ACCESS_TICKET_AUDIENCE;
  typ: typeof ACCESS_TICKET_TYPE;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
};

type AccessSessionClaims = {
  iss: typeof ACCESS_TICKET_AUDIENCE;
  aud: typeof ACCESS_TICKET_AUDIENCE;
  typ: typeof ACCESS_SESSION_TYPE;
  sub: string;
  iat: number;
  exp: number;
};

type JsonObject = Record<string, unknown>;

function getAccessSecret() {
  const secret = process.env.TELEGRAM_EMBED_ACCESS_SECRET?.trim();
  if (!secret) throw new Error('TELEGRAM_EMBED_ACCESS_SECRET is not configured');
  return secret;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function signPayload(payload: string) {
  return createHmac('sha256', getAccessSecret()).update(payload).digest('base64url');
}

function createSignedToken(claims: AccessTicketClaims | AccessSessionClaims) {
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

function readSignedClaims(token: string): JsonObject | undefined {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;

  const [payload, signature] = parts;
  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
  if (
    signatureBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) return undefined;

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return isJsonObject(claims) ? claims : undefined;
  } catch {
    return undefined;
  }
}

function hasValidTimes(claims: JsonObject, maxLifetimeSeconds: number) {
  if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') return false;
  const now = Math.floor(Date.now() / 1_000);
  return (
    claims.iat <= now + CLOCK_TOLERANCE_SECONDS
    && claims.exp > now - CLOCK_TOLERANCE_SECONDS
    && claims.exp - claims.iat > 0
    && claims.exp - claims.iat <= maxLifetimeSeconds
  );
}

function hasValidSubject(claims: JsonObject) {
  return typeof claims.sub === 'string' && claims.sub.length > 0 && claims.sub.length <= 128;
}

export function verifyAccessTicket(token: string) {
  const claims = readSignedClaims(token);
  if (
    !claims
    || claims.iss !== ACCESS_TICKET_ISSUER
    || claims.aud !== ACCESS_TICKET_AUDIENCE
    || claims.typ !== ACCESS_TICKET_TYPE
    || typeof claims.jti !== 'string'
    || !claims.jti
    || !hasValidSubject(claims)
    || !hasValidTimes(claims, MAX_TICKET_LIFETIME_SECONDS)
  ) return undefined;

  return claims as AccessTicketClaims;
}

export function createAccessSession(userId: string) {
  const issuedAt = Math.floor(Date.now() / 1_000);
  return createSignedToken({
    iss: ACCESS_TICKET_AUDIENCE,
    aud: ACCESS_TICKET_AUDIENCE,
    typ: ACCESS_SESSION_TYPE,
    sub: userId,
    iat: issuedAt,
    exp: issuedAt + ACCESS_SESSION_MAX_AGE_SECONDS,
  });
}

export function verifyAccessSession(token: string | undefined) {
  if (!token) return undefined;
  const claims = readSignedClaims(token);
  if (
    !claims
    || claims.iss !== ACCESS_TICKET_AUDIENCE
    || claims.aud !== ACCESS_TICKET_AUDIENCE
    || claims.typ !== ACCESS_SESSION_TYPE
    || !hasValidSubject(claims)
    || !hasValidTimes(claims, ACCESS_SESSION_MAX_AGE_SECONDS)
  ) return undefined;

  return claims as AccessSessionClaims;
}

export function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(';')) {
    const separatorIndex = item.indexOf('=');
    if (separatorIndex < 0) continue;
    if (item.slice(0, separatorIndex).trim() === name) {
      return item.slice(separatorIndex + 1).trim();
    }
  }
  return undefined;
}
