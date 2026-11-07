import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Incident } from '../lib/types';

export type IconName =
  | 'grid' | 'alert' | 'plus' | 'brain' | 'search' | 'bell' | 'arrow' | 'check' | 'clock' | 'shield'
  | 'pulse' | 'spark' | 'server' | 'link' | 'file' | 'chevron' | 'menu' | 'close' | 'database' | 'trend'
  | 'users' | 'copy';

export const C = {
  mint: '#BFEBD9',
  peach: '#FFE4D1',
  butter: '#FFF1BF',
  rose: '#FFDDE6',
  sky: '#DDEBFF',
};

const paths: Record<IconName, ReactNode> = {
  grid: (<><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>),
  alert: (<><path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  brain: (<><path d="M9.5 4.7A3.5 3.5 0 0 0 3.8 7.4a3.4 3.4 0 0 0 .8 5.8A3.5 3.5 0 0 0 9.5 19" /><path d="M14.5 4.7a3.5 3.5 0 0 1 5.7 2.7 3.4 3.4 0 0 1-.8 5.8 3.5 3.5 0 0 1-4.9 5.8M12 4v16M8 9.5c1.3 0 2.4-1 2.4-2.4M16 9.5c-1.3 0-2.4-1-2.4-2.4M8.2 14.5c1.2 0 2.2.8 2.2 2M15.8 14.5c-1.2 0-2.2.8-2.2 2" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
  bell: (<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>),
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  shield: (<><path d="M12 3 4.5 6v5c0 4.8 3.2 8.3 7.5 10 4.3-1.7 7.5-5.2 7.5-10V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>),
  pulse: <path d="M3 12h4l2.2-5 4 10 2.3-5H21" />,
  spark: (<><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z" /><path d="m5 15 .7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15Z" /></>),
  server: (<><rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" /><path d="M7 7h.01M7 17h.01" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></>),
  file: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>),
  chevron: <path d="m9 18 6-6-6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  database: (<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>),
  trend: (<><path d="m4 17 6-6 4 4 6-8" /><path d="M15 7h5v5" /></>),
  users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>),
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

const severityColor: Record<string, string> = { Critical: C.rose, High: C.peach, Medium: C.butter, Low: C.sky };
export function SeverityBadge({ s }: { s: string }) {
  return (
    <span className="badge" style={{ background: severityColor[s] ?? C.sky }}>
      <span className="badge-dot" />
      {s}
    </span>
  );
}

const statusLabel: Record<string, string> = { open: 'Open', analyzed: 'Investigating', resolved: 'Resolved' };
const statusColor: Record<string, string> = { open: C.sky, analyzed: C.butter, resolved: C.mint };
export function StatusBadge({ s }: { s: string }) {
  return <span className="badge" style={{ background: statusColor[s] ?? C.sky }}>{statusLabel[s] ?? s}</span>;
}

export function SyntheticTag() {
  return (
    <span className="synthetic-tag">
      <Icon name="spark" size={12} />
      Synthetic data
    </span>
  );
}

export function Confidence({ level }: { level: 'low' | 'medium' | 'high' }) {
  const color = level === 'high' ? C.mint : level === 'medium' ? C.butter : '#EFEDF4';
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return <span className="confidence" style={{ background: color }}>{label} confidence</span>;
}

export function Relevance({ level, children }: { level?: string; children?: ReactNode }) {
  return (
    <span className="relevance">
      <Icon name="spark" size={12} />
      {children ?? (level === 'none' ? 'Not relevant (not used)' : `${level} relevance`)}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function Button({
  children, variant = 'primary', icon, onClick, type = 'button', disabled = false,
}: {
  children: ReactNode; variant?: 'primary' | 'outline' | 'mint'; icon?: IconName; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  return (
    <button type={type} disabled={disabled} className={`button ${variant}`} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </button>
  );
}

/** A router link that looks like a Figma button. */
export function LinkButton({ to, children, variant = 'primary', icon }: { to: string; children: ReactNode; variant?: 'primary' | 'outline' | 'mint'; icon?: IconName }) {
  const nav = useNavigate();
  return (
    <a
      href={to}
      className={`button ${variant}`}
      onClick={(e) => { e.preventDefault(); nav(to); }}
    >
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </a>
  );
}

export function PageHeader({ eyebrow, title, description, right }: { eyebrow?: string; title: string; description?: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {right}
    </header>
  );
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-row">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="page skeleton-page">
      <div className="skeleton title" />
      <div className="skeleton subtitle" />
      <div className="skeleton wide" />
      <div className="skeleton-grid">
        <div className="skeleton block" />
        <div className="skeleton block" />
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-alert" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <strong>Something went wrong</strong>
        <p>{message}</p>
        {onRetry && <button className="button outline retry" onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <Card className="empty-state">
      <span><Icon name="search" size={24} /></span>
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      {action}
    </Card>
  );
}

export const Bullets = ({ items, empty = 'None' }: { items: string[]; empty?: string }) =>
  items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="field-hint">{empty}</p>;

export const fmt = (d: string) => new Date(d).toLocaleString();

export function timeAgo(d: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function IncidentRow({ i }: { i: Incident }) {
  const nav = useNavigate();
  return (
    <button className="incident-row" onClick={() => nav(`/incidents/${i._id}`)}>
      <div className="incident-main">
        <span className="mono id">{i._id.slice(-6).toUpperCase()}</span>
        <div>
          <strong>{i.title}</strong>
          <p>{i.serviceName} · {i.environment} · {timeAgo(i.occurredAt)}{i.isSynthetic ? ' · synthetic' : ''}</p>
        </div>
      </div>
      <SeverityBadge s={i.severity} />
      <StatusBadge s={i.status} />
      <Icon name="chevron" size={16} />
    </button>
  );
}

/** Generic data loader hook with loading + error state. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    setError(null);
    fn().then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps);
  return { data, error, loading, reload: load, setData };
}

export function Kicker({ to, label, children }: { to: string; label: string; children?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="incident-kicker">
      <button onClick={() => nav(to)}>
        <Icon name="arrow" size={14} />
        {label}
      </button>
      {children}
    </div>
  );
}
