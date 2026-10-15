/** Types shared with the Express API (see server/src/types.ts). */

export type DemoMode = 'buggy' | 'fixed';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  image: string;
  unit: string;
  stock: number;
}

export interface CartItem {
  productId: string;
  quantity: number;
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
  expectedTotal: number;
  chargedTotal: number;
  paymentAmount: number;
  status: string;
  stockAfter: Record<string, number>;
}

export interface OrderSummary {
  cartId: string;
  mode: DemoMode;
  currency: 'INR';
  items: OrderLine[];
  ghostItems: OrderLine[];
  activeSubtotal: number;
  ghostSubtotal: number;
  subtotal: number;
  shippingFee: number;
  shipping: { fee: number; freeAbove: number; freeShippingApplied: boolean };
  displayedTotal: number;
  expectedTotal: number;
  totalsMatch: boolean;
  itemCount: number;
}

export type View = 'shop' | 'cart' | 'checkout' | 'confirmation';

export interface Notice {
  kind: 'success' | 'error' | 'info';
  text: string;
}