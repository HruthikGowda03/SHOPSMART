/**
 * Local development / self-hosted entry point.
 *
 * On Vercel the same app is loaded by api/index.mjs as a serverless function
 * instead of being listened on here.
 */

import { app } from './app.js';

const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, () => {
  console.log(`ShopSmart API listening on http://localhost:${PORT}`);
  console.log('Demo mode starts in FIXED. Use POST /api/mode {"mode":"buggy"} to switch.');
});