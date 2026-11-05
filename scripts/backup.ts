import { backup } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getDatabase, closeDatabases } from '../src/lib/database.ts';

const target = resolve(process.argv[2] || `backups/bishamon-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
if (existsSync(target)) throw new Error('Tujuan backup sudah ada. Gunakan nama berkas baru.');
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
try {
  await backup(getDatabase(), target);
  console.log(`Backup konsisten tersimpan: ${target}`);
} finally { closeDatabases(); }
