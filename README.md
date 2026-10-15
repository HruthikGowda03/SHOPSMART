# ShopSmart — a store used to demonstrate manual bug hunting

A complete, working fictional online store built for an Epistemology presentation. The audience shops
like real customers and **discovers the problems themselves**; the presenter never labels them.

The backend runs in one of two modes:

| Mode | What it does |
| --- | --- |
| **Buggy mode** (presenter-only) | Four deliberate defects are active, each isolated behind the mode flag. |
| **Fixed mode** (default) | The backend reprices every cart, adds shipping, recalculates after a removal and blocks out-of-stock orders. |

Everything is simulated: fictional products, INR prices, in-memory orders, a "payment" that is a
number compared against the server's own total. **No real payment gateway, no real transactions, no
personal data, no database.**

---

## 1. Quick start (two terminals)

You need [Node.js](https://nodejs.org) 18 or newer. Check with `node -v`.

```bash
# 1. install everything (root tools + backend + frontend)
cd shopsmart
npm run install:all

# 2. start the backend and the website together
npm run dev
```

Then open **<http://localhost:5173>**.

- Backend API: <http://localhost:4000> (health check at <http://localhost:4000/api/health>)
- Frontend: <http://localhost:5173>

Press `Ctrl + C` once to stop both servers.

### If you prefer two terminals

```bash
# terminal 1 - backend on port 4000
cd shopsmart/server
npm install
npm run dev

# terminal 2 - frontend on port 5173
cd shopsmart/client
npm install
npm run dev
```

### Other commands

```bash
npm run build      # type-check + build both projects (production output)
npm run typecheck  # TypeScript errors only, both projects
npm start          # run the built backend + a preview of the built website
npm run test:add   # regression tests for the Add to Cart quantity (servers must be running)
npm run check:deploy  # checks vercel.json + the Vercel server entrypoint before you deploy
```

---

## 2. Switching modes during the presentation

The storefront never shows a mode label, a banner or a test panel. The controls are hidden in a
**presenter drawer** with three ways in:

| Gesture | Notes |
| --- | --- |
| **`Ctrl + Shift + P`** | Keyboard shortcut. Press again (or `Esc`) to close. |
| **Double-click "Store information"** in the footer | The link looks like ordinary footer text. |
| **Open <http://localhost:5173/#presenter>** | Useful if the keyboard is captured by the projector. Bookmark it. |

Inside the drawer:

- **Buggy mode** — four deliberate defects are active. **Set this before the audience arrives.**
- **Fixed mode** — all four defects are corrected. Switch to this at the end to close the demo.
- **Reset demo data** — restores stock, clears orders and empties the cart.
- **Self-check** — a collapsible suite of four reproducible checks against the real API (presenter
  only; the audience never sees it).
- **Presenter notes** — claim, question and evidence wording for your talk.

Switching modes takes effect on the server immediately; the storefront silently recalculates the cart.

---

## 3. How to run the presentation (3 minutes)

1. **Before anyone arrives:** open the site, press `Ctrl+Shift+P`, choose **Buggy mode**, press
   **Reset demo data**, then close the drawer.
2. **Ask the audience to shop.** Suggested prompts, in this order:
   - "Add two products. Does the subtotal match the items?"
   - "Check the delivery charge — is it included in the total?"
   - "Remove something. What happens to the total?"
   - "This product says *Out of stock*. Try to buy it anyway."
   - "Pay ₹1 instead of the total. Does the shop notice?"
3. **Collect their evidence.** Every problem shows up as a number that does not add up.
4. **Close the demo:** `Ctrl+Shift+P` → **Fixed mode** → **Reset demo data**. Repeat the same
   shopping steps; the totals now behave and bad payments/stock orders are refused with an explanation.

That contrast is the argument: the claim *"our shopping website works perfectly"* survives or fails
depending on the evidence, not on anyone's opinion.

---

## 4. The four defects (presenter reference)

| # | Defect | Buggy behaviour | Fixed behaviour | Where the code lives |
| --- | --- | --- | --- | --- |
| 1 | Incorrect payment amount accepted | The mock checkout accepts whatever amount is typed (pay ₹10 for a ₹948 order) | The server recalculates the total from its own prices and rejects any mismatch with `402 PAYMENT_AMOUNT_MISMATCH` | `server/src/services.ts` (`checkout`) |
| 2 | Shipping fee omitted | The shipping fee is shown in the summary but never added to the amount charged | The fee is part of the same server-calculated total that is displayed | `server/src/pricing.ts` (`computeSummary`) |
| 3 | Removed item still charged | Removing a line hides it on screen but its price stays in the subtotal | The subtotal is rebuilt from the items that are actually in the cart | `server/src/pricing.ts` + `server/src/services.ts` (`removeItem`) |
| 4 | Out-of-stock product can be ordered | Checkout never checks inventory; stock is even pushed negative | Every quantity is compared with server stock first; otherwise `409 OUT_OF_STOCK` | `server/src/services.ts` (`checkout`) |

**Security principle used throughout:** the client may send a `cartId` and a `paymentAmount`. It may
never send a price, a subtotal, a shipping fee or a total — those are always recalculated on the
server from `server/src/store.ts`.

---

## 5. Manual test checklist

Run through this once before your presentation, so you know exactly what the audience will hit.

### Buggy mode — the audience should find these

| # | Steps | What appears on screen |
| --- | --- | --- |
| 1 | Add **Lumen Arc Desk Lamp** ×1 and **Drift Insulated Bottle** ×1. | Subtotal ₹1,448 and "Shipping (flat ₹49)", but **Total ₹1,448** — the fee is never collected. |
| 2 | Remove the bottle. | It leaves the list, yet the **subtotal stays ₹1,448** for a single ₹549 item. |
| 3 | Check out and pay **₹10**. | The order is accepted. Receipt: item ₹549, subtotal ₹1,448, shipping ₹49, **Total ₹10**. |
| 4 | Add **Vertex Wireless Earbuds** (labelled *Out of stock*) and check out. | The order succeeds. Nobody warned them. |
| 5 | In the drawer, run the self-check suite. | `0 pass · 4 fail`. |

### Fixed mode — the corrections

| # | Steps | What appears on screen |
| --- | --- | --- |
| 1 | Add the lamp and the bottle. | Subtotal ₹1,448 + shipping ₹49 = **Total ₹1,497**. |
| 2 | Remove the bottle. | Total drops to **₹548** (₹499 + ₹49). |
| 3 | Pay **₹10**. | **Rejected**: "the server calculated Rs.548 but Rs.10 was submitted". |
| 4 | Buy the out-of-stock earbuds. | **Rejected**: "Not enough stock for: Vertex Wireless Earbuds (requested 1, available 0)". |
| 5 | Run the self-check suite. | `4 pass · 0 fail`. |

### Error handling spot checks (both modes)

- Leave the amount empty or type letters → the Pay button disables / the server answers `400`.
- An unknown cart id (`GET /api/cart/nope`) → `404` with a friendly message.
- An unknown route (`GET /api/nope`) → `404`, never a blank screen or a crash.

---

## 6. Resetting the demo

| Goal | How |
| --- | --- |
| Full reset (stock, orders, cart) and back to fixed mode | Drawer → **Reset demo data** |
| Start clean without the drawer | Stop the servers and run `npm run dev` again — all data is in memory |
| Clear the saved cart | The reset also clears the cart id stored in the browser |

---

## 7. Product images

The ten product photographs are **stored locally** in `client/public/products/` as 1200x900 JPEGs.
Nothing is hotlinked at runtime, so the site works with no internet connection (important for a
classroom or projector).

- **Source:** genuine photographs from [Wikimedia Commons](https://commons.wikimedia.org), used under
  their Creative Commons licence. Full author + licence list:
  [`client/public/IMAGE-CREDITS.md`](client/public/IMAGE-CREDITS.md). Attribution is required by
  several of those licences, so keep that file if you redistribute the project.
- **No AI-generated or illustrated images** — every image is a real photograph of real hardware.
  The ShopSmart brand names, prices and descriptions remain fictional.
- Every image is auto-cropped onto a white 1200x900 canvas so the catalogue looks consistent, and the
  product card uses `object-fit: contain`, so nothing is cut off again.
- If an image fails to load, `placeholder.svg` is shown instead of a broken-image icon.

Replacing an image later: drop a file at `client/public/products/<product-id>.jpg` (or change the
`image:` path in `server/src/store.ts`) — nothing else needs to change.

---

## 8. Project layout

```
shopsmart/
├─ package.json            # root scripts: install:all, dev, build, typecheck
├─ server/                 # Express + TypeScript API
│  └─ src/
│     ├─ index.ts          # app bootstrap, CORS, error handler, port 4000
│     ├─ routes.ts         # every HTTP endpoint
│     ├─ services.ts       # cart operations + checkout   (defects 1 and 4)
│     ├─ pricing.ts        # summary + totals             (defects 2 and 3)
│     ├─ store.ts          # in-memory products, stock, carts, orders, mode
│     ├─ errors.ts         # ApiError + friendly helpers
│     └─ types.ts          # shared domain types
└─ client/                 # React + Vite + TypeScript website
   ├─ vite.config.ts       # dev server on 5173, /api proxied to 4000
   ├─ public/products/     # the 10 product photographs + placeholder.svg
   ├─ public/IMAGE-CREDITS.md   # author + licence for every photograph
   └─ src/
      ├─ App.tsx           # storefront pages + presenter drawer wiring
      ├─ shop.tsx          # global state (products, cart, checkout, mode)
      ├─ api.ts            # typed fetch wrapper + HTTP tracing
      ├─ components/       # Header, ProductCard, Cart, Checkout, Confirmation,
      │                    # SummaryPanel, Footer, Notice
      │                    └─ PresenterPanel (+ BugLab, EpistemologyPanel) — hidden
      ├─ tests/bugTests.ts # the four self-checks that call the real API
      └─ styles.css        # all styling (no CSS framework)
```

The audience only ever sees the components at the top of `components/`. Everything about the
demonstration lives behind `PresenterPanel.tsx`.

---

## 9. API reference

Base URL `http://localhost:4000/api`. Every response is JSON. Failures look like
`{ "ok": false, "error": { "code", "message", "details" } }`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness, current mode, counts |
| GET | `/mode` · POST `/mode` | Read / switch the demonstration mode |
| POST | `/demo/reset` | Full reset: data + fixed mode |
| POST | `/test/reset` | Reset for the tests: orders + stock (keeps your cart and the mode) |
| POST | `/test/stock` | `{ productId, stock }` — makes a scenario reproducible |
| GET | `/products` | Catalogue with server prices and stock |
| POST | `/cart` | Create a cart, optionally with items |
| GET | `/cart/:id` | Cart + freshly calculated summary |
| POST | `/cart/:id/items` | Add a product |
| PUT | `/cart/:id/items` | Set a quantity (`0` removes) |
| DELETE | `/cart/:id/items/:productId` | Remove a product |
| DELETE | `/cart/:id` | Empty the cart |
| GET | `/cart/:id/summary` | Subtotal, shipping, totals |
| POST | `/checkout` | `{ cartId, paymentAmount }` — simulated payment |
| GET | `/orders` | Orders created in this session |

Shipping rules (server controlled): flat ₹49, free at ₹1,500 and above.

---

## 10. Troubleshooting

| Symptom | Fix |
| --- | --- |
| Page loads but support says "Back shortly" | The backend is not running. Start `npm run dev` in the project root. |
| "Cannot reach the ShopSmart API" | Port 4000 is busy or the server crashed. Check the terminal running the backend. |
| `Ctrl + Shift + P` does nothing | The projector or another app may capture the chord — use the footer's **Store information** double-click, or the `#presenter` URL. |
| Port 5173 or 4000 already in use | Close the other program, or edit the port in `client/vite.config.ts` (plus its proxy target) and `PORT` for the server. |
| Changes to the backend do not appear | `npm run dev` in `server/` uses `tsx watch`, which reloads automatically. If not, press `Ctrl + C` and start again. |
| Changes to the frontend do not appear | Vite hot-reloads automatically; refresh the browser once. |
| A product image looks stale | The browser cached the old file — press `Ctrl + F5` to hard-refresh. |
| Totals look stale | Press **Reset demo data** in the drawer; restarting the server has the same effect. |
| Want a clean slate before presenting | Reset in the drawer, then close and restart both servers. |
---

## 11. Deploying to Vercel

### The project is deployed as two services

`vercel.json` at the repository root declares a **multi-service** deployment:

```json
"services": {
  "client": { "root": "client", "framework": "vite", "buildCommand": "npm run build" },
  "server": { "root": "server", "framework": "express",
              "entrypoint": "index.js", "buildCommand": "npm run build" }
},
"rewrites": [
  { "source": "/api/(.*)", "destination": { "service": "server" } },
  { "source": "/(.*)",     "destination": { "service": "client" } }
]
```

* **`client`** - the Vite single-page app. It is built to `client/dist` and served as static
  files.
* **`server`** - the Express API. `server/index.js` exports the compiled app from
  `server/dist/app.js`; it is never called with `listen()`, because Vercel runs it as a
  function. `npm run dev` and `npm start` are unchanged and still use `src/index.ts`.
* **Routing** - one domain, two services. `/api/*` reaches the server, everything else
  reaches the client. Order matters: the specific rewrite first, the catch-all last.

`server/src/app.ts` mounts its router under **both** `/api` and `/`. On Vercel the prefix is
normally kept, but the second mount means the routes also resolve if it is ever stripped
before the request reaches the service.

**No service bindings are needed.** A binding would inject the target's internal URL into
the calling service, but `client/src/api.ts` already calls relative paths (`/api/...`) and the
rewrite routes them on the same domain. That is the right design here: bindings are injected
into functions at runtime, and the browser bundle cannot receive an injected value at all.

**One non-obvious rule about the server entrypoint.** Vercel's Express builder decides which
file is the entrypoint by *reading its source text* and looking for a direct
`import ... from 'express'` - it never follows the import graph. A file that only re-exports
the built app is rejected with *"No entrypoint found which imports express"*, so
`server/index.js` imports express itself (a no-op at runtime, since `dist/app.js` loads it
anyway). `npm run check:deploy` re-runs Vercel's own detection rule against this repository,
along with the rewrite order and the "no build/runtime keys at the top level" rule, so this
stays caught locally rather than during a production build.

The `client` service sets its `buildCommand` on purpose: the Vite preset's default is
`vite build`, which skips `tsc -b`. `npm run build` runs `tsc -b && vite build`, so a type
error fails the deploy instead of shipping.

**Do not set `runtime` on a service.** It expects a *lambda runtime* identifier
(`nodejs24.x`, `python3.14`), not a framework slug - `"runtime": "nodejs"` fails the
deployment with `Service "server" has invalid runtime "nodejs"`. Vercel auto-detects the
runtime, and `framework: "express"` is what selects the Express builder, so the key is simply
omitted. `npm run check:deploy` rejects an unrecognised runtime value before you push.

Vercel's routing docs confirm the service receives the **original** path (`GET /api/users`
arrives as `/api/users`, not `/users`), so the `/api` mount in `server/src/app.ts` is the one
that serves requests; the extra `/` mount is a harmless safety net.

### How the API survives serverless functions

Vercel runs the `server` service as a function: every request can arrive on a different
instance, and instances are recycled when idle. Anything kept only in a variable would
disappear between two requests (empty carts, mode snapping back to "fixed").

ShopSmart therefore sends no state of its own between requests. The demo state - cart
contents, demonstration mode, stock levels, order list - travels back to the browser in a
cookie named `shopsmart_session`:

* **httpOnly** - page JavaScript cannot read or edit it
* **signed with HMAC-SHA256** (`SESSION_SECRET`) - a visitor cannot hand-edit the mode or
  the stock levels; a tampered cookie is simply ignored
* **the catalogue never travels** - prices, shipping rules and product data are code, so
  every rupee is still recalculated on the server for each request

A measured session is ~0.5 KB; a busy one stays under 2.5 KB, well inside the 4 KB browser
limit. Requests are also serialised per instance, and the browser never has two cart
mutations in flight, so a click can never be applied twice.

### Step 1 - push the project to GitHub

```bash
cd shopsmart
git init
git add .
git commit -m "ShopSmart demo for the Epistemology presentation"
```

Create an empty GitHub repository (no README, no .gitignore - this project already has one),
then push:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/shopsmart.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `dist` and `.env` files, so nothing secret or
heavy is uploaded. `.env.example` is committed on purpose - it only contains a placeholder.

### Step 2 - import into Vercel

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. Import the `shopsmart` repository. Vercel reads `vercel.json` and detects **two services**
   (`client` and `server`) - do not set Framework Preset, Build Command or Output Directory,
   they all live in the service definitions.
3. Deploy.

You get one URL that serves both the website and the API, e.g. `https://shopsmart.vercel.app`
(`/` = the client service, `/api/*` = the server service).

If you prefer to check the routing locally first, `npx vercel dev` starts both services with
the same rewrites and injects the environment variables.

### Step 3 - set the session secret

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add `SESSION_SECRET` (key) with a long random value (value):

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Choose **All environments** and deploy again.

The app works without it (a development default is used), but set it so nobody can forge a
session cookie. `PORT` is ignored on Vercel - it manages that itself.

### Step 4 - verify the deployed demo (2 minutes)

| Check | How |
| --- | --- |
| Website loads | Open the URL; 10 product photographs appear |
| API is live | Open `<url>/api/health` - it returns JSON |
| Cart survives a reload | Add something, press F5, the cart is still there |
| Images are served | `<url>/products/aurora-headphones.jpg` opens |
| Fixed mode | Checkout with the wrong amount is rejected with 402 |
| Out-of-stock | Buying *Vertex Wireless Earbuds* is rejected with 409 |
| Buggy mode | `Ctrl+Shift+P` → **Buggy mode** → shipping is skipped, underpaying is accepted |

### Presentation-day notes

- Run the whole demo from **one browser**. State lives in that browser's cookie, so a
  different device (or a private window) starts in Fixed mode - which is the safer default.
- Set **Buggy mode + Reset demo data** before the audience arrives.
- If the cart looks empty, the cookie was dropped (private window / cleared browsing data).
  Reload once; the site rebuilds the cart automatically.
- Vercel's Hobby plan is fine: this demo makes a handful of API calls per minute.