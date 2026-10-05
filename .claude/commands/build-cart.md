---
description: Build the whole cart app by running the five sub-agents in dependency order, with a check after each step and a QA fix loop at the end
argument-hint: "[from <agent-name>]"
allowed-tools: Agent, Read, Bash, Glob, Grep
---

You are the **orchestrator** for the cart application described in `README.md`. Build the
app by delegating to the sub-agents in `.claude/agents/`, **one at a time, in order**. You
do not write application code yourself. Your job is to sequence the agents, check that each
step really finished, pass the right context forward, and stop when something breaks.

Arguments: `$ARGUMENTS`

- Empty → run the full pipeline from step 1.
- `from <agent-name>` → resume at that step. First check that the earlier steps' outputs
  exist (see each gate), and stop if they don't.

## Pipeline

Run these strictly in sequence. Never start an agent until the previous gate passes.
Never run two agents in parallel: each one builds on the files the previous one wrote.

| Step | Agent               | Depends on | Gate (check yourself before moving on) |
| ---- | ------------------- | ---------- | -------------------------------------- |
| 1    | `project-architect` | —          | `shared/contract.ts`, `backend/nuxt.config.ts`, `frontend/vite.config.ts` exist · `npm install` succeeded · `npm run build -w frontend` passes |
| 2    | `nuxt-backend`      | 1          | `backend/server/utils/{item-store,cart-store,seed,validate-item}.ts` and the 6 route files exist · `curl localhost:3001/api/items` returned 10 items in the agent's report |
| 3    | `socket-realtime`   | 1, 2       | `backend/server/plugins/socket.io.ts` and `frontend/src/composables/useCartSocket.ts` exist · `nitro.experimental.websocket` is `true` · the two-client check passed in the report |
| 4    | `vue-frontend`      | 1, 2, 3    | `frontend/src/components/{AppHeader,CartBadge,ItemList,ItemCard}.vue` and `frontend/src/api/items.ts` exist · `npx vue-tsc --noEmit` and `npm run build` in `frontend/` pass |
| 5    | `qa-tester`         | 1–4        | All suites ran · the report has a summary table and a bug list (which may be empty) |
| 6    | `project-architect` | 1–5        | Contract audit (its Task 2) finished: a violation list, or "no violations" |

Why this order: the architect creates the skeleton and the shared contract everyone
imports. The backend creates the cart store that the socket layer depends on. The socket
layer creates `useCartSocket`, which the UI uses. QA needs the whole app. The final audit
checks that nothing drifted from the contract along the way.

## How to run each step

For each step, call the **Agent** tool with `subagent_type` set to the agent name and
`run_in_background: false`, because the next step depends on the result. Give it a short
prompt that includes:

1. Its task, e.g. *"Run your Task 1: scaffold the monorepo as specified in your instructions."*
2. **Context from earlier steps:** the files they created, versions picked (e.g. the
   `crossws` version from step 3), and any deviations or warnings they reported. Pass only
   what this agent needs, briefly.
3. The reminder: *"Do not commit or push. End with the verification results from your
   instructions."*

Then check the gate **yourself** with `Glob`, `Read`, or quick `Bash` commands. Don't just
trust the report. Make sure no dev server from that step is still running (check ports
3001 and 5173); stop any that are left.

## When a step fails

- If an agent reports it is **blocked by a missing earlier step**, re-run that earlier
  agent with the missing piece named, then retry. **At most one retry per step.**
- If a gate fails a second time, **stop the pipeline**. Report which step failed, the exact
  error output, and the agent that owns the fix. Don't continue to later steps on a broken
  foundation.
- If an agent asks for a **contract change**, stop and ask the user. Contract changes go
  through `project-architect` Task 3 and need approval.

## QA fix loop (after step 5)

If `qa-tester` reports bugs:

1. Group them by owner agent. Re-run each owner **once**, in pipeline order (backend →
   socket → frontend), and pass only that agent's bugs: file, expected, actual, failing
   test name.
2. Re-run `qa-tester` and tell it to re-run the suites and confirm the earlier bugs are
   fixed.
3. Repeat **at most 2 rounds**. If bugs remain after that, keep going to step 6 and list
   them as open in the final report.

Never ask `qa-tester` to weaken, skip, or delete a failing test to make the run green.

## Final report

When the pipeline ends, finished or stopped, report to the user:

1. **Pipeline status:** each step with ✅ / ❌ / ⏭️ (skipped), and retries used.
2. **QA results:** the latest summary table (passed / failed / total per suite), and the
   number of fix rounds.
3. **Open issues:** remaining bugs and audit violations, each with its owner agent.
4. **What was built:** a short tree of the top-level folders and key files.
5. **How to run it:**
   ```bash
   npm run dev        # backend :3001 + frontend :5173
   npm test           # unit + API + socket tests
   npm run test:e2e   # Playwright end-to-end
   ```
6. **Manual checks:** the browser checklist from `vue-frontend`'s report.

Do not commit or push anything. Leave all changes in the working tree for the user to
review.
