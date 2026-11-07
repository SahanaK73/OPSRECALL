import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Card, Empty, ErrorBox, Icon, PageHeader, Spinner, SyntheticTag, fmt, useLoad } from '../components/ui';

export default function HistoricalMemory() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const applied = params.get('q') ?? '';
  const [q, setQ] = useState(applied);
  const { data, error, loading, reload } = useLoad(() => api.memory(applied || undefined), [applied]);
  const submit = (e: FormEvent) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); };

  const retained = data?.retainedIncidents.filter((m) => m.retained).length ?? 0;
  const needle = applied.toLowerCase();
  const incidents = (data?.retainedIncidents ?? []).filter((m) =>
    !needle || [m.title, m.serviceName, m.confirmedRootCause, m.resolutionApplied, m.verificationResults].join(' ').toLowerCase().includes(needle));

  return (
    <div className="page">
      <PageHeader
        eyebrow="HINDSIGHT"
        title="Historical memory"
        description="Explore confirmed causes and resolutions your team can recall under pressure."
        right={
          data ? (
            <div className="memory-total">
              <Icon name="brain" />
              <strong>{retained}</strong>
              <span>trusted {retained === 1 ? 'memory' : 'memories'}</span>
            </div>
          ) : undefined
        }
      />
      <form className="memory-toolbar" onSubmit={submit}>
        <div className="search-box">
          <Icon name="search" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search causes, services, fixes, or incident titles…" />
        </div>
        <button className="button primary" type="submit"><span>Search</span></button>
        {applied && <button className="button outline" type="button" onClick={() => { setQ(''); setParams({}); }}><span>Clear</span></button>}
      </form>

      {loading && <Spinner label="Loading memory…" />}
      {error && <ErrorBox message={error} onRetry={reload} />}

      {data && (
        <>
          {incidents.length === 0 ? (
            <Empty
              title={applied ? 'No memories found' : 'Memory is empty'}
              hint={applied ? `Nothing matches “${applied}”. Try a service name, error keyword, or incident title.` : 'Resolve an incident and click “Confirm and Remember Resolution” to teach OpsRecall.'}
            />
          ) : (
            <div className="memory-grid">
              {incidents.map((m) => (
                <Card className="memory-card" key={String(m.incidentId)}>
                  <div className="memory-card-head">
                    <span className="memory-icon"><Icon name="brain" size={17} /></span>
                    <div>
                      <span className="mono">{String(m.incidentId).slice(-6).toUpperCase()}</span>
                      <small>{m.serviceName}{m.severity ? ` · ${m.severity}` : ''}</small>
                    </div>
                    {m.isSynthetic && <SyntheticTag />}
                  </div>
                  <h2 style={{ cursor: 'pointer' }} onClick={() => nav(`/incidents/${m.incidentId}`)}>{m.title}</h2>
                  <div className="memory-detail"><div><span>ROOT CAUSE</span><p>{m.confirmedRootCause}</p></div></div>
                  <div className="memory-detail"><div><span>CONFIRMED FIX</span><p>{m.resolutionApplied}</p></div></div>
                  <div className="memory-detail verify">
                    <Icon name="shield" size={15} />
                    <div><span>VERIFICATION</span><p>{m.verificationResults} · recovered: {m.serviceRecovered ? 'yes' : 'no'}</p></div>
                  </div>
                  <div className="recall-footer">
                    <span><Icon name="link" size={14} />Where it was recalled</span>
                    <strong>
                      {m.recalledBy.length === 0 ? 'Not yet recalled' : `Recalled ${m.recalledBy.length} time${m.recalledBy.length === 1 ? '' : 's'}`}
                    </strong>
                  </div>
                  {m.recalledBy.length > 0 && (
                    <ul className="field-hint" style={{ paddingLeft: 18 }}>
                      {m.recalledBy.map((r) => (
                        <li key={r.incidentId}>
                          <a className="link" href={`/incidents/${r.incidentId}/analysis`} onClick={(e) => { e.preventDefault(); nav(`/incidents/${r.incidentId}/analysis`); }}>{r.title}</a>
                          {r.relevance ? ` (judged ${r.relevance} relevance)` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="field-hint">
                    {m.retained ? `Retained ${m.retainedAt ? fmt(m.retainedAt) : ''}` : `Not retained yet${m.retainError ? `: ${m.retainError}` : ''}`}
                  </p>
                </Card>
              ))}
            </div>
          )}

          <Card className="info-card" >
            <h3>Facts stored in Hindsight</h3>
            <p>Live from the Hindsight Cloud API — what the memory engine extracted from retained incidents.</p>
            {data.hindsightError && <div style={{ marginTop: 12 }}><ErrorBox message={`Hindsight unavailable: ${data.hindsightError}`} /></div>}
            {data.hindsight && (data.hindsight.items.length === 0
              ? <p style={{ marginTop: 10 }}>No facts stored yet.</p>
              : (
                <>
                  <p className="field-hint">{data.hindsight.total} fact(s)</p>
                  <ul>{data.hindsight.items.map((f) => <li key={f.id}>{f.text}</li>)}</ul>
                </>
              ))}
          </Card>
        </>
      )}
    </div>
  );
}
