import { LayoutGrid, List, ArrowUpDown } from 'lucide-react'

interface SortOption { value: string; label: string }

interface ViewControlsProps {
  viewMode:    'grid' | 'list'
  onViewMode:  (v: 'grid' | 'list') => void
  sortBy:      string
  onSortBy:    (v: string) => void
  sortOptions: SortOption[]
  search?:     string
  onSearch?:   (v: string) => void
  searchPlaceholder?: string
}

export function ViewControls({
  viewMode, onViewMode, sortBy, onSortBy, sortOptions,
  search, onSearch, searchPlaceholder = 'Suchen …',
}: ViewControlsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-5">
      {onSearch && (
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input className="form-input pl-9 w-48 text-sm" placeholder={searchPlaceholder}
            value={search} onChange={e => onSearch(e.target.value)}/>
        </div>
      )}

      {/* Sort */}
      <select className="form-input w-40 text-xs"
        value={sortBy} onChange={e => onSortBy(e.target.value)}>
        {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Grid/List Toggle */}
      <div className="flex rounded-xl overflow-hidden ml-auto"
        style={{ border: '1px solid rgb(255 255 255 / 0.08)' }}>
        <button onClick={() => onViewMode('grid')}
          className={`p-2 transition-colors ${viewMode==='grid'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}
          title="Kachelansicht">
          <LayoutGrid size={14}/>
        </button>
        <button onClick={() => onViewMode('list')}
          className={`p-2 transition-colors ${viewMode==='list'?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}
          title="Listenansicht">
          <List size={14}/>
        </button>
      </div>
    </div>
  )
}
