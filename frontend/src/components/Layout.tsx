import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Icon, type IconName } from './ui';

const nav: { label: string; icon: IconName; to: string; match: (p: string) => boolean }[] = [
  { label: 'Dashboard', icon: 'grid', to: '/', match: (p) => p === '/' },
  { label: 'Incidents', icon: 'alert', to: '/incidents', match: (p) => p.startsWith('/incidents') && p !== '/incidents/new' },
  { label: 'Submit Incident', icon: 'plus', to: '/incidents/new', match: (p) => p === '/incidents/new' },
  { label: 'Historical Memory', icon: 'brain', to: '/memory', match: (p) => p.startsWith('/memory') },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<{ ok: boolean; text: string } | null>(null);
  const [memCount, setMemCount] = useState<number | null>(null);
  const [incCount, setIncCount] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.health()
      .then((h) => {
        const ok = h.mongodb === 'connected' && h.hindsight?.ok !== false;
        setHealth({ ok, text: ok ? 'All connected' : 'Check connections' });
      })
      .catch(() => setHealth({ ok: false, text: 'Backend offline' }));
  }, []);

  // Live counts for the sidebar (refresh when navigating)
  useEffect(() => {
    api.memory().then((m) => setMemCount(m.retainedIncidents.filter((x) => x.retained).length)).catch(() => setMemCount(null));
    api.stats().then((s) => setIncCount(s.open)).catch(() => setIncCount(null));
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const go = (to: string) => { navigate(to); setOpen(false); };
  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/memory${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <button className="logo" onClick={() => go('/')} aria-label="OpsRecall home">
            <span><Icon name="pulse" size={19} /></span>
            OpsRecall
          </button>
          <button className="mobile-close" onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>
        <nav>
          <span className="nav-label">WORKSPACE</span>
          {nav.map((n) => (
            <button key={n.label} className={n.match(pathname) ? 'active' : ''} onClick={() => go(n.to)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.label === 'Incidents' && incCount ? <b>{incCount}</b> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-memory">
          <div>
            <Icon name="brain" size={16} />
            <span>
              <strong>Hindsight</strong>
              <small>{memCount === null ? 'Memory unavailable' : `${memCount} trusted ${memCount === 1 ? 'memory' : 'memories'}`}</small>
            </span>
          </div>
          <div className="mini-progress"><span style={{ width: `${Math.min(100, (memCount ?? 0) * 10)}%` }} /></div>
        </div>
        <div className="connection">
          <span style={health && !health.ok ? { background: '#e5748f' } : undefined} />
          <div>
            <strong>{health?.text ?? 'Checking…'}</strong>
            <small>Engineers approve every fix</small>
          </div>
        </div>
        <div className="profile">
          <span>ER</span>
          <div>
            <strong>Engineer on call</strong>
            <small>OpsRecall never runs changes</small>
          </div>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <main>
        <div className="mobile-header">
          <button onClick={() => setOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="logo"><span><Icon name="pulse" size={16} /></span>OpsRecall</div>
          <button onClick={() => go('/incidents/new')} aria-label="New incident"><Icon name="plus" /></button>
        </div>
        <form className="topbar" onSubmit={search}>
          <label className="search-trigger" style={{ cursor: 'text' }}>
            <Icon name="search" size={16} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search historical memory…"
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: 13 }}
            />
          </label>
          <button type="button" className="button primary" onClick={() => go('/incidents/new')}>
            <Icon name="plus" size={16} /><span>New incident</span>
          </button>
        </form>
        <Outlet />
      </main>
    </div>
  );
}
