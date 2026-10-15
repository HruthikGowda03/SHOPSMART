/**
 * HTTP layer. Routes only validate input and shape responses -
 * all business logic lives in services.ts / pricing.ts.
 */

import { Router } from 'express';
import { ApiError, badRequest } from './errors.js';
import { getProducts, getOneProduct, checkout, createCart, getCart, addToCart, setItemQuantity, removeItem, clearCart, getSummary, listOrders } from './services.js';
import { resetData, resetEverything, resetForTests, store, listProducts, getProduct } from './store.js';
import type { CartItem, DemoMode } from './types.js';

export const router: Router = Router();

function requireMode(raw: unknown): DemoMode {
  if (raw !== 'buggy' && raw !== 'fixed') {
    throw badRequest('Mode must be either "buggy" or "fixed".', { received: raw });
  }
  return raw;
}

/* ---------------------------------------------------------------- */
/* Health, mode and demo data                                       */
/* ---------------------------------------------------------------- */

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'shopsmart-server',
    mode: store.mode,
    products: listProducts().length,
    carts: store.carts.size,
    orders: store.orders.length,
    time: new Date().toISOString(),
  });
});

router.get('/mode', (_req, res) => {
  res.json({ ok: true, mode: store.mode });
});

/** Switches the demonstration mode on the server. */
router.post('/mode', (req, res) => {
  store.mode = requireMode(req.body?.mode);
  res.json({
    ok: true,
    mode: store.mode,
    message:
      store.mode === 'buggy'
        ? 'BUGGY VERSION active: all four teaching bugs are enabled.'
        : 'FIXED VERSION active: all four bugs are corrected.',
  });
});

/** Full demo reset - clears carts, orders, restores stock and returns to FIXED mode. */
router.post('/demo/reset', (_req, res) => {
  resetEverything();
  res.json({ ok: true, mode: store.mode, message: 'Demo reset. Carts and orders cleared, stock restored, mode set to FIXED.' });
});

/* ---------------------------------------------------------------- */
/* Test helpers (used by the Bug Lab before each test)               */
/* ---------------------------------------------------------------- */

/** Clears orders and restores stock. The selected mode and carts are kept. */
router.post('/test/reset', (_req, res) => {
  resetForTests();
  res.json({ ok: true, mode: store.mode, message: 'Test data reset. Stock restored and orders cleared.' });
});

/** Sets the stock of one product so a test scenario is fully reproducible. */
router.post('/test/stock', (req, res) => {
  const { productId, stock } = req.body ?? {};
  const product = getProduct(String(productId ?? ''));
  if (!product) throw badRequest(`No product with id "${productId}".`);
  const value = Number(stock);
  if (!Number.isInteger(value)) throw badRequest('Stock must be a whole number.', { received: stock });
  product.stock = value;
  res.json({ ok: true, productId: product.id, name: product.name, stock: product.stock });
});

/* ---------------------------------------------------------------- */
/* Products                                                          */
/* ---------------------------------------------------------------- */

router.get('/products', (_req, res) => {
  res.json({ ok: true, products: getProducts(), currency: 'INR' });
});

router.get('/products/:id', (req, res) => {
  res.json({ ok: true, product: getOneProduct(req.params.id) });
});

/* ---------------------------------------------------------------- */
/* Carts                                                             */
/* ---------------------------------------------------------------- */

router.post('/cart', (req, res) => {
  const items = Array.isArray(req.body?.items) ? (req.body.items as CartItem[]) : [];
  const cart = createCart(
    items.map((item) => ({ productId: String(item.productId), quantity: Number(item.quantity), removed: false })),
  );
  res.status(201).json({ ok: true, cart, summary: getSummary(cart.id) });
});

router.get('/cart/:id', (req, res) => {
  const cart = getCart(req.params.id);
  res.json({ ok: true, cart, summary: getSummary(cart.id) });
});

router.post('/cart/:id/items', (req, res) => {
  const { productId, quantity = 1 } = req.body ?? {};
  if (!productId) throw badRequest('productId is required.');
  const cart = addToCart(getCart(req.params.id), String(productId), quantity);
  res.status(201).json({ ok: true, cart, summary: getSummary(cart.id) });
});

router.put('/cart/:id/items', (req, res) => {
  const { productId, quantity } = req.body ?? {};
  if (!productId) throw badRequest('productId is required.');
  const cart = setItemQuantity(getCart(req.params.id), String(productId), quantity);
  res.json({ ok: true, cart, summary: getSummary(cart.id) });
});

router.delete('/cart/:id/items/:productId', (req, res) => {
  const cart = removeItem(getCart(req.params.id), req.params.productId);
  res.json({ ok: true, cart, summary: getSummary(cart.id) });
});

router.delete('/cart/:id', (req, res) => {
  const cart = clearCart(getCart(req.params.id));
  res.json({ ok: true, cart, summary: getSummary(cart.id) });
});

/** Order summary: subtotal, shipping fee and totals, always recalculated server-side. */
router.get('/cart/:id/summary', (req, res) => {
  const cart = getCart(req.params.id);
  res.json({ ok: true, mode: store.mode, summary: getSummary(cart.id) });
});

/* ---------------------------------------------------------------- */
/* Checkout and orders                                               */
/* ---------------------------------------------------------------- */

router.post('/checkout', (req, res) => {
  const { cartId, paymentAmount } = req.body ?? {};
  if (!cartId) throw badRequest('cartId is required.');
  const result = checkout({ cartId: String(cartId), paymentAmount });
  res.status(201).json({
    ok: true,
    mode: store.mode,
    order: result.order,
    summary: result.summary,
    message: result.message,
  });
});

router.get('/orders', (_req, res) => {
  res.json({ ok: true, orders: listOrders(), mode: store.mode });
});

/* ---------------------------------------------------------------- */
/* Fallback + error handler (kept here for a single-file view)      */
/* ---------------------------------------------------------------- */

router.use((req, _res) => {
  throw new ApiError(404, 'NOT_FOUND', `No API route matches ${req.method} ${req.originalUrl}.`);
});