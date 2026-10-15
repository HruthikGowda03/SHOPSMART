/**
 * Serverless entry point for the ShopSmart API (Vercel "services" mode).
 *
 * Vercel mounts this Express app as the `server` service and routes every
 * /api/* request to it, so the app is *exported* here and never listened on.
 * `npm run dev` and `npm start` still use src/index.ts / dist/index.js, which
 * call app.listen() as before.
 *
 * The TypeScript sources are compiled to dist/ by this service's buildCommand.
 */
import app from './dist/app.js';

export default app;
export { app };