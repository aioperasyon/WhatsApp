export interface MessageTemplate {
  id: string;
  name: string;
  category: string | null;
  content: string;
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplateListRequest {
  search?: string;
}

export interface MessageTemplateSaveInput {
  id?: string;
  name: string;
  category?: string | null;
  content: string;
  isFavorite?: boolean;
}

export interface MessageTemplateDeleteRequest {
  id: string;
}

export interface MessageTemplateMarkUsedRequest {
  id: string;
}

export interface MessageTemplateMarkUsedResult {
  updated: boolean;
  usageCount: number;
  lastUsedAt: string | null;
}
