// Hindsight Cloud integration: RETAIN (store verified experience) and RECALL (search it).
// Uses the official @vectorize-io/hindsight-client SDK. No local arrays, no fake data.
import { HindsightError } from '@vectorize-io/hindsight-client';
import { getBankId, getHindsightClient } from '../config/hindsight';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { retry, withTimeout } from '../utils/async';

export interface RetainInput {
  incidentId: string;
  serviceName: string;
  environment: string;
  severity: string;
  title: string;
  errorMessage: string;
  symptoms: string;
  recentDeployment: string;
  actualRootCause: string;
  resolutionApplied: string;
  verificationResults: string;
  serviceRecovered: boolean;
  isSynthetic: boolean;
}

export interface RecalledFact {
  id: string;
  text: string;
  type?: string | null;
  context?: string | null;
  documentId?: string | null;
  entities?: string[] | null;
  occurredAt?: string | null;
}

const RETAIN_TIMEOUT_MS = 90_000; // retain runs LLM fact extraction server-side, so allow time
const RECALL_TIMEOUT_MS = 30_000;

export const documentIdFor = (incidentId: string) => `incident-${incidentId}`;
export const incidentIdFromDocumentId = (docId?: string | null) =>
  docId && docId.startsWith('incident-') ? docId.slice('incident-'.length) : null;

const isTransient = (e: unknown) => {
  if (e instanceof HindsightError) return !e.statusCode || e.statusCode >= 500 || e.statusCode === 429;
  return (e as { isTimeout?: boolean })?.isTimeout === true || e instanceof TypeError; // network errors
};

function toAppError(e: unknown, op: string): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof HindsightError) {
    if (e.statusCode === 401 || e.statusCode === 403)
      return new AppError(502, `Hindsight rejected the API key during ${op}. Check HINDSIGHT_API_KEY.`, 'HINDSIGHT_AUTH');
    if (e.statusCode === 402)
      return new AppError(502, `Hindsight reports insufficient credits during ${op}.`, 'HINDSIGHT_CREDITS');
    if (e.statusCode === 429)
      return new AppError(503, `Hindsight rate limit hit during ${op}. Try again shortly.`, 'HINDSIGHT_RATE_LIMIT');
    return new AppError(502, `Hindsight ${op} failed: ${e.message}`, 'HINDSIGHT_ERROR');
  }
  if ((e as { isTimeout?: boolean })?.isTimeout) return new AppError(504, `Hindsight ${op} timed out.`, 'HINDSIGHT_TIMEOUT');
  return new AppError(502, `Could not reach Hindsight during ${op}: ${(e as Error).message}`, 'HINDSIGHT_UNREACHABLE');
}

/** Create the memory bank if needed (createBank is create-or-update) and steer what Hindsight extracts. */
export async function ensureBank(): Promise<void> {
  try {
    await withTimeout(
      getHindsightClient().createBank(getBankId(), {
        reflectMission:
          'OpsRecall: an incident-response memory. Remember engineer-verified production incidents so future incidents can be compared with past confirmed root causes and resolutions.',
        retainMission:
          'Extract incident experience: affected service, symptoms, key error messages, deployment context, the engineer-CONFIRMED root cause, the resolution applied and its verification outcome. Keep the incident ID in every fact. Only treat the confirmed root cause as fact.',
      }),
      20_000,
      'Hindsight createBank',
    );
    logger.info(`Hindsight bank ready: ${getBankId()}`);
  } catch (e) {
    throw toAppError(e, 'bank setup');
  }
}

/** Build the structured text that Hindsight will remember for a resolved incident. */
export function buildRetainContent(i: RetainInput): string {
  return [
    `ENGINEER-VERIFIED INCIDENT EXPERIENCE${i.isSynthetic ? ' (synthetic demo data)' : ''}`,
    `Incident ID: ${i.incidentId}`,
    `Incident title: ${i.title}`,
    `Service: ${i.serviceName} | Environment: ${i.environment} | Severity: ${i.severity}`,
    `Symptoms: ${i.symptoms || 'not recorded'}`,
    `Error messages: ${i.errorMessage}`,
    `Deployment context: ${i.recentDeployment || 'none recorded'}`,
    `CONFIRMED ROOT CAUSE (verified by engineer): ${i.actualRootCause}`,
    `RESOLUTION APPLIED: ${i.resolutionApplied}`,
    `VERIFICATION OUTCOME: ${i.verificationResults}`,
    `Service recovered after fix: ${i.serviceRecovered ? 'yes' : 'no'}`,
  ].join('\n');
}

