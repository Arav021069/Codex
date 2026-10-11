/**
 * `cerberus demo seed [--no-reset]` (M9) — write a deterministic, non-destructive demo fixture into the
 * audit log so the dashboard's Sessions/History views always tell the same three-outcome story:
 *   1. an allowed read, 2. a policy-blocked destructive command, 3. a human-review request that is denied.
 *
 * It NEVER runs a tool — it only records audit events (through the real AuditLog, so the hash chain stays
 * valid). Run it BEFORE starting the engine so the engine resumes the chain from the seeded log.
 */
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { AuditLog } from '../audit/index.js';
import { strEnv } from '../config/env.js';
import type { AuditEntry, RiskAssessment, RiskFactor, ToolCategory } from '../contract/types.js';

const SESSION = 'demo-session';
const RISK_VERSION = 'demo-fixture';

function risk(score: number, band: RiskAssessment['band'], factors: RiskFactor[]): RiskAssessment {
  return { score, band, version: RISK_VERSION, factors, hardFloor: band === 'BLOCK' };
}

export async function runDemo(args: string[], _projectRoot: string): Promise<void> {
  const cmd = args[0];
  if (cmd !== 'seed') {
    process.stderr.write(
      'usage: cerberus demo seed [--no-reset]\n' +
        '  writes a deterministic allow / block / review fixture into the audit log (never executes a tool).\n',
    );
    process.exit(1);
  }

  const auditFile = strEnv('AUDIT', join(process.cwd(), '.cerberus', 'audit.jsonl'));
  const reset = !args.includes('--no-reset');
  if (reset && existsSync(auditFile)) {
    copyFileSync(auditFile, `${auditFile}.bak`);
    rmSync(auditFile);
  }

  const log = new AuditLog(auditFile);
  const t0 = Date.now() - 15_000;
  const at = (n: number): number => t0 + n * 2_500;

  const decision = (
    n: number,
    requestId: string,
    tool: string,
    input: Record<string, unknown>,
    category: ToolCategory,
    action: 'ALLOW' | 'BLOCK',
    ruleId: string,
    reason: string,
    r: RiskAssessment,
  ): AuditEntry => ({ event: 'decision', ts: at(n), sessionId: SESSION, requestId, tool, input, category, action, ruleId, signal: 'policy', risk: r, reason });

  const events: AuditEntry[] = [
    { event: 'session-started', ts: at(0), sessionId: SESSION, reason: 'Session started (demo fixture).' },
    decision(1, 'demo-allow', 'Bash', { command: 'ls -la' }, 'EXECUTE', 'ALLOW', 'allow-readonly-commands',
      'Read-only shell command auto-approved.', risk(0, 'ALLOW', [])),
    decision(2, 'demo-block', 'Bash', { command: 'rm -rf src' }, 'EXECUTE', 'BLOCK', 'block-rm-rf',
      'Recursive force delete blocked outright.', risk(100, 'BLOCK', [{ source: 'policy', label: 'block-rm-rf', points: 100, group: 'destructive' }])),
    { event: 'hitl-opened', ts: at(3), sessionId: SESSION, requestId: 'demo-review', tool: 'Bash',
      input: { command: 'git push origin main' }, category: 'EXECUTE', ruleId: 'hitl-git-push', signal: 'policy',
      risk: risk(40, 'HITL', [{ source: 'policy', label: 'hitl-git-push', points: 40, group: 'state-change' }]),
      reason: 'git push to a remote requires human approval.' },
    { event: 'hitl-resolved', ts: at(5), sessionId: SESSION, requestId: 'demo-review', tool: 'Bash',
      input: { command: 'git push origin main' }, category: 'EXECUTE', action: 'BLOCK', viaHitl: true,
      ruleId: 'hitl-git-push', signal: 'policy', resolution: 'rejected', latencyMs: 5_000,
      reason: 'Cerberus: denied by human.' },
  ];

  let written = 0;
  for (const e of events) if (log.record(e)) written++;

  const report = log.verify();
  process.stdout.write(
    `demo fixture written to ${auditFile}\n` +
      `  ${written}/${events.length} events recorded  ·  ${reset ? 'audit log reset (backup: ' + auditFile + '.bak)' : 'appended'}\n` +
      `  chain: ${report.ok ? '✅ valid' : '❌ invalid — ' + report.reason}\n` +
      `  outcomes: 1 allowed (ls -la) · 1 blocked (rm -rf src) · 1 human-reviewed & denied (git push)\n` +
      `  next: node bin/cerberus.mjs engine   then open http://127.0.0.1:9000/ (Sessions tab)\n`,
  );
}
