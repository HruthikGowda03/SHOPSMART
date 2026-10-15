/**
 * Stateless demo session.
 *
 * WHY THIS EXISTS
 * ---------------
 * The ShopSmart API keeps everything in memory: the demonstration mode, stock
 * levels, carts and orders. That is fine on a laptop, but Vercel runs the API
 * as serverless functions: each request can land on a different instance, and
 * instances are recycled when idle. In-memory state would randomly disappear
 * between two requests (empty carts, mode snapping back to "fixed").
 *
 * The fix keeps the project simple - no database, no external service. The
 * mutable part of the store travels with the *client* in a cookie that is
 * signed with HMAC-SHA256:
 *
 *   - httpOnly  -> page JavaScript cannot read or edit it
 *   - signed    -> the signature proves it came from this API, so a visitor
 *                  cannot hand-edit the mode or the stock levels
 *   - catalogue prices are NEVER part of the cookie; every rupee is still
 *     recalculated on the server from SEED_PRODUCTS
 *
 * Locally the very same middleware runs, so `npm run dev` behaves exactly the
 * same as the deployed site.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Cart, DemoMode, Order } from './types.js';

export const COOKIE_NAME = 'shopsmart_session';

/** Cookies are capped at ~4 KB by browsers, so keep well under that. */
const MAX_TOKEN_BYTES = 3600;
const MAX_CARTS = 12;

/**
 * Used only when SESSION_SECRET is not set (local development). Set the
 * variable in Vercel for the deployed demo - see .env.example.
 */
const DEV_SECRET = 'shopsmart-local-development-secret-do-not-use-in-production';

/** Everything that has to survive between requests. */
export interface StoreState {
  mode: DemoMode;
  /** productId -> current stock level (only differences from the catalogue). */
  stock: Record<string, number>;
  carts: Record<string, Cart>;
  orders: Order[];
  cartCounter: number;
  orderCounter: number;
}

function secret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** base64url(json) + "." + base64url(hmac) */
export function serialize(state: StoreState): string {
  const payload = Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Returns null for a missing, malformed or tampered-with token. */
export function deserialize(token: string | undefined): StoreState | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    return null;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as StoreState;
    if (!parsed || typeof parsed !== 'object' || !parsed.carts) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Encodes the state, shedding the least important data first if the cookie
 * would be too large for a browser.
 */
export function serializeFitted(state: StoreState): string {
  const sizes = [12, 6, 3, 0];
  for (const keepOrders of sizes) {
    const attempt: StoreState = { ...state, orders: state.orders.slice(-keepOrders) };
    // Carts are ordered oldest-activity-first by store.snapshot(), so keeping
    // the tail preserves the carts the presenter is actually using.
    const carts = Object.fromEntries(Object.entries(attempt.carts).slice(-MAX_CARTS));
    attempt.carts = carts;
    const token = serialize(attempt);
    if (Buffer.byteLength(token, 'utf8') <= MAX_TOKEN_BYTES) return token;
  }
  // Absolute fallback: just the mode and the counters.
  return serialize({ ...state, orders: [], carts: {} });
}

export function readCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function writeCookie(res: Response, token: string): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=604800',
  ];
  // "Secure" would be ignored on http://localhost, so only add it in production.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}