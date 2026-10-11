// Unit test for the tamper-evident audit hash chain (run: npx tsx scripts/audit-chain.test.ts).
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuditLog, GENESIS, computeHash } from '../src/audit/index.js';
import type { AuditEntry } from '../src/contract/types.js';

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) (pass++, console.log(`  ✅ ${name}`));
  else (fail++, console.log(`  ❌ ${name} — ${detail}`));
}

const ok = (over: Partial<AuditEntry>): AuditEntry =>
  ({ event: 'decision', ts: 1, sessionId: 's', reason: 'r', requestId: 'q', action: 'ALLOW', ...over }) as AuditEntry;

const readLines = (f: string): string[] => readFileSync(f, 'utf8').split('\n').filter(Boolean);
const mkChain = (): string => {
  const f = join(mkdtempSync(join(tmpdir(), 'ag-chain-')), 'audit.jsonl');
  const log = new AuditLog(f);
  log.record(ok({ ts: 1, requestId: 'a' }));
  log.record(ok({ ts: 2, requestId: 'b' }));
  log.record(ok({ ts: 3, requestId: 'c' }));
  return f;
};

try {
  const dir = mkdtempSync(join(tmpdir(), 'ag-chain-'));
  const emptyFile = join(dir, 'empty.jsonl');
  writeFileSync(emptyFile, '');
  check('empty (existing) log verifies', new AuditLog(emptyFile).verify().ok === true);
  check('missing file is NOT reported valid', new AuditLog(join(dir, 'nope.jsonl')).verify().ok === false);
  check('GENESIS anchors the first record prevHash', JSON.parse(readLines(mkChain())[0] as string).prevHash === GENESIS);

  // valid chain + resumable append
  const f0 = mkChain();
  check('3-record chain verifies', new AuditLog(f0).verify().ok === true, JSON.stringify(new AuditLog(f0).verify()));
  new AuditLog(f0).record(ok({ ts: 4, requestId: 'd' }));
  const v4 = new AuditLog(f0).verify();
  check('resumed chain still verifies after append', v4.ok === true && v4.total === 4, JSON.stringify(v4));

  // content tamper (hash left untouched)
  const f1 = mkChain();
  const l1 = readLines(f1);
  const e1 = JSON.parse(l1[1] as string);
  e1.reason = 'changed';
  l1[1] = JSON.stringify(e1);
  writeFileSync(f1, l1.join('\n') + '\n');
  const r1 = new AuditLog(f1).verify();
  check('modified record detected (hash mismatch)', !r1.ok && /hash mismatch/.test(r1.reason) && r1.firstInvalidIndex === 1, JSON.stringify(r1));

  // reorder
  const f2 = mkChain();
  const l2 = readLines(f2);
  [l2[0], l2[1]] = [l2[1] as string, l2[0] as string];
  writeFileSync(f2, l2.join('\n') + '\n');
  const r2 = new AuditLog(f2).verify();
  check('reordered records detected (broken link)', !r2.ok && /prevHash/.test(r2.reason), JSON.stringify(r2));

  // deletion
  const f3 = mkChain();
  const l3 = readLines(f3);
  l3.splice(1, 1);
  writeFileSync(f3, l3.join('\n') + '\n');
  const r3 = new AuditLog(f3).verify();
  check('deleted record detected (broken link)', !r3.ok, JSON.stringify(r3));

  // report identifies the FIRST invalid entry
  const f4 = mkChain();
  const l4 = readLines(f4);
  const e2 = JSON.parse(l4[2] as string);
  e2.action = 'BLOCK';
  l4[2] = JSON.stringify(e2);
  writeFileSync(f4, l4.join('\n') + '\n');
  const r4 = new AuditLog(f4).verify();
  check('first invalid index is reported', !r4.ok && r4.firstInvalidIndex === 2, JSON.stringify(r4));

  check('computeHash is deterministic', computeHash(ok({ ts: 9 })) === computeHash(ok({ ts: 9 })));
  check('computeHash ignores key order', computeHash({ ts: 1, event: 'decision', sessionId: 's', reason: 'r', requestId: 'q', action: 'ALLOW' }) === computeHash({ action: 'ALLOW', requestId: 'q', reason: 'r', sessionId: 's', event: 'decision', ts: 1 }));
} catch (err) {
  fail++;
  console.log('  ❌ harness error —', (err as Error).message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
