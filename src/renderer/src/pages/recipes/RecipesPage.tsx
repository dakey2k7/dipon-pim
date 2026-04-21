import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Plus, Trash2, Search, AlertCircle,
  ChevronDown, ChevronUp, Upload, BookOpen, FilePlus,
  Calculator, Percent,
} from 'lucide-react'
import { Button }  from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }   from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

interface Product { id:number; name:string; code:string; group_name:string|null; group_color:string|null; batch_size:number; batch_unit:string; material_count:number; variant_count:number }
interface Material { id:number; name:string; code:string; unit:string; preferred_price:number|null; preferred_currency:string|null; product_type?:string }
type PM = {
  id:number; material_id:number; material_name:string; material_code:string
  quantity:number; unit:string; waste_factor:number
  pref_price:number|null; pref_currency:string|null; pref_supplier_name:string|null
  all_prices_json:string|null; category_name?:string; material_category?:string
}

const N = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }
const eur  = (v: unknown, d = 4) => N(v) > 0 ? new Intl.NumberFormat('de-DE', { minimumFractionDigits:d, maximumFractionDigits:d }).format(N(v)) + ' €' : '–'
const eur2 = (v: unknown) => eur(v, 2)
const SORT = [{ value:'name_asc', label:'Name A–Z' }, { value:'name_desc', label:'Name Z–A' }, { value:'mats_desc', label:'Meiste Stoffe' }]

function toKg(qty: number, unit: string): number {
  if (unit === 'kg') return qty
  if (unit === 'g')  return qty / 1000
  if (unit === 'l')  return qty
  if (unit === 'ml') return qty / 1000
  return qty
}

