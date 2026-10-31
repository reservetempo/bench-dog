// /app/lib/auth.js

// Password login for /admin. The password is the ADMIN_PASSWORD env var.
// Logging in sets a signed cookie. Changing ADMIN_PASSWORD logs out every session.

import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'blog_admin';
const SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days

const sha256 = (text) => crypto.createHash('sha256').update(text).digest();

function signingKey() {
  const password = process.env.ADMIN_PASSWORD;
  return password ? sha256(`blog-admin-session:${password}`) : null;
}

const sign = (key, expires) =>
  crypto.createHmac('sha256', key).update(String(expires)).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return crypto.timingSafeEqual(sha256(String(password)), sha256(expected));
}

export function isLoggedIn() {
  const key = signingKey();
  const value = cookies().get(COOKIE_NAME)?.value;
  if (!key || !value) return false;

  const [expires, signature] = value.split('.');
  if (!signature || !(Number(expires) > Date.now() / 1000)) return false;
  return safeEqual(signature, sign(key, expires));
}

export function startSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  cookies().set(COOKIE_NAME, `${expires}.${sign(signingKey(), expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_SECONDS,
  });
}

export function endSession() {
  cookies().delete(COOKIE_NAME);
}
