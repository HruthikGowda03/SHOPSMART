/**
 * Bug Lab - the four reproducible tests.
 *
 * Each test creates its OWN isolated cart on the server (so your shopping cart
 * is never touched), resets stock first so the scenario is identical every
 * time, and then talks to the real HTTP API. Nothing here fakes a result:
 * the PASS/FAIL verdict is computed from the server's own responses.
 */

import { ApiError, checkout, createCart, getOrders, getProducts, getSummary, removeCartItem, resetTestData, setTestStock } from '../api';
import type { TraceStep } from '../api';
import { formatINR } from '../money';
import type { DemoMode, Order } from '../types';

/** What a test needs to build a cart - `removed` is always server controlled. */
type CartSeed = { productId: string; quantity: number };

export type TestId = 'payment-amount' | 'shipping-fee' | 'removed-item' | 'out-of-stock';

export interface TestDefinition {
  id: TestId;
  button: string;
  name: string;
  bug: string;
  scenario: string;
}

export interface TestResult {
  id: TestId;
  name: string;
  bug: string;
  scenario: string;
  mode: DemoMode;
  expected: string;
  actual: string;
  passed: boolean;
  explanation: string;
  trace: TraceStep[];
  ranAt: string;
  durationMs: number;
}

export const TEST_DEFINITIONS: TestDefinition[] = [
  {
    id: 'payment-amount',
    button: '1. Test incorrect payment amount',
    name: 'Incorrect payment amount',
    bug: 'Bug 1 - the server trusts the amount typed by the customer.',
    scenario: 'Cart: Nimbus Mechanical Keyboard x1. The shopper pays Rs.100 for a Rs.1,799 order.',
  },
  {
    id: 'shipping-fee',
    button: '2. Test missing shipping fee',
    name: 'Missing shipping fee',
    bug: 'Bug 2 - the shipping fee never reaches the final amount charged.',
    scenario: 'Cart: Lumen Arc Desk Lamp x1 + Drift Insulated Bottle x1 (Rs.1,448 + Rs.49 shipping).',
  },
  {
    id: 'removed-item',
    button: '3. Test removed item still charged',
    name: 'Removed item still charged',
    bug: 'Bug 3 - a removed line stays inside the calculated subtotal.',
    scenario: 'Cart: Drift Insulated Bottle x1 + Lumen Arc Desk Lamp x1, then the bottle is removed.',
  },
  {
    id: 'out-of-stock',
    button: '4. Test ordering an out-of-stock product',
    name: 'Out-of-stock product can be ordered',
    bug: 'Bug 4 - no inventory check before the order is accepted.',
    scenario: 'Solstice Bluetooth Speaker is forced to 0 stock, then one is ordered.',
  },
];

const ALL_IDS = TEST_DEFINITIONS.map((test) => test.id);

/** Small helper so each test reads as a short story. */
async function attemptCheckout(trace: TraceStep[], cartId: string, amount: number) {
  try {
    const data = await checkout(cartId, amount, trace);
    return { accepted: true as const, order: data.order, message: data.message, error: null as ApiError | null };
  } catch (error) {
    return {
      accepted: false as const,
      order: null as Order | null,
      message: '',
      error: error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', String(error)),
    };
  }
}

async function stockOf(productId: string, trace: TraceStep[]): Promise<number> {
  const data = await getProducts(trace);
  return data.products.find((product) => product.id === productId)?.stock ?? 0;
}

async function cartWith(items: CartSeed[], trace: TraceStep[]) {
  return createCart(items, trace);
}

/* ================================================================== */
/* Bug 1 - incorrect payment amount                                    */
/* ================================================================== */

