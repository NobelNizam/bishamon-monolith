import { copyFileSync, existsSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) throw new Error('Gunakan Node.js 22.18 atau lebih baru.');
if (!existsSync('.env')) { copyFileSync('.env.example', '.env'); chmodSync('.env', 0o600); console.log('.env dibuat. Isi kata sandi dan provider sesuai kebutuhan.'); }
const result = spawnSync(process.execPath, ['--env-file-if-exists=.env', '--experimental-strip-types', 'scripts/seed.ts'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
