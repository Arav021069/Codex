// One-command hackathon launcher (M9): verify prerequisites, install if needed, build the dashboard,
// seed a deterministic demo fixture, then start the gateway. Usage: `npm run demo`.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(root, 'bin', 'cerberus.mjs');
const step = (m) => process.stdout.write(`\n\u25B6 ${m}\n`);

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  process.stderr.write(`\n\u2717 Node ${process.versions.node} is too old — Warden needs Node >= 20.\n\n`);
  process.exit(1);
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!existsSync(join(root, 'node_modules')) || !existsSync(join(root, 'node_modules', 'tsx'))) {
  step('Installing gateway dependencies (npm install)');
  run('npm', ['install', '--no-audit', '--no-fund']);
}
if (!existsSync(join(root, 'dashboard', 'node_modules'))) {
  step('Installing dashboard dependencies');
  run('npm', ['--prefix', 'dashboard', 'install', '--no-audit', '--no-fund']);
}
if (!existsSync(join(root, 'dashboard', 'dist', 'index.html'))) {
  step('Building the gateway + dashboard (npm run build)');
  run('npm', ['run', 'build']);
}

if (!process.argv.includes('--no-seed')) {
  step('Seeding the deterministic demo fixture (allow / block / human-review)');
  run(process.execPath, [bin, 'demo', 'seed']);
}

step('Starting the Warden gateway — dashboard at http://127.0.0.1:9000/  (Ctrl+C to stop)');
const child = spawn(process.execPath, [bin, 'engine'], { cwd: root, stdio: 'inherit' });
const forward = (sig) => () => child.kill(sig);
process.on('SIGINT', forward('SIGINT'));
process.on('SIGTERM', forward('SIGTERM'));
child.on('exit', (code) => process.exit(code ?? 0));
