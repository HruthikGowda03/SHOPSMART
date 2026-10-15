/**
 * Global shop state.
 *
 * Important design rule of this demo: the browser never decides a price.
 * It asks the server for the order summary and renders whatever the server
 * says - in BUGGY mode the server says the wrong thing on purpose.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ApiError,
  addCartItem,
  clearCart as clearCartApi,
  createCart,
  getCart,
  getMode,
  getProducts,
  getSummary,
  removeCartItem,
  resetDemo as resetDemoApi,
  setCartItemQuantity,
  setModeApi,
  checkout as checkoutApi,
} from './api';
import type { Cart, DemoMode, Notice, Order, OrderSummary, Product, View } from './types';

const CART_KEY = 'shopsmart.cartId';

export interface CheckoutResult {
  ok: boolean;
  order?: Order;
  message: string;
  code?: string;
}

interface ShopContextValue {
  mode: DemoMode;
  products: Product[];
  cart: Cart | null;
  summary: OrderSummary | null;
  view: View;
  lastOrder: Order | null;
  notice: Notice | null;
  loading: boolean;
  busy: boolean;
  backendOnline: boolean;
  cartCount: number;
  setMode: (mode: DemoMode) => Promise<void>;
  setView: (view: View) => void;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  changeQuantity: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  emptyCart: () => Promise<void>;
  placeOrder: (amount: number) => Promise<CheckoutResult>;
  resetDemo: () => Promise<void>;
  refresh: () => Promise<void>;
  dismissNotice: () => void;
  notify: (notice: Notice) => void;
}

const ShopContext = createContext<ShopContextValue | null>(null);

function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

/** Fallback name for a toast when the product has already left the summary. */
function getProductName(products: Product[], productId: string): string {
  return products.find((product) => product.id === productId)?.name ?? productId;
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DemoMode>('fixed');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [view, setView] = useState<View>('shop');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const cartIdRef = useRef<string | null>(null);
  const bootedRef = useRef(false);
  /**
   * Guards against two cart mutations being in flight at once. The API is
   * stateless (state travels in a signed cookie), so overlapping requests
   * would both start from the same snapshot and one increment would be lost.
   */
  const inFlight = useRef(false);

  const notify = useCallback((next: Notice) => setNotice(next), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const loadProducts = useCallback(async () => {
    const data = await getProducts();
    setProducts(data.products);
  }, []);

  /** Loads the saved cart (or creates one) and refreshes the server summary. */
  const loadCart = useCallback(async () => {
    const savedId = cartIdRef.current ?? window.localStorage.getItem(CART_KEY);
    if (savedId) {
      try {
        const data = await getCart(savedId);
        cartIdRef.current = data.cart.id;
        window.localStorage.setItem(CART_KEY, data.cart.id);
        setCart(data.cart);
        setSummary(data.summary);
        return;
      } catch {
        // The cart was wiped by a demo reset - start a fresh one.
        window.localStorage.removeItem(CART_KEY);
        cartIdRef.current = null;
      }
    }
    const data = await createCart();
    cartIdRef.current = data.cart.id;
    window.localStorage.setItem(CART_KEY, data.cart.id);
    setCart(data.cart);
    setSummary(data.summary);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const modeData = await getMode();
      setModeState(modeData.mode);
      await loadProducts();
      await loadCart();
      setBackendOnline(true);
    } catch (error) {
      setBackendOnline(false);
      setNotice({ kind: 'error', text: messageOf(error) });
    } finally {
      setLoading(false);
    }
  }, [loadCart, loadProducts]);

  useEffect(() => {
    // Guard against React StrictMode running the effect twice in development.
    if (bootedRef.current) return;
    bootedRef.current = true;
    void refresh();
  }, [refresh]);

  /** Runs a cart mutation and stores the summary the server returned. */
  const runCartAction = useCallback(
    async (action: (cartId: string) => Promise<{ cart: Cart; summary: OrderSummary }>) => {
      if (!cartIdRef.current || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const data = await action(cartIdRef.current);
        setCart(data.cart);
        setSummary(data.summary);
        setBackendOnline(true);
      } catch (error) {
        setNotice({ kind: 'error', text: messageOf(error) });
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [],
  );

  const setMode = useCallback(
    async (next: DemoMode) => {
      setBusy(true);
      try {
        const data = await setModeApi(next);
        setModeState(data.mode);
        // Prices may change with the mode, so pull a fresh summary from the server.
        if (cartIdRef.current) {
          const data2 = await getSummary(cartIdRef.current);
          setSummary(data2.summary);
        }
        await loadProducts();
      } catch (error) {
        // Mode errors are presenter-facing: report them without a storefront toast.
        console.warn('Could not switch demonstration mode:', messageOf(error));
      } finally {
        setBusy(false);
      }
    },
    [loadProducts],
  );

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      if (!cartIdRef.current || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const data = await addCartItem(cartIdRef.current, productId, quantity);
        setCart(data.cart);
        setSummary(data.summary);
        const added = data.summary.items.find((line) => line.productId === productId);
        const name = added?.name ?? getProductName(products, productId);
        notify({ kind: 'success', text: `Added ${quantity} × ${name} to your cart.` });
      } catch (error) {
        notify({ kind: 'error', text: messageOf(error) });
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [notify, products],
  );

  const changeQuantity = useCallback(
    async (productId: string, quantity: number) => {
      await runCartAction((cartId) => setCartItemQuantity(cartId, productId, quantity));
    },
    [runCartAction],
  );

  const removeItem = useCallback(
    async (productId: string) => {
      await runCartAction((cartId) => removeCartItem(cartId, productId));
    },
    [runCartAction],
  );

  const emptyCart = useCallback(async () => {
    await runCartAction((cartId) => clearCartApi(cartId));
  }, [runCartAction]);

  const placeOrder = useCallback(
    async (amount: number): Promise<CheckoutResult> => {
      if (!cartIdRef.current) return { ok: false, message: 'No cart yet.' };
      setBusy(true);
      try {
        const data = await checkoutApi(cartIdRef.current, amount);
        setLastOrder(data.order);
        // The basket is emptied server-side; reload it so the cart matches.
        await loadCart();
        await loadProducts();
        setView('confirmation');
        setNotice({ kind: 'success', text: data.message });
        return { ok: true, order: data.order, message: data.message };
      } catch (error) {
        const message = messageOf(error);
        setNotice({ kind: 'error', text: message });
        const code = error instanceof ApiError ? error.code : 'ERROR';
        return { ok: false, message, code };
      } finally {
        setBusy(false);
      }
    },
    [loadCart, loadProducts],
  );

  const resetDemo = useCallback(async () => {
    setBusy(true);
    try {
      const data = await resetDemoApi();
      window.localStorage.removeItem(CART_KEY);
      cartIdRef.current = null;
      setLastOrder(null);
      setView('shop');
      setNotice({ kind: 'info', text: `${data.message} Reloading...` });
      // Reloading guarantees a completely clean, reproducible starting point.
      window.setTimeout(() => window.location.reload(), 400);
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) });
      setBusy(false);
    }
  }, []);

  const cartCount = summary ? summary.itemCount : 0;

  const value = useMemo<ShopContextValue>(
    () => ({
      mode,
      products,
      cart,
      summary,
      view,
      lastOrder,
      notice,
      loading,
      busy,
      backendOnline,
      cartCount,
      setMode,
      setView,
      addItem,
      changeQuantity,
      removeItem,
      emptyCart,
      placeOrder,
      resetDemo,
      refresh,
      dismissNotice,
      notify,
    }),
    [
      mode,
      products,
      cart,
      summary,
      view,
      lastOrder,
      notice,
      loading,
      busy,
      backendOnline,
      cartCount,
      setMode,
      addItem,
      changeQuantity,
      removeItem,
      emptyCart,
      placeOrder,
      resetDemo,
      refresh,
      dismissNotice,
      notify,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used inside <ShopProvider>.');
  return context;
}