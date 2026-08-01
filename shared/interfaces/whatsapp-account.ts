export type WhatsAppAccountStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_required'
  | 'connected'
  | 'error';

export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: WhatsAppAccountStatus;
  sessionPath: string;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppAccountInput {
  name: string;
}

export interface DeleteWhatsAppAccountResult {
  success: boolean;
  accountId: string;
}
