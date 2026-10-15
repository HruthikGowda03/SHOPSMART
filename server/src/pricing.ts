/**
 * Pricing engine.
 *
 * This module is the heart of the demo: it contains all four deliberate bugs.
 * Every bug is guarded by `store.mode === 'buggy'` so the behaviour can be
 * switched on and off at runtime from the website.
 *
 * NOTHING in here touches a real payment service. The "payment" is a number
 * that is compared and stored in memory.
 */

import { SHIPPING_RULES, getProduct, store } from './store.js';
import type { Cart, DemoMode, OrderLine, OrderSummary } from './types.js';

interface PricedLine extends OrderLine {
  removed: boolean;
}

/** Flat shipping fee, waived above a subtotal threshold. */
export function shippingFeeFor(subtotal: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= SHIPPING_RULES.freeAbove ? 0 : SHIPPING_RULES.fee;
}

/**
 * Prices every cart line using SERVER-side prices only.
 * A client can ask for a quantity, it can never ask for a price.
 */
function priceCartItems(cart: Cart): PricedLine[] {
  return cart.items.flatMap((item) => {
    const product = getProduct(item.productId);
    if (!product) return []; // product was removed from the catalogue
    return [
      {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: product.price * item.quantity,
        removed: item.removed,
      },
    ];
  });
}

/**
 * Builds the order summary shown to the shopper.
 *
 * `displayedTotal`  - what the store asks the customer to pay (mode dependent).
 * `expectedTotal`   - what the customer genuinely owes. Always calculated the
 *                     correct way from trusted prices, for comparison.
 */
export function computeSummary(cart: Cart, mode: DemoMode = store.mode): OrderSummary {
  const priced = priceCartItems(cart);
  const active = priced.filter((line) => !line.removed);
  const removed = priced.filter((line) => line.removed);

  const activeSubtotal = active.reduce((sum, line) => sum + line.lineTotal, 0);

  // =========================================================================
  // BUG 3 - REMOVED ITEM STILL CHARGED
  // Deleting a line from the cart flags it as `removed` but keeps the row.
  // In BUGGY mode those flagged rows are still added to the subtotal, so the
  // customer keeps paying for something they removed.
  // FIX: in FIXED mode the subtotal is built from active lines only.
  // =========================================================================
  const ghostSubtotal = mode === 'buggy' ? removed.reduce((s, l) => s + l.lineTotal, 0) : 0;
  const subtotal = activeSubtotal + ghostSubtotal;
  const ghostItems = mode === 'buggy' ? removed : [];

  const shippingFee = shippingFeeFor(subtotal);

  // =========================================================================
  // BUG 2 - SHIPPING FEE MISSING
  // In BUGGY mode the shipping fee is never added to the final amount, even
  // though the summary still shows a shipping line to the customer.
  // FIX: in FIXED mode the total is subtotal + shipping fee.
  // =========================================================================
  const displayedTotal = mode === 'buggy' ? subtotal : subtotal + shippingFee;

  // Independent server truth. This is deliberately calculated without looking
  // at the demo mode: active lines only, plus the fee those lines really earn.
  const truthSubtotal = activeSubtotal;
  const truthShippingFee = shippingFeeFor(truthSubtotal);
  const expectedTotal = truthSubtotal + truthShippingFee;

  return {
    cartId: cart.id,
    mode,
    currency: 'INR',
    items: active,
    ghostItems,
    activeSubtotal,
    ghostSubtotal,
    subtotal,
    shippingFee,
    shipping: {
      fee: SHIPPING_RULES.fee,
      freeAbove: SHIPPING_RULES.freeAbove,
      freeShippingApplied: subtotal >= SHIPPING_RULES.freeAbove && subtotal > 0,
    },
    displayedTotal,
    expectedTotal,
    totalsMatch: displayedTotal === expectedTotal,
    itemCount: active.reduce((sum, line) => sum + line.quantity, 0),
  };
}