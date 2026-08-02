import { INITIAL_SCHEMA_SQL } from '../schema/initial-schema.js';
import { ensureCampaignDatabaseSchema, } from '../schema/campaign-schema.js';
const SCHEMA_VERSION = 3;
export function runDatabaseMigrations(database) {
    const currentVersion = database.pragma('user_version', {
        simple: true,
    });
    if (currentVersion >= SCHEMA_VERSION) {
        return;
    }
    const migrate = database.transaction(() => {
        if (currentVersion < 1) {
            database.exec(INITIAL_SCHEMA_SQL);
        }
        if (currentVersion < 2) {
            ensureCampaignDatabaseSchema(database);
        }
        if (currentVersion < 3) {
            ensureCampaignDatabaseSchema(database);
        }
        database.pragma(`user_version = ${SCHEMA_VERSION}`);
    });
    migrate();
}
//# sourceMappingURL=run-migrations.js.map