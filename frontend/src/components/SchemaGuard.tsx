import React from "react"

import { useSessionStore } from "../store/session"
import { SCHEMA_REQUIRED_COLUMNS } from "./layout/schemaRequirements"

interface SchemaGuardProps {
  requires: string | string[]
  children: React.ReactNode
}

function resolveColumns(schema: string) {
  return SCHEMA_REQUIRED_COLUMNS[schema] ?? []
}

export function SchemaGuard({ requires, children }: SchemaGuardProps) {
  const sessionId = useSessionStore((state) => state.sessionId)
  const schemaTypes = useSessionStore((state) => state.schemaTypes)
  const openUpload = useSessionStore((state) => state.openUpload)
  const requiredSchemas = Array.isArray(requires) ? requires : [requires]
  const canAccess = requiredSchemas.some((schema) => schemaTypes.includes(schema))
  const requiredColumns = Array.from(
    new Set(requiredSchemas.flatMap((schema) => resolveColumns(schema))),
  )

  if (sessionId && canAccess) {
    return <>{children}</>
  }

  const hasUpload = Boolean(sessionId)
  const message = hasUpload
    ? "Este dashboard requer um arquivo com as colunas abaixo. Faça upload do arquivo correto."
    : "Faça upload de um arquivo para habilitar este dashboard."

  return (
    <div className="flex min-h-[420px] items-center justify-center px-6 py-8">
      <div className="w-full max-w-2xl rounded-3xl border border-emerald-900/30 bg-slate-950/95 px-8 py-10 text-center shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <span className="mb-4 block text-5xl">📂</span>
        <h2 className="text-2xl font-extrabold text-slate-50">Dados não compatíveis</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">{message}</p>
        {requiredColumns.length > 0 && (
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
            Colunas esperadas:{" "}
            <code className="rounded-full bg-emerald-500/10 px-3 py-1 font-semibold text-emerald-300">
              {requiredColumns.join(", ")}
            </code>
          </p>
        )}
        {schemaTypes.length > 0 && (
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Detectado: {schemaTypes.join(" • ")}
          </p>
        )}
        <button
          type="button"
          onClick={openUpload}
          className="mt-6 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
        >
          Fazer Upload
        </button>
      </div>
    </div>
  )
}
