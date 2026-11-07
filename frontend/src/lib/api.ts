import type { Analysis, Incident, MemoryResponse, Resolution, Scenario, Stats } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...init });
  } catch {
    throw new ApiError('Cannot reach the OpsRecall backend. Is it running on port 5000?', 0, 'NETWORK');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (json as any)?.error;
    const detail = Array.isArray(e?.details) ? ` (${e.details.map((d: any) => `${d.field}: ${d.message}`).join('; ')})` : '';
    throw new ApiError((e?.message ?? `Request failed (${res.status})`) + detail, res.status, e?.code, e?.details);
  }
  return json as T;
}

export const api = {
  stats: () => request<Stats>('/incidents/stats'),
  list: () => request<Incident[]>('/incidents'),
  get: (id: string) => request<Incident>(`/incidents/${id}`),
  create: (body: unknown) => request<Incident>('/incidents', { method: 'POST', body: JSON.stringify(body) }),
  analyze: (id: string, useMemory: boolean) => request<Analysis>(`/incidents/${id}/analyze`, { method: 'POST', body: JSON.stringify({ useMemory }) }),
  resolve: (id: string, body: unknown) =>
    request<{ resolution: Resolution; retained: boolean; warning?: string }>(`/incidents/${id}/resolve`, { method: 'POST', body: JSON.stringify(body) }),
  retryRetain: (id: string) => request<{ retained: boolean; retainError?: string }>(`/memory/retry/${id}`, { method: 'POST' }),
  memory: (q?: string) => request<MemoryResponse>(`/memory${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  synthetic: () => request<{ notice: string; scenarios: Scenario[] }>('/incidents/synthetic'),
  health: () => request<{ status: string; mongodb: string; hindsight?: { ok: boolean; version?: string; error?: string } }>('/health?deep=true'),
};
