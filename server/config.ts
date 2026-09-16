import path from 'path';
import { timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    receivedAt: number;
  }
}

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const isProduction = process.env.NODE_ENV === 'production';

export const cookieSecret = process.env.COOKIE_SECRET
  || (isProduction ? '' : 'nummo-local-development-cookie-secret');

if (cookieSecret.length < 32) {
  throw new Error('COOKIE_SECRET must be at least 32 characters');
}

let secureCookies = isProduction;

if (isProduction) {
  for (const name of [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
  ]) {
    if (!process.env[name]) throw new Error(`${name} is required in production`);
  }
  const redirectUri = new URL(process.env.GOOGLE_REDIRECT_URI as string);
  const isLocalRedirect = ['localhost', '127.0.0.1', '[::1]'].includes(redirectUri.hostname);
  if (redirectUri.protocol !== 'https:' && !isLocalRedirect) {
    throw new Error('GOOGLE_REDIRECT_URI must use HTTPS outside localhost');
  }
  secureCookies = redirectUri.protocol === 'https:';
}

export const useSecureCookies = secureCookies;

export const signedCookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: useSecureCookies,
  signed: true,
};

export function readSignedCookie(request: FastifyRequest, name: string): string | null {
  const rawValue = request.cookies[name];
  if (!rawValue) return null;
  const unsigned = request.unsignCookie(rawValue);
  return unsigned.valid && unsigned.value ? unsigned.value : null;
}

export function secureValuesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function getCurrentKstDateTime(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .substring(0, 19);
}

export const PRACTICE_MODES = [
  'CALC_BASIC',
  'CALC_ADVANCED',
  'CALC_MIXED',
  'CALC_RECEIPT',
  'ROW_HOME',
  'ROW_BOTTOM',
  'ROW_TOP',
  'NUM_RANDOM',
] as const;

export const OFFICIAL_RECORD_MODES = ['CALC_MIXED', 'CALC_BASIC', 'CALC_RECEIPT'] as const;
