/**
 * Shared domain types for the ShopSmart demo API.
 *
 * Every number in this file is an amount in whole rupees (INR).
 * Money is stored as a plain integer to avoid floating point surprises.
 */

export type DemoMode = 'buggy' | 'fixed';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  /** Server-controlled unit price. The client is NEVER trusted for this value. */
  price: number;
  image: string;
  unit: string;
  /** Current stock level (server-controlled). Can go negative in BUGGY mode on purpose. */
  stock: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
  /**
   * A removed item is flagged instead of deleted.
   * In FIXED mode flagged lines are ignored completely.
   * In BUGGY mode flagged lines are still added to the total (Bug 3).
   */
  removed: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  cartId: string;
  mode: DemoMode;
  placedAt: string;
  items: OrderLine[];
  subtotal: number;
  shippingFee: number;
  /** Amount the server says is genuinely owed (always correct, mode independent). */
  expectedTotal: number;
  /** Amount the (simulated) payment actually processed. */
  chargedTotal: number;
  /** Amount the client claimed to pay. */
  paymentAmount: number;
  status: string;
  /** Stock level after this order, so stock bugs become visible. */
  stockAfter: Record<string, number>;
}

export interface OrderSummary {
  cartId: string;
  mode: DemoMode;
  currency: 'INR';
  /** Items the shopper currently sees (removed items are not listed here). */
  items: OrderLine[];
  /** Removed items that are still being charged - BUG 3 only. */
  ghostItems: OrderLine[];
  activeSubtotal: number;
  ghostSubtotal: number;
  subtotal: number;
  shippingFee: number;
  shipping: {
    fee: number;
    freeAbove: number;
    freeShippingApplied: boolean;
  };
  /** Total as calculated by the (possibly buggy) pricing code. */
  displayedTotal: number;
  /** Independently calculated correct total. Never influenced by the demo mode. */
  expectedTotal: number;
  /** true when displayedTotal === expectedTotal. */
  totalsMatch: boolean;
  itemCount: number;
}

export interface ShippingRules {
  /** Flat fee in rupees. */
  fee: number;
  /** Orders at or above this subtotal ship free. */
  freeAbove: number;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}