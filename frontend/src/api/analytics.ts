import { api } from './client';
import type { AxiosProgressEvent } from 'axios';

export interface UploadResponse {
  session_id: string;
  filename: string;
  rows: number;
  columns: number;
  col_types: Record<string, string>;
  preview: Record<string, unknown>[];
  template: string | null;
}

export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<UploadResponse>('/api/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event: AxiosProgressEvent) => {
      if (!onProgress || !event.total) return;
      const percent = Math.round((event.loaded * 100) / event.total);
      onProgress(percent);
    },
  });
  return data;
}
