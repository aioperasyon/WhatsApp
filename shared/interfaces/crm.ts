export type CrmPermissionStatus = 'allowed' | 'blocked';

export interface CrmContact {
  id: string;
  fullName: string;
  companyName: string | null;
  sector: string | null;
  city: string | null;
  phoneNumber: string;
  permissionStatus: CrmPermissionStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContactListRequest {
  search?: string;
  permissionStatus?: CrmPermissionStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface CrmContactSnapshot {
  contacts: CrmContact[];
  total: number;
}

export interface CrmContactSaveInput {
  id?: string;
  fullName: string;
  companyName?: string | null;
  sector?: string | null;
  city?: string | null;
  phoneNumber: string;
  permissionStatus?: CrmPermissionStatus;
  notes?: string | null;
}

export interface CrmContactDeleteRequest {
  id: string;
}

export interface CrmImportPreviewRow {
  rowNumber: number;
  fullName: string;
  companyName: string | null;
  sector: string | null;
  city: string | null;
  phoneNumber: string;
  status: 'new' | 'update' | 'duplicate' | 'invalid';
  issue: string | null;
}

export interface CrmImportPreview {
  sessionId: string;
  fileName: string;
  sheetName: string;
  total: number;
  valid: number;
  inserted: number;
  updated: number;
  duplicates: number;
  invalidPhone: number;
  missingName: number;
  previewRows: CrmImportPreviewRow[];
}

export interface CrmImportApplyRequest {
  sessionId: string;
}

export interface CrmImportResult {
  total: number;
  inserted: number;
  updated: number;
  duplicates: number;
  invalidPhone: number;
  missingName: number;
}


export interface CrmBulkPermissionRequest {
  ids: string[];
  permissionStatus: CrmPermissionStatus;
}

export interface CrmBulkDeleteRequest {
  ids: string[];
}

export interface CrmBulkActionResult {
  affected: number;
}

export interface CrmExportRequest {
  search?: string;
  permissionStatus?: CrmPermissionStatus | 'all';
  format: 'xlsx' | 'csv';
}

export interface CrmExportResult {
  exported: number;
  filePath: string | null;
}
