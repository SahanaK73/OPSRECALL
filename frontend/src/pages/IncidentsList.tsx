import { useState } from 'react';
import { api } from '../lib/api';
import { Card, Empty, ErrorBox, IncidentRow, LinkButton, PageHeader, Spinner, useLoad } from '../components/ui';

const label: Record<string, string> = { all: 'All', open: 'Open', analyzed: 'Investigating', resolved: 'Resolved' };

export default function IncidentsList() {
  const { data, error, loading, reload } = useLoad(api.list);
  const [filter, setFilter] = useState('all');
  const rows = (data ?? []).filter((i) => filter === 'all' || i.status === filter);
  return (
    <div className="page">
      <PageHeader
        eyebrow="INCIDENTS"
        title="All incidents"
        description="Every incident reported to OpsRecall."
        right={<LinkButton to="/incidents/new" icon="plus">Submit incident</LinkButton>}
      />
      <div className="filter-chips">
        {Object.keys(label).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{label[f]}</button>
        ))}
      </div>
      {loading && <Spinner label="Loading incidents…" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (rows.length === 0
        ? <Empty title="No incidents match" hint="Submit an incident to get started." />
        : <Card className="incidents-card"><div className="incident-list">{rows.map((i) => <IncidentRow key={i._id} i={i} />)}</div></Card>)}
    </div>
  );
}
