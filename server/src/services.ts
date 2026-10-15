/**
 * Cart + checkout services.
 *
 * Bugs 1 (wrong payment amount accepted) and Bug 4 (out-of-stock order allowed)
 * live in `checkout`. Bugs 2 and 3 live in `pricing.ts`.
 */

import { ApiError, badRequest, conflict, notFound } from './errors.js';
import { computeSummary } from './pricing.js';
import { getProduct, listProducts, store } from './store.js';
import type { Cart, CartItem, DemoMode, Order, Product } from './types.js';

const MAX_QUANTITY = 20;

function nextCartId(): string {
  store.cartCounter += 1;
  return `cart_${store.cartCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function nextOrderId(): string {
  store.orderCounter += 1;
  return `SS-${String(store.orderCounter).padStart(4, '0')}`;
}

function touch(cart: Cart): Cart {
  cart.updatedAt = new Date().toISOString();
  return cart;
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export function getProducts(): Product[] {
  return listProducts();
}

export function getOneProduct(id: string): Product {
  const product = getProduct(id);
  if (!product) throw notFound(`No product with id "${id}".`);
  return product;
}

/* ------------------------------------------------------------------ */
/* Carts                                                               */
/* ------------------------------------------------------------------ */

export function createCart(items: CartItem[] = []): Cart {
  const cart: Cart = {
    id: nextCartId(),
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.carts.set(cart.id, cart);
  for (const item of items) setItemQuantity(cart, item.productId, item.quantity ?? 1);
  return touch(cart);
}

export function getCart(cartId: string): Cart {
  const cart = store.carts.get(cartId);
  if (!cart) throw notFound(`Cart "${cartId}" was not found. It may have been cleared by a demo reset.`);
  // Reading counts as using it: the stateless session cookie keeps the most
  // recently used carts, so a cart that is only being looked at must not age out.
  touch(cart);
  return cart;
}

function parseQuantity(raw: unknown): number {
  const quantity = Number(raw);
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
    throw badRequest('Quantity must be a whole number.', { received: raw });
  }
  if (quantity < 0) throw badRequest('Quantity cannot be negative.', { received: raw });
  if (quantity > MAX_QUANTITY) throw badRequest(`Quantity cannot be more than ${MAX_QUANTITY}.`, { received: raw });
  return quantity;
}

/** Adds a line or sets its quantity. Quantity 0 is treated as "remove". */
export function setItemQuantity(cart: Cart, productId: string, rawQuantity: unknown): Cart {
  const product = getProduct(productId);
  const quantity = parseQuantity(rawQuantity);

  if (quantity === 0) return removeItem(cart, productId);

  const existing = cart.items.find((item) => item.productId === productId);
  if (existing) {
    existing.quantity = quantity;
    existing.removed = false; // bringing the item back revives the row
  } else {
    cart.items.push({ productId, quantity, removed: false });
  }
  return touch(cart);
}

export function addToCart(cart: Cart, productId: string, rawQuantity: unknown): Cart {
  getProduct(productId); // 404 when the product does not exist
  const delta = parseQuantity(rawQuantity);
  if (delta < 1) throw badRequest('Use an amount of 1 or more to add a product to the cart.');
  const existing = cart.items.find((item) => item.productId === productId);

  // A removed row keeps its old quantity on purpose (Bug 3 needs that row to
  // survive so its price can stay on the bill). It must NOT be used as the
  // starting point when the shopper adds the product again, otherwise a single
  // click would resurrect the old quantity: add 3, remove, add once -> 4 units.
  // Re-adding a previously removed product therefore starts from zero.
  const base = existing && !existing.removed ? existing.quantity : 0;
  const nextQuantity = base + delta;
  if (nextQuantity > MAX_QUANTITY) {
    throw badRequest(`A maximum of ${MAX_QUANTITY} units may be ordered per product.`, {
      productId,
      requested: nextQuantity,
    });
  }
  return setItemQuantity(cart, productId, nextQuantity);
}

/**
 * Removes a line from the cart.
 *
 * The row is flagged `removed` rather than deleted so that the history of the
 * cart stays visible. FIXED mode ignores flagged rows everywhere; BUGGY mode
 * forgets to do that in `computeSummary` (Bug 3).
 */
export function removeItem(cart: Cart, productId: string): Cart {
  const existing = cart.items.find((item) => item.productId === productId);
  if (!existing) throw notFound(`"${productId}" is not in this cart.`);
  existing.removed = true;
  return touch(cart);
}

export function clearCart(cart: Cart): Cart {
  for (const item of cart.items) item.removed = true;
  return touch(cart);
}

export function getSummary(cartId: string) {
  return computeSummary(getCart(cartId), store.mode);
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

export interface CheckoutInput {
  cartId: string;
  paymentAmount: unknown;
  mode?: DemoMode;
}

/**
 * Simulated checkout. No real payment provider is contacted - the "payment"
 * is a number compared against the server's own calculation.
 */
export function checkout(input: CheckoutInput): { order: Order; summary: ReturnType<typeof computeSummary>; message: string } {
  const mode: DemoMode = input.mode ?? store.mode;
  const cart = getCart(input.cartId);
  const summary = computeSummary(cart, mode);

  if (summary.items.length === 0) {
    throw badRequest('Your cart is empty. Add at least one product before checking out.', { cartId: cart.id });
  }

  // ---------------------------------------------------------------------
  // BUG 4 - OUT-OF-STOCK PRODUCT CAN BE ORDERED
  // In BUGGY mode the stock check is skipped, so a shopper can buy an item
  // that does not exist in the warehouse. Stock is even allowed to go
  // negative, which is the classic symptom of a missing inventory check.
  // FIX: in FIXED mode every requested quantity is compared against the
  //      server's stock level before anything is charged.
  // ---------------------------------------------------------------------
  if (mode === 'fixed') {
    const unavailable = summary.items
      .filter((line) => line.quantity > (getProduct(line.productId)?.stock ?? 0))
      .map((line) => ({
        productId: line.productId,
        name: line.name,
        requested: line.quantity,
        available: getProduct(line.productId)?.stock ?? 0,
      }));
    if (unavailable.length > 0) {
      throw new ApiError(
        409,
        'OUT_OF_STOCK',
        `Not enough stock for: ${unavailable.map((u) => `${u.name} (requested ${u.requested}, available ${u.available})`).join(', ')}.`,
        { unavailable, mode },
      );
    }
  }

  // Basic input sanity check in BOTH modes: the amount must be a positive number.
  // This is not the fix for Bug 1 - it only rejects nonsense such as "abc".
  const paymentAmount = Number(input.paymentAmount);
  if (input.paymentAmount === undefined || input.paymentAmount === null || input.paymentAmount === '') {
    throw badRequest('A payment amount is required.', { cartId: cart.id });
  }
  if (!Number.isFinite(paymentAmount)) {
    throw badRequest('The payment amount must be a number.', { received: input.paymentAmount });
  }
  if (paymentAmount <= 0) {
    throw badRequest('The payment amount must be greater than zero.', { received: input.paymentAmount });
  }

  // ---------------------------------------------------------------------
  // BUG 1 - INCORRECT PAYMENT AMOUNT ACCEPTED
  // In BUGGY mode the amount typed by the customer is simply trusted, so a
  // shopper can pay Rs.1 for a Rs.1,799 order.
  // FIX: in FIXED mode the server recomputes the total from its own prices,
  //      quantities and shipping rules, and rejects any mismatch.
  // ---------------------------------------------------------------------
  if (mode === 'fixed' && paymentAmount !== summary.expectedTotal) {
    throw new ApiError(
      402,
      'PAYMENT_AMOUNT_MISMATCH',
      `Payment rejected: the server calculated Rs.${summary.expectedTotal} but Rs.${paymentAmount} was submitted.`,
      {
        expectedTotal: summary.expectedTotal,
        receivedAmount: paymentAmount,
        difference: summary.expectedTotal - paymentAmount,
        currency: 'INR',
        note: 'The server never trusts a client-supplied total. It reprices the cart itself.',
      },
    );
  }

  // BUGGY mode: charge whatever the summary said was payable (which already
  // omits shipping - Bug 2) or whatever the customer typed (Bug 1).
  const chargedTotal = mode === 'fixed' ? summary.expectedTotal : Math.min(paymentAmount, summary.displayedTotal);

  // Reduce stock. BUGGY mode happily drives stock below zero.
  const stockAfter: Record<string, number> = {};
  for (const line of summary.items) {
    const product = getProduct(line.productId);
    if (!product) continue;
    product.stock -= line.quantity;
    stockAfter[line.productId] = product.stock;
  }

  const order: Order = {
    id: nextOrderId(),
    cartId: cart.id,
    mode,
    placedAt: new Date().toISOString(),
    items: summary.items,
    subtotal: summary.subtotal,
    shippingFee: summary.shippingFee,
    expectedTotal: summary.expectedTotal,
    chargedTotal,
    paymentAmount,
    status: 'PAID',
    stockAfter,
  };
  store.orders.push(order);

  // The basket is emptied once the order is accepted.
  for (const item of cart.items) item.removed = true;
  touch(cart);

  // The confirmation message is deliberately identical in both modes: a shopper
  // (and the audience) must spot a problem from the numbers, not from a label.
  const message = `Payment of Rs.${chargedTotal} received. Order ${order.id} is confirmed.`;

  return { order, summary, message };
}

export function listOrders(): Order[] {
  return store.orders;
}