import { getDatabase } from '../database/database.js';
import { runDatabaseMigrations } from '../database/migrations/run-migrations.js';
export function bootstrapApplication() {
    const database = getDatabase();
    runDatabaseMigrations(database);
    const schemaVersion = database.pragma('user_version', {
        simple: true,
    });
    return {
        databaseReady: true,
        schemaVersion,
    };
}
//# sourceMappingURL=bootstrap.service.js.map