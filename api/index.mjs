/**
 * Vercel serverless function for the ShopSmart API.
 *
 * Vercel turns every file in /api into a function mounted at /api, so this
 * serves the whole /api/* surface. It loads the app that was compiled to
 * server/dist by the build step, so no TypeScript resolution happens at runtime.
 */
import app from '../server/dist/app.js';

export default app;