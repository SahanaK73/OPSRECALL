// Groq LLM integration: JSON-mode chat completion + validation + self-repair retries.
import { ZodError } from 'zod';
import { getGroqClient } from '../config/groq';
import { getEnv } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { llmAnalysisSchema, LlmAnalysis } from '../utils/schemas';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Pull a JSON object out of model text (handles ```json fences and stray prose). */
export function extractJson(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) throw new SyntaxError('No JSON object found in model output');
  return JSON.parse(s.slice(start, end + 1));
}

function mapGroqError(e: unknown): AppError {
  const status = (e as { status?: number })?.status;
  const msg = (e as Error)?.message ?? 'unknown error';
  if (status === 401) return new AppError(502, 'Groq rejected the API key. Check GROQ_API_KEY.', 'GROQ_AUTH');
  if (status === 429) return new AppError(503, 'Groq rate limit reached. Wait a moment and retry.', 'GROQ_RATE_LIMIT');
  if (status === 404 || status === 400) return new AppError(502, `Groq request failed (${status}). Is GROQ_MODEL valid? ${msg}`, 'GROQ_BAD_REQUEST');
  if (/timed? ?out|ETIMEDOUT|abort/i.test(msg)) return new AppError(504, 'Groq request timed out.', 'GROQ_TIMEOUT');
  return new AppError(502, `Groq request failed: ${msg}`, 'GROQ_ERROR');
}

/**
 * Ask the model for a structured analysis. If the output is not valid JSON or fails
 * schema validation, send the error back to the model and retry (max `maxAttempts`).
 */
export async function generateAnalysis(system: string, user: string, maxAttempts = 3): Promise<{ analysis: LlmAnalysis; model: string }> {
  let model = getEnv().GROQ_MODEL;
  if (model === 'llama-3.3-70b-versatile' || !model) {
    model = 'openai/gpt-oss-120b';
  }
  let isReasoningModel = /gpt-oss|qwen3/i.test(model);
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  let lastProblem = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let content: string;
    try {
      const completion = await getGroqClient().chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        // Reasoning models (gpt-oss) spend part of the budget on thinking, so give them more room.
        max_tokens: isReasoningModel ? 8000 : 2500,
        ...(isReasoningModel ? { reasoning_effort: 'low' as const } : {}),
        response_format: { type: 'json_object' }, // requires the word "JSON" in the prompt (it is)
      });
      content = completion.choices[0]?.message?.content ?? '';
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 404 && model !== 'openai/gpt-oss-120b') {
        logger.warn(`Groq model ${model} not found (404). Falling back to openai/gpt-oss-120b.`);
        model = 'openai/gpt-oss-120b';
        isReasoningModel = true;
        continue;
      }
      throw mapGroqError(e);
    }

    try {
      const analysis = llmAnalysisSchema.parse(extractJson(content));
      return { analysis, model };
    } catch (e) {
      lastProblem = e instanceof ZodError ? e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : (e as Error).message;
      logger.warn(`Groq output invalid (attempt ${attempt}/${maxAttempts}): ${lastProblem}`);
      messages.push({ role: 'assistant', content: content || '(empty)' });
      messages.push({
        role: 'user',
        content: `Your previous reply was not valid. Problem: ${lastProblem}. Reply again with ONLY one valid JSON object that follows the required schema exactly.`,
      });
    }
  }
  throw new AppError(502, `The AI returned malformed output ${maxAttempts} times (${lastProblem}). Please retry.`, 'LLM_MALFORMED_OUTPUT');
}
