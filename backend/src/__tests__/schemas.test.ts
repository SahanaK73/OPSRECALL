import { describe, it, expect } from 'vitest';
import { createIncidentSchema, resolveSchema, llmAnalysisSchema } from '../utils/schemas';

const valid = { title: 'Payments failing', serviceName: 'payment-service', severity: 'Critical', environment: 'production', errorMessage: 'timeout', occurredAt: '2026-03-01T10:00:00Z' };

describe('createIncidentSchema', () => {
  it('accepts a valid incident and fills defaults', () => {
    const r = createIncidentSchema.parse(valid);
    expect(r.logDetails).toBe('');
    expect(r.occurredAt).toBeInstanceOf(Date);
  });
  it('rejects bad severity, missing error message, oversized logs and bad dates', () => {
    expect(createIncidentSchema.safeParse({ ...valid, severity: 'Huge' }).success).toBe(false);
    expect(createIncidentSchema.safeParse({ ...valid, errorMessage: '' }).success).toBe(false);
    expect(createIncidentSchema.safeParse({ ...valid, logDetails: 'x'.repeat(20001) }).success).toBe(false);
    expect(createIncidentSchema.safeParse({ ...valid, occurredAt: 'not-a-date' }).success).toBe(false);
  });
});

describe('resolveSchema', () => {
  const ok = { actualRootCause: 'Pool too small', resolutionApplied: 'Raised pool size', verificationResults: 'Recovered', serviceRecovered: true, engineerConfirmed: true };
  it('requires explicit engineer confirmation', () => {
    expect(resolveSchema.safeParse(ok).success).toBe(true);
    expect(resolveSchema.safeParse({ ...ok, engineerConfirmed: false }).success).toBe(false);
    expect(resolveSchema.safeParse({ ...ok, engineerConfirmed: undefined }).success).toBe(false);
  });
});

describe('llmAnalysisSchema', () => {
  it('accepts the documented output shape', () => {
    const r = llmAnalysisSchema.parse({ summary: 's', possibleCauses: [{ cause: 'c', confidence: 'medium', evidence: ['e'] }], historicalComparisons: [], recommendedChecks: [], missingInformation: [], requiresEngineerReview: true });
    expect(r.possibleCauses[0].basedOn).toBe('current_evidence');
    expect(r.alternativeExplanations).toEqual([]);
  });
  it('rejects invalid confidence values', () => {
    expect(llmAnalysisSchema.safeParse({ summary: 's', possibleCauses: [{ cause: 'c', confidence: 'certain', evidence: [] }] }).success).toBe(false);
  });
});
