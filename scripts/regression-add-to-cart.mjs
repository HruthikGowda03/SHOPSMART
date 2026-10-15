/**
 * Regression tests for the "Add to Cart" quantity flow.
 *
 * Run with the servers already running:   npm run test:add
 *
 * Covers: one click, two separate clicks, repeated rerenders, re-adding a
 * removed item (the regression), the quantity selector, concurrent clicks, the
 * per-order cap, and a static check that the button has exactly ONE handler.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.API_URL ?? 'http://localhost:4000/api';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` :: ${detail}` : ''}`);
  }
}

let sessionCookie = '';

async function call(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionCookie) headers.Cookie = sessionCookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // The API keeps its state in a signed httpOnly cookie, so these tests must
  // behave like a browser and send it back on every call.
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const entry of setCookies) {
    if (entry.startsWith('shopsmart_session=')) sessionCookie = entry.split(';')[0];
  }
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const newCart = async () => (await call('POST', '/cart', { items: [] })).json.cart.id;
const add = (cartId, quantity, productId = 'drift-bottle') =>
  call('POST', `/cart/${cartId}/items`, { productId, quantity });
const summary = async (cartId) => (await call('GET', `/cart/${cartId}/summary`)).json.summary;
const remove = (cartId, productId = 'drift-bottle') =>
  call('DELETE', `/cart/${cartId}/items/${productId}`);
const qtyOf = (json, productId = 'drift-bottle') =>
  json.cart.items.find((item) => item.productId === productId)?.quantity ?? 0;

async function withMode(mode, fn) {
  await call('POST', '/mode', { mode });
  return fn();
}

/* ------------------------------------------------------------------ */

async function main() {
  try {
    await call('GET', '/health');
  } catch {
    console.error(`Cannot reach the API at ${BASE}. Start the servers with "npm run dev" first.`);
    process.exit(1);
  }

  console.log('\n1. One click adds exactly one unit');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    const r = await add(cartId, 1);
    check('one click -> quantity 1', qtyOf(r.json) === 1, `got ${qtyOf(r.json)}`);
    check('one click -> itemCount 1', r.json.summary.itemCount === 1, `got ${r.json.summary.itemCount}`);
    check('one click -> subtotal is one unit (Rs.549)', r.json.summary.subtotal === 549, `got ${r.json.summary.subtotal}`);
  });

  console.log('\n2. Two separate clicks add exactly two units');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    await add(cartId, 1);
    const second = await add(cartId, 1);
    check('two clicks -> quantity 2', qtyOf(second.json) === 2, `got ${qtyOf(second.json)}`);
    check('two clicks -> subtotal Rs.1,098', second.json.summary.subtotal === 1098, `got ${second.json.summary.subtotal}`);
  });

  console.log('\n3. Repeated rerenders never change the quantity');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    await add(cartId, 1);
    await add(cartId, 1);
    let stable = true;
    for (let i = 0; i < 5; i += 1) {
      const s = await summary(cartId);
      if (s.items[0].quantity !== 2) stable = false;
    }
    check('5 summary refreshes keep quantity 2', stable);
    const r = await call('GET', `/cart/${cartId}`);
    check('GET /cart does not mutate the cart', qtyOf(r.json) === 2, `got ${qtyOf(r.json)}`);
  });

  console.log('\n4. REGRESSION: adding after a removal starts from 1');
  for (const mode of ['fixed', 'buggy']) {
    await withMode(mode, async () => {
      const cartId = await newCart();
      await add(cartId, 1);
      await add(cartId, 1);
      await add(cartId, 1); // shopper now has 3
      await remove(cartId);
      const s = await summary(cartId);
      check(`[${mode}] removed item is not visible in the cart`, s.items.length === 0, `got ${s.items.length}`);
      const back = await add(cartId, 1);
      check(`[${mode}] one click after remove -> quantity 1 (not 4)`, qtyOf(back.json) === 1, `got ${qtyOf(back.json)}`);
      check(`[${mode}] itemCount back to 1`, back.json.summary.itemCount === 1, `got ${back.json.summary.itemCount}`);
    });
  }

  console.log('\n5. The quantity selector is respected on a fresh row');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    const r = await add(cartId, 3);
    check('selector 3 -> quantity 3', qtyOf(r.json) === 3, `got ${qtyOf(r.json)}`);
  });

  console.log('\n6. Overlapping requests cannot corrupt the cart');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    const results = await Promise.all([add(cartId, 1), add(cartId, 1)]);
    // The API is stateless: each request starts from the same signed cookie,
    // so overlapping adds are last-write-wins, never a corrupted quantity.
    // The browser therefore never runs two cart mutations at once (checked below).
    const quantities = results.map((r) => qtyOf(r.json));
    check('overlapping adds stay in the 1..2 range', quantities.every((q) => q >= 1 && q <= 2), JSON.stringify(quantities));
    const after = await summary(cartId);
    check('cart is still readable afterwards', after.items.length === 1, `got ${after.items.length}`);
  });
  const shopSourceForGuard = readFileSync(join(ROOT, 'client', 'src', 'shop.tsx'), 'utf8');
  check(
    'shop.tsx guards against two in-flight cart mutations',
    shopSourceForGuard.includes('inFlight.current = true') && shopSourceForGuard.includes('inFlight.current = false'),
  );

  console.log('\n7. Both modes behave identically for quantity');
  const counts = {};
  for (const mode of ['fixed', 'buggy']) {
    await withMode(mode, async () => {
      const cartId = await newCart();
      await add(cartId, 1);
      await remove(cartId);
      const r = await add(cartId, 1);
      counts[mode] = qtyOf(r.json);
    });
  }
  check('quantity handling is identical in both modes', counts.fixed === counts.buggy, JSON.stringify(counts));

  console.log('\n8. Per-order cap still enforced');
  await withMode('fixed', async () => {
    const cartId = await newCart();
    for (let i = 0; i < 20; i += 1) await add(cartId, 1);
    const overflow = await add(cartId, 1);
    check('21st unit is rejected with 400', overflow.status === 400, `status ${overflow.status}`);
  });

  console.log('\n9. Static check: the Add to Cart button has exactly one handler');
  const source = readFileSync(join(ROOT, 'client', 'src', 'components', 'ProductCard.tsx'), 'utf8');
  const buttonBlock = source.slice(source.indexOf('<button'), source.indexOf('</button>'));
  const handlers = (buttonBlock.match(/onClick=/g) ?? []).length;
  check('button declares exactly one onClick', handlers === 1, `found ${handlers}`);
  check('button calls addItem once', (buttonBlock.match(/addItem\(/g) ?? []).length === 1);
  check('button is not inside a form (no implicit submit)', !/<form/i.test(source));
  const shopSource = readFileSync(join(ROOT, 'client', 'src', 'shop.tsx'), 'utf8');
  const addFn = shopSource.slice(shopSource.indexOf('const addItem'), shopSource.indexOf('const changeQuantity'));
  check('addItem issues exactly one API call', (addFn.match(/addCartItem\(/g) ?? []).length === 1);
  check('addItem has no retry/loop', !/\b(retry|setInterval|while\s*\()/.test(addFn));

  // Leave the demo in the safe default state.
  await call('POST', '/demo/reset', {});

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`} (${passed} passed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});