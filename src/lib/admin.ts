import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { config } from './config';

/** The admin area has one password (ADMIN_PASSWORD). The cookie holds a signature of it, never the password. */

const COOKIE = 'plana_admin';
const sign = () => createHmac('sha256', config.adminPassword).update('plana-admin-v1').digest('hex');

export function checkPassword(candidate: string): boolean {
  if (!config.adminPassword) return false;
  const a = createHmac('sha256', 'cmp').update(candidate).digest();
  const b = createHmac('sha256', 'cmp').update(config.adminPassword).digest();
  return timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  if (!config.adminPassword) return false;
  const value = (await cookies()).get(COOKIE)?.value ?? '';
  const expected = sign();
  return value.length === expected.length && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export async function signIn(): Promise<void> {
  (await cookies()).set(COOKIE, sign(), { httpOnly: true, sameSite: 'lax', secure: config.siteUrl.startsWith('https'), path: '/', maxAge: 60 * 60 * 12 });
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
