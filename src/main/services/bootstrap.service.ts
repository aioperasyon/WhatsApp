import { getDatabase } from '../database/database.js';
import { runDatabaseMigrations } from '../database/migrations/run-migrations.js';

export interface BootstrapResult {
  databaseReady: boolean;
  schemaVersion: number;
}

export function bootstrapApplication(): BootstrapResult {
  const database = getDatabase();

  runDatabaseMigrations(database);

  const schemaVersion = database.pragma('user_version', {
    simple: true,
  }) as number;

  return {
    databaseReady: true,
    schemaVersion,
  };
}
