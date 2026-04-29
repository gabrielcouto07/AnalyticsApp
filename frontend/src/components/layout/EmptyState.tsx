import React from 'react'

interface EmptyStateProps {
  schemaRequired: string
  requiredColumns: string[]
  uploadedSchemas: string[]
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  schemaRequired,
  requiredColumns,
  uploadedSchemas,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        padding: 28,
        textAlign: 'center',
        color: '#cbd5e1',
        background: 'linear-gradient(180deg, rgba(7,38,28,0.96), rgba(11,79,58,0.92))',
        border: '1px solid rgba(203,187,160,0.18)',
        borderRadius: 22,
        boxShadow: '0 20px 50px rgba(11,79,58,0.18)',
      }}
    >
      <span style={{ fontSize: 42, marginBottom: 12 }}>📂</span>
      <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' }}>
        Este dashboard requer dados do tipo {schemaRequired}.
      </h3>
      <p style={{ maxWidth: 520, margin: '10px 0 0', fontSize: 14, lineHeight: 1.7 }}>
        Faça upload de um arquivo com as colunas:
      </p>
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 16,
        }}
      >
        {requiredColumns.map((column) => (
          <code
            key={column}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(34,197,94,0.28)',
              color: '#86efac',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {column}
          </code>
        ))}
      </div>
      {uploadedSchemas.length > 0 && (
        <p style={{ margin: '16px 0 0', fontSize: 13, color: 'rgba(241,245,249,0.82)' }}>
          Arquivo atual detectado como: <strong>{uploadedSchemas.join(' | ')}</strong>
        </p>
      )}
    </div>
  )
}
