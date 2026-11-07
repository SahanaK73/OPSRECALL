// Memory-assisted analysis: Hindsight RECALL -> Groq reasoning -> validated, provenance-tagged result.
import { Incident, IncidentDoc } from '../models/Incident';
import { Resolution } from '../models/Resolution';
import { notFound } from '../utils/AppError';
import { logger } from '../utils/logger';
import { LlmAnalysis } from '../utils/schemas';
import { generateAnalysis } from './groq.service';
import { RecalledFact, buildRecallQuery, incidentIdFromDocumentId, recallSimilar } from './hindsight.service';

export interface RecalledMemoryRecord {
  ref: string; // HIST-1.. (the label the LLM saw)
  incidentId?: string;
  title?: string;
  serviceName?: string;
  severity?: string;
  confirmedRootCause?: string;
  resolutionApplied?: string;
  verificationResults?: string;
  serviceRecovered?: boolean;
  verifiedRecord: boolean; // true when the full confirmed record was found in MongoDB
  retrievedFacts: string[]; // verbatim fact text returned by Hindsight recall
  hindsightRank: number; // 1 = best match returned by Hindsight
  sharedService: boolean | null;
  sharedTerms: string[]; // deterministic overlap between current and past incident text
  suppliedToLlm: true; // we only record memories that were actually put in the prompt
  llm?: { relevance: string; similarities: string[]; differences: string[]; influence: string };
}

const MAX_MEMORIES = 4;
const STOP = new Set('the a an and or of to in on at for with from by is are was were be been this that it as not no error failed failure service request requests after before during while into out up down http https com org net'.split(' '));

export const tokenize = (s: string): Set<string> =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9_.-]+/)
      .map((t) => t.replace(/^[.-]+|[.-]+$/g, ''))
      .filter((t) => t.length > 3 && !STOP.has(t) && !/^\d+$/.test(t)),
  );

export const sharedTerms = (a: string, b: string, max = 8): string[] => {
  const tb = tokenize(b);
  return [...tokenize(a)].filter((t) => tb.has(t)).slice(0, max);
};

