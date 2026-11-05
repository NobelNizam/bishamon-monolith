import { getDatabase, closeDatabases, recoverInterruptedRuns } from '../src/lib/database.ts';

try {
  const db = getDatabase();
  if (process.argv.includes('--recover')) recoverInterruptedRuns();
  const result = db.prepare('SELECT COUNT(*) AS count FROM domains').get();
  console.log(`Seed selesai tanpa menghapus data. Domain: ${result?.count}.`);
} finally { closeDatabases(); }
