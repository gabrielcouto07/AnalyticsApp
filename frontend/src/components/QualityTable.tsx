import { useSession } from '../store/session'

export function QualityTable() {
  const { quality } = useSession()

  if (!quality || quality.length === 0) {
    return <div className="text-center py-8 text-muted">Sem dados de qualidade</div>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-primary/20 shadow-xl">
      <table className="w-full text-sm bg-gradient-to-b from-card/80 to-card/40">
        <thead>
          <tr className="border-b border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10">
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              Coluna
            </th>
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              Tipo
            </th>
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              Nulos
            </th>
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              %
            </th>
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              Únicos
            </th>
            <th className="text-left py-4 px-5 text-primary font-bold uppercase text-xs tracking-wider">
              Amostra
            </th>
          </tr>
        </thead>
        <tbody>
          {quality.map((item, idx) => (
            <tr key={idx} className="border-b border-border/30 hover:bg-primary/10 transition-all duration-200 group">
              <td className="py-4 px-5 font-semibold text-text group-hover:text-primary transition-colors">{item.column}</td>
              <td className="py-4 px-5">
                <span className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-primary/20 to-primary/10 text-primary border border-primary/20">
                  {item.type}
                </span>
              </td>
              <td className="py-4 px-5 text-muted font-bold">{item.nulls}</td>
              <td className="py-4 px-5">
                <span
                  className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    item.null_pct > 10
                      ? 'bg-danger/20 text-danger shadow-lg shadow-danger/20 border border-danger/30'
                      : item.null_pct > 0
                      ? 'bg-warning/20 text-warning shadow-lg shadow-warning/20 border border-warning/30'
                      : 'bg-success/20 text-success shadow-lg shadow-success/20 border border-success/30'
                  }`}
                >
                  {item.null_pct}%
                </span>
              </td>
              <td className="py-4 px-5 text-muted font-bold">{item.unique}</td>
              <td className="py-4 px-5 text-muted truncate max-w-xs text-xs font-mono bg-muted/5 px-3 py-1 rounded">
                {item.sample}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
