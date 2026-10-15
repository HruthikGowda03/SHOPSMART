/**
 * Tiny API client.
 *
 * Every call goes through `request()`, which:
 *  - sends JSON,
 *  - converts a failed response into a readable `ApiError`,
 *  - optionally records the call in a trace array (used by the Bug Lab so you
 *    can show the real HTTP traffic behind each test).
 */

import type { Cart, Order, OrderSummary, Product, DemoMode } from './types';

export interface TraceStep {
  method: string;
  path: string;
  request?: unknown;
  status: number;
  response: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown, trace?: TraceStep[]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const message = 'Cannot reach the ShopSmart API. Is the backend running on http://localhost:4000 ?';
    trace?.push({ method, path, request: body, status: 0, response: { error: message } });
    throw new ApiError(0, 'NETWORK_ERROR', message);
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  trace?.push({ method, path, request: body, status: response.status, response: payload });

  if (!response.ok) {
    const errorBody = (payload as { error?: { code: string; message: string; details?: Record<string, unknown> } })?.error;
    throw new ApiError(
      response.status,
      errorBody?.code ?? 'HTTP_ERROR',
      errorBody?.message ?? `Request failed with status ${response.status}.`,
      errorBody?.details ?? {},
    );
  }

  return payload as T;
}

/* ------------------------------------------------------------------ */
/* Mode + demo data                                                   */
/* ------------------------------------------------------------------ */

export const getMode = (trace?: TraceStep[]) => request<{ ok: true; mode: DemoMode }>('GET', '/mode', undefined, trace);
export const setModeApi = (mode: DemoMode, trace?: TraceStep[]) =>
  request<{ ok: true; mode: DemoMode; message: string }>('POST', '/mode', { mode }, trace);
export const resetDemo = (trace?: TraceStep[]) =>
  request<{ ok: true; message: string }>('POST', '/demo/reset', {}, trace);
export const resetTestData = (trace?: TraceStep[]) =>
  request<{ ok: true; message: string }>('POST', '/test/reset', {}, trace);
export const setTestStock = (productId: string, stock: number, trace?: TraceStep[]) =>
  request<{ ok: true; stock: number }>('POST', '/test/stock', { productId, stock }, trace);

/* ------------------------------------------------------------------ */
/* Products                                                           */
/* ------------------------------------------------------------------ */

export const getProducts = (trace?: TraceStep[]) =>
  request<{ ok: true; products: Product[]; currency: string }>('GET', '/products', undefined, trace);

/* ------------------------------------------------------------------ */
/* Cart                                                               */
/* ------------------------------------------------------------------ */

export interface CartResponse {
  ok: true;
  cart: Cart;
  summary: OrderSummary;
}

/** Items accepted when creating a cart - `removed` is always decided by the server. */
export interface CartSeed {
  productId: string;
  quantity: number;
}

export const createCart = (items: CartSeed[] = [], trace?: TraceStep[]) =>
  request<CartResponse>('POST', '/cart', { items }, trace);

export const getCart = (cartId: string, trace?: TraceStep[]) =>
  request<CartResponse>('GET', `/cart/${cartId}`, undefined, trace);

export const addCartItem = (cartId: string, productId: string, quantity: number, trace?: TraceStep[]) =>
  request<CartResponse>('POST', `/cart/${cartId}/items`, { productId, quantity }, trace);

export const setCartItemQuantity = (cartId: string, productId: string, quantity: number, trace?: TraceStep[]) =>
  request<CartResponse>('PUT', `/cart/${cartId}/items`, { productId, quantity }, trace);

export const removeCartItem = (cartId: string, productId: string, trace?: TraceStep[]) =>
  request<CartResponse>('DELETE', `/cart/${cartId}/items/${productId}`, undefined, trace);

export const clearCart = (cartId: string, trace?: TraceStep[]) =>
  request<CartResponse>('DELETE', `/cart/${cartId}`, undefined, trace);

export const getSummary = (cartId: string, trace?: TraceStep[]) =>
  request<{ ok: true; mode: DemoMode; summary: OrderSummary }>('GET', `/cart/${cartId}/summary`, undefined, trace);

/* ------------------------------------------------------------------ */
/* Checkout                                                           */
/* ------------------------------------------------------------------ */

export const checkout = (cartId: string, paymentAmount: number, trace?: TraceStep[]) =>
  request<{ ok: true; order: Order; summary: OrderSummary; message: string }>(
    'POST',
    '/checkout',
    { cartId, paymentAmount },
    trace,
  );

export const getOrders = (trace?: TraceStep[]) =>
  request<{ ok: true; orders: Order[]; mode: DemoMode }>('GET', '/orders', undefined, trace);