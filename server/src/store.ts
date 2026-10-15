/**
 * In-memory data store.
 *
 * Everything lives in this process's memory and is reset when the server
 * restarts. No database is required for this educational demo.
 */

import type { Cart, DemoMode, Order, Product } from './types.js';
import type { StoreState } from './session.js';

export interface SeedProduct extends Omit<Product, 'stock'> {
  /** The stock level the catalogue is restored to by a reset. */
  baseStock: number;
}

/** Fictional catalogue. No real products, no real brands. */
export const SEED_PRODUCTS: SeedProduct[] = [
  {
    id: 'aurora-headphones',
    name: 'Aurora Studio Headphones',
    brand: 'Aurora',
    category: 'Audio',
    description: 'Over-ear wireless headphones with a 40 hour battery and memory-foam cushions.',
    price: 2499,
    image: '/products/aurora-headphones.jpg',
    unit: 'per pair',
    baseStock: 12,
  },
  {
    id: 'nimbus-keyboard',
    name: 'Nimbus Mechanical Keyboard',
    brand: 'Nimbus',
    category: 'Workspace',
    description: 'Hot-swappable mechanical keyboard with a milled aluminium case.',
    price: 1799,
    image: '/products/nimbus-keyboard.jpg',
    unit: 'per keyboard',
    baseStock: 8,
  },
  {
    id: 'pulse-watch',
    name: 'Pulse Fitness Band',
    brand: 'Pulse',
    category: 'Wearables',
    description: 'Slim activity band with heart-rate tracking and a seven day battery.',
    price: 3299,
    image: '/products/pulse-watch.jpg',
    unit: 'per band',
    baseStock: 5,
  },
  {
    id: 'vertex-earbuds',
    name: 'Vertex Wireless Earbuds',
    brand: 'Vertex',
    category: 'Audio',
    description: 'Compact true-wireless earbuds with an eight hour battery and a charging case.',
    price: 1499,
    image: '/products/vertex-earbuds.jpg',
    unit: 'per pair',
    baseStock: 0,
  },
  {
    id: 'lumen-lamp',
    name: 'Lumen Arc Desk Lamp',
    brand: 'Lumen',
    category: 'Home',
    description: 'Adjustable aluminium task lamp with three brightness levels.',
    price: 899,
    image: '/products/lumen-lamp.jpg',
    unit: 'per lamp',
    baseStock: 20,
  },
  {
    id: 'voyager-backpack',
    name: 'Voyager Commuter Backpack',
    brand: 'Voyager',
    category: 'Bags',
    description: 'Water resistant 20L backpack with a padded 16 inch laptop sleeve.',
    price: 1299,
    image: '/products/voyager-backpack.jpg',
    unit: 'per backpack',
    baseStock: 6,
  },
  {
    id: 'drift-bottle',
    name: 'Drift Insulated Bottle',
    brand: 'Drift',
    category: 'Lifestyle',
    description: 'Double walled steel bottle that keeps drinks cold for 24 hours.',
    price: 549,
    image: '/products/drift-bottle.jpg',
    unit: 'per bottle',
    baseStock: 25,
  },
  {
    id: 'solstice-speaker',
    name: 'Solstice Bluetooth Speaker',
    brand: 'Solstice',
    category: 'Audio',
    description: 'Rugged portable speaker with 360 degree sound and 16 hour playback.',
    price: 1999,
    image: '/products/solstice-speaker.jpg',
    unit: 'per speaker',
    baseStock: 4,
  },
  {
    id: 'terra-mug-set',
    name: 'Terra Ceramic Mug Set',
    brand: 'Terra',
    category: 'Kitchen',
    description: 'Set of four glazed stoneware mugs, dishwasher safe.',
    price: 449,
    image: '/products/terra-mug-set.jpg',
    unit: 'per set',
    baseStock: 30,
  },
  {
    id: 'quartz-mouse',
    name: 'Quartz Wireless Mouse',
    brand: 'Quartz',
    category: 'Accessories',
    description: 'Low-latency wireless mouse with a 70 day battery and silent clicks.',
    price: 1099,
    image: '/products/quartz-mouse.jpg',
    unit: 'per mouse',
    baseStock: 15,
  },
];

