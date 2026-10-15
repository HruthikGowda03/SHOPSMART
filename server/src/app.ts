/**
 * ShopSmart Express application.
 *
 * Kept separate from index.ts so that:
 *   - local dev can call app.listen() and get hot reloads (tsx watch)
 *   - Vercel can import the same app as a serverless function (see api/index.mjs)
 *
 * The session middleware makes the API stateless: the mutable store is rebuilt
 * from a signed, httpOnly cookie before every request and written back after,
 * so state survives cold starts and multiple serverless instances.
 */

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ApiError } from './errors.js';
import { router } from './routes.js';
import { deserialize, readCookie, serializeFitted, writeCookie } from './session.js';
import { hydrate, snapshot } from './store.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', true);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  // One request at a time per instance: the store is rebuilt per request, so
  // two overlapping requests must never interleave.
  let queue: Promise<unknown> = Promise.resolve();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const run = queue.then(
      () =>
        new Promise<void>((resolve) => {
          hydrate(deserialize(readCookie(req)));

          // The cookie has to be attached while the headers are still open,
          // so it is written from inside writeHead. The "finish" event fires
          // after the response has already left, which is too late.
          const originalWriteHead = res.writeHead.bind(res);
          res.writeHead = ((...args: unknown[]) => {
            try {
              writeCookie(res, serializeFitted(snapshot()));
            } catch {
              // Never let cookie writing break a response.
            }
            return (originalWriteHead as (...a: unknown[]) => Response)(...args);
          }) as Response['writeHead'];

          res.once('finish', resolve);
          res.once('close', resolve);

          next();
        }),
    );
    queue = run.catch(() => undefined);
  });

  // Request logger - useful while presenting the demo.
  app.use((req, _res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[api] ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      ok: true,
      name: 'ShopSmart API',
      docs: 'See README.md.',
      endpoints: [
        'GET  /api/health',
        'GET  /api/mode            POST /api/mode { mode }',
        'POST /api/demo/reset      POST /api/test/reset      POST /api/test/stock',
        'GET  /api/products',
        'POST /api/cart             GET /api/cart/:id        DELETE /api/cart/:id',
        'POST /api/cart/:id/items   PUT /api/cart/:id/items   DELETE /api/cart/:id/items/:productId',
        'GET  /api/cart/:id/summary',
        'POST /api/checkout         GET /api/orders',
      ],
    });
  });

  app.use('/api', router);

  // Central error handler: every failure becomes a friendly JSON payload.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    console.error('[error]', err);
    res.status(500).json({ ok: false, error: { code: 'SERVER_ERROR', message } });
  });

  return app;
}

export const app = createApp();
export default app;