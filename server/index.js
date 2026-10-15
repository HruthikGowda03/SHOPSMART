/**
 * Serverless entry point for the ShopSmart API (Vercel "services" mode).
 *
 * Vercel mounts this Express app as the `server` service and routes every
 * /api/* request to it, so the app is *exported* here and never listened on.
 * `npm run dev` and `npm start` still use src/index.ts / dist/index.js, which
 * call app.listen() as before.
 *
 * The TypeScript sources are compiled to dist/ by this service's buildCommand
 * ("npm run build"), which runs before Vercel resolves the entrypoint.
 */

// Vercel's Express builder (@vercel/express) decides which file is the
// entrypoint by looking for a file that imports "express" directly - it reads
// the source with a regex and never resolves the import graph. A file that only
// re-exports the built app is rejected with "No entrypoint found which imports
// express". Importing express here is what makes this file the entrypoint;
// it is a no-op at runtime, since dist/app.js loads express anyway.
// `npm run check:deploy` re-runs Vercel's own detection rule against the repo.
import 'express';
import app from './dist/app.js';

export default app;
export { app };