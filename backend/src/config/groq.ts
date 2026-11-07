import Groq from 'groq-sdk';
import { getEnv } from './env';

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!client) {
    client = new Groq({ apiKey: getEnv().GROQ_API_KEY, timeout: 60_000, maxRetries: 1 });
  }
  return client;
}