/** RETAIN: store a verified (engineer-confirmed) incident. Throws AppError on failure. */
export async function retainResolution(i: RetainInput): Promise<{ documentId: string }> {
  const documentId = documentIdFor(i.incidentId);
  try {
    await retry(
      () =>
        withTimeout(
          getHindsightClient().retain(getBankId(), buildRetainContent(i), {
            documentId, // re-retaining the same incident updates rather than duplicates
            context: 'Engineer-verified production incident: confirmed root cause and resolution',
            timestamp: new Date(),
            metadata: { incidentId: i.incidentId, service: i.serviceName, environment: i.environment, severity: i.severity, verified: 'true', synthetic: String(i.isSynthetic) },
            tags: ['opsrecall', `service:${i.serviceName.toLowerCase()}`],
            async: false, // wait until facts are extracted so the next recall can find them
          }),
          RETAIN_TIMEOUT_MS,
          'Hindsight retain',
        ),
      { attempts: 2, delayMs: 1500, shouldRetry: isTransient },
    );
    logger.info(`Hindsight retain OK for ${documentId}`);
    return { documentId };
  } catch (e) {
    throw toAppError(e, 'retain');
  }
}

/** Compose the recall query from symptoms, service, error messages and context. */
export function buildRecallQuery(inc: {
  serviceName: string;
  title: string;
  errorMessage: string;
  symptoms?: string;
  recentDeployment?: string;
  logDetails?: string;
}): string {
  const logSnippet = (inc.logDetails || '').split('\n').filter(Boolean).slice(0, 6).join(' ').slice(0, 600);
  return [
    `Past incidents similar to this one in service "${inc.serviceName}": ${inc.title}.`,
    `Error: ${inc.errorMessage.slice(0, 500)}`,
    inc.symptoms ? `Symptoms: ${inc.symptoms.slice(0, 500)}` : '',
    inc.recentDeployment ? `Deployment context: ${inc.recentDeployment.slice(0, 300)}` : '',
    logSnippet ? `Log excerpt: ${logSnippet}` : '',
    'What were the confirmed root causes and resolutions?',
  ]
    .filter(Boolean)
    .join(' ');
}

/** RECALL: search Hindsight for relevant past facts. Empty array = nothing relevant (not an error). */
export async function recallSimilar(query: string, maxFacts = 15): Promise<RecalledFact[]> {
  try {
    const res = await retry(
      () =>
        withTimeout(
          getHindsightClient().recall(getBankId(), query, { budget: 'mid', maxTokens: 4096, tags: ['opsrecall'], tagsMatch: 'any_strict' }),
          RECALL_TIMEOUT_MS,
          'Hindsight recall',
        ),
      { attempts: 2, delayMs: 1000, shouldRetry: isTransient },
    );
    return (res.results ?? []).slice(0, maxFacts).map((r) => ({
      id: r.id,
      text: r.text,
      type: r.type,
      context: r.context,
      documentId: r.document_id,
      entities: r.entities,
      occurredAt: r.occurred_start ?? r.mentioned_at ?? null,
    }));
  } catch (e) {
    throw toAppError(e, 'recall');
  }
}

/** List what Hindsight currently holds (used by the Historical Memory page). */
export async function listBankFacts(opts: { q?: string; limit?: number } = {}) {
  try {
    const res = await withTimeout(
      getHindsightClient().listMemories(getBankId(), { q: opts.q, limit: opts.limit ?? 50, offset: 0 }),
      RECALL_TIMEOUT_MS,
      'Hindsight listMemories',
    );
    return { total: res.total, items: res.items };
  } catch (e) {
    throw toAppError(e, 'list memories');
  }
}

export async function pingHindsight(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const v = await withTimeout(getHindsightClient().getVersion(), 8000, 'Hindsight getVersion');
    return { ok: true, version: v.api_version };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
