# OpsRecall

**An Incident Response Agent That Learns From Previous Production Failures.**

OpsRecall helps engineers investigate production incidents using *history*. It analyses current logs with an LLM (Groq), searches **Hindsight** (Vectorize's persistent agent memory) for similar past incidents, and shows exactly which past incident influenced each recommendation. Engineers confirm the real root cause; only that **verified** experience is retained in Hindsight for next time.

> Engineers stay in control. OpsRecall only *suggests* investigation steps. It never executes fixes. All demo data is labelled **synthetic**.

---

## 1. Architecture

```
React (Vite, TS, Tailwind)  ──/api──▶  Express + TypeScript
                                         │
                       ┌─────────────────┼───────────────────┐
                       ▼                 ▼                   ▼
                MongoDB Atlas      Hindsight Cloud        Groq API
              (incident lifecycle)  retain / recall     (JSON analysis)
```

Memory cycle:

1. Engineer submits an incident → stored in MongoDB.
2. **Analyse**: backend builds a query from service + error + symptoms + logs and calls Hindsight **recall**.
3. Recalled facts are grouped per past incident, enriched with the engineer-confirmed record, and passed to Groq with the current incident.
4. Groq returns structured JSON → validated (zod) → memory references checked → saved.
5. Engineer confirms actual root cause + fix → saved in MongoDB → **Hindsight retain**.
6. Next similar incident recalls it.

| Folder | Purpose |
|---|---|
| `backend/src/config` | env validation, MongoDB, Hindsight client, Groq client |
| `backend/src/models` | `Incident`, `Resolution` Mongoose schemas |
| `backend/src/services` | `hindsight.service` (retain/recall), `groq.service` (LLM + validation/retry), `analysis.service` (the memory-assisted pipeline), `incident.service`, `resolution.service` |
| `backend/src/controllers`, `routes` | thin HTTP layer |
| `backend/src/middleware` | `validateRequest`, central `errorHandler` |
| `backend/src/data/syntheticIncidents.ts` | the 3 synthetic scenarios |
| `backend/src/scripts/runDemo.ts` | end-to-end before/after demo against the real API |
| `frontend/src/pages` | Dashboard, Submit, Analysis, Resolve, Details, Memory |

---

## 2. Prerequisites

- Node.js 20+ and npm
- A **MongoDB Atlas** cluster (free tier is fine) and its connection string
- A **Groq** API key: https://console.groq.com/keys
- A **Hindsight Cloud** account + API key: https://ui.hindsight.vectorize.io (Connect page)

## 3. Installation

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # then edit .env with your real keys
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Verify: open http://localhost:5000/api/health?deep=true. You should see `mongodb: connected` and `hindsight.ok: true`.

### Environment variables (`backend/.env`)

| Variable | Required | Meaning |
|---|---|---|
| `MONGODB_URI` | yes | Atlas connection string. Add your IP under Atlas → Network Access. |
| `GROQ_API_KEY` | yes | Groq key (server-side only) |
| `GROQ_MODEL` | no | default `llama-3.3-70b-versatile`; any Groq chat model that supports JSON mode |
| `HINDSIGHT_API_KEY` | yes | Hindsight Cloud key (sent as `Authorization: Bearer`) |
| `HINDSIGHT_BASE_URL` | no | default `https://api.hindsight.vectorize.io` |
| `HINDSIGHT_BANK_ID` | no | memory bank name, default `opsrecall-incidents` (auto-created at startup) |
| `PORT` | no | default `5000` |
| `CORS_ORIGIN` | no | default `http://localhost:5173` |

Keys live only in `backend/.env` (git-ignored). The browser only ever talks to `/api`.

---

## 4. API reference (`/api`)

| Method & path | Purpose | Success |
|---|---|---|
| `GET /health[?deep=true]` | Health. `deep=true` also pings Hindsight | 200 / 503 |
| `POST /incidents` | Create incident | 201, `409` duplicate, `400` invalid |
| `GET /incidents` | List incidents | 200 |
| `GET /incidents/:id` | Incident + analyses + resolution | 200, `404` |
| `POST /incidents/:id/analyze` | Body `{ "useMemory": true\|false }` (default true). Recall + Groq | 201 |
| `POST /incidents/:id/resolve` | Engineer-confirmed resolution → retain in Hindsight | 201 (`retained` flag + `warning` if Hindsight failed) |
| `GET /memory[?q=text]` | Retained incidents + live facts from Hindsight | 200 |
| `GET /memory/search?q=` | Raw Hindsight recall for free text | 200 |
| `POST /memory/retry/:id` | Retry retain after a Hindsight failure | 200 |
| `GET /incidents/stats` | Dashboard numbers | 200 |
| `GET /incidents/synthetic` | The 3 synthetic scenarios | 200 |

Errors always look like `{ "error": { "code", "message", "details" } }`. Limits: 100 KB body, logs ≤ 20 000 chars, 150 s server timeout, 30–90 s timeouts on Hindsight calls, 60 s on Groq.

A Postman collection is in `postman/OpsRecall.postman_collection.json` (set the `baseUrl` variable; it saves the created incident id automatically).

---

## 5. How Hindsight is used

Official SDK: `@vectorize-io/hindsight-client` (`HindsightClient({ baseUrl, apiKey })`).

- **Bank setup** – `createBank(bankId, { retainMission, reflectMission })` at startup (create-or-update) tells Hindsight to extract service, symptoms, errors, *confirmed* root cause, resolution and verification.
- **RETAIN** – `retain(bankId, content, { documentId: "incident-<id>", context, metadata, tags, async: false })`. Called **only** when `engineerConfirmed === true`. Content contains incident id, service, symptoms, error messages, deployment context, confirmed root cause, resolution, verification outcome. AI guesses are never retained. `documentId` makes re-retaining update instead of duplicate.
- **RECALL** – `recall(bankId, query, { budget: "mid", tags: ["opsrecall"] })` with a query built from service, title, error, symptoms, deployment and a log excerpt.
- **Provenance** – each recalled fact carries `document_id = incident-<id>`, so facts are grouped per past incident and joined to the confirmed record in MongoDB. A memory is shown as "influencing" an analysis **only if it was in the prompt sent to Groq**; comparisons referencing unknown memories are dropped server-side, and a memory the model judges `none` relevance is displayed as *not used*.
- **Failure behaviour** – if Hindsight is down during analysis, the analysis still runs and is clearly labelled as having no memory; if retain fails, the resolution stays saved and the UI offers **Retry**.

Note: MongoDB is the system of record for the incident lifecycle (forms, status, timeline). *What is relevant* is decided by Hindsight recall, not by MongoDB search.

---

## 6. Synthetic scenarios

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | DB connection pool exhaustion (resolved by engineer) | gets retained in Hindsight |
| 2 | Similar DB timeouts after a deployment | Recalls #1, explains similarities and differences, recommends checking pool config **without assuming the same cause** |
| 3 | HTTP 502 / upstream unavailable, no DB evidence | Memory #1 judged not relevant; recommends gateway/upstream checks |

Load them from **Submit Incident → “Demo: load a synthetic scenario”**, or run the scripted demo.

## 7. Testing

```bash
cd backend
npm test          # 31 unit/API tests (validation, JSON repair, memory-provenance rules, HTTP layer)
npm run typecheck
npm run demo      # END-TO-END against the running backend with REAL Mongo/Hindsight/Groq
cd ../frontend && npm run build
```

Unit tests mock only the service layer for HTTP-level tests. The app itself contains no mocks; `npm run demo` exercises the real integrations.

## 8. Demo walkthrough (before vs after Hindsight)

1. **Submit** scenario 2 (load it from the dropdown) → on the Analysis page click **Analyse without memory (baseline)**. Generic suggestions, *0 historical incidents*.
2. **Submit** scenario 1 → **Confirm resolution** → “Fill with synthetic resolution” → tick confirmation → **Confirm and Remember Resolution** (takes ~10–40 s while Hindsight extracts facts).
3. Return to scenario 2 → **Analyse with Hindsight memory**. The **Before vs after memory** panel and **Memory provenance** card show the retrieved incident, its confirmed root cause and fix, shared terms and the AI's similarities/differences.
4. Submit scenario 3 → analyse with memory → it is *not* forced into a database explanation.

See `DEMO_SCRIPT.md` for a timed 4-minute script.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` at start | `.env` missing/incomplete in `backend/` |
| `MongoDB connection failed` | Wrong URI, or your IP isn't in Atlas Network Access |
| UI says “Cannot reach the OpsRecall backend” | Backend not running on :5000 |
| `Hindsight rejected the API key` | Check `HINDSIGHT_API_KEY` / `HINDSIGHT_BASE_URL` |
| Analysis shows “memory searched, nothing relevant” right after resolving | Retain may have failed (see incident timeline → Retry), or facts are still being processed; wait a few seconds and re-run |
| `Groq request failed (400/404)` | `GROQ_MODEL` isn't available to your key; pick one from the Groq console |
| `LLM_MALFORMED_OUTPUT` | Rare; the backend already retried 3× with corrective prompts. Retry |

## 10. Security notes

API keys only in `backend/.env`; Helmet, CORS allow-list, body-size limits, schema validation on every input and on LLM output; no secrets are logged; never commit `.env`.
