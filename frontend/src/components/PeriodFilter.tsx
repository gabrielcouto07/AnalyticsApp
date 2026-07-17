const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

interface Props {
  anos: number[]
  ano: number
  /** null = ano inteiro */
  mes: number | null
  excluirIntercompany: boolean
  onChange: (v: { ano: number; mes: number | null; excluirIntercompany: boolean }) => void
}

const selectCls =
  "bg-card text-text border border-border rounded-lg px-3 py-2 text-sm cursor-pointer " +
  "hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"

/**
 * Filtro de período com MÊS (1-12) e ANO numéricos e separados — nunca uma
 * célula de texto 'MM/AAAA' (o Excel converte para data silenciosamente e
 * quebra os filtros; correção documentada no próprio workbook de referência).
 */
export function PeriodFilter({ anos, ano, mes, excluirIntercompany, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-ano" className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Ano
        </label>
        <select
          id="filtro-ano"
          className={selectCls}
          value={ano}
          onChange={e => onChange({ ano: Number(e.target.value), mes, excluirIntercompany })}
        >
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-mes" className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Mês
        </label>
        <select
          id="filtro-mes"
          className={selectCls}
          value={mes ?? ""}
          onChange={e => onChange({ ano, mes: e.target.value === "" ? null : Number(e.target.value), excluirIntercompany })}
        >
          <option value="">Ano inteiro</option>
          {MONTHS.map((nome, i) => (
            <option key={i + 1} value={i + 1}>{i + 1} — {nome}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 pb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={excluirIntercompany}
          onChange={e => onChange({ ano, mes, excluirIntercompany: e.target.checked })}
          className="w-4 h-4 accent-primary cursor-pointer"
          aria-label="Excluir CNPJs intercompany dos cálculos"
        />
        <span className="text-xs text-muted">Excluir intercompany</span>
      </label>
    </div>
  )
}
