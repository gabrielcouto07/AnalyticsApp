import { api } from "./client"

export interface ConverterColumn {
  original: string
  safe: string
  sql_type: string
  pandas_dtype: string
  sample: string
  non_null_count: number
}

export interface AlterColumn {
  column: string
  sql: string
}

export interface ConverterFormula {
  sheet: string
  cell: string
  column: string
  excel: string
  javascript: string
  unknown_functions: string[]
}

export interface ConverterResult {
  filename: string
  rows: number
  column_count: number
  columns: ConverterColumn[]
  sql: {
    table_name: string
    create_table: string
    alter_columns: AlterColumn[]
    inserts: string[]
    rows_inserted: number
    rows_total: number
  }
  formulas: ConverterFormula[]
  formula_count: number
}

export interface FilePreview {
  rows: number
  total_rows: number
  columns: string[]
  preview: Record<string, any>[]
  data_types: Record<string, string>
  missing_values: Record<string, number>
}

export const analyzeXlsx = async (file: File): Promise<ConverterResult> => {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post("/api/converter/analyze", form)
  return data
}

export const getPreview = async (file: File): Promise<FilePreview> => {
  const form = new FormData()
  form.append("file", file)
  const { data } = await api.post("/api/converter/preview", form)
  return data
}

export const convertFile = async (
  file: File,
  targetFormat: "csv" | "json" | "xlsx"
): Promise<Blob> => {
  const form = new FormData()
  form.append("file", file)
  form.append("target_format", targetFormat)
  const response = await api.post("/api/converter/convert", form, {
    responseType: "blob",
  })
  return response.data
}
