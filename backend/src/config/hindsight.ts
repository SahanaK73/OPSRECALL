import { HindsightClient } from '@vectorize-io/hindsight-client';
import { getEnv } from './env';

let client: HindsightClient | null = null;

/** Official Hindsight SDK client, authenticated with a Bearer API key (server-side only). */
export function getHindsightClient(): HindsightClient {
  if (!client) {
    const env = getEnv();
    client = new HindsightClient({ baseUrl: env.HINDSIGHT_BASE_URL, apiKey: env.HINDSIGHT_API_KEY });
  }
  return client;
}
export const getBankId = () => getEnv().HINDSIGHT_BANK_ID;
