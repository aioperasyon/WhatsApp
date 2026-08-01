import { INITIAL_SCHEMA_SQL } from '../schema/initial-schema.js';
const SCHEMA_VERSION = 1;
export function runDatabaseMigrations(database) {
    const currentVersion = database.pragma('user_version', {
        simple: true,
    });
    if (currentVersion >= SCHEMA_VERSION) {
        return;
    }
    const migrate = database.transaction(() => {
        database.exec(INITIAL_SCHEMA_SQL);
        database.pragma(`user_version = ${SCHEMA_VERSION}`);
    });
    migrate();
}
//# sourceMappingURL=run-migrations.js.map