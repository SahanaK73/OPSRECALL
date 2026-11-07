import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button, Card, ErrorBox, Field, Icon, Kicker, PageHeader, Relevance, SectionHeading, Spinner, useLoad } from '../components/ui';

export default function ResolveIncident() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { data: inc, error, loading, reload } = useLoad(() => api.get(id), [id]);
  const [f, setF] = useState({ actualRootCause: '', resolutionApplied: '', verificationResults: '', serviceRecovered: true, engineerName: '', engineerConfirmed: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ retained: boolean; warning?: string } | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fillSynthetic = async () => {
    const { scenarios } = await api.synthetic();
    const s = scenarios.find((x) => x.resolution && inc && x.incident.title === inc.title);
    if (s?.resolution) setF({ ...f, ...s.resolution, engineerConfirmed: false });
  };

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { setDone(await api.resolve(id, f)); reload(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  if (loading && !inc) return <div className="page"><Spinner label="Loading incident…" /></div>;
  if (error) return <div className="page"><ErrorBox message={error} onRetry={reload} /></div>;
  if (!inc) return null;

  if (done || inc.status === 'resolved') {
    const retained = done ? done.retained : !!inc.resolution?.retained;
    const who = inc.resolution?.engineerName || f.engineerName;
    return (
      <div className="success-wrap">
        <Card className="success-state">
          <span className="success-icon"><Icon name={retained ? 'check' : 'alert'} size={30} /></span>
          <span className="eyebrow">{retained ? 'INCIDENT RESOLVED' : 'RESOLUTION SAVED'}</span>
          <h1>{retained ? 'Retained in Hindsight' : 'Not yet retained in Hindsight'}</h1>
          <p>
            {retained
              ? 'This resolution is now part of your team’s operational memory and can be recalled when similar symptoms appear.'
              : done?.warning ?? inc.resolution?.retainError ?? 'The resolution was saved, but Hindsight did not accept it yet.'}
          </p>
          <div className="memory-receipt">
            <div>
              <Icon name="brain" />
              <span>
                <strong>{inc.title}</strong>
                <small>{inc._id.slice(-6).toUpperCase()}{who ? ` · Confirmed by ${who}` : ''}</small>
              </span>
            </div>
            {retained && <Relevance>Verified memory</Relevance>}
          </div>
          <div className="success-actions">
            {!retained && (
              <Button
                disabled={retrying}
                onClick={async () => { setRetrying(true); try { await api.retryRetain(id); setDone(null); reload(); } finally { setRetrying(false); } }}
              >
                {retrying ? 'Retrying…' : 'Retry retaining'}
              </Button>
            )}
            <Button variant="outline" onClick={() => nav(`/incidents/${id}`)}>View incident details</Button>
            <Button variant={retained ? 'primary' : 'outline'} onClick={() => nav('/memory')}>Open historical memory</Button>
          </div>
        </Card>
      </div>
    );
  }

  const set = (k: 'actualRootCause' | 'resolutionApplied' | 'verificationResults') => (e: React.ChangeEvent<HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="page confirmation-page">
      <Kicker to={`/incidents/${id}/analysis`} label="Back to analysis">
        <span className="mono">{inc._id.slice(-6).toUpperCase()}</span>
      </Kicker>
      <PageHeader
        eyebrow="FINAL STEP"
        title="Confirm the resolution"
        description="Only engineer-verified facts are stored in memory. AI guesses are never retained."
      />
      <form onSubmit={submit}>
        <div className="confirmation-grid">
          <Card className="confirmation-form">
            <SectionHeading title="Resolution record" action={inc.isSynthetic ? <button type="button" className="text-button" onClick={fillSynthetic}>Fill demo resolution</button> : undefined} />
            <p className="field-hint" style={{ marginTop: -8, marginBottom: 14 }}>{inc.title} · {inc.serviceName} · {inc.environment}</p>
            <Field label="Confirmed root cause" required><textarea required minLength={5} value={f.actualRootCause} onChange={set('actualRootCause')} /></Field>
            <Field label="Resolution applied" required><textarea required minLength={5} value={f.resolutionApplied} onChange={set('resolutionApplied')} /></Field>
            <Field label="How was the fix verified?" required><textarea required minLength={5} value={f.verificationResults} onChange={set('verificationResults')} /></Field>
            <div className="field-row">
              <Field label="Engineer name"><input value={f.engineerName} onChange={(e) => setF({ ...f, engineerName: e.target.value })} placeholder="Your name" /></Field>
              <Field label="Did the service recover?">
                <select value={String(f.serviceRecovered)} onChange={(e) => setF({ ...f, serviceRecovered: e.target.value === 'true' })}>
                  <option value="true">Yes, recovered</option>
                  <option value="false">No, not recovered</option>
                </select>
              </Field>
            </div>
          </Card>
          <div>
            <Card className="retention-preview">
              <div className="memory-icon"><Icon name="brain" /></div>
              <span className="eyebrow lavender">WHAT HINDSIGHT WILL RETAIN</span>
              <h2>A concise, verified memory</h2>
              <p>Future responders will see the confirmed cause, fix, verification, and relevant system signals — not the full incident transcript.</p>
              <ul>
                <li><Icon name="check" size={14} />Confirmed by a human responder</li>
                <li><Icon name="check" size={14} />Linked to the source incident</li>
                <li><Icon name="check" size={14} />Only your confirmed facts, never AI guesses</li>
              </ul>
            </Card>
            <label className={`confirmation-check ${f.engineerConfirmed ? 'checked' : ''}`}>
              <input type="checkbox" checked={f.engineerConfirmed} onChange={(e) => setF({ ...f, engineerConfirmed: e.target.checked })} />
              <span><Icon name="check" size={16} /></span>
              <div>
                <strong>I confirm this resolution is accurate</strong>
                <p>I am the responsible engineer and the root cause and fix above are verified.</p>
              </div>
            </label>
            {err && <ErrorBox message={err} />}
            <Button variant="mint" icon="brain" type="submit" disabled={busy || !f.engineerConfirmed}>
              {busy ? 'Saving and retaining (can take ~30s)…' : 'Confirm and Remember Resolution'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
