// Unit test for the agent pause/quarantine control store (run: npx tsx scripts/controls.test.ts).
import { AgentControlStore, AGENT_STATUSES } from '../src/controls/agents.js';

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) (pass++, console.log(`  ✅ ${name}`));
  else (fail++, console.log(`  ❌ ${name} — ${detail}`));
}

try {
  const store = new AgentControlStore();
  check('unknown session is active by default', store.status('s1') === 'active');
  check('active session has no block reason', store.blockReason('s1') === null);

  const paused = store.set('s1', 'paused', 'operator hold');
  check('set paused records status + reason', paused.status === 'paused' && paused.reason === 'operator hold');
  check('paused session is blocked server-side', /paused/.test(store.blockReason('s1') ?? ''));
  check('paused status is queryable', store.status('s1') === 'paused');

  store.set('s2', 'quarantined');
  check('quarantined session block reason mentions quarantine', /quarantined/.test(store.blockReason('s2') ?? ''));

  check('resume returns a paused session to active', (store.set('s1', 'active'), store.blockReason('s1') === null));
  check('list returns newest first', store.list().length === 2 && store.list()[0]?.sessionId === 's1');

  const control = store.get('s2');
  check('get returns the stored control', control?.status === 'quarantined');
  check('undefined session never blocks', store.blockReason(undefined) === null);
  check('AGENT_STATUSES covers the three statuses', AGENT_STATUSES.size === 3 && AGENT_STATUSES.has('quarantined'));
} catch (err) {
  fail++;
  console.log('  ❌ harness error —', (err as Error).message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
