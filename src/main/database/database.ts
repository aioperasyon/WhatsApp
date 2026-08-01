import { app } from 'electron';
import Database from 'better-sqlite3';
import path from 'node:path';

let databaseInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'ai-operasyon-whatsapp-crm.sqlite');
}

export function getDatabase(): Database.Database {
  if (databaseInstance) {
    return databaseInstance;
  }

  databaseInstance = new Database(getDatabasePath());
  databaseInstance.pragma('journal_mode = WAL');
  databaseInstance.pragma('foreign_keys = ON');
  databaseInstance.pragma('busy_timeout = 5000');

  return databaseInstance;
}

export function closeDatabase(): void {
  if (!databaseInstance) {
    return;
  }

  databaseInstance.close();
  databaseInstance = null;
}