/** Group recalled facts by the incident they came from (document id), preserving Hindsight's ranking. */
export function groupFactsByIncident(facts: RecalledFact[], excludeIncidentId: string) {
  const groups = new Map<string, { incidentId: string | null; facts: string[]; firstRank: number }>();
  facts.forEach((f, idx) => {
    const incidentId = incidentIdFromDocumentId(f.documentId);
    if (incidentId === excludeIncidentId) return; // never "recall" the incident we are analysing
    const key = incidentId ?? `fact-${f.id}`;
    const g = groups.get(key) ?? { incidentId, facts: [], firstRank: idx + 1 };
    g.facts.push(f.text);
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => a.firstRank - b.firstRank).slice(0, MAX_MEMORIES);
}

async function buildMemoryRecords(facts: RecalledFact[], current: IncidentDoc): Promise<RecalledMemoryRecord[]> {
  const groups = groupFactsByIncident(facts, String(current._id));
  const currentText = [current.title, current.errorMessage, current.symptoms, current.logDetails, current.recentDeployment].join(' ');
  const records: RecalledMemoryRecord[] = [];
  for (const [i, g] of groups.entries()) {
    const ref = `HIST-${i + 1}`;
    const past = g.incidentId && /^[a-f\d]{24}$/i.test(g.incidentId) ? await Incident.findById(g.incidentId).lean() : null;
    const res = past?.resolutionId ? await Resolution.findById(past.resolutionId).lean() : null;
    const verified = !!(past && res && res.engineerConfirmed);
    const pastText = past ? [past.title, past.errorMessage, past.symptoms].join(' ') : g.facts.join(' ');
    records.push({
      ref,
      incidentId: g.incidentId ?? undefined,
      title: past?.title,
      serviceName: past?.serviceName,
      severity: past?.severity,
      confirmedRootCause: verified ? res!.actualRootCause : undefined,
      resolutionApplied: verified ? res!.resolutionApplied : undefined,
      verificationResults: verified ? res!.verificationResults : undefined,
      serviceRecovered: verified ? res!.serviceRecovered : undefined,
      verifiedRecord: verified,
      retrievedFacts: g.facts,
      hindsightRank: g.firstRank,
      sharedService: past ? past.serviceName.toLowerCase() === current.serviceName.toLowerCase() : null,
      sharedTerms: sharedTerms(currentText, pastText),
      suppliedToLlm: true,
    });
  }
  return records;
}

// ---- Prompt ---------------------------------------------------------------
const SCHEMA_EXAMPLE = `{
  "summary": "one or two sentences describing what is happening now",
  "possibleCauses": [
    { "cause": "...", "confidence": "low|medium|high", "evidence": ["quote or paraphrase from CURRENT logs/symptoms"], "basedOn": "current_evidence|historical_memory|both" }
  ],
  "historicalComparisons": [
    { "memoryRef": "HIST-1", "relevance": "high|medium|low|none", "similarities": ["..."], "differences": ["..."], "influence": "how (or whether) this history changed your recommendation" }
  ],
  "recommendedChecks": ["concrete, ordered investigation steps"],
  "alternativeExplanations": ["..."],
  "missingInformation": ["what data would raise or lower confidence"],
  "insufficientEvidence": false,
  "requiresEngineerReview": true
}`;

export function buildSystemPrompt(memoryProvided: boolean): string {
  return `You are OpsRecall, an incident-investigation assistant for software engineers. You output ONLY one JSON object, no prose.

Rules:
- Separate HISTORICAL FACTS (engineer-confirmed past incidents supplied below) from CURRENT HYPOTHESES (your guesses about the current incident). Hypotheses are never facts.
- Base every cause on evidence found in the CURRENT incident. Quote or paraphrase it in "evidence".
- Use calibrated confidence: "high" only with direct evidence; "medium" with partial evidence; "low" for speculation. If evidence is thin set "insufficientEvidence": true and say what is missing.
- Never invent historical incidents, ids, or past resolutions. ${
    memoryProvided
      ? 'You may only reference historical incidents labelled HIST-n in the input. For EACH HIST-n produce one entry in "historicalComparisons". If a past incident is not actually similar (different symptoms/service/error type), set relevance "none" and do NOT let it influence your causes. A similar past incident suggests a hypothesis to CHECK; it does not prove the same root cause.'
      : 'No historical memory is supplied for this analysis. "historicalComparisons" MUST be an empty array and no cause may have basedOn other than "current_evidence".'
  }
- Recommend investigation steps only. Never claim a fix was applied; humans approve all actions. Always set "requiresEngineerReview": true.

Required JSON schema:
${SCHEMA_EXAMPLE}`;
}

export function buildUserPrompt(inc: IncidentDoc, memories: RecalledMemoryRecord[]): string {
  const current = `CURRENT INCIDENT
Title: ${inc.title}
Service: ${inc.serviceName} | Environment: ${inc.environment} | Severity: ${inc.severity}
Occurred at: ${new Date(inc.occurredAt).toISOString()}
Error message: ${inc.errorMessage}
Symptoms: ${inc.symptoms || 'none provided'}
Recent deployment: ${inc.recentDeployment || 'none provided'}
Logs:
${(inc.logDetails || 'none provided').slice(0, 8000)}`;

  if (memories.length === 0) return `${current}\n\nHISTORICAL MEMORY: none supplied.\nRespond with JSON.`;

  const hist = memories
    .map((m) =>
      [
        `[${m.ref}] ${m.title ?? 'Past incident'}${m.serviceName ? ` (service: ${m.serviceName})` : ''}`,
        m.verifiedRecord
          ? `  Engineer-confirmed root cause: ${m.confirmedRootCause}\n  Verified resolution: ${m.resolutionApplied}\n  Verification: ${m.verificationResults} (service recovered: ${m.serviceRecovered ? 'yes' : 'no'})`
          : '  (Full confirmed record not found locally; rely only on the recalled facts below.)',
        `  Facts recalled from Hindsight memory:\n${m.retrievedFacts.map((f) => `    - ${f.replace(/\n+/g, ' ').slice(0, 700)}`).join('\n')}`,
      ].join('\n'),
    )
    .join('\n\n');
  return `${current}\n\nHISTORICAL MEMORY (retrieved from Hindsight, engineer-verified):\n${hist}\n\nRespond with JSON.`;
}

/** Make sure the LLM output can't claim more than it was given. */
export function reconcileWithMemory(analysis: LlmAnalysis, memories: RecalledMemoryRecord[]) {
  const byRef = new Map(memories.map((m) => [m.ref, m]));
  const seen = new Set<string>();
  const comparisons = memoryComparisons(analysis, byRef, seen);
  const influenced = comparisons.some((c) => c.relevance !== 'none');
  for (const c of comparisons) {
    const rec = byRef.get(c.memoryRef)!;
    rec.llm = { relevance: c.relevance, similarities: c.similarities, differences: c.differences, influence: c.influence };
  }
  return {
    ...analysis,
    requiresEngineerReview: true as const,
    historicalComparisons: comparisons,
    possibleCauses: analysis.possibleCauses.map((c) => ({ ...c, basedOn: influenced ? c.basedOn : ('current_evidence' as const) })),
    memoryInfluenced: influenced,
  };
}

function memoryComparisons(analysis: LlmAnalysis, byRef: Map<string, RecalledMemoryRecord>, seen: Set<string>) {
  return analysis.historicalComparisons.filter((c) => {
    if (!byRef.has(c.memoryRef) || seen.has(c.memoryRef)) return false; // drop invented / duplicate refs
    seen.add(c.memoryRef);
    return true;
  });
}

export async function analyzeIncident(incidentId: string, useMemory: boolean) {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw notFound('Incident');
  const doc = incident.toObject() as IncidentDoc;

  let memories: RecalledMemoryRecord[] = [];
  let memoryError: string | undefined;
  if (useMemory) {
    try {
      const facts = await recallSimilar(buildRecallQuery(doc));
      memories = await buildMemoryRecords(facts, doc);
      logger.info(`Recall for ${incidentId}: ${facts.length} facts -> ${memories.length} past incidents supplied to LLM`);
    } catch (e) {
      // Hindsight down must not block analysis; we say so honestly.
      memoryError = (e as Error).message;
      logger.warn(`Memory recall failed, analysing without memory: ${memoryError}`);
    }
  }

  const { analysis, model } = await generateAnalysis(buildSystemPrompt(memories.length > 0), buildUserPrompt(doc, memories));
  const result = reconcileWithMemory(analysis, memories);

  const entry = {
    createdAt: new Date(),
    memoryRequested: useMemory,
    memoryUsed: memories.length > 0,
    memoryError,
    model,
    recalledMemories: memories,
    result,
  };
  incident.analyses.push(entry as never);
  if (incident.status === 'open') incident.status = 'analyzed';
  const label = !useMemory
    ? 'Analysis generated WITHOUT memory'
    : memories.length
      ? `Hindsight returned ${memories.length} historical incident(s); recommendation generated with memory`
      : memoryError
        ? 'Hindsight unavailable; analysis generated without memory'
        : 'Hindsight searched: no relevant history; analysis generated from current evidence';
  incident.activity.push({ type: 'analyzed', message: label, at: new Date() } as never);
  await incident.save();

  return incident.analyses[incident.analyses.length - 1];
}