async function runPaymentAmountTest(mode: DemoMode): Promise<TestResult> {
  const trace: TraceStep[] = [];
  const started = Date.now();
  await resetTestData(trace);
  const ordersBefore = (await getOrders(trace)).orders.length;
  const { cart } = await cartWith([{ productId: 'nimbus-keyboard', quantity: 1 }], trace);
  const { summary } = await getSummary(cart.id, trace);

  const amountPaid = 100; // deliberately far too little
  const result = await attemptCheckout(trace, cart.id, amountPaid);
  const ordersAfter = (await getOrders(trace)).orders.length;

  const rejectedCleanly = !result.accepted && ordersAfter === ordersBefore;
  const passed = rejectedCleanly;
  const shortfall = summary.expectedTotal - amountPaid;

  const actual = result.accepted
    ? `The order was ACCEPTED. ${formatINR(amountPaid)} was charged for goods worth ${formatINR(
        summary.expectedTotal,
      )}. A shortfall of ${formatINR(shortfall)} went unnoticed.`
    : `The order was REJECTED with "${result.error?.code}: ${result.error?.message}" and no order was created (orders before ${ordersBefore}, after ${ordersAfter}).`;

  return {
    id: 'payment-amount',
    name: 'Incorrect payment amount',
    bug: 'Bug 1 - the server trusts the amount typed by the customer.',
    scenario: 'Cart: Nimbus Mechanical Keyboard x1. The shopper pays Rs.100 for a Rs.1,799 order.',
    mode,
    expected: `Checkout is rejected because ${formatINR(amountPaid)} does not match the server-calculated total of ${formatINR(summary.expectedTotal)}, and no order is created.`,
    actual,
    passed,
    explanation:
      'BUG: the checkout accepted whatever number the browser sent, so a customer could pay Rs.1 for a Rs.1,799 basket. FIX: the server reprices the cart from its own catalogue (prices + quantities + shipping rule) and rejects the payment with 402 PAYMENT_AMOUNT_MISMATCH when the submitted amount differs. The client is never trusted for a total.',
    trace,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

/* ================================================================== */
/* Bug 2 - missing shipping fee                                        */
/* ================================================================== */

async function runShippingFeeTest(mode: DemoMode): Promise<TestResult> {
  const trace: TraceStep[] = [];
  const started = Date.now();
  await resetTestData(trace);
  const { cart } = await cartWith(
    [
      { productId: 'lumen-lamp', quantity: 1 },
      { productId: 'drift-bottle', quantity: 1 },
    ],
    trace,
  );
  const { summary } = await getSummary(cart.id, trace);

  // The customer pays exactly what the website asked for (displayedTotal).
  const amountPaid = summary.displayedTotal;
  const result = await attemptCheckout(trace, cart.id, amountPaid);
  const order = result.order;
  const shippingCharged = order ? order.chargedTotal - order.subtotal : 0;
  const passed = Boolean(order && order.shippingFee === summary.shipping.fee && shippingCharged === order.shippingFee);

  const actual = order
    ? `Subtotal ${formatINR(order.subtotal)} + shipping fee ${formatINR(order.shippingFee)} should mean ${formatINR(
        order.expectedTotal,
      )}, but the simulated payment was ${formatINR(order.chargedTotal)} (the website told the customer to pay ${formatINR(
        amountPaid,
        )}). Shipping actually charged: ${formatINR(shippingCharged)}.`
    : `Checkout was rejected with "${result.error?.code}" so the shipping fee was never lost, but the test expected an order to show the fee being applied.`;

  return {
    id: 'shipping-fee',
    name: 'Missing shipping fee',
    bug: 'Bug 2 - the shipping fee never reaches the final amount charged.',
    scenario: 'Cart: Lumen Arc Desk Lamp x1 + Drift Insulated Bottle x1 (Rs.1,448 + Rs.49 shipping).',
    mode,
    expected: `The amount charged equals subtotal + shipping fee = ${formatINR(summary.expectedTotal)} (${formatINR(summary.subtotal)} + ${formatINR(summary.shippingFee)}).`,
    actual,
    passed,
    explanation:
      'BUG: the summary showed a shipping fee but the final amount was calculated as the subtotal alone, so delivery was never paid for. FIX: the server adds the applicable shipping rule (flat fee, waived above the free-shipping threshold) into the same total it shows in the order summary and later charges.',
    trace,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

/* ================================================================== */
/* Bug 3 - removed item still charged                                 */
/* ================================================================== */

async function runRemovedItemTest(mode: DemoMode): Promise<TestResult> {
  const trace: TraceStep[] = [];
  const started = Date.now();
  await resetTestData(trace);
  const { cart } = await cartWith(
    [
      { productId: 'drift-bottle', quantity: 1 },
      { productId: 'lumen-lamp', quantity: 1 },
    ],
    trace,
  );
  const beforeRemove = (await getSummary(cart.id, trace)).summary;
  await removeCartItem(cart.id, 'drift-bottle', trace);
  const { summary } = await getSummary(cart.id, trace);

  const result = await attemptCheckout(trace, cart.id, summary.displayedTotal);
  const order = result.order;

  const ghostTotal = summary.ghostItems.reduce((sum, line) => sum + line.lineTotal, 0);
  const totalsAgree = summary.displayedTotal === summary.expectedTotal;
  const passed = summary.ghostItems.length === 0 && totalsAgree && Boolean(order && order.items.length === 1);

  const actual = `Before removing anything the total was ${formatINR(beforeRemove.displayedTotal)}. After removing the ${formatINR(
    summary.ghostSubtotal || ghostTotal,
  )} bottle the website still asks for ${formatINR(summary.displayedTotal)}, while the cart genuinely only contains ${formatINR(
    summary.activeSubtotal,
  )} of goods (server truth: ${formatINR(summary.expectedTotal)}).` +
    (order
      ? ` The order was charged ${formatINR(order.chargedTotal)} for ${order.items.length} line item(s).`
      : ' Checkout was rejected.');

  return {
    id: 'removed-item',
    name: 'Removed item still charged',
    bug: 'Bug 3 - a removed line stays inside the calculated subtotal.',
    scenario: 'Cart: Drift Insulated Bottle x1 + Lumen Arc Desk Lamp x1, then the bottle is removed.',
    mode,
    expected: `Removing the bottle leaves only ${formatINR(summary.activeSubtotal)} of goods, so the total must drop to ${formatINR(summary.expectedTotal)} and no removed line may be charged.`,
    actual,
    passed,
    explanation:
      'BUG: deleting a line only hid it on screen; the row was still summed inside the subtotal, so the customer kept paying for an item they threw away. FIX: the subtotal is rebuilt from the cart items that are actually present on every request, so a removal updates the screen and the backend calculation at the same time.',
    trace,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

/* ================================================================== */
/* Bug 4 - out-of-stock product can be ordered                         */
/* ================================================================== */

async function runOutOfStockTest(mode: DemoMode): Promise<TestResult> {
  const trace: TraceStep[] = [];
  const started = Date.now();
  await resetTestData(trace);
  await setTestStock('solstice-speaker', 0, trace);

  const { cart } = await cartWith([{ productId: 'solstice-speaker', quantity: 1 }], trace);
  const { summary } = await getSummary(cart.id, trace);
  const ordersBefore = (await getOrders(trace)).orders.length;

  const result = await attemptCheckout(trace, cart.id, summary.expectedTotal);
  const ordersAfter = (await getOrders(trace)).orders.length;
  const stockAfterOrder = await stockOf('solstice-speaker', trace);

  const stockUnchanged = stockAfterOrder === 0;
  const noOrderCreated = ordersAfter === ordersBefore;
  const passed = !result.accepted && stockUnchanged && noOrderCreated;

  const actual = result.accepted
    ? `The order was ACCEPTED for a product with 0 stock. Stock is now ${stockAfterOrder} (negative stock means the shop oversold) and ${ordersAfter - ordersBefore} order was created.`
    : `The order was REJECTED with "${result.error?.code}: ${result.error?.message}". Stock stayed at ${stockAfterOrder} and no order was created (orders before ${ordersBefore}, after ${ordersAfter}).`;

  return {
    id: 'out-of-stock',
    name: 'Out-of-stock product can be ordered',
    bug: 'Bug 4 - no inventory check before the order is accepted.',
    scenario: 'Solstice Bluetooth Speaker is forced to 0 stock, then one is ordered.',
    mode,
    expected: `Checkout is rejected with 409 OUT_OF_STOCK because only 0 units exist, stock stays at 0 and no order is created.`,
    actual,
    passed,
    explanation:
      'BUG: the checkout never looked at inventory, so an order was accepted for an item the warehouse does not have - and the stock counter was pushed below zero, the classic fingerprint of a missing check. FIX: the server compares every requested quantity with its own stock level before charging anything and rejects the order with 409 OUT_OF_STOCK.',
    trace,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - started,
  };
}

/* ================================================================== */

export async function runBugTest(id: TestId, mode: DemoMode): Promise<TestResult> {
  switch (id) {
    case 'payment-amount':
      return runPaymentAmountTest(mode);
    case 'shipping-fee':
      return runShippingFeeTest(mode);
    case 'removed-item':
      return runRemovedItemTest(mode);
    case 'out-of-stock':
      return runOutOfStockTest(mode);
    default:
      throw new Error(`Unknown test "${id}"`);
  }
}

export async function runAllBugTests(mode: DemoMode, onResult: (result: TestResult) => void): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const id of ALL_IDS) {
    const result = await runBugTest(id, mode);
    results.push(result);
    onResult(result);
  }
  return results;
}