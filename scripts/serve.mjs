import { spawn, spawnSync } from 'node:child_process';

const mode = process.argv[2] === 'dev' ? 'dev' : 'start';
const host = process.env.HOST || '127.0.0.1';
const port = process.env.PORT || '3000';
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.APP_PASSWORD) {
  throw new Error('Akses LAN memerlukan APP_PASSWORD di .env.');
}
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('PORT harus antara 1 dan 65535.');
}
const recovery = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/seed.ts', '--recover'], { stdio: 'inherit', env: process.env });
if (recovery.status !== 0) process.exit(recovery.status ?? 1);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', mode, '--hostname', host, '--port', port], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Gagal menjalankan Next.js. Jalankan npm install terlebih dahulu.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
