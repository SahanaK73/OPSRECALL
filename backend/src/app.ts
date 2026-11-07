import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import incidentRoutes from './routes/incident.routes';
import analysisRoutes from './routes/analysis.routes';
import resolutionRoutes from './routes/resolution.routes';
import memoryRoutes from './routes/memory.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { asyncHandler } from './middleware/validateRequest';
import { isDatabaseConnected } from './config/database';
import { pingHindsight } from './services/hindsight.service';
import { logger } from './utils/logger';

export function createApp(corsOrigin = 'http://localhost:5173') {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' })); // input size limit
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  app.get(
    '/api/health',
    asyncHandler(async (req, res) => {
      const deep = req.query.deep === 'true'; // deep=true also pings Hindsight
      const body: Record<string, unknown> = { status: 'ok', time: new Date().toISOString(), mongodb: isDatabaseConnected() ? 'connected' : 'disconnected' };
      if (deep) body.hindsight = await pingHindsight();
      res.status(isDatabaseConnected() ? 200 : 503).json(body);
    }),
  );

  app.use('/api/incidents', incidentRoutes);
  app.use('/api/incidents', analysisRoutes);
  app.use('/api/incidents', resolutionRoutes);
  app.use('/api/memory', memoryRoutes);

  const publicDir = path.resolve(__dirname, '../public');
  if (existsSync(path.join(publicDir, 'index.html'))) {
    app.use(express.static(publicDir));
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
