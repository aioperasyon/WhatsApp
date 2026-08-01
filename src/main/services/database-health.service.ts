import type { DatabaseHealth } from '../../../shared/interfaces/desktop-api.js';
import { getDatabase, getDatabasePath } from '../database/database.js';

interface SqliteTableRow {
  name: string;
}

export function getDatabaseHealth(): DatabaseHealth {
  try {
    const database = getDatabase();

    const result = database
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name ASC
      `)
      .all() as SqliteTableRow[];

    const schemaVersion = database.pragma('user_version', {
      simple: true,
    }) as number;

    return {
      connected: true,
      schemaVersion,
      databasePath: getDatabasePath(),
      tables: result.map((table) => table.name),
    };
  } catch (error: unknown) {
    return {
      connected: false,
      schemaVersion: 0,
      databasePath: getDatabasePath(),
      tables: [],
      error:
        error instanceof Error
          ? error.message
          : 'Veritabanı sağlık kontrolü başarısız oldu.',
    };
  }
}