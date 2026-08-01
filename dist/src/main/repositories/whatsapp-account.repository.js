import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from '../database/database.js';
const ACCOUNT_COLUMNS = `
  id,
  name,
  phone_number,
  status,
  session_path,
  last_connected_at,
  created_at,
  updated_at
`;
function mapAccount(row) {
    return {
        id: row.id,
        name: row.name,
        phoneNumber: row.phone_number,
        status: row.status,
        sessionPath: row.session_path,
        lastConnectedAt: row.last_connected_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export function getWhatsAppAccount(accountId) {
    const row = getDatabase()
        .prepare(`
      SELECT ${ACCOUNT_COLUMNS}
      FROM whatsapp_accounts
      WHERE id = ?
    `)
        .get(accountId);
    return row ? mapAccount(row) : null;
}
export function listWhatsAppAccounts() {
    const rows = getDatabase()
        .prepare(`
      SELECT ${ACCOUNT_COLUMNS}
      FROM whatsapp_accounts
      ORDER BY created_at DESC
    `)
        .all();
    return rows.map(mapAccount);
}
export function createWhatsAppAccount(input) {
    const name = input.name.trim();
    if (!name) {
        throw new Error('Hesap adı boş bırakılamaz.');
    }
    if (name.length > 80) {
        throw new Error('Hesap adı en fazla 80 karakter olabilir.');
    }
    const id = randomUUID();
    const sessionPath = path.join(app.getPath('userData'), 'whatsapp-sessions', id);
    fs.mkdirSync(sessionPath, { recursive: true });
    try {
        getDatabase()
            .prepare(`
        INSERT INTO whatsapp_accounts (
          id,
          name,
          session_path
        )
        VALUES (?, ?, ?)
      `)
            .run(id, name, sessionPath);
    }
    catch (error) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        throw error;
    }
    const account = getWhatsAppAccount(id);
    if (!account) {
        throw new Error('Oluşturulan WhatsApp hesabı okunamadı.');
    }
    return account;
}
export function updateWhatsAppAccountConnection(accountId, values) {
    const current = getWhatsAppAccount(accountId);
    if (!current) {
        throw new Error('WhatsApp hesabı bulunamadı.');
    }
    const phoneNumber = values.phoneNumber === undefined
        ? current.phoneNumber
        : values.phoneNumber;
    const lastConnectedAt = values.lastConnectedAt === undefined
        ? current.lastConnectedAt
        : values.lastConnectedAt;
    getDatabase()
        .prepare(`
      UPDATE whatsapp_accounts
      SET
        status = ?,
        phone_number = ?,
        last_connected_at = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
        .run(values.status, phoneNumber, lastConnectedAt, accountId);
    const updated = getWhatsAppAccount(accountId);
    if (!updated) {
        throw new Error('WhatsApp hesap durumu güncellenemedi.');
    }
    return updated;
}
export function deleteWhatsAppAccount(accountId) {
    const id = accountId.trim();
    if (!id) {
        throw new Error('Silinecek hesap kimliği belirtilmedi.');
    }
    const account = getWhatsAppAccount(id);
    if (!account) {
        return {
            success: false,
            accountId: id,
        };
    }
    const result = getDatabase()
        .prepare('DELETE FROM whatsapp_accounts WHERE id = ?')
        .run(id);
    if (result.changes > 0) {
        fs.rmSync(account.sessionPath, {
            recursive: true,
            force: true,
        });
    }
    return {
        success: result.changes > 0,
        accountId: id,
    };
}
//# sourceMappingURL=whatsapp-account.repository.js.map