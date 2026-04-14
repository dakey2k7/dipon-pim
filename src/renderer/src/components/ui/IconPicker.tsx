import { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { Search, X } from 'lucide-react'

// Kuratierte Icon-Liste für DIPON PIM
const ICON_GROUPS = {
  'Produkte & Materialien': [
    'FlaskConical','TestTube','Beaker','Layers','Package','Box','Archive',
    'Container','Boxes','PackageOpen','PackageCheck','Component',
  ],
  'Verpackung & Logistik': [
    'Package2','Truck','ShoppingCart','ShoppingBag','Warehouse','Store',
    'Barcode','QrCode','Tag','Tags','Ticket',
  ],
  'Chemie & Industrie': [
    'Atom','Zap','Flame','Droplets','Wind','Thermometer','Gauge',
    'Settings','Settings2','Wrench','Tool','Hammer',
  ],
  'Finanzen & Kalkulation': [
    'DollarSign','Euro','Calculator','TrendingUp','TrendingDown',
    'BarChart','BarChart2','BarChart3','PieChart','LineChart','Activity',
    'Percent','Receipt','CreditCard','Wallet',
  ],
  'Lieferanten & Kontakte': [
    'Building','Building2','Factory','Users','User','UserCheck',
    'Phone','Mail','Globe','MapPin','Truck',
  ],
  'Dokumente & Daten': [
    'FileText','File','Files','FolderOpen','Folder','Database',
    'ClipboardList','Clipboard','BookOpen','Book','Notebook',
  ],
  'Status & Aktionen': [
    'CheckCircle','XCircle','AlertCircle','Info','Star','Heart',
    'Bookmark','Flag','Bell','Eye','Lock','Shield',
  ],
  'Navigation': [
    'LayoutDashboard','Menu','Grid','List','Table','Columns',
    'Sidebar','PanelLeft','Home','Compass','Map',
  ],
}

const ALL_ICONS = Object.values(ICON_GROUPS).flat()

interface IconPickerProps {
  value?:    string
  onChange:  (icon: string) => void
  size?:     number
  label?:    string
}

function renderIcon(name: string, size = 16, color = 'currentColor') {
  const Icon = (LucideIcons as Record<string, React.ComponentType<{size?:number;color?:string}>>)[name]
  if (!Icon) return null
  return <Icon size={size} color={color}/>
}

export function IconDisplay({ name, size=16, color='currentColor' }: { name:string; size?:number; color?:string }) {
  return renderIcon(name, size, color) ?? <span style={{fontSize:size/2}}>?</span>
}

export function IconPicker({ value, onChange, size=16, label }: IconPickerProps) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const [group, setGroup]     = useState('Alle')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const icons = group === 'Alle' ? ALL_ICONS : (ICON_GROUPS as Record<string,string[]>)[group] ?? ALL_ICONS
    return icons.filter(n => !q || n.toLowerCase().includes(q))
  }, [search, group])

  return (
    <div className="relative">
      {label && <label className="form-label">{label}</label>}

      {/* Trigger */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="form-input flex items-center gap-2 cursor-pointer hover:border-brand-500/40 transition-colors"
        style={{ minWidth: 120 }}>
        {value
          ? <><IconDisplay name={value} size={size}/><span className="text-sm text-slate-300">{value}</span></>
          : <span className="text-sm text-slate-500">– Icon wählen –</span>
        }
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            width: 340, background: '#161930',
            border: '1px solid rgb(139 92 246/0.3)',
            boxShadow: '0 8px 40px rgb(0 0 0/0.6)',
          }}>
          {/* Suche */}
          <div className="p-3 border-b border-white/5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4">
              <Search size={13} className="text-slate-500 shrink-0"/>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Icon suchen …"
                className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"/>
              {search && <button onClick={() => setSearch('')}><X size={11} className="text-slate-600"/></button>}
            </div>
          </div>

          {/* Gruppen-Tabs */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5"
            style={{ scrollbarWidth: 'none' }}>
            {['Alle', ...Object.keys(ICON_GROUPS)].map(g => (
              <button key={g} onClick={() => setGroup(g)}
                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${
                  group === g ? 'bg-brand-500/20 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}>
                {g === 'Alle' ? `Alle (${ALL_ICONS.length})` : g.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Icon Grid */}
          <div className="overflow-y-auto p-2" style={{ maxHeight: 260 }}>
            {!filtered.length
              ? <p className="text-center text-slate-600 text-xs py-6">Keine Icons gefunden</p>
              : <div className="grid grid-cols-8 gap-1">
                  {filtered.map(name => (
                    <button key={name} type="button"
                      onClick={() => { onChange(name); setOpen(false); setSearch('') }}
                      title={name}
                      className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:scale-110 ${
                        value === name
                          ? 'bg-brand-500/30 text-brand-400 ring-1 ring-brand-500/50'
                          : 'text-slate-400 hover:bg-white/8 hover:text-white'
                      }`}>
                      <IconDisplay name={name} size={16}/>
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* Aktuell gewählt */}
          {value && (
            <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <IconDisplay name={value} size={14}/> {value}
              </div>
              <button onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs text-red-400 hover:text-red-300">Entfernen</button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>}
    </div>
  )
}