/** Shipping rules used by the server to price every order. */
export const SHIPPING_RULES = {
  fee: 49,
  freeAbove: 1500,
} as const;

interface Store {
  mode: DemoMode;
  products: Map<string, Product>;
  carts: Map<string, Cart>;
  orders: Order[];
  cartCounter: number;
  orderCounter: number;
}

function buildProducts(): Map<string, Product> {
  const map = new Map<string, Product>();
  for (const seed of SEED_PRODUCTS) {
    const { baseStock, ...product } = seed;
    map.set(product.id, { ...product, stock: baseStock });
  }
  return map;
}

export const store: Store = {
  mode: 'fixed',
  products: buildProducts(),
  carts: new Map(),
  orders: [],
  cartCounter: 0,
  orderCounter: 0,
};

/**
 * Rebuilds the mutable store for a new request. On Vercel a serverless
 * instance can be cold at any time, so this runs before every route, using the
 * state carried in the signed session cookie (see session.ts).
 */
export function hydrate(state: StoreState | null | undefined): void {
  resetStock();
  store.carts = new Map();
  store.orders = [];
  store.mode = 'fixed';
  store.cartCounter = 0;
  store.orderCounter = 0;
  if (!state) return;

  if (state.mode === 'buggy' || state.mode === 'fixed') store.mode = state.mode;

  const levels = state.stock || {};
  for (const productId of Object.keys(levels)) {
    const product = store.products.get(productId);
    const level = levels[productId];
    if (product && typeof level === 'number' && Number.isFinite(level)) product.stock = level;
  }

  const carts = state.carts || {};
  for (const cartId of Object.keys(carts)) {
    const cart = carts[cartId];
    if (cart && Array.isArray(cart.items)) store.carts.set(cartId, cart);
  }

  store.orders = Array.isArray(state.orders) ? state.orders : [];
  store.cartCounter = typeof state.cartCounter === 'number' ? state.cartCounter : store.carts.size;
  store.orderCounter = typeof state.orderCounter === 'number' ? state.orderCounter : store.orders.length;
}

/** Captures the mutable store so it can be signed into the session cookie. */
export function snapshot(): StoreState {
  const stock: Record<string, number> = {};
  for (const seed of SEED_PRODUCTS) {
    const product = store.products.get(seed.id);
    // Only differences from the catalogue are stored, to keep the cookie small.
    if (product && product.stock !== seed.baseStock) stock[seed.id] = product.stock;
  }
  // Oldest activity first, so that trimming the cookie (see serializeFitted)
  // drops the least recently used carts instead of an active one.
  const ordered = [...store.carts.values()].sort((a, b) =>
    String(a.updatedAt).localeCompare(String(b.updatedAt)),
  );

  return {
    mode: store.mode,
    stock,
    carts: Object.fromEntries(ordered.map((cart) => [cart.id, cart])),
    orders: store.orders,
    cartCounter: store.cartCounter,
    orderCounter: store.orderCounter,
  };
}

/** Restores the catalogue stock levels (used by the reset endpoints). */
export function resetStock(): void {
  for (const seed of SEED_PRODUCTS) {
    const product = store.products.get(seed.id);
    if (product) product.stock = seed.baseStock;
  }
}

/** Clears carts and orders and restores stock. Mode is left untouched. */
export function resetData(): void {
  store.carts.clear();
  store.orders = [];
  resetStock();
}

/**
 * Reset used before each Bug Lab test: orders and stock go back to normal,
 * but carts are kept so running the tests never empties a shopper's basket.
 */
export function resetForTests(): void {
  store.orders = [];
  resetStock();
}

/** Full reset used by "Reset demo": data *and* mode go back to the safe default. */
export function resetEverything(): void {
  resetData();
  store.mode = 'fixed';
}

export function getProduct(id: string): Product | undefined {
  return store.products.get(id);
}

export function listProducts(): Product[] {
  return [...store.products.values()];
}