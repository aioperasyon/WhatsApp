import { dialog, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { getDatabase } from '../database/database.js';
const IPC_CHANNELS = {
    list: 'crm-contacts:list',
    save: 'crm-contacts:save',
    delete: 'crm-contacts:delete',
    previewImport: 'crm-contacts:preview-import',
    applyImport: 'crm-contacts:apply-import',
    bulkPermission: 'crm-contacts:bulk-permission',
    bulkDelete: 'crm-contacts:bulk-delete',
    export: 'crm-contacts:export',
};
const importSessions = new Map();
const IMPORT_SESSION_TTL_MS = 30 * 60 * 1000;
function ensureCrmSchema() {
    getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      company_name TEXT,
      sector TEXT,
      city TEXT,
      phone_number TEXT NOT NULL UNIQUE,
      permission_status TEXT NOT NULL DEFAULT 'allowed'
        CHECK (permission_status IN ('allowed', 'blocked')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_crm_contacts_name
      ON crm_contacts(full_name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS idx_crm_contacts_company
      ON crm_contacts(company_name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS idx_crm_contacts_sector
      ON crm_contacts(sector COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS idx_crm_contacts_city
      ON crm_contacts(city COLLATE NOCASE);
  `);
}
function mapContact(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        companyName: row.company_name,
        sector: row.sector,
        city: row.city,
        phoneNumber: row.phone_number,
        permissionStatus: row.permission_status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function normalizePhone(value) {
    let phone = String(value ?? '').replace(/\D/g, '');
    if (phone.startsWith('0') && phone.length === 11) {
        phone = `90${phone.slice(1)}`;
    }
    if (phone.length === 10) {
        phone = `90${phone}`;
    }
    if (phone.length < 10 || phone.length > 15) {
        throw new Error('Telefon numarasını ülke koduyla birlikte 10-15 hane olarak girin.');
    }
    return phone;
}
function cleanOptional(value) {
    const cleaned = value?.trim() ?? '';
    return cleaned || null;
}
function assertPermission(value) {
    return value === 'blocked' ? 'blocked' : 'allowed';
}
function listContacts(request = {}) {
    ensureCrmSchema();
    const database = getDatabase();
    const search = request.search?.trim() ?? '';
    const permissionStatus = request.permissionStatus === 'allowed' ||
        request.permissionStatus === 'blocked'
        ? request.permissionStatus
        : 'all';
    const limit = [20, 50, 100].includes(request.limit ?? 20)
        ? (request.limit ?? 20)
        : 20;
    const offset = Math.max(0, request.offset ?? 0);
    const where = [];
    const parameters = [];
    if (search) {
        where.push(`(
      full_name LIKE ?
      OR company_name LIKE ?
      OR sector LIKE ?
      OR city LIKE ?
      OR phone_number LIKE ?
    )`);
        const term = `%${search}%`;
        parameters.push(term, term, term, term, term);
    }
    if (permissionStatus !== 'all') {
        where.push('permission_status = ?');
        parameters.push(permissionStatus);
    }
    const whereSql = where.length
        ? `WHERE ${where.join(' AND ')}`
        : '';
    const totalRow = database
        .prepare(`
      SELECT COUNT(*) AS total
      FROM crm_contacts
      ${whereSql}
    `)
        .get(...parameters);
    const rows = database
        .prepare(`
      SELECT
        id,
        full_name,
        company_name,
        sector,
        city,
        phone_number,
        permission_status,
        notes,
        created_at,
        updated_at
      FROM crm_contacts
      ${whereSql}
      ORDER BY updated_at DESC, full_name COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
    `)
        .all(...parameters, limit, offset);
    return {
        contacts: rows.map(mapContact),
        total: totalRow.total,
    };
}
function saveContact(input) {
    ensureCrmSchema();
    const database = getDatabase();
    const fullName = input.fullName?.trim();
    const phoneNumber = normalizePhone(input.phoneNumber ?? '');
    if (!fullName) {
        throw new Error('Ad soyad alanı zorunludur.');
    }
    const id = input.id?.trim() || randomUUID();
    const existingPhone = database
        .prepare(`
      SELECT id
      FROM crm_contacts
      WHERE phone_number = ? AND id <> ?
      LIMIT 1
    `)
        .get(phoneNumber, id);
    if (existingPhone) {
        throw new Error('Bu telefon numarası başka bir CRM kişisinde kayıtlı.');
    }
    database.prepare(`
    INSERT INTO crm_contacts (
      id,
      full_name,
      company_name,
      sector,
      city,
      phone_number,
      permission_status,
      notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      full_name = excluded.full_name,
      company_name = excluded.company_name,
      sector = excluded.sector,
      city = excluded.city,
      phone_number = excluded.phone_number,
      permission_status = excluded.permission_status,
      notes = excluded.notes,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, fullName, cleanOptional(input.companyName), cleanOptional(input.sector), cleanOptional(input.city), phoneNumber, assertPermission(input.permissionStatus), cleanOptional(input.notes));
    const row = database
        .prepare(`
      SELECT
        id,
        full_name,
        company_name,
        sector,
        city,
        phone_number,
        permission_status,
        notes,
        created_at,
        updated_at
      FROM crm_contacts
      WHERE id = ?
      LIMIT 1
    `)
        .get(id);
    if (!row) {
        throw new Error('CRM kişisi kaydedilemedi.');
    }
    return mapContact(row);
}
function deleteContact(request) {
    ensureCrmSchema();
    const id = request.id?.trim();
    if (!id) {
        throw new Error('Silinecek CRM kişi kimliği zorunludur.');
    }
    const result = getDatabase()
        .prepare('DELETE FROM crm_contacts WHERE id = ?')
        .run(id);
    return {
        deleted: result.changes > 0,
    };
}
function normalizeHeader(value) {
    return String(value ?? '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[ıİ]/g, 'i')
        .replace(/[öÖ]/g, 'o')
        .replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
const HEADER_ALIASES = {
    fullName: [
        'ad soyad',
        'adi soyadi',
        'isim soyisim',
        'isim',
        'ad',
        'name',
        'full name',
        'fullname',
        'contact name',
    ],
    companyName: [
        'firma',
        'firma adi',
        'sirket',
        'sirket adi',
        'company',
        'company name',
        'organization',
    ],
    sector: [
        'sektor',
        'sektor adi',
        'sector',
        'industry',
        'kategori',
    ],
    city: [
        'il',
        'sehir',
        'city',
        'province',
        'location',
    ],
    phoneNumber: [
        'telefon',
        'telefon no',
        'telefon numarasi',
        'cep telefonu',
        'gsm',
        'phone',
        'phone number',
        'mobile',
        'whatsapp',
        'whatsapp no',
    ],
};
function findHeaderKey(headers, aliases) {
    const normalizedAliases = aliases.map(normalizeHeader);
    for (const header of headers) {
        const normalized = normalizeHeader(header);
        if (normalizedAliases.includes(normalized)) {
            return header;
        }
    }
    for (const header of headers) {
        const normalized = normalizeHeader(header);
        if (normalizedAliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
            return header;
        }
    }
    return null;
}
function readCell(row, key) {
    if (!key)
        return '';
    return String(row[key] ?? '').trim();
}
function cleanupExpiredImportSessions() {
    const now = Date.now();
    for (const [sessionId, session] of importSessions.entries()) {
        if (now - session.createdAt > IMPORT_SESSION_TTL_MS) {
            importSessions.delete(sessionId);
        }
    }
}
async function previewImport() {
    ensureCrmSchema();
    cleanupExpiredImportSessions();
    const selected = await dialog.showOpenDialog({
        title: 'CRM kişi dosyasını seçin',
        properties: ['openFile'],
        filters: [
            {
                name: 'Excel ve CSV Dosyaları',
                extensions: ['xlsx', 'xls', 'csv'],
            },
        ],
    });
    if (selected.canceled || selected.filePaths.length === 0) {
        return null;
    }
    const filePath = selected.filePaths[0];
    const workbook = XLSX.readFile(filePath, {
        cellDates: false,
        raw: false,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error('Dosyada okunabilir bir çalışma sayfası bulunamadı.');
    }
    const sheet = workbook.Sheets[sheetName];
    const sourceRows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false,
    });
    if (sourceRows.length === 0) {
        throw new Error('Seçilen dosyada aktarılabilecek kayıt bulunamadı.');
    }
    const headers = Object.keys(sourceRows[0] ?? {});
    const fullNameKey = findHeaderKey(headers, HEADER_ALIASES.fullName);
    const companyNameKey = findHeaderKey(headers, HEADER_ALIASES.companyName);
    const sectorKey = findHeaderKey(headers, HEADER_ALIASES.sector);
    const cityKey = findHeaderKey(headers, HEADER_ALIASES.city);
    const phoneNumberKey = findHeaderKey(headers, HEADER_ALIASES.phoneNumber);
    if (!fullNameKey || !phoneNumberKey) {
        throw new Error('Dosyada Ad Soyad ve Telefon sütunları bulunamadı. Sütun başlıklarını kontrol edin.');
    }
    const database = getDatabase();
    const existingPhones = new Set(database
        .prepare('SELECT phone_number FROM crm_contacts')
        .all().map((row) => row.phone_number));
    const filePhones = new Set();
    const normalizedRows = [];
    let inserted = 0;
    let updated = 0;
    let duplicates = 0;
    let invalidPhone = 0;
    let missingName = 0;
    sourceRows.forEach((sourceRow, index) => {
        const fullName = readCell(sourceRow, fullNameKey);
        const companyName = cleanOptional(readCell(sourceRow, companyNameKey));
        const sector = cleanOptional(readCell(sourceRow, sectorKey));
        const city = cleanOptional(readCell(sourceRow, cityKey));
        const rawPhone = readCell(sourceRow, phoneNumberKey);
        let phoneNumber = rawPhone.replace(/\D/g, '');
        let status = 'new';
        let issue = null;
        if (!fullName) {
            status = 'invalid';
            issue = 'Ad soyad eksik';
            missingName += 1;
        }
        else {
            try {
                phoneNumber = normalizePhone(rawPhone);
            }
            catch {
                status = 'invalid';
                issue = 'Telefon numarası geçersiz';
                invalidPhone += 1;
            }
        }
        if (status !== 'invalid') {
            if (filePhones.has(phoneNumber)) {
                status = 'duplicate';
                issue = 'Dosya içinde tekrarlı telefon';
                duplicates += 1;
            }
            else if (existingPhones.has(phoneNumber)) {
                status = 'update';
                updated += 1;
            }
            else {
                status = 'new';
                inserted += 1;
            }
            filePhones.add(phoneNumber);
        }
        normalizedRows.push({
            rowNumber: index + 2,
            fullName,
            companyName,
            sector,
            city,
            phoneNumber,
            status,
            issue,
        });
    });
    const sessionId = randomUUID();
    const preview = {
        sessionId,
        fileName: filePath.split(/[\\/]/).pop() ?? filePath,
        sheetName,
        total: normalizedRows.length,
        valid: inserted + updated,
        inserted,
        updated,
        duplicates,
        invalidPhone,
        missingName,
        previewRows: normalizedRows.slice(0, 50),
    };
    importSessions.set(sessionId, {
        createdAt: Date.now(),
        rows: normalizedRows,
        preview,
    });
    return preview;
}
function applyImport(request) {
    ensureCrmSchema();
    cleanupExpiredImportSessions();
    const sessionId = request.sessionId?.trim();
    const session = sessionId
        ? importSessions.get(sessionId)
        : undefined;
    if (!session) {
        throw new Error('İçe aktarma önizlemesinin süresi doldu. Dosyayı yeniden seçin.');
    }
    const database = getDatabase();
    const findExisting = database.prepare(`
    SELECT id
    FROM crm_contacts
    WHERE phone_number = ?
    LIMIT 1
  `);
    const insertContact = database.prepare(`
    INSERT INTO crm_contacts (
      id,
      full_name,
      company_name,
      sector,
      city,
      phone_number,
      permission_status,
      notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'allowed', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
    const updateContact = database.prepare(`
    UPDATE crm_contacts
    SET
      full_name = ?,
      company_name = ?,
      sector = ?,
      city = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE phone_number = ?
  `);
    let inserted = 0;
    let updated = 0;
    const transaction = database.transaction(() => {
        for (const row of session.rows) {
            if (row.status === 'invalid' || row.status === 'duplicate') {
                continue;
            }
            const existing = findExisting.get(row.phoneNumber);
            if (existing) {
                updateContact.run(row.fullName, row.companyName, row.sector, row.city, row.phoneNumber);
                updated += 1;
            }
            else {
                insertContact.run(randomUUID(), row.fullName, row.companyName, row.sector, row.city, row.phoneNumber);
                inserted += 1;
            }
        }
    });
    transaction();
    importSessions.delete(sessionId);
    return {
        total: session.preview.total,
        inserted,
        updated,
        duplicates: session.preview.duplicates,
        invalidPhone: session.preview.invalidPhone,
        missingName: session.preview.missingName,
    };
}
function normalizeIds(ids) {
    return Array.from(new Set((ids ?? [])
        .map((id) => String(id ?? '').trim())
        .filter(Boolean)));
}
function bulkUpdatePermission(request) {
    ensureCrmSchema();
    const ids = normalizeIds(request.ids);
    const permissionStatus = assertPermission(request.permissionStatus);
    if (ids.length === 0) {
        return { affected: 0 };
    }
    const placeholders = ids.map(() => '?').join(', ');
    const result = getDatabase()
        .prepare(`
      UPDATE crm_contacts
      SET
        permission_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `)
        .run(permissionStatus, ...ids);
    return { affected: result.changes };
}
function bulkDeleteContacts(request) {
    ensureCrmSchema();
    const ids = normalizeIds(request.ids);
    if (ids.length === 0) {
        return { affected: 0 };
    }
    const placeholders = ids.map(() => '?').join(', ');
    const result = getDatabase()
        .prepare(`
      DELETE FROM crm_contacts
      WHERE id IN (${placeholders})
    `)
        .run(...ids);
    return { affected: result.changes };
}
async function exportContacts(request) {
    ensureCrmSchema();
    const database = getDatabase();
    const search = request.search?.trim() ?? '';
    const permissionStatus = request.permissionStatus === 'allowed' ||
        request.permissionStatus === 'blocked'
        ? request.permissionStatus
        : 'all';
    const where = [];
    const parameters = [];
    if (search) {
        where.push(`(
      full_name LIKE ?
      OR company_name LIKE ?
      OR sector LIKE ?
      OR city LIKE ?
      OR phone_number LIKE ?
    )`);
        const term = `%${search}%`;
        parameters.push(term, term, term, term, term);
    }
    if (permissionStatus !== 'all') {
        where.push('permission_status = ?');
        parameters.push(permissionStatus);
    }
    const whereSql = where.length
        ? `WHERE ${where.join(' AND ')}`
        : '';
    const rows = database
        .prepare(`
      SELECT
        full_name,
        company_name,
        sector,
        city,
        phone_number,
        permission_status,
        notes,
        created_at,
        updated_at
      FROM crm_contacts
      ${whereSql}
      ORDER BY full_name COLLATE NOCASE ASC
    `)
        .all(...parameters);
    if (rows.length === 0) {
        throw new Error('Dışa aktarılacak CRM kaydı bulunamadı.');
    }
    const format = request.format === 'csv' ? 'csv' : 'xlsx';
    const selected = await dialog.showSaveDialog({
        title: 'CRM kayıtlarını dışa aktar',
        defaultPath: `crm-kisileri.${format}`,
        filters: format === 'csv'
            ? [{ name: 'CSV Dosyası', extensions: ['csv'] }]
            : [{ name: 'Excel Dosyası', extensions: ['xlsx'] }],
    });
    if (selected.canceled || !selected.filePath) {
        return {
            exported: 0,
            filePath: null,
        };
    }
    const exportRows = rows.map((row) => ({
        'Ad Soyad': row.full_name,
        Firma: row.company_name ?? '',
        Sektör: row.sector ?? '',
        İl: row.city ?? '',
        Telefon: row.phone_number,
        'İzin Durumu': row.permission_status === 'allowed' ? 'İzinli' : 'Engelli',
        Notlar: row.notes ?? '',
        'Oluşturulma Tarihi': row.created_at,
        'Güncellenme Tarihi': row.updated_at,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CRM Kişileri');
    if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet, {
            FS: ';',
        });
        fs.writeFileSync(selected.filePath, '\uFEFF' + csv, 'utf8');
    }
    else {
        XLSX.writeFile(workbook, selected.filePath);
    }
    return {
        exported: rows.length,
        filePath: selected.filePath,
    };
}
export function registerCrmIpcHandlers() {
    ensureCrmSchema();
    Object.values(IPC_CHANNELS).forEach((channel) => {
        ipcMain.removeHandler(channel);
    });
    ipcMain.handle(IPC_CHANNELS.list, (_event, request) => listContacts(request));
    ipcMain.handle(IPC_CHANNELS.save, (_event, input) => saveContact(input));
    ipcMain.handle(IPC_CHANNELS.delete, (_event, request) => deleteContact(request));
    ipcMain.handle(IPC_CHANNELS.previewImport, () => previewImport());
    ipcMain.handle(IPC_CHANNELS.applyImport, (_event, request) => applyImport(request));
    ipcMain.handle(IPC_CHANNELS.bulkPermission, (_event, request) => bulkUpdatePermission(request));
    ipcMain.handle(IPC_CHANNELS.bulkDelete, (_event, request) => bulkDeleteContacts(request));
    ipcMain.handle(IPC_CHANNELS.export, (_event, request) => exportContacts(request));
}
//# sourceMappingURL=register-crm-ipc.js.map