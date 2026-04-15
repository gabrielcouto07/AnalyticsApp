import React, { useState } from 'react'
import axios from 'axios'
import { useSession } from '../store/session'

export const ExportButton: React.FC = () => {
  const sessionId = useSession(state => state.sessionId)
  const filename = useSession(state => state.filename)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!sessionId) return null

  const downloadFile = async (format: 'excel' | 'csv') => {
    setIsLoading(true)
    setError(null)
    try {
      const url = `http://localhost:8000/api/export/${sessionId}/${format}`
      const response = await axios.get(url, { responseType: 'blob' })
      
      const blob = new Blob([response.data], {
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv'
      })
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const baseName = filename?.replace(/\.[^/.]+$/, '') || 'export'
      link.download = `${baseName}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err: any) {
      setError(err.response?.data?.detail || `Erro ao exportar ${format}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => downloadFile('excel')}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition flex items-center gap-2"
      >
        📊 {isLoading ? 'Exportando...' : 'Excel'}
      </button>
      
      <button
        onClick={() => downloadFile('csv')}
        disabled={isLoading}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition flex items-center gap-2"
      >
        📄 {isLoading ? 'Exportando...' : 'CSV'}
      </button>

      {error && <div className="text-red-500 text-sm flex items-center gap-1">⚠️ {error}</div>}
    </div>
  )
}
