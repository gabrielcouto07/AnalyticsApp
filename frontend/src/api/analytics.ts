import { api } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResponse {
session_id: string;
filename: string;
rows: number;
columns: number;
col_types: Record<string, string>;
preview: Record<string, unknown>[];
}

export interface KpiData {
title: string;
total: number;
mean: number;
trend: number;
}

export interface QualityData {
column: string;
dtype: string;
null_count: number;
null_pct: number;
unique_count: number;
sample: string;
}

export interface TemporalPoint {
date: string;
value: number;
cumulative: number;
}

export interface TemporalResponse {
data: TemporalPoint[];
summary: {
  time_range: string;
  total_records: number;
  avg_per_period: number;
  data_gaps: number;
};
}

export interface CrossPoint {
category: string;
aggregated_value: number;
}

export interface CorrelationResponse {
columns: string[];
data: number[][];
strong_count: number;
weak_count: number;
no_corr_count: number;
top_correlations: { col_a: string; col_b: string; value: number }[];
}

export interface DistributionStats {
mean: number;
median: number;
std: number;
min: number;
max: number;
q1: number;
q3: number;
iqr: number;
skewness: number;
kurtosis: number;
outlier_count: number;
count: number;
}

export interface DistributionResponse {
values: number[];
bins: { x: number; count: number }[];
stats: DistributionStats;
}

export interface RankingRow {
rank: number;
category: string;
value: number;
pct_of_total: number;
vs_mean_pct: number;
}

export interface RankingRequest {
cat_col: string;
num_col: string;
agg_fn: string;
top_n: number;
direction: 'top' | 'bottom';
}

export interface ScatterRequest {
x_col: string;
y_col: string;
color_col?: string;
size_col?: string;
sample_n?: number;
}

export interface ScatterResponse {
data: { x: number; y: number; color?: string; size?: number }[];
regression: { slope: number; intercept: number; r2: number; p_value: number };
correlation: { pearson: number; spearman: number; kendall: number };
}

export interface InsightData {
type: 'anomaly' | 'trend' | 'correlation' | 'outlier' | 'missing_data' | 'pattern';
severity: 'info' | 'warning' | 'critical';
title: string;
description: string;
affected_columns: string[];
chart_suggestion?: { type: string; x_col: string; y_col: string | null } | null;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<UploadResponse> {
const form = new FormData();
form.append('file', file);
const { data } = await api.post<UploadResponse>('/api/upload', form, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
return data;
}

// ─── Data ────────────────────────────────────────────────────────────────────

export async function getKpis(sessionId: string): Promise<{ kpis: KpiData[] }> {
const { data } = await api.get(`/api/data/${sessionId}/kpis`);
return data;
}

export async function getStats(sessionId: string): Promise<Record<string, unknown>> {
const { data } = await api.get(`/api/data/${sessionId}/stats`);
return data;
}

export async function getQuality(sessionId: string): Promise<{ quality: QualityData[] }> {
const { data } = await api.get(`/api/data/${sessionId}/quality`);
return data;
}

export async function getInsights(sessionId: string): Promise<{ insights: InsightData[] }> {
const { data } = await api.get(`/api/data/${sessionId}/insights`);
return data;
}

export async function getSemantic(sessionId: string): Promise<any> {
const { data } = await api.get(`/api/data/${sessionId}/semantic`);
return data;
}

// ─── Charts ───────────────────────────────────────────────────────────────────

export async function getTemporalData(
sessionId: string,
payload: { date_col: string; metric_col: string; granularity: string }
): Promise<TemporalResponse> {
const { data } = await api.post<TemporalResponse>(
  `/api/charts/${sessionId}/temporal`,
  payload
);
return data;
}

export async function getCrossData(
sessionId: string,
payload: { cat_col: string; num_col: string; agg_fn?: string; top_n?: number }
): Promise<{ data: CrossPoint[] }> {
const { data } = await api.post(`/api/charts/${sessionId}/cross`, payload);
return data;
}

export async function getCorrelationData(sessionId: string): Promise<CorrelationResponse> {
const { data } = await api.get<CorrelationResponse>(
  `/api/charts/${sessionId}/correlation`
);
return data;
}

export async function getDistributionData(
sessionId: string,
col: string
): Promise<DistributionResponse> {
const { data } = await api.get<DistributionResponse>(
  `/api/charts/${sessionId}/distribution/${encodeURIComponent(col)}`
);
return data;
}

export async function getRankingData(
sessionId: string,
payload: RankingRequest
): Promise<{ data: RankingRow[] }> {
const { data } = await api.post(`/api/charts/${sessionId}/ranking`, payload);
return data;
}

export async function getScatterData(
sessionId: string,
payload: ScatterRequest
): Promise<ScatterResponse> {
const { data } = await api.post<ScatterResponse>(
  `/api/charts/${sessionId}/scatter`,
  payload
);
return data;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function exportExcel(sessionId: string, filename: string): Promise<void> {
const response = await api.get(`/api/export/${sessionId}/excel`, {
  responseType: 'blob',
});
const url = URL.createObjectURL(new Blob([response.data]));
const a = document.createElement('a');
a.href = url;
a.download = `${filename.replace(/\.[^/.]+$/, '')}_export.xlsx`;
a.click();
URL.revokeObjectURL(url);
}

export async function exportCsv(sessionId: string, filename: string): Promise<void> {
const response = await api.get(`/api/export/${sessionId}/csv`, {
  responseType: 'blob',
});
const url = URL.createObjectURL(new Blob([response.data]));
const a = document.createElement('a');
a.href = url;
a.download = `${filename.replace(/\.[^/.]+$/, '')}_export.csv`;
a.click();
URL.revokeObjectURL(url);
}