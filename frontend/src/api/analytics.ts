import { api } from './client';

export interface UploadResponse {
  session_id: string;
  filename: string;
  rows: number;
  columns: number;
  col_types: Record<string, string>;
  preview: Record<string, unknown>[];
  template: string | null;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<UploadResponse>('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
