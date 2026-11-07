import { describe, it, expect } from 'vitest';
import { groupFactsByIncident, reconcileWithMemory, sharedTerms, buildSystemPrompt, RecalledMemoryRecord } from '../services/analysis.service';
import { buildRecallQuery, buildRetainContent, documentIdFor, incidentIdFromDocumentId } from '../services/hindsight.service';
import { syntheticScenarios } from '../data/syntheticIncidents';

describe('Hindsight helpers', () => {
  it('maps incident ids to document ids and back', () => {
    expect(documentIdFor('abc')).toBe('incident-abc');
    expect(incidentIdFromDocumentId('incident-abc')).toBe('abc');
    expect(incidentIdFromDocumentId('other')).toBeNull();
  });
  it('recall query includes service, error and symptoms', () => {
    const s = syntheticScenarios()[1].incident;
    const q = buildRecallQuery(s);
    expect(q).toContain('payment-service');
    expect(q).toContain('connection timeout');
    expect(q).toContain('Increased payment request failures');
  });
  it('retain content includes confirmed root cause, resolution, verification and id', () => {
    const s = syntheticScenarios()[0];
    const c = buildRetainContent({ incidentId: 'id1', ...s.incident, ...s.resolution, isSynthetic: true });
    expect(c).toContain('Incident ID: id1');
    expect(c).toContain('CONFIRMED ROOT CAUSE');
    expect(c).toContain('RESOLUTION APPLIED');
    expect(c).toContain('VERIFICATION OUTCOME');
    expect(c).toContain('synthetic');
  });
});

describe('groupFactsByIncident', () => {
  const f = (id: string, doc: string | null, text: string) => ({ id, text, documentId: doc });
  it('groups facts per incident, keeps ranking, excludes the current incident', () => {
    const groups = groupFactsByIncident([f('1', 'incident-A', 'a1'), f('2', 'incident-B', 'b1'), f('3', 'incident-A', 'a2'), f('4', 'incident-CUR', 'x')], 'CUR');
    expect(groups.map((g) => g.incidentId)).toEqual(['A', 'B']);
    expect(groups[0].facts).toEqual(['a1', 'a2']);
  });
  it('returns empty for empty recall', () => expect(groupFactsByIncident([], 'x')).toEqual([]));
});

describe('sharedTerms', () => {
  it('finds meaningful overlap and ignores stop words', () => {
    const t = sharedTerms('database connection timeout pool', 'connection pool exhausted database');
    expect(t).toEqual(expect.arrayContaining(['database', 'connection', 'pool']));
  });
  it('is empty for unrelated text', () => expect(sharedTerms('502 bad gateway upstream catalog', 'database pool exhausted')).toEqual([]));
});

describe('reconcileWithMemory (no fabricated provenance)', () => {
  const mem: RecalledMemoryRecord = { ref: 'HIST-1', verifiedRecord: true, retrievedFacts: ['x'], hindsightRank: 1, sharedService: true, sharedTerms: [], suppliedToLlm: true };
  const base = { summary: 's', recommendedChecks: [], alternativeExplanations: [], missingInformation: [], insufficientEvidence: false, requiresEngineerReview: false };
  it('drops comparisons that reference memories never supplied and forces engineer review', () => {
    const out = reconcileWithMemory(
      { ...base, possibleCauses: [{ cause: 'c', confidence: 'low', evidence: [], basedOn: 'historical_memory' }], historicalComparisons: [{ memoryRef: 'HIST-9', relevance: 'high', similarities: [], differences: [], influence: '' }] },
      [mem],
    );
    expect(out.historicalComparisons).toHaveLength(0);
    expect(out.memoryInfluenced).toBe(false);
    expect(out.possibleCauses[0].basedOn).toBe('current_evidence'); // cannot claim memory influence
    expect(out.requiresEngineerReview).toBe(true);
  });
  it('keeps valid comparisons and attaches the LLM relevance to the provenance record', () => {
    const m = { ...mem };
    const out = reconcileWithMemory(
      { ...base, possibleCauses: [{ cause: 'c', confidence: 'medium', evidence: [], basedOn: 'both' }], historicalComparisons: [{ memoryRef: 'HIST-1', relevance: 'high', similarities: ['pool'], differences: [], influence: 'check pool' }] },
      [m],
    );
    expect(out.memoryInfluenced).toBe(true);
    expect(m.llm?.relevance).toBe('high');
    expect(out.possibleCauses[0].basedOn).toBe('both');
  });
  it('a "none" relevance memory does not count as influence', () => {
    const out = reconcileWithMemory({ ...base, possibleCauses: [], historicalComparisons: [{ memoryRef: 'HIST-1', relevance: 'none', similarities: [], differences: ['different'], influence: '' }] }, [{ ...mem }]);
    expect(out.memoryInfluenced).toBe(false);
  });
});

describe('prompt', () => {
  it('forbids historical references when no memory is supplied', () => {
    expect(buildSystemPrompt(false)).toContain('MUST be an empty array');
    expect(buildSystemPrompt(true)).toContain('HIST-n');
  });
});

describe('synthetic data', () => {
  it('has three scenarios all labelled synthetic', () => {
    const s = syntheticScenarios();
    expect(s).toHaveLength(3);
    s.forEach((x) => expect(x.incident.isSynthetic).toBe(true));
  });
});