// ── Live-Kalkulations-Panel ───────────────────────────────────
function LiveCalcPanel({ mats, product }: { mats: PM[]; product: Product }) {
  // Batch in kg (normalisiert)
  const batchKg = toKg(product.batch_size, product.batch_unit)

  // Eingabe-Menge immer in kg
  const [calcQtyStr, setCalcQtyStr] = useState(() => String(batchKg))
  const [pctMode, setPctMode] = useState(false)
  // Lokale Mengen-Overrides (in Originaleinheit des Materials)
  const [overrides, setOverrides] = useState<Record<number, string>>({})

  const calcQty = N(calcQtyStr.replace(',', '.'))

  // Effektive Menge eines Materials (original unit, ggf. überschrieben)
  const effQty = (m: PM) => N(overrides[m.id] ?? String(m.quantity))

  // Summe aller Materialmengen in kg (für Normalisierung auf 100%)
  const totalKg = useMemo(() =>
    mats.reduce((s, m) => s + toKg(effQty(m), m.unit), 0)
  , [mats, overrides])

  // EK/kg des Mixes (gewichtsbasiert)
  const ekPerKg = useMemo(() => {
    if (totalKg <= 0) return 0
    return mats.reduce((s, m) => {
      const frac  = toKg(effQty(m), m.unit) / totalKg
      const price = N(m.pref_price)
      return s + frac * price
    }, 0)
  }, [mats, totalKg, overrides])

  const scaleFactor = batchKg > 0 ? calcQty / batchKg : 0
  const ekTotal     = ekPerKg * calcQty

  const missingPrices = mats.filter(m => !m.pref_price)

  const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#a78bfa','#34d399']

  return (
    <div className="shrink-0" style={{ width: 300 }}>
      <div className="glass-card p-4 space-y-4" style={{ borderColor:'rgba(139,92,246,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <Calculator size={13} className="text-brand-400"/> Live-Kalkulation
          </p>
          <button onClick={() => setPctMode(v => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${pctMode ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>
            <Percent size={10}/> %
          </button>
        </div>

        {/* Charge eingeben */}
        <div>
          <label className="text-[10px] font-semibold text-slate-300 block mb-1">
            Berechnung für (kg)
          </label>
          <div className="flex items-center gap-2">
            <input type="text" value={calcQtyStr}
              onChange={e => setCalcQtyStr(e.target.value)}
              className="form-input text-sm font-mono text-white flex-1 text-right"
              placeholder={String(batchKg)}/>
            <span className="text-xs text-slate-400 shrink-0">kg</span>
          </div>
          {calcQty !== batchKg && batchKg > 0 && (
            <p className="text-[10px] text-indigo-400 mt-0.5">
              Skalierung ×{(calcQty / batchKg).toFixed(3).replace('.',',')}
            </p>
          )}
        </div>

        {/* Normalisation info */}
        <div className="p-2.5 rounded-xl" style={{ background:'rgba(139,92,246,0.08)', border:'1px solid rgba(139,92,246,0.2)' }}>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="font-semibold" style={{ color:'#c4b5fd', fontWeight:300 }}>EK / kg</span>
            <span className="font-mono font-bold text-white">{eur(ekPerKg, 4)}</span>
          </div>
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color:'#c4b5fd', fontWeight:300 }}>EK {calcQty > 0 ? calcQty : batchKg} kg</span>
            <span className="font-mono font-bold text-emerald-400">{eur2(ekTotal > 0 ? ekTotal : ekPerKg * batchKg)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color:'#94a3b8', fontWeight:300 }}>Rezeptur Summe</span>
            <span className="font-mono text-slate-300">{totalKg.toFixed(3).replace('.',',')} kg</span>
          </div>
        </div>

        {/* Prozentbalken */}
        {mats.length > 0 && totalKg > 0 && (
          <div>
            <div className="flex rounded-full overflow-hidden h-2.5 mb-2">
              {mats.map((m, i) => {
                const frac = totalKg > 0 ? toKg(effQty(m), m.unit) / totalKg * 100 : 0
                return <div key={m.id} style={{ width:`${frac}%`, background:colors[i%colors.length] }}
                  title={`${m.material_name}: ${frac.toFixed(1)}%`}/>
              })}
            </div>
          </div>
        )}

        {/* Rohstoff-Aufschlüsselung (editierbar) */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color:'#94a3b8' }}>
            Rohstoffe {pctMode ? '(Anteil %)' : '(Menge in ' + (calcQty > 0 ? calcQty : batchKg) + ' kg)'}
          </p>
          {mats.map((m, i) => {
            const eQty    = effQty(m)
            const eQtyKg  = toKg(eQty, m.unit)
            const frac    = totalKg > 0 ? eQtyKg / totalKg : 0
            const price   = N(m.pref_price)
            const contrib = frac * price
            const hasPrice = price > 0

            // Skalierte Menge für die eingegebene Charge
            const scaledQtyKg = eQtyKg * scaleFactor
            const displayQty  = pctMode
              ? (frac * 100).toFixed(2).replace('.',',') + '%'
              : scaleFactor > 0
                ? (scaledQtyKg).toFixed(3).replace('.',',') + ' kg'
                : eQty + ' ' + m.unit

            return (
              <div key={m.id} className="rounded-xl p-2.5"
                style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${colors[i%colors.length]}25` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background:colors[i%colors.length] }}/>
                    <span className="text-xs font-semibold text-white truncate max-w-[130px]">
                      {m.material_name}
                    </span>
                  </div>
                  {hasPrice
                    ? <span className="text-xs font-mono font-bold text-white">{eur(contrib, 4)}</span>
                    : <span className="text-[10px] text-red-400 flex items-center gap-0.5"><AlertCircle size={9}/>kein Preis</span>
                  }
                </div>
                <div className="flex items-center gap-2">
                  {/* Editierbare Menge */}
                  <input
                    type="number" step="0.001" min="0"
                    value={overrides[m.id] ?? m.quantity}
                    onChange={e => setOverrides(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className="w-20 px-2 py-1 rounded-lg text-xs font-mono text-white text-right"
                    style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)' }}
                    title="Menge bearbeiten (nur für Kalkulation)"/>
                  <span className="text-[10px]" style={{ color:'#94a3b8', fontWeight:300 }}>{m.unit}</span>
                  <span className="flex-1 text-right text-[10px] font-mono" style={{ color: colors[i%colors.length] }}>
                    {displayQty}
                  </span>
                </div>
                {hasPrice && (
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px]" style={{ color:'#94a3b8', fontWeight:300 }}>
                      {(frac * 100).toFixed(2).replace('.',',')}%
                    </span>
                    <span className="text-[10px] font-mono" style={{ color:'#94a3b8', fontWeight:300 }}>
                      {eur(price, 2)}/kg
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {missingPrices.length > 0 && (
          <div className="p-2.5 rounded-xl" style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-[10px] font-bold text-red-400">⚠ {missingPrices.length} ohne Preis</p>
            {missingPrices.map(m => (
              <p key={m.id} className="text-[10px]" style={{ color:'#94a3b8' }}>{m.material_name}</p>
            ))}
          </div>
        )}

        {/* Reset */}
        {Object.keys(overrides).length > 0 && (
          <button onClick={() => setOverrides({})}
            className="w-full text-[10px] py-1.5 rounded-lg transition-colors"
            style={{ color:'#94a3b8', border:'1px dashed rgba(255,255,255,0.1)' }}>
            ↺ Originalmengen wiederherstellen
          </button>
        )}

        {mats.length === 0 && (
          <p className="text-xs text-center" style={{ color:'#475569' }}>Noch keine Rohstoffe</p>
        )}
      </div>
    </div>
  )
}

// ── Rezeptur-Karte ────────────────────────────────────────────
function RecipeCard({ product, defaultOpen = false }: { product: Product; defaultOpen?: boolean }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [open,    setOpen]   = useState(defaultOpen)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ material_id:'', quantity:'', unit:'g', waste_factor:'0' })

  const { data: detail } = useQuery<{ materials: PM[]; variants: any[] }>({
    queryKey: ['product-detail', product.id],
    queryFn: () => window.api.products.get(product.id) as Promise<any>,
    enabled: open,
  })
  const { data: allMats = [] } = useQuery<Material[]>({
    queryKey: ['materials'],
    queryFn: () => window.api.materials.list() as Promise<Material[]>,
  })

  const invD = () => qc.invalidateQueries({ queryKey: ['product-detail', product.id] })
  const saveMat = useMutation({
    mutationFn: (d: unknown) => window.api.products.saveMaterial(product.id, d),
    onSuccess: () => { invD(); setShowAdd(false); setAddForm({ material_id:'', quantity:'', unit:'g', waste_factor:'0' }); toast.success('Rohstoff hinzugefügt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const delMat = useMutation({
    mutationFn: (id: number) => window.api.products.deleteMaterial(product.id, id),
    onSuccess: invD,
  })

  const mats = detail?.materials ?? []

  const matsByCategory = useMemo(() => {
    const groups: Record<string, PM[]> = {}
    for (const m of mats) {
      const cat = m.category_name || m.material_category || 'Sonstige'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [mats])

  const uniqueMats = useMemo(() => {
    const seen = new Map<string, Material>()
    for (const m of allMats as Material[]) {
      const key = m.name.toLowerCase().replace(/\s+/g, '')
      if (!seen.has(key) || (m.preferred_price && !seen.get(key)?.preferred_price)) seen.set(key, m)
    }
    return Array.from(seen.values()).sort((a, b) => {
      const catA = (a as any).product_type || 'z'
      const catB = (b as any).product_type || 'z'
      return catA.localeCompare(catB) || a.name.localeCompare(b.name)
    })
  }, [allMats])

  const fmt4 = (v: number, c = 'EUR') =>
    new Intl.NumberFormat('de-DE', { style:'currency', currency:c, minimumFractionDigits:4 }).format(v)

  return (
    <div className="glass-card overflow-hidden mb-2">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/3 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background:`${product.group_color||'#8b5cf6'}20`, color:product.group_color||'#8b5cf6' }}>
            {product.code.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white">{product.name}</p>
              <span className="badge-blue text-xs font-mono">{product.code}</span>
              {product.group_name && <span className="text-xs text-slate-500">{product.group_name}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500">{product.batch_size} {product.batch_unit} Batch</span>
              {product.material_count > 0
                ? <span className="badge-blue text-xs">{product.material_count} Rohstoffe</span>
                : <span className="text-xs text-slate-600 flex items-center gap-1"><AlertCircle size={10}/>Kein Rezept</span>}
              {product.variant_count > 0 && <span className="badge-slate text-xs">{product.variant_count} Varianten</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {product.material_count === 0 ? (
            <button onClick={e => { e.stopPropagation(); setOpen(true); setTimeout(() => setShowAdd(true), 50) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', color:'#a5b4fc' }}>
              <FilePlus size={12}/><span className="hidden sm:block">Rezept hinzufügen</span>
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.35)', color:'#6ee7b7' }}>
              <BookOpen size={12}/><span className="hidden sm:block">Rezept bearbeiten</span>
            </button>
          )}
          {open ? <ChevronUp size={15} className="text-slate-500 shrink-0"/> : <ChevronDown size={15} className="text-slate-500 shrink-0"/>}
        </div>
      </div>

      {open && (
        <div className="border-t border-white/5">
          <div className="flex gap-4 p-4 items-start">
            {/* Rohstoffliste */}
            <div className="flex-1 min-w-0 space-y-4">
              {matsByCategory.length === 0 && (
                <p className="text-xs text-slate-600 italic py-2">Noch keine Rohstoffe in der Rezeptur</p>
              )}
              {matsByCategory.map(([category, items]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical size={11} className="text-slate-600 shrink-0"/>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{category}</span>
                    <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.06)' }}/>
                  </div>
                  {items.map(m => {
                    let prices: any[] = []
                    try { prices = m.all_prices_json ? JSON.parse(m.all_prices_json) : [] } catch {}
                    return (
                      <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl mb-1.5 group"
                        style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2">
                          <FlaskConical size={12} className="text-brand-400 shrink-0"/>
                          <div>
                            <p className="text-xs font-semibold text-white">{m.material_name}</p>
                            <p className="text-[10px] text-slate-500">
                              {m.quantity} {m.unit}{m.waste_factor > 0 ? ` +${(m.waste_factor*100).toFixed(0)}% Ausschuss` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {prices.length > 1 && (
                            <select className="form-input text-xs py-0.5 w-40"
                              defaultValue={prices.find((p: any) => p.is_preferred)?.supplier_id || ''}>
                              {prices.map((p: any) => (
                                <option key={p.supplier_id} value={p.supplier_id}>
                                  {p.is_preferred ? '★ ' : ''}{p.supplier_name}
                                </option>
                              ))}
                            </select>
                          )}
                          {prices.length === 1 && m.pref_supplier_name && (
                            <span className="text-[10px] text-slate-500">
                              {m.pref_supplier_name === 'Brenntag' ? '★ Brenntag' : m.pref_supplier_name}
                            </span>
                          )}
                          <span className="text-xs font-mono text-slate-300">
                            {m.pref_price != null
                              ? fmt4(m.pref_price, m.pref_currency||'EUR') + `/${m.unit}`
                              : <span className="text-red-400">Kein Preis</span>}
                          </span>
                          <button onClick={() => delMat.mutate(m.id)}
                            className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100">
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {showAdd ? (
                <div className="p-3 rounded-xl space-y-2"
                  style={{ background:'rgba(99,102,241,0.05)', border:'1px solid rgba(99,102,241,0.2)' }}>
                  <Select label="Rohstoff *" value={addForm.material_id}
                    onChange={e => setAddForm(f => ({ ...f, material_id: e.target.value }))}>
                    <option value="">– Wählen –</option>
                    {(() => {
                      const byType: Record<string, Material[]> = {}
                      for (const m of uniqueMats) {
                        const t = (m as any).product_type || 'Sonstige'
                        if (!byType[t]) byType[t] = []
                        byType[t].push(m)
                      }
                      return Object.entries(byType).sort(([a],[b]) => a.localeCompare(b)).map(([type, items]) => (
                        <optgroup key={type} label={type}>
                          {items.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.code}){m.preferred_price != null ? ` — ${new Intl.NumberFormat('de-DE',{minimumFractionDigits:4}).format(m.preferred_price)} €/${m.unit}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    })()}
                  </Select>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Menge *" type="number" step="0.001" value={addForm.quantity}
                      onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}/>
                    <Select label="Einheit" value={addForm.unit}
                      onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}>
                      {['g','kg','ml','l'].map(u => <option key={u}>{u}</option>)}
                    </Select>
                    <Input label="Ausschuss %" type="number" step="0.1" value={addForm.waste_factor}
                      onChange={e => setAddForm(f => ({ ...f, waste_factor: e.target.value }))}/>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" loading={saveMat.isPending}
                      disabled={!addForm.material_id || !addForm.quantity}
                      onClick={() => saveMat.mutate({ material_id:Number(addForm.material_id), quantity:Number(addForm.quantity), unit:addForm.unit, waste_factor:Number(addForm.waste_factor)/100 })}>
                      Hinzufügen
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowAdd(false)}>Abbrechen</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  style={{ border:'1px dashed rgba(255,255,255,0.08)' }}>
                  <Plus size={11}/> Rohstoff hinzufügen
                </button>
              )}
            </div>

            {/* Live-Kalkulations-Panel */}
            {mats.length > 0 && <LiveCalcPanel mats={mats} product={product}/>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
export default function RecipesPage() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [search,      setSearch]      = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [sortBy,      setSortBy]      = useState('name_asc')
  const [showNew,     setShowNew]     = useState(false)
  const [showImport,  setShowImport]  = useState(false)
  const [newForm,     setNewForm]     = useState({ name:'', code:'', product_group_id:'', batch_size:1000, batch_unit:'g', overhead_factor:5, has_recipe:true })
  const [deleting,    setDeleting]    = useState<Product | undefined>()
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', debouncedSearch, filterGroup],
    queryFn:  () => window.api.products.list({ search:debouncedSearch||undefined, group_id:filterGroup?Number(filterGroup):undefined }) as Promise<Product[]>,
  })
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['product-groups'],
    queryFn: () => window.api.productGroups.list() as Promise<any[]>,
  })

  const sorted = ([...products] as Product[]).sort((a, b) =>
    sortBy === 'name_desc'  ? b.name.localeCompare(a.name) :
    sortBy === 'mats_desc'  ? (b.material_count ?? 0) - (a.material_count ?? 0) :
    a.name.localeCompare(b.name)
  )
  const withRecipe    = sorted.filter(p => (p.material_count ?? 0) > 0)
  const withoutRecipe = sorted.filter(p => (p.material_count ?? 0) === 0)

  const inv = () => qc.invalidateQueries({ queryKey: ['products'] })
  const createM = useMutation({
    mutationFn: (d: unknown) => window.api.products.create(d),
    onSuccess: () => { inv(); setShowNew(false); toast.success('Angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title">Rezepturen & Komponenten</h2>
          <p className="page-subtitle">{withRecipe.length} mit Rezept · {withoutRecipe.length} Einzelartikel</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white transition-colors"
            style={{ border:'1px solid rgba(255,255,255,0.1)' }}>
            <Upload size={12}/> Excel Import
          </button>
          <Button icon={<Plus size={14}/>} onClick={() => setShowNew(true)}>Produkt anlegen</Button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-full text-sm" placeholder="Suchen …" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-input w-40 text-sm" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
          <option value="">Alle Gruppen</option>
          {(groups as any[]).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-input w-36 text-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          {SORT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {!products.length && <EmptyState icon={<FlaskConical size={40}/>} title="Noch keine Produkte"
        action={<Button icon={<Plus size={12}/>} onClick={() => setShowNew(true)}>Erstes Produkt</Button>}/>}

      {withRecipe.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={12} className="text-brand-400"/>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mit Rezeptur ({withRecipe.length})</span>
          </div>
          {withRecipe.map(p => <RecipeCard key={p.id} product={p}/>)}
        </div>
      )}

      {withoutRecipe.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={12} className="text-slate-500"/>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Einzelartikel ohne Rezept ({withoutRecipe.length})</span>
          </div>
          {withoutRecipe.map(p => <RecipeCard key={p.id} product={p}/>)}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Neues Produkt / Komponente" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Name *" value={newForm.name} autoFocus
                onChange={e => setNewForm(f => ({ ...f, name:e.target.value, code:e.target.value.toUpperCase().replace(/\s+/g,'-').slice(0,12) }))}/>
            </div>
            <Input label="Code *" value={newForm.code} onChange={e => setNewForm(f => ({ ...f, code:e.target.value.toUpperCase() }))}/>
            <Select label="Produktgruppe" value={newForm.product_group_id} onChange={e => setNewForm(f => ({ ...f, product_group_id:e.target.value }))}>
              <option value="">– Keine –</option>
              {(groups as any[]).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch-Größe" type="number" value={newForm.batch_size} onChange={e => setNewForm(f => ({ ...f, batch_size:Number(e.target.value) }))}/>
            <Select label="Einheit" value={newForm.batch_unit} onChange={e => setNewForm(f => ({ ...f, batch_unit:e.target.value }))}>
              {['g','kg','ml','l'].map(u => <option key={u}>{u}</option>)}
            </Select>
          </div>
          <div className="flex gap-3">
            {[{v:true,l:'🧪 Mit Rezeptur'},{v:false,l:'📦 Ohne Rezeptur'}].map(opt => (
              <button key={String(opt.v)} type="button"
                onClick={() => setNewForm(f => ({ ...f, has_recipe:opt.v }))}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${newForm.has_recipe===opt.v ? 'bg-brand-500/20 border-brand-500/40 text-white' : 'border-white/8 text-slate-400'}`}>
                {opt.l}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button disabled={!newForm.name || !newForm.code}
              onClick={() => createM.mutate({ ...newForm, product_group_id:newForm.product_group_id?Number(newForm.product_group_id):null, overhead_factor:1+newForm.overhead_factor/100 })}>
              Anlegen
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Produkt löschen?"
        message={`"${deleting?.name}" wirklich löschen?`}
        onConfirm={() => { if (deleting) window.api.products.delete(deleting.id).then(() => { inv(); setDeleting(undefined) }) }}
        onCancel={() => setDeleting(undefined)}/>
    </div>
  )
}
