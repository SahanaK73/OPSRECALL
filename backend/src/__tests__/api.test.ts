import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Service layer is mocked so the HTTP layer (validation, status codes, error format) can be tested without MongoDB.
vi.mock('../services/incident.service', async () => {
  const { AppError } = await import('../utils/AppError');
  return {
    createIncident: vi.fn(async (i: unknown) => ({ _id: 'abc', ...(i as object) })),
    listIncidents: vi.fn(async () => []),
    getIncidentWithResolution: vi.fn(async () => { throw new AppError(404, 'Incident not found', 'NOT_FOUND'); }),
    getStats: vi.fn(async () => ({ total: 0 })),
  };
});
vi.mock('../services/analysis.service', () => ({ analyzeIncident: vi.fn(async () => ({ result: {} })) }));
vi.mock('../services/resolution.service', () => ({ confirmResolution: vi.fn(async () => ({ retained: true })), retryRetain: vi.fn() }));
vi.mock('../services/hindsight.service', () => ({ pingHindsight: vi.fn(), listBankFacts: vi.fn(), recallSimilar: vi.fn(), buildRecallQuery: vi.fn() }));

import { createApp } from '../app';
const app = createApp();
const good = { title: 'Payments failing', serviceName: 'payment-service', severity: 'High', environment: 'production', errorMessage: 'timeout', occurredAt: '2026-03-01T10:00:00Z' };

describe('REST API', () => {
  it('GET /api/health responds (503 when DB not connected)', async () => {
    const r = await request(app).get('/api/health');
    expect([200, 503]).toContain(r.status);
    expect(r.body.status).toBe('ok');
  });
  it('POST /api/incidents -> 201 for valid input', async () => {
    expect((await request(app).post('/api/incidents').send(good)).status).toBe(201);
  });
  it('POST /api/incidents -> 400 with field details for invalid input', async () => {
    const r = await request(app).post('/api/incidents').send({ ...good, severity: 'Nope' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('POST /api/incidents -> 413 when body too large', async () => {
    const r = await request(app).post('/api/incidents').send({ ...good, logDetails: 'x'.repeat(200_000) });
    expect(r.status).toBe(413);
  });
  it('POST /api/incidents -> 400 for malformed JSON', async () => {
    const r = await request(app).post('/api/incidents').set('Content-Type', 'application/json').send('{bad');
    expect(r.status).toBe(400);
  });
  it('GET /api/incidents/:id -> 400 for bad id, 404 for unknown', async () => {
    expect((await request(app).get('/api/incidents/xyz')).status).toBe(400);
    expect((await request(app).get('/api/incidents/aaaaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
  });
  it('POST /api/incidents/:id/resolve requires engineer confirmation', async () => {
    const body = { actualRootCause: 'pool too small', resolutionApplied: 'raised pool', verificationResults: 'metrics recovered', serviceRecovered: true, engineerConfirmed: false };
    expect((await request(app).post('/api/incidents/aaaaaaaaaaaaaaaaaaaaaaaa/resolve').send(body)).status).toBe(400);
    const ok = await request(app).post('/api/incidents/aaaaaaaaaaaaaaaaaaaaaaaa/resolve').send({ ...body, engineerConfirmed: true }); expect(ok.status).toBe(201);
  });
  it('POST /api/incidents/:id/analyze works with empty body (defaults to memory on)', async () => {
    expect((await request(app).post('/api/incidents/aaaaaaaaaaaaaaaaaaaaaaaa/analyze').send({})).status).toBe(201);
  });
  it('unknown route -> 404 JSON', async () => {
    const r = await request(app).get('/api/nope');
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
