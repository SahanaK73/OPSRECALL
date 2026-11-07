import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button, Card, ErrorBox, Icon, Kicker, PageHeader, SectionHeading, SeverityBadge, Spinner, StatusBadge, SyntheticTag, fmt, useLoad, type IconName } from '../components/ui';

export default function IncidentDetails() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: inc, error, loading, reload } = useLoad(() => api.get(id), [id]);
  if (loading && !inc) return <div className="page"><Spinner label="Loading incident…" /></div>;
  if (error) return <div className="page"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!inc) return null;

  const last = inc.analyses[inc.analyses.length - 1];
  const memAnalysis = [...inc.analyses].reverse().find((a) => a.recalledMemories.length > 0);

  type Row = { title: string; time: string; text: string; icon: IconName; memory?: boolean };
  const lifecycle: Row[] = [
    { title: 'Submitted', time: fmt(inc.createdAt), text: `${inc.title} reported on ${inc.serviceName} (${inc.environment}).`, icon: 'file' },
  ];
  if (last) lifecycle.push({ title: 'Diagnosis', time: fmt(last.createdAt), text: last.result.summary, icon: 'pulse' });
  if (memAnalysis) {
    lifecycle.push({
      title: 'Memory references', time: fmt(memAnalysis.createdAt),
      text: `Hindsight recalled ${memAnalysis.recalledMemories.length} past incident(s) that were supplied to the AI.`, icon: 'brain', memory: true,
    });
  }
  if (inc.resolution) {
    lifecycle.push({
      title: 'Confirmed resolution', time: inc.resolution.retainedAt ? fmt(inc.resolution.retainedAt) : '',
      text: inc.resolution.retained ? 'Engineer confirmed and retained in Hindsight.' : 'Engineer confirmed; not yet retained in Hindsight.', icon: 'check',
    });
  }

  return (
    <div className="page">
      <Kicker to="/incidents" label="Incidents">
        <Icon name="chevron" size={13} />
        <span className="mono">{inc._id.slice(-6).toUpperCase()}</span>
      </Kicker>
      <PageHeader
        title={inc.title}
        description="A complete, evidence-linked record of the incident lifecycle."
        right={
          <div className="header-badges">
            {inc.isSynthetic && <SyntheticTag />}
            <SeverityBadge s={inc.severity} />
            <StatusBadge s={inc.status} />
          </div>
        }
      />
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Button icon="spark" onClick={() => nav(`/incidents/${id}/analysis`)}>Open analysis</Button>
        {inc.status !== 'resolved' && <Button variant="mint" icon="check" onClick={() => nav(`/incidents/${id}/resolve`)}>Confirm resolution</Button>}
      </div>

      <div className="details-grid">
        <Card className="lifecycle">
          <SectionHeading title="Incident lifecycle" action={<span className="muted-label">{inc.analyses.length} analysis run(s)</span>} />
          {lifecycle.map((row, i) => (
            <div className="lifecycle-row" key={row.title}>
              <div className={`lifecycle-node ${row.memory ? 'memory' : ''}`}><Icon name={row.icon} size={16} /></div>
              {i < lifecycle.length - 1 && <i />}
              <div>
                <div><h3>{row.title}</h3><time>{row.time}</time></div>
                <p>{row.text}</p>
                {row.memory && memAnalysis && memAnalysis.recalledMemories.map((m) => (
                  <button key={m.ref} onClick={() => (m.incidentId ? nav(`/incidents/${m.incidentId}`) : nav('/memory'))}>
                    {m.title ?? 'Past incident'}{m.llm ? ` · ${m.llm.relevance} relevance` : ''} <Icon name="arrow" size={13} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!last && <p className="field-hint">Not analysed yet.</p>}
        </Card>

        <div className="details-side">
          <Card>
            <SectionHeading title="Incident metadata" />
            <dl>
              <div><dt>Service</dt><dd className="mono">{inc.serviceName}</dd></div>
              <div><dt>Environment</dt><dd>{inc.environment}</dd></div>
              <div><dt>Severity</dt><dd>{inc.severity}</dd></div>
              <div><dt>Started</dt><dd>{fmt(inc.occurredAt)}</dd></div>
              {inc.resolution?.engineerName && <div><dt>Resolved by</dt><dd>{inc.resolution.engineerName}</dd></div>}
            </dl>
          </Card>
          {inc.resolution ? (
            <Card className="resolution-summary">
              <span className="eyebrow">CONFIRMED RESOLUTION</span>
              <h3>{inc.resolution.actualRootCause}</h3>
              <p>{inc.resolution.resolutionApplied}</p>
              <div><Icon name="shield" size={16} />{inc.resolution.verificationResults} · recovered: {inc.resolution.serviceRecovered ? 'yes' : 'no'}</div>
            </Card>
          ) : (
            <Card className="resolution-summary">
              <span className="eyebrow">CONFIRMED RESOLUTION</span>
              <p>Awaiting engineer confirmation.</p>
            </Card>
          )}
        </div>
      </div>

      <Card className="info-card" >
        <h3>Original submission</h3>
        <p><strong>Error message</strong></p>
        <pre className="pre-block">{inc.errorMessage}</pre>
        {inc.symptoms && <p style={{ marginTop: 12 }}><strong>Symptoms:</strong> {inc.symptoms}</p>}
        {inc.recentDeployment && <p style={{ marginTop: 8 }}><strong>Recent deployment:</strong> {inc.recentDeployment}</p>}
        {inc.logDetails && <><p style={{ marginTop: 12 }}><strong>Logs</strong></p><pre className="pre-block">{inc.logDetails}</pre></>}
      </Card>

      <Card className="info-card">
        <h3>Timeline</h3>
        {inc.activity.length ? <ul>{inc.activity.map((a, i) => <li key={i}>{fmt(a.at)} — {a.message}</li>)}</ul> : <p>No activity recorded.</p>}
      </Card>
    </div>
  );
}
