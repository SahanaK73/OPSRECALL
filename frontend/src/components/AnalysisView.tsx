import type { Analysis, RecalledMemory } from '../lib/types';
import { Bullets, Card, Confidence, Icon, Relevance, SectionHeading, fmt } from './ui';

const barColor = { high: '#BFEBD9', medium: '#FFF1BF', low: '#DAD8E2' } as const;
const barWidth = { high: 88, medium: 55, low: 25 } as const; // visual only; the label is the real signal

function RootCause({ rank, cause, confidence, evidence, basedOn, memoryUsed }: { rank: number; cause: string; confidence: 'low' | 'medium' | 'high'; evidence: string[]; basedOn: string; memoryUsed: boolean }) {
  return (
    <Card className={`root-cause ${memoryUsed && basedOn !== 'current_incident' ? 'selected' : ''}`}>
      <span className="rank">{String(rank).padStart(2, '0')}</span>
      <div className="cause-content">
        <div>
          <h3>{cause}</h3>
          <Confidence level={confidence} />
        </div>
        <div className="confidence-bar"><span style={{ width: `${barWidth[confidence]}%`, background: barColor[confidence] }} /></div>
        {evidence.length > 0 ? (
          evidence.map((e, i) => (
            <p key={i}><Icon name="link" size={14} /> <strong>Evidence:</strong> {e}</p>
          ))
        ) : (
          <p><Icon name="link" size={14} /> <strong>Evidence:</strong> none cited from the current incident</p>
        )}
        {memoryUsed && <p style={{ marginTop: 6 }}><strong>Informed by:</strong> {basedOn.replace(/_/g, ' ')}</p>}
      </div>
    </Card>
  );
}

function Provenance({ m }: { m: RecalledMemory }) {
  return (
    <Card className="provenance">
      <div className="provenance-head">
        <span className="memory-icon"><Icon name="brain" /></span>
        <div>
          <span className="eyebrow lavender">MEMORY PROVENANCE</span>
          <h2>Why this was recalled</h2>
        </div>
        {m.llm && <Relevance level={m.llm.relevance} />}
      </div>
      <div className="past-incident">
        <div>
          <span className="mono">{m.ref}</span>
          <small>Hindsight rank #{m.hindsightRank}</small>
        </div>
        <strong>{m.title ?? 'Past incident (from recalled facts)'}</strong>
      </div>
      {m.verifiedRecord ? (
        <>
          <div className="provenance-item"><Icon name="check" size={15} /><div><span>Confirmed root cause</span><p>{m.confirmedRootCause}</p></div></div>
          <div className="provenance-item"><Icon name="check" size={15} /><div><span>Previous resolution</span><p>{m.resolutionApplied}</p></div></div>
          <div className="provenance-item"><Icon name="check" size={15} /><div><span>Verification then</span><p>{m.verificationResults} · service recovered: {m.serviceRecovered ? 'yes' : 'no'}</p></div></div>
        </>
      ) : (
        <p className="field-hint">Recalled facts only — no engineer-verified record matched.</p>
      )}
      {(m.sharedService != null || m.sharedTerms.length > 0) && (
        <div className="provenance-section">
          <span>SHARED SIGNALS</span>
          <div className="chip-list">
            {m.sharedService != null && <span className="keyword">{m.sharedService ? 'same service' : 'different service'}</span>}
            {m.sharedTerms.map((x) => <span className="keyword" key={x}>{x}</span>)}
          </div>
        </div>
      )}
      {m.llm && (m.llm.similarities.length > 0 || m.llm.differences.length > 0) && (
        <div className="provenance-section">
          <span>MEANINGFUL DIFFERENCES</span>
          <div className="chip-list">
            {m.llm.similarities.map((s, i) => <span className="keyword" key={'s' + i}>{s}</span>)}
            {m.llm.differences.map((s, i) => <span className="difference" key={'d' + i}>{s}</span>)}
          </div>
        </div>
      )}
      {m.llm?.influence && (
        <div className="provenance-item"><Icon name="spark" size={15} /><div><span>How it influenced this analysis</span><p>{m.llm.influence}</p></div></div>
      )}
      <details className="recalled-detail">
        <summary>Raw facts returned by Hindsight recall ({m.retrievedFacts.length})</summary>
        <ul>{m.retrievedFacts.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </details>
    </Card>
  );
}

/** Renders one stored analysis, including real memory provenance. */
export default function AnalysisView({ a }: { a: Analysis }) {
  const r = a.result;
  return (
    <>
      <Card className="info-card">
        <span className="eyebrow lavender">
          {a.memoryUsed
            ? `MEMORY-ASSISTED · ${a.recalledMemories.length} past incident(s) supplied to the AI`
            : a.memoryRequested ? 'MEMORY SEARCHED · nothing relevant to supply' : 'NO MEMORY · analysed from current evidence only'}
        </span>
        <p style={{ marginTop: 8, color: 'var(--ink)' }}>{r.summary}</p>
        {a.memoryError && <p className="warn-note">Hindsight unavailable ({a.memoryError}). This analysis ran without memory.</p>}
        {r.insufficientEvidence && <p className="warn-note">The AI reports insufficient evidence for a firm conclusion.</p>}
        <p className="field-hint">{fmt(a.createdAt)} · model {a.model} · Requires engineer review — these are hypotheses, not confirmed facts.</p>
      </Card>

      <div className="analysis-grid">
        <div>
          <SectionHeading title="Root-cause recommendations" action={<span className="muted-label">Ranked by the AI</span>} />
          <div className="root-causes">
            {r.possibleCauses.length === 0 && <Card className="info-card"><p>No causes proposed.</p></Card>}
            {r.possibleCauses.map((c, i) => (
              <RootCause key={i} rank={i + 1} cause={c.cause} confidence={c.confidence} evidence={c.evidence} basedOn={c.basedOn} memoryUsed={a.memoryUsed} />
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          {a.recalledMemories.length > 0
            ? a.recalledMemories.map((m) => <Provenance key={m.ref} m={m} />)
            : (
              <Card className="info-card">
                <h3>No memory used</h3>
                <p>No historical incident was supplied to the AI for this analysis, so nothing is claimed as remembered.</p>
              </Card>
            )}
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 20 }}>
        <Card className="info-card">
          <h3>Suggested investigation steps</h3>
          {r.recommendedChecks.length ? <ol>{r.recommendedChecks.map((c, i) => <li key={i}>{c}</li>)}</ol> : <p>None</p>}
        </Card>
        <Card className="info-card">
          <h3>Alternative explanations</h3>
          <Bullets items={r.alternativeExplanations} />
        </Card>
      </div>
      <Card className="info-card">
        <h3>Missing information</h3>
        <Bullets items={r.missingInformation} empty="Nothing flagged" />
      </Card>
    </>
  );
}
