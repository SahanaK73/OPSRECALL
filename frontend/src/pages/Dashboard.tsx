import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { C, Card, Empty, ErrorBox, Icon, IncidentRow, LinkButton, PageHeader, SectionHeading, Spinner, timeAgo, useLoad, type IconName } from '../components/ui';

const sevColor: Record<string, string> = { Critical: C.rose, High: C.peach, Medium: C.butter, Low: C.sky };

function StatCard({ icon, label, value, note, memory }: { icon: IconName; label: string; value: number; note: string; memory?: boolean }) {
  return (
    <Card className={`stat-card ${memory ? 'memory-stat' : ''}`}>
      <div className="stat-top">
        <span className="stat-icon"><Icon name={icon} /></span>
        <span className="stat-delta">{note}</span>
      </div>
      <strong>{value}</strong>
      <p>{label}</p>
    </Card>
  );
}

function activityIcon(type: string, message: string): { icon: IconName; color: string } {
  const t = `${type} ${message}`.toLowerCase();
  if (t.includes('retain') || t.includes('remember')) return { icon: 'brain', color: '#F1ECFF' };
  if (t.includes('resolv') || t.includes('confirm')) return { icon: 'check', color: C.mint };
  if (t.includes('memory') || t.includes('hindsight') || t.includes('recall')) return { icon: 'brain', color: '#F1ECFF' };
  if (t.includes('analys')) return { icon: 'spark', color: C.butter };
  return { icon: 'file', color: C.sky };
}

export default function Dashboard() {
  const nav = useNavigate();
  const stats = useLoad(api.stats);
  const list = useLoad(api.list);
  const err = stats.error || list.error;
  const s = stats.data;
  const maxSev = s ? Math.max(1, ...Object.values(s.severity)) : 1;
  const pct = (n: number) => (s && s.total ? `${Math.round((n / s.total) * 100)}% of total` : '—');

  return (
    <div className="page">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        title="Welcome back"
        description="Here’s what OpsRecall remembers about your systems today."
      />
      <Card className="recall-loop">
        <div className="loop-copy">
          <span className="eyebrow lavender">YOUR INCIDENT MEMORY LOOP</span>
          <h2>Every resolved incident makes the next one easier.</h2>
          <p>OpsRecall connects today’s symptoms to yesterday’s answers, while keeping your team in control.</p>
        </div>
        <div className="loop-flow">
          {['Incident', 'Recall', 'Recommend', 'Confirm', 'Remember'].map((item, i) => (
            <div className="loop-item" key={item}>
              <span className={i === 1 || i === 4 ? 'memory-node' : ''}>{i + 1}</span>
              <small>{item}</small>
              {i < 4 && <Icon name="arrow" size={14} />}
            </div>
          ))}
        </div>
      </Card>

      {err && <ErrorBox message={err} onRetry={() => { stats.reload(); list.reload(); }} />}
      {(stats.loading || list.loading) && !err && <Spinner label="Loading dashboard…" />}

      {s && list.data && (
        <>
          <div className="stats-grid">
            <StatCard icon="file" label="Total incidents" value={s.total} note="all time" />
            <StatCard icon="clock" label="Open" value={s.open} note="not yet resolved" />
            <StatCard icon="alert" label="Critical" value={s.critical} note="by severity" />
            <StatCard icon="shield" label="Resolved" value={s.resolved} note={pct(s.resolved)} />
            <StatCard icon="brain" label="Memory-assisted" value={s.memoryAssisted} note="used Hindsight" memory />
          </div>

          {s.total === 0 ? (
            <Empty
              title="No incidents yet"
              hint="Submit your first incident, or load a synthetic scenario from the submit form."
              action={<LinkButton to="/incidents/new" icon="plus">Submit incident</LinkButton>}
            />
          ) : (
            <div className="dashboard-grid">
              <Card className="incidents-card">
                <SectionHeading
                  title="Recent incidents"
                  action={<button className="text-button" onClick={() => nav('/incidents')}>View all <Icon name="arrow" size={14} /></button>}
                />
                <div className="incident-list">
                  {list.data.slice(0, 6).map((i) => <IncidentRow key={i._id} i={i} />)}
                </div>
              </Card>
              <Card className="severity-card">
                <SectionHeading title="Incidents by severity" action={<span className="muted-label">All time</span>} />
                <div className="chart">
                  {(['Critical', 'High', 'Medium', 'Low'] as const).map((k) => (
                    <div className="bar-row" key={k}>
                      <div><span>{k}</span><strong>{s.severity[k]}</strong></div>
                      <div className="bar-track">
                        <span style={{ width: `${(s.severity[k] / maxSev) * 100}%`, background: sevColor[k] }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="activity-card">
                <SectionHeading title="Recent activity" />
                {s.recentActivity.length === 0 ? (
                  <p className="field-hint">No activity yet.</p>
                ) : (
                  <div className="activity-list">
                    {s.recentActivity.slice(0, 4).map((a, i) => {
                      const ic = activityIcon(a.type, a.message);
                      return (
                        <div className="activity" key={i} style={{ cursor: 'pointer' }} onClick={() => nav(`/incidents/${a.incidentId}`)}>
                          <span className="activity-icon" style={{ background: ic.color }}><Icon name={ic.icon} size={16} /></span>
                          <div>
                            <strong>{a.title}</strong>
                            <p>{a.message}</p>
                          </div>
                          <time>{timeAgo(a.at)}</time>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
