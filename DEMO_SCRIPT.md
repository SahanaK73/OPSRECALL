# OpsRecall - 4-minute demo script

**Setup before recording:** backend + frontend running, empty database (or fresh Hindsight bank id), browser at `http://localhost:5173`.

| Time | Say | Do |
|---|---|---|
| 0:00 | "Production incidents repeat, but chatbots forget. OpsRecall uses Hindsight as persistent memory so our agent learns from past incidents. Engineers stay in control. It never runs fixes." | Show Dashboard (empty/low counts). |
| 0:25 | "Here's a *new* incident: payments failing with DB timeouts after a deployment. No memory exists yet." | **Submit Incident** → load *Scenario 2* → Submit. |
| 0:50 | "First, the BEFORE: analysis without memory." | Click **Analyse without memory**. Point out generic checks and **0 historical incidents**. |
| 1:20 | "Now an earlier outage: connection-pool exhaustion. An engineer resolved it." | Submit *Scenario 1* → **Confirm resolution** → **Fill with synthetic resolution** → tick confirmation → **Confirm and Remember Resolution**. |
| 2:00 | "Only engineer-verified facts are retained, never AI guesses. Hindsight just stored root cause, fix and verification." | Show "Resolution retained" + **Historical Memory** page (facts live from Hindsight). |
| 2:25 | "Back to the deployment incident, now AFTER memory." | Open scenario 2 analysis → **Analyse with Hindsight memory**. Narrate loading labels. |
| 2:50 | "See the *Before vs after* panel. Hindsight recalled the earlier incident. Provenance shows its confirmed cause, its fix, shared terms and the AI's similarities and differences. Note it says *check* pool config; it doesn't claim the cause is identical, and flags the new deployment as a difference." | Scroll the Memory provenance card; open "Raw facts returned by Hindsight". |
| 3:25 | "Memory must not be forced. Here's an unrelated 502 gateway incident." | Submit *Scenario 3* → Analyse with memory → relevance **not relevant**, gateway/upstream checks. |
| 3:50 | "Real backend, real Hindsight retain/recall, Groq reasoning, human confirmation. Experience compounds." | Dashboard: memory-assisted counter. |

**Backup:** `cd backend && npm run demo` prints the same before/after flow in the terminal.
