import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes/index.js';
import { checkOrigin } from './middleware/origin.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use('/api', checkOrigin, apiRouter());
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
