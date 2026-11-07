import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import AnalysisView from '../components/AnalysisView';
import { Button, Card, ErrorBox, Icon, Kicker, PageHeader, Relevance, SeverityBadge, Spinner, StatusBadge, SyntheticTag, fmt, useLoad } from '../components/ui';
import type { Analysis } from '../lib/types';

const STEPS = ['Intake', 'Signals', 'Recall', 'Compare', 'Recommend', 'Confirm'];

export default function IncidentAnalysis() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: inc, error, loading, reload } = useLoad(() => api.get(id), [id]);
  const [busy, setBusy] = useState<null | 'memory' | 'plain'>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [view, setView] = useState<string>('latest');

  async function run(useMemory: boolean) {
    setBusy(useMemory ? 'memory' : 'plain'); setRunError(null);
    try { await api.analyze(id, useMemory); setView('latest'); reload(); } catch (e) { setRunError((e as Error).message); } finally { setBusy(null); }
  }

  if (loading && !inc) return <div className="page"><Spinner label="Loading incident…" /></div>;
  if (error) return <div className="page"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!inc) return null;

  const analyses = [...inc.analyses].reverse();
  const latestPlain = analyses.find((a) => !a.memoryRequested);
  const latestMem = analyses.find((a) => a.memoryRequested);
  const selected: Analysis | undefined = view === 'latest' ? analyses[0] : analyses.find((a) => a._id === view);
  const canCompare = !!latestPlain && !!latestMem;

  // Stepper derived from REAL incident state
  const analysed = analyses.length > 0;
  const done = [true, analysed, analyses.some((a) => a.memoryRequested), analyses.some((a) => a.memoryUsed), analysed, inc.status === 'resolved'];
  const activeIdx = done.findIndex((d) => !d);
  const progressText = busy
    ? busy === 'memory' ? 'Analysing → searching Hindsight → generating recommendation…' : 'Analysing current evidence → generating recommendation…'
    : inc.status === 'resolved' ? 'Resolved and retained' : analysed ? 'Awaiting engineer confirmation' : 'Not analysed yet';

  return (
    <div className="page analysis-page">
      <Kicker to="/incidents" label="Incidents">
        <Icon name="chevron" size={13} />
        <span className="mono">{inc._id.slice(-6).toUpperCase()}</span>
        <SeverityBadge s={inc.severity} />
        <StatusBadge s={inc.status} />
        {inc.isSynthetic && <SyntheticTag />}
      </Kicker>
      <PageHeader title={inc.title} description={`${inc.serviceName} · ${inc.environment} · ${fmt(inc.occurredAt)}`} />

      <Card className="progress-card">
        <div className="progress-title">
          <div>
            {busy && <span className="live-dot" />}
            <strong>{busy ? 'Analysis in progress' : 'Analysis status'}</strong>
          </div>
          <span>{progressText}</span>
        </div>
        <div className="stepper">
          {STEPS.map((step, i) => (
            <div className={`step ${done[i] ? 'complete' : i === activeIdx ? 'active' : ''}`} key={step}>
              <span>{done[i] ? <Icon name="check" size={13} /> : i + 1}</span>
              <small>{step}</small>
              {i < STEPS.length - 1 && <i />}
            </div>
          ))}
        </div>
      </Card>

      <Card className="info-card">
        <h3>Error message</h3>
        <pre className="pre-block">{inc.errorMessage}</pre>
      </Card>

      {busy && <Card className="info-card"><Spinner label={progressText} /></Card>}
      {runError && <ErrorBox message={runError} />}

      {analyses.length === 0 && !busy && (
        <Card className="empty-state">
          <span><Icon name="spark" size={24} /></span>
          <h2>No analysis yet</h2>
          <p>Use the buttons below to analyse this incident. Run both modes to see what memory changes.</p>
        </Card>
      )}

      {canCompare && (
        <div className="comparison-grid">
          {[
            { cls: 'before-card', icon: 'search' as const, t: 'BEFORE: NO MEMORY', a: latestPlain! },
            { cls: 'after-card', icon: 'brain' as const, t: 'AFTER: WITH HINDSIGHT MEMORY', a: latestMem! },
          ].map(({ cls, icon, t, a }) => (
            <Card key={t} className={cls}>
              <div className="comparison-label">
                <Icon name={icon} />
                <span>{t}</span>
                {cls === 'after-card' && a.memoryUsed && <Relevance>Memory used</Relevance>}
              </div>
              <h3>{a.result.summary}</h3>
              <div className={`reference-count ${a.memoryUsed ? 'memory' : ''}`}>
                <strong>{a.recalledMemories.length}</strong>
                <span>past incidents<br />referenced</span>
              </div>
              <ul>
                {a.result.possibleCauses.slice(0, 3).map((c, i) => <li key={i}>{c.cause} ({c.confidence})</li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 14px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Analysis detail</h2>
            <select className="analysis-select" value={view} onChange={(e) => setView(e.target.value)}>
              <option value="latest">Latest</option>
              {analyses.map((a) => <option key={a._id} value={a._id}>{fmt(a.createdAt)} · {a.memoryUsed ? 'with memory' : a.memoryRequested ? 'memory searched (none relevant)' : 'no memory'}</option>)}
            </select>
          </div>
          <AnalysisView a={selected} />
        </>
      )}

      <div className="sticky-actions">
        <div>
          <Icon name="brain" size={18} />
          <span>
            <strong>{selected?.memoryUsed ? 'Hindsight is active' : 'Hindsight ready'}</strong>
            <small>{selected?.memoryUsed ? `${selected.recalledMemories.length} confirmed memory(ies) informed this analysis` : 'Run with memory to recall past incidents'}</small>
          </span>
        </div>
        <div>
          <Button variant="outline" disabled={!!busy} onClick={() => run(false)}>{busy === 'plain' ? 'Working…' : 'Analyse without memory'}</Button>
          <Button icon="spark" disabled={!!busy} onClick={() => run(true)}>{busy === 'memory' ? 'Working…' : 'Analyse with Hindsight memory'}</Button>
          {inc.status !== 'resolved' && <Button variant="mint" icon="check" onClick={() => nav(`/incidents/${id}/resolve`)}>Confirm resolution</Button>}
        </div>
      </div>
    </div>
  );
}
