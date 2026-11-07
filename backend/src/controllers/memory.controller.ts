import { Request, Response } from 'express';
import { Resolution } from '../models/Resolution';
import { Incident } from '../models/Incident';
import { listBankFacts, buildRecallQuery, recallSimilar } from '../services/hindsight.service';
import { retryRetain } from '../services/resolution.service';
import { getBankId } from '../config/hindsight';

/** Historical memory: retained incidents (MongoDB lifecycle records) + live facts stored in Hindsight. */
export const getMemory = async (req: Request, res: Response) => {
  const { q, limit } = (req as unknown as { validatedQuery: { q?: string; limit: number } }).validatedQuery;

  const resolutions = await Resolution.find().sort({ createdAt: -1 }).limit(limit).lean();
  const incidents = await Incident.find({ _id: { $in: resolutions.map((r) => r.incidentId) } }).lean();
  const byId = new Map(incidents.map((i) => [String(i._id), i]));
  const retainedIncidents = resolutions.map((r) => {
    const i = byId.get(String(r.incidentId));
    return {
      incidentId: r.incidentId,
      title: i?.title,
      serviceName: i?.serviceName,
      severity: i?.severity,
      isSynthetic: i?.isSynthetic,
      symptoms: i?.symptoms,
      errorMessage: i?.errorMessage,
      confirmedRootCause: r.actualRootCause,
      resolutionApplied: r.resolutionApplied,
      verificationResults: r.verificationResults,
      serviceRecovered: r.serviceRecovered,
      retained: r.retained,
      retainedAt: r.retainedAt,
      retainError: r.retainError,
      hindsightDocumentId: r.hindsightDocumentId,
      // Where this incident was recalled for later incidents (real provenance from stored analyses)
      recalledBy: [] as { incidentId: string; title: string; relevance?: string }[],
    };
  });

  // Why was each memory retrieved? Look at stored analyses that actually received it.
  const withMemory = await Incident.find({ 'analyses.memoryUsed': true }).select('title analyses').lean();
  for (const inc of withMemory) {
    for (const a of inc.analyses) {
      for (const m of (a.recalledMemories ?? []) as { incidentId?: string; llm?: { relevance: string } }[]) {
        const target = retainedIncidents.find((r) => String(r.incidentId) === m.incidentId);
        if (target && !target.recalledBy.some((x) => x.incidentId === String(inc._id)))
          target.recalledBy.push({ incidentId: String(inc._id), title: inc.title, relevance: m.llm?.relevance });
      }
    }
  }

  let hindsight: unknown = null;
  let hindsightError: string | undefined;
  try {
    hindsight = await listBankFacts({ q, limit });
  } catch (e) {
    hindsightError = (e as Error).message;
  }
  res.json({ bankId: getBankId(), retainedIncidents, hindsight, hindsightError });
};

/** Run a real Hindsight recall for free text (shows what memory would return). */
export const search = async (req: Request, res: Response) => {
  const q = String((req.query.q as string) ?? '').slice(0, 500);
  if (!q.trim()) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Query parameter q is required' } });
  const facts = await recallSimilar(buildRecallQuery({ serviceName: 'any', title: q, errorMessage: q }));
  res.json({ query: q, facts });
};

export const retry = async (req: Request, res: Response) => {
  const r = await retryRetain(String(req.params.id));
  res.json({ retained: r.retained, retainError: r.retainError });
};
