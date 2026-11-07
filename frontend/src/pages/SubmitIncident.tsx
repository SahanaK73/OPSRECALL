import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Button, Card, ErrorBox, Field, Icon, PageHeader, SectionHeading, SyntheticTag } from '../components/ui';
import type { Scenario } from '../lib/types';

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const blank = { title: '', serviceName: '', severity: 'High', environment: 'production', errorMessage: '', logDetails: '', symptoms: '', recentDeployment: '', occurredAt: toLocalInput(new Date()), isSynthetic: false };

export default function SubmitIncident() {
  const nav = useNavigate();
  const [form, setForm] = useState(blank);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => { api.synthetic().then((r) => setScenarios(r.scenarios)).catch(() => {}); }, []);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const loadScenario = (key: string) => {
    const s = scenarios.find((x) => x.key === key);
    if (!s) return;
    setPicked(key);
    const { occurredAt, ...rest } = s.incident;
    // New timestamp each time so loading the same scenario twice is not flagged as a duplicate
    setForm({ ...blank, ...(rest as object), occurredAt: toLocalInput(new Date(new Date(occurredAt).getTime() + Math.floor(Math.random() * 60000))), isSynthetic: true } as typeof blank);
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setExistingId(null);
    try {
      const inc = await api.create({ ...form, occurredAt: new Date(form.occurredAt).toISOString() });
      nav(`/incidents/${inc._id}/analysis`);
    } catch (err) {
      const e2 = err as ApiError;
      setError(e2.message);
      if (e2.code === 'DUPLICATE_INCIDENT') setExistingId((e2.details as any)?.existingId ?? null);
    } finally { setBusy(false); }
  }

  return (
    <div className="page narrow-page">
      <PageHeader
        eyebrow="NEW INCIDENT"
        title="Submit an incident"
        description="Give OpsRecall enough context to investigate and search historical memory."
        right={form.isSynthetic ? <SyntheticTag /> : undefined}
      />

      {scenarios.length > 0 && (
        <div className="scenario-box" style={{ cursor: 'default' }}>
          <span className="scenario-icon"><Icon name="spark" size={20} /></span>
          <span>
            <strong>Try a synthetic scenario</strong>
            <small>Pre-fill this form with a safe, realistic production scenario (all demo data is synthetic).</small>
          </span>
          <select className="analysis-select" value={picked} onChange={(e) => loadScenario(e.target.value)}>
            <option value="" disabled>Choose a scenario…</option>
            {scenarios.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBox message={error} />
          {existingId && <Button variant="outline" onClick={() => nav(`/incidents/${existingId}`)}>Open the existing incident</Button>}
        </div>
      )}

      <form onSubmit={submit}>
        <div className="form-grid">
          <Card className="form-card">
            <SectionHeading title="Incident context" />
            <Field label="Incident title" required>
              <input required minLength={3} maxLength={200} value={form.title} onChange={set('title')} placeholder="e.g. Checkout requests returning 503s" />
            </Field>
            <div className="field-row">
              <Field label="Affected service" required>
                <input required value={form.serviceName} onChange={set('serviceName')} placeholder="payment-service" />
              </Field>
              <Field label="Severity" required>
                <select value={form.severity} onChange={set('severity')}>
                  {['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="field-row">
              <Field label="Environment" required>
                <input required value={form.environment} onChange={set('environment')} placeholder="production" />
              </Field>
              <Field label="When did it start?" required>
                <input required type="datetime-local" value={form.occurredAt} onChange={set('occurredAt')} />
              </Field>
            </div>
            <Field label="What are users experiencing?" hint="Symptoms">
              <textarea maxLength={5000} value={form.symptoms} onChange={set('symptoms')} placeholder="Describe the customer impact and what dashboards show…" />
            </Field>
          </Card>

          <Card className="form-card">
            <SectionHeading title="Technical signals" />
            <Field label="Error message" required hint="Monospace">
              <textarea required maxLength={5000} className="mono code-field" value={form.errorMessage} onChange={set('errorMessage')} placeholder="Paste the exact error message…" />
            </Field>
            <Field label="Relevant logs" hint="Optional">
              <textarea maxLength={20000} className="mono code-field tall" value={form.logDetails} onChange={set('logDetails')} placeholder="Paste logs, one event per line…" />
            </Field>
            <Field label="Recent changes / deployment">
              <textarea maxLength={3000} value={form.recentDeployment} onChange={set('recentDeployment')} placeholder="Deploys, config changes, migrations…" />
            </Field>
          </Card>
        </div>
        <div className="form-actions">
          <p><Icon name="shield" size={16} />Engineers confirm every diagnosis. Nothing is executed automatically.</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" onClick={() => { setForm(blank); setPicked(''); setError(null); }}>Reset</Button>
            <Button type="submit" icon="spark" disabled={busy}>{busy ? 'Submitting…' : 'Submit & begin analysis'}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
