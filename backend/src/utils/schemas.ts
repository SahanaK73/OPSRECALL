// All request + LLM-output validation lives here (zod).
import { z } from 'zod';
import { SEVERITIES } from '../models/Incident';

const text = (max: number) => z.string().trim().max(max);

export const createIncidentSchema = z.object({
  title: text(200).min(3, 'Title must be at least 3 characters'),
  serviceName: text(100).min(1, 'Service name is required'),
  severity: z.enum(SEVERITIES),
  environment: text(50).min(1, 'Environment is required'),
  errorMessage: text(5000).min(1, 'Error message is required'),
  logDetails: text(20000).optional().default(''),
  symptoms: text(5000).optional().default(''),
  recentDeployment: text(3000).optional().default(''),
  occurredAt: z.coerce.date().refine((d) => !isNaN(d.getTime()), 'Invalid timestamp'),
  isSynthetic: z.boolean().optional().default(false),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const idParamSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid incident id') });

export const analyzeBodySchema = z.object({ useMemory: z.boolean().optional().default(true) }).default({ useMemory: true });

export const resolveSchema = z.object({
  actualRootCause: text(3000).min(5, 'Describe the actual root cause'),
  resolutionApplied: text(3000).min(5, 'Describe the resolution applied'),
  verificationResults: text(3000).min(5, 'Describe how you verified the fix'),
  serviceRecovered: z.boolean(),
  engineerName: text(100).optional().default(''),
  engineerConfirmed: z.literal(true, { message: 'An engineer must confirm the resolution before it is remembered' }),
});
export type ResolveInput = z.infer<typeof resolveSchema>;

export const memoryQuerySchema = z.object({
  q: text(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

// ---- LLM output contract -------------------------------------------------
const level = z.enum(['low', 'medium', 'high']);
const strArr = z.array(z.string()).default([]);

export const llmAnalysisSchema = z.object({
  summary: z.string().min(1),
  possibleCauses: z
    .array(
      z.object({
        cause: z.string().min(1),
        confidence: level,
        evidence: strArr,
        basedOn: z.enum(['current_evidence', 'historical_memory', 'both']).default('current_evidence'),
      }),
    )
    .default([]),
  historicalComparisons: z
    .array(
      z.object({
        memoryRef: z.string(), // e.g. "HIST-1"
        relevance: z.enum(['high', 'medium', 'low', 'none']),
        similarities: strArr,
        differences: strArr,
        influence: z.string().default(''),
      }),
    )
    .default([]),
  recommendedChecks: strArr,
  alternativeExplanations: strArr,
  missingInformation: strArr,
  insufficientEvidence: z.boolean().default(false),
  requiresEngineerReview: z.boolean().default(true),
});
export type LlmAnalysis = z.infer<typeof llmAnalysisSchema>;
