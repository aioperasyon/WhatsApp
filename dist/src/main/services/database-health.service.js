import { getDatabase, getDatabasePath } from '../database/database.js';
export function getDatabaseHealth() {
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
            .all();
        const schemaVersion = database.pragma('user_version', {
            simple: true,
        });
        return {
            connected: true,
            schemaVersion,
            databasePath: getDatabasePath(),
            tables: result.map((table) => table.name),
        };
    }
    catch (error) {
        return {
            connected: false,
            schemaVersion: 0,
            databasePath: getDatabasePath(),
            tables: [],
            error: error instanceof Error
                ? error.message
                : 'Veritabanı sağlık kontrolü başarısız oldu.',
        };
    }
}
//# sourceMappingURL=database-health.service.js.map