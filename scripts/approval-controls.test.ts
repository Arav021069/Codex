// Security regression: a held (HITL) call must NOT be released by a stale approval after its agent has
// been paused or quarantined mid-hold. Run: npx tsx scripts/approval-controls.test.ts
//
// The control gate lives at the TOP of /intercept, so a call that was already pending when the operator
// paused/quarantined the session bypasses it. The resolver must therefore RE-CHECK the current control
// state and fail-closed (BLOCK) even when the dashboard/hook asked to ALLOW. This test drives the real
// Engine over HTTP: hold a call, quarantine/pause, then approve — and asserts the tool-bearing verdict
// is BLOCK (so the hook denies and the tool never runs), plus the audit/agent-state are recorded.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Engine } from '../src/engine/server.js';
import { DEFAULT_ANOMALY_CONFIG } from '../src/signals/behavioral.js';
import { DEFAULT_CONTENT_CONFIG } from '../src/signals/content.js';
import type { AgentStatus, AuditEntry } from '../src/contract/types.js';

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) (pass++, console.log(`  ✅ ${name}`));
  else (fail++, console.log(`  ❌ ${name} — ${detail}`));
}

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 9361;
const BASE = `http://127.0.0.1:${PORT}`;
const auditFile = join(mkdtempSync(join(tmpdir(), 'ag-ctl-')), 'audit.jsonl');
const opts = {
  port: PORT,
  rulesPath: join(ROOT, 'rules', 'default_policy.yaml'),
  weightsPath: join(ROOT, 'rules', 'risk_weights.yaml'),
  auditFile,
  ttlMs: 5_000,
  behavioral: { ...DEFAULT_ANOMALY_CONFIG },
  content: { ...DEFAULT_CONTENT_CONFIG },
  injection: { enabled: false, threshold: 0.5 },
  approvalSurface: 'dashboard' as const, // hold the socket so a human can act on it
};

const post = (path: string, body: unknown) =>
  fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const getPending = () => fetch(`${BASE}/pending`).then((r) => r.json() as Promise<{ pending: { id: string; toolCall: { sessionId?: string } }[] }>);
const setStatus = (sessionId: string, status: AgentStatus) => post('/agents/status', { sessionId, status });
const decide = (violationId: string, action: 'ALLOW' | 'BLOCK') => post('/decision', { type: 'decision', violationId, action });

/** Poll until the held call for `sessionId` shows in the inbox, then return it. */
async function waitPending(sessionId: string): Promise<{ id: string }> {
  for (let i = 0; i < 40; i++) {
    const { pending } = await getPending();
    const hit = pending.find((v) => v.toolCall.sessionId === sessionId);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`held call for ${sessionId} never appeared`);
}

/**
 * One full scenario: hold an approval-required action, apply `status` while it is pending, then attempt
 * to APPROVE it. Returns the resolved held verdict for assertions.
 */
async function scenario(status: AgentStatus, sessionId: string): Promise<{ action?: string; reason?: string }> {
  // 1+2+3: governed action requiring human approval — held open, not executed.
  const heldCall = post('/intercept', { tool: 'Bash', input: { command: 'git push origin main' }, sessionId }).then(
    (r) => r.json() as Promise<{ action?: string; reason?: string }>,
  );
  const v = await waitPending(sessionId);
  check(`${status}: approval-required action is pending`, !!v.id);
  check(`${status}: exactly one call held (nothing executed yet)`, (await getPending()).pending.length === 1);

  // 4: quarantine/pause the agent while the action remains pending.
  const s = await setStatus(sessionId, status);
  check(`${status}: operator control accepted`, s.status === 200);

  // 5: attempt to approve the ORIGINAL pending action (stale verdict).
  const d = await decide(v.id, 'ALLOW');
  check(`${status}: stale approval request accepted by the endpoint`, d.status === 200);

  // 6+7: backend rechecks control state; held verdict must be BLOCK ⇒ hook denies ⇒ tool never runs.
  const verdict = await heldCall;
  check(`${status}: held call resolved to BLOCK despite ALLOW approval`, verdict.action === 'BLOCK', JSON.stringify(verdict));
  check(`${status}: block reason cites the ${status} control`, new RegExp(status).test(verdict.reason ?? ''), verdict.reason ?? '');

  // return to benign state for the next scenario
  await setStatus(sessionId, 'active');
  return verdict;
}

function auditEntries(): AuditEntry[] {
  return readFileSync(auditFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as AuditEntry);
}

async function run() {
  const engine = new Engine(opts);
  await engine.listen();
  try {
    const q = 'ctl-quarantine';
    const p = 'ctl-pause';
    await scenario('quarantined', q);
    await scenario('paused', p);

    // 8: final decision + agent status are recorded in the tamper-evident log.
    const entries = auditEntries();
    const verdicts = entries.filter((e) => e.event === 'hitl-resolved' && (e.sessionId === q || e.sessionId === p));
    check('audit records both held verdicts', verdicts.length === 2, `got ${verdicts.length}`);
    check('both held verdicts recorded as BLOCK', verdicts.every((e) => e.action === 'BLOCK'), JSON.stringify(verdicts.map((e) => e.action)));
    check(
      'quarantine verdict reason names the quarantine',
      verdicts.some((e) => e.sessionId === q && /quarantined/.test(e.reason)),
    );
    check('pause verdict reason names the pause', verdicts.some((e) => e.sessionId === p && /paused/.test(e.reason)));
    check('agent-quarantined lifecycle event recorded', entries.some((e) => e.event === 'agent-quarantined' && e.sessionId === q));
    check('agent-paused lifecycle event recorded', entries.some((e) => e.event === 'agent-paused' && e.sessionId === p));

    const agents = (await fetch(`${BASE}/agents`).then((r) => r.json())) as { agents: { sessionId: string; status: AgentStatus }[] };
    check('agent overview reflects final status', agents.agents.find((a) => a.sessionId === q)?.status === 'active');

    const verify = (await fetch(`${BASE}/audit/verify`).then((r) => r.json())) as { ok: boolean };
    check('audit chain verifies after control verdicts', verify.ok === true, JSON.stringify(verify));
  } finally {
    await engine.close();
  }
}

run()
  .catch((e) => { fail++; console.log('  ❌ harness error —', (e as Error).message); })
  .finally(() => { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); });
