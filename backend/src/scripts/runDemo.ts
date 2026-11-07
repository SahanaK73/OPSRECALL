// End-to-end demo against a RUNNING backend (npm run dev in another terminal).
// Uses the real API -> real MongoDB, real Hindsight retain/recall, real Groq. Nothing is mocked.
// All incidents are labelled SYNTHETIC.
const BASE = process.env.API_URL ?? 'http://localhost:5000/api';

async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json?.error?.message ?? 'error'}`);
  return json;
}
const hr = (t: string) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);
const show = (a: any) => {
  console.log(`memory requested: ${a.memoryRequested} | memory actually supplied to LLM: ${a.memoryUsed}`);
  console.log(`summary: ${a.result.summary}`);
  a.result.possibleCauses.forEach((c: any) => console.log(`  cause [${c.confidence}] ${c.cause}  (basedOn: ${c.basedOn})`));
  console.log('  checks:', a.result.recommendedChecks.slice(0, 4));
  if (a.recalledMemories.length) {
    a.recalledMemories.forEach((m: any) => {
      console.log(`  MEMORY ${m.ref}: "${m.title}" -> confirmed cause: ${m.confirmedRootCause}`);
      console.log(`     resolution: ${m.resolutionApplied}`);
      console.log(`     LLM relevance: ${m.llm?.relevance ?? 'n/a'} | shared terms: ${m.sharedTerms.join(', ')}`);
    });
  } else console.log('  (no historical incidents referenced)');
};

async function main() {
  const { scenarios } = await api('/incidents/synthetic');
  const [s1, s2, s3] = scenarios;

  hr('STEP 1 - BEFORE MEMORY: Scenario 2 analysed WITHOUT memory');
  const inc2 = await api('/incidents', 'POST', s2.incident);
  show(await api(`/incidents/${inc2._id}/analyze`, 'POST', { useMemory: false }));

  hr('STEP 2 - Scenario 1 submitted, analysed and RESOLVED by an engineer (retain)');
  const inc1 = await api('/incidents', 'POST', s1.incident);
  show(await api(`/incidents/${inc1._id}/analyze`, 'POST', { useMemory: true }));
  const r = await api(`/incidents/${inc1._id}/resolve`, 'POST', s1.resolution);
  console.log(`retained in Hindsight: ${r.retained}${r.warning ? ' - ' + r.warning : ''}`);

  hr('STEP 3 - AFTER MEMORY: same Scenario 2 incident re-analysed WITH Hindsight recall');
  show(await api(`/incidents/${inc2._id}/analyze`, 'POST', { useMemory: true }));

  hr('STEP 4 - Scenario 3 (HTTP 502): memory must NOT be forced onto an unrelated incident');
  const inc3 = await api('/incidents', 'POST', s3.incident);
  show(await api(`/incidents/${inc3._id}/analyze`, 'POST', { useMemory: true }));
  console.log('\nDone. Open the web UI to see the same results with full provenance.');
}
main().catch((e) => { console.error('Demo failed:', e.message); process.exit(1); });
