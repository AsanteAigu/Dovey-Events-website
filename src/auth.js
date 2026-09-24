import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

const COOKIE = 'dovey_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

// Hashing first gives equal-length buffers, so timingSafeEqual never leaks the length.
const digest = (value) => createHash('sha256').update(String(value)).digest();
const safeEqual = (a, b) => timingSafeEqual(digest(a), digest(b));

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function createAdminAuth({ adminPassword, sessionSecret, isProd }) {
  // Without a configured secret (local dev), sessions last until the server restarts.
  const secret = sessionSecret || randomBytes(32).toString('hex');
  const attempts = new Map(); // ip -> { count, resetAt }

  const sign = (expires) => createHmac('sha256', secret).update(`admin.${expires}`).digest('hex');

  function isAuthenticated(req) {
    const token = readCookie(req, COOKIE);
    if (!token) return false;
    const [expires, signature] = token.split('.');
    return Number(expires) > Date.now() && !!signature && safeEqual(signature, sign(expires));
  }

  function cookieOptions(maxAge) {
    return { httpOnly: true, sameSite: 'strict', secure: isProd, path: '/', maxAge };
  }

  return {
    isAuthenticated,

    requireAdmin(req, res, next) {
      if (isAuthenticated(req)) return next();
      next(new AppError(401, 'Please sign in'));
    },

    login(req, res) {
      if (!adminPassword) throw new AppError(503, 'Admin sign-in is not configured (set ADMIN_PASSWORD).');

      const now = Date.now();
      const entry = attempts.get(req.ip);
      if (entry && entry.resetAt > now && entry.count >= MAX_LOGIN_ATTEMPTS) {
        throw new AppError(429, 'Too many attempts. Try again in a few minutes.');
      }
      if (!safeEqual(req.body?.password ?? '', adminPassword)) {
        const fresh = !entry || entry.resetAt <= now;
        attempts.set(req.ip, { count: fresh ? 1 : entry.count + 1, resetAt: fresh ? now + LOGIN_WINDOW_MS : entry.resetAt });
        throw new AppError(401, 'Incorrect password');
      }

      attempts.delete(req.ip);
      const expires = now + SESSION_MS;
      res.cookie(COOKIE, `${expires}.${sign(expires)}`, cookieOptions(SESSION_MS));
      res.json({ ok: true });
    },

    logout(req, res) {
      res.clearCookie(COOKIE, cookieOptions(undefined));
      res.json({ ok: true });
    },
  };
}
