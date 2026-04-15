import { useState } from 'react'
import { useSession } from '../store/session'

interface Filters {
  dateRange: [string, string] | null
  selectedCategories: string[]
  numericRange: [number, number] | null
}

interface FilterSidebarProps {
  onFiltersChange: (filters: Filters) => void
  isOpen: boolean
  onClose: () => void
}

export function FilterSidebar({ onFiltersChange, isOpen, onClose }: FilterSidebarProps) {
  const { colTypes } = useSession()
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    selectedCategories: [],
    numericRange: null,
  })

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange: [string, string] = [e.target.value, filters.dateRange?.[1] || '']
    setFilters({ ...filters, dateRange: newRange })
    onFiltersChange({ ...filters, dateRange: newRange })
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange: [string, string] = [filters.dateRange?.[0] || '', e.target.value]
    setFilters({ ...filters, dateRange: newRange })
    onFiltersChange({ ...filters, dateRange: newRange })
  }

  const toggleCategory = (cat: string) => {
    const newCats = filters.selectedCategories.includes(cat)
      ? filters.selectedCategories.filter((c) => c !== cat)
      : [...filters.selectedCategories, cat]
    setFilters({ ...filters, selectedCategories: newCats })
    onFiltersChange({ ...filters, selectedCategories: newCats })
  }

  const handleNumericMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange: [number, number] = [
      parseFloat(e.target.value) || 0,
      filters.numericRange?.[1] || 0,
    ]
    setFilters({ ...filters, numericRange: newRange })
    onFiltersChange({ ...filters, numericRange: newRange })
  }

  const handleNumericMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRange: [number, number] = [
      filters.numericRange?.[0] || 0,
      parseFloat(e.target.value) || 0,
    ]
    setFilters({ ...filters, numericRange: newRange })
    onFiltersChange({ ...filters, numericRange: newRange })
  }

  const resetFilters = () => {
    const cleared: Filters = {
      dateRange: null,
      selectedCategories: [],
      numericRange: null,
    }
    setFilters(cleared)
    onFiltersChange(cleared)
  }

  return (
    <>
      {/* Overlay Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative top-20 left-0 right-0 bottom-0 bg-card border-r border-border z-40
          md:z-0 md:top-0 w-full md:w-64 transform transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
          overflow-y-auto`}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between md:hidden">
            <h3 className="font-semibold text-text">Filtros</h3>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Date Filter */}
          {colTypes?.date && colTypes.date.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text uppercase tracking-wider">
                {colTypes.date[0]}
              </h4>
              <div className="space-y-2">
                <input
                  type="date"
                  placeholder="De"
                  value={filters.dateRange?.[0] || ''}
                  onChange={handleDateFromChange}
                  className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-sm
                    hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="date"
                  placeholder="Até"
                  value={filters.dateRange?.[1] || ''}
                  onChange={handleDateToChange}
                  className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-sm
                    hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Category Filter */}
          {colTypes?.categorical && colTypes.categorical.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text uppercase tracking-wider">
                {colTypes.categorical[0]}
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Mock categories - in real app, would come from data */}
                {['Categoria A', 'Categoria B', 'Categoria C', 'Categoria D'].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 rounded border-border bg-surface accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted group-hover:text-text transition-colors">
                      {cat}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Numeric Filter */}
          {colTypes?.numeric && colTypes.numeric.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-text uppercase tracking-wider">
                {colTypes.numeric[0]} (Intervalo)
              </h4>
              <div className="space-y-2">
                <input
                  type="number"
                  placeholder="Mín."
                  value={filters.numericRange?.[0] || ''}
                  onChange={handleNumericMinChange}
                  className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-sm
                    hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"
                />
                <input
                  type="number"
                  placeholder="Máx."
                  value={filters.numericRange?.[1] || ''}
                  onChange={handleNumericMaxChange}
                  className="w-full px-3 py-2 bg-surface rounded-lg border border-border text-text text-sm
                    hover:border-primary/50 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          {/* Reset Button */}
          <button
            onClick={resetFilters}
            className="w-full px-4 py-2 rounded-lg bg-muted/10 text-muted hover:bg-muted/20
              transition-colors font-medium text-sm"
          >
            Limpar Filtros
          </button>
        </div>
      </div>
    </>
  )
}
