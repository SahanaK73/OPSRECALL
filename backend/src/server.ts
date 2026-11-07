import { createApp } from './app';
import { getEnv } from './config/env';
import { connectDatabase } from './config/database';
import { ensureBank } from './services/hindsight.service';
import { logger } from './utils/logger';

async function main() {
  const env = getEnv(); // fails fast with a readable message if .env is incomplete
  await connectDatabase();
  try {
    await ensureBank();
  } catch (e) {
    // Do not crash: the app still works, retain/recall will report errors until Hindsight is reachable.
    logger.warn(`Hindsight bank setup failed (will keep running): ${(e as Error).message}`);
  }
  const app = createApp(env.CORS_ORIGIN);
  const server = app.listen(env.PORT, () => logger.info(`OpsRecall API listening on http://localhost:${env.PORT}`));
  server.setTimeout(150_000); // analysis/retain call external services
  server.requestTimeout = 150_000;
}

main().catch((e) => {
  logger.error('Fatal startup error', e as Error);
  process.exit(1);
});
