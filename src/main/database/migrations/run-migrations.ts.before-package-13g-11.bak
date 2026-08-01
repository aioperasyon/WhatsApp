import type Database from 'better-sqlite3';
import { INITIAL_SCHEMA_SQL } from '../schema/initial-schema.js';

const SCHEMA_VERSION = 1;

export function runDatabaseMigrations(database: Database.Database): void {
  const currentVersion = database.pragma('user_version', {
    simple: true,
  }) as number;

  if (currentVersion >= SCHEMA_VERSION) {
    return;
  }

  const migrate = database.transaction(() => {
    database.exec(INITIAL_SCHEMA_SQL);
    database.pragma(`user_version = ${SCHEMA_VERSION}`);
  });

  migrate();
}
