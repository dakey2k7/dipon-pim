import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Plus, Trash2, Search, AlertCircle,
  ChevronDown, ChevronUp, BookOpen, FilePlus,
  Pencil, Check, X, RefreshCw, ArrowUp, ArrowDown, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

interface Product { id:number; name:string; code:string; group_name:string|null; group_color:string|null; batch_size:number; batch_unit:string; material_count:number; variant_count:number }
interface Material { id:number; name:string; code:string; unit:string; preferred_price:number|null; preferred_currency:string|null; product_type?:string }
type PM = { id:number; material_id:number; material_name:string; material_code:string; quantity:number; unit:string; waste_factor:number; pref_price:number|null; pref_currency:string|null; pref_supplier_name:string|null; all_prices_json:string|null; category_name?:string; material_category?:string }

const N = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }
const fmt = (v: number, d = 4) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)

function toKg(qty: number, unit: string): number {
  if (unit === 'g' || unit === 'ml') return qty / 1000
  return qty
}

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#a78bfa','#34d399']
const SORT = [
  { value:'name_asc',  label:'Name A–Z' },
  { value:'name_desc', label:'Name Z–A' },
  { value:'mats_desc', label:'Meiste Stoffe' },
]
const UNIT_MODES = [
  { key:'kg',   label:'/kg',   factor:1       },
  { key:'100g', label:'/100g', factor:0.1     },
  { key:'g',    label:'/g',    factor:0.001   },
  { key:'l',    label:'/l',    factor:1       },
]

// ── Live-Kalkulation (rechts, wie Bild 1) ─────────────────────
function LiveCalcPanel({ mats, product }: { mats: PM[]; product: Product }) {
  const batchKg = toKg(product.batch_size, product.batch_unit)
  const [chargeKg,  setChargeKg]  = useState(() => batchKg > 0 ? batchKg : 1)
  const [unitModeK, setUnitModeK] = useState('kg')

  const mode   = UNIT_MODES.find(m => m.key === unitModeK) ?? UNIT_MODES[0]
  const factor = mode.factor

  const totalKg = useMemo(() =>
    mats.reduce((s, m) => s + toKg(m.quantity, m.unit), 0)
  , [mats])

  // EK/kg des Mixes (normalisiert auf 1 kg Mischung)
  const ekPerKgMix = useMemo(() => {
    if (totalKg <= 0) return 0
    return mats.reduce((s, m) => {
      const frac = toKg(m.quantity, m.unit) / totalKg
      return s + frac * N(m.pref_price)
    }, 0)
  }, [mats, totalKg])

  const missingCount = mats.filter(m => !m.pref_price).length

  return (
    <div className="shrink-0 flex flex-col gap-0 rounded-2xl overflow-hidden"
      style={{ width:405, background:'#10121e', border:'1px solid rgba(255,255,255,0.08)' }}>

      {/* Header + Unit-Toggle */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between"
        style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Live-Kalkulation
        </p>
        <div className="flex gap-0.5 p-0.5 rounded-lg"
          style={{ background:'rgba(255,255,255,0.06)' }}>
          {UNIT_MODES.map(m => (
            <button key={m.key} onClick={() => setUnitModeK(m.key)}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold transition-all"
              style={unitModeK === m.key
                ? { background:'rgba(99,102,241,0.4)', color:'#c7d2fe' }
                : { color:'#475569' }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zutaten-Liste */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ divideColor:'rgba(255,255,255,0.04)' }}>
        {mats.map((m, i) => {
          const mKg    = toKg(m.quantity, m.unit)
          const frac   = totalKg > 0 ? mKg / totalKg : 0
          const price  = N(m.pref_price)
          // Anteil = Beitrag dieses Rohstoffs zum Mix-Preis pro Einheit
          const anteil = frac * price * factor

          return (
            <div key={m.id} className="px-4 py-2.5 flex items-start gap-3"
              style={{ borderBottom:'1px solid rgba(255,255,255,0.10)' }}>
              {/* Index */}
              <span className="text-[10px] font-bold shrink-0 mt-0.5"
                style={{ color: COLORS[i % COLORS.length], minWidth:14 }}>
                {i + 1}
              </span>
              {/* Name + qty·% */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{m.material_name}</p>
                <p className="text-[10px]" style={{ color:'#e2e8f0' }}>
                  {mKg >= 1
                    ? fmt(mKg, 2) + ' kg'
                    : fmt(mKg * 1000, 2) + ' g'}
                  {' · '}
                  <span style={{ color:'#e2e8f0' }}>{fmt(frac * 100, 2)}%</span>
                </p>
              </div>
              {/* Preis + Anteil */}
              <div className="text-right shrink-0">
                {price > 0 ? (
                  <>
                    <p className="text-xs font-bold font-mono text-white">
                      {fmt(price * factor, 4)} €
                    </p>
                    <p className="text-[10px] font-mono" style={{ color:'#94a3b8' }}>
                      {fmt(anteil, 4)} € Anteil
                    </p>
                  </>
                ) : (
                  <p className="text-[10px]" style={{ color:'#f87171' }}>kein Preis</p>
                )}
              </div>
            </div>
          )
        })}

        {!mats.length && (
          <p className="text-xs text-center py-6" style={{ color:'#475569' }}>
            Noch keine Rohstoffe
          </p>
        )}
      </div>

      {/* Farbbalken */}
      {mats.length > 0 && totalKg > 0 && (
        <div className="flex h-1.5">
          {mats.map((m, i) => {
            const frac = toKg(m.quantity, m.unit) / totalKg * 100
            return <div key={m.id} style={{ width:`${frac}%`, background:COLORS[i%COLORS.length] }}/>
          })}
        </div>
      )}

      {/* Footer: Charge + Preis */}
      <div className="px-4 py-3 space-y-2"
        style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
        {/* Chargengewicht-Input */}
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color:'#e2e8f0' }}>Chargengewicht</span>
          <div className="flex items-center gap-1.5">
            <input type="number" step="0.001" min="0"
              value={chargeKg}
              onChange={e => setChargeKg(N(e.target.value))}
              className="w-24 px-2 py-1 rounded-lg text-xs font-mono text-white text-right"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)' }}/>
            <span className="text-xs font-bold" style={{ color:'#ffffff' }}>kg</span>
          </div>
        </div>

        {/* EK pro Einheit */}
        <div className="flex items-center justify-between pt-1"
          style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="text-[10px]" style={{ color:'#94a3b8' }}>Preis</p>
            <p className="text-[10px]" style={{ color:'#94a3b8' }}>pro {mode.key === '100g' ? '100g' : mode.key}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black font-mono text-white">
              {fmt(ekPerKgMix * factor, 2)} €
            </p>
            <p className="text-xs font-mono" style={{ color:'#94a3b8' }}>
              {fmt(ekPerKgMix * factor, 4)} €
            </p>
          </div>
        </div>

        {/* EK für Charge */}
        {chargeKg !== totalKg && chargeKg > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color:'#94a3b8' }}>EK {chargeKg} kg</span>
            <div className="text-right">
              <span className="text-sm font-bold font-mono" style={{ color:'#34d399' }}>
                {fmt(ekPerKgMix * chargeKg, 2)} €
              </span>
              <p className="text-[10px] font-mono" style={{ color:'#6ee7b7' }}>
                {fmt(ekPerKgMix * chargeKg, 4)} €
              </p>
            </div>
          </div>
        )}

        {missingCount > 0 && (
          <p className="text-[10px] text-center" style={{ color:'#f87171' }}>
            ⚠ {missingCount} Rohstoff{missingCount > 1 ? 'e' : ''} ohne Preis
          </p>
        )}
      </div>
    </div>
  )
}

// ── Editierbare Rezeptur-Zeile (wie Bild 2 + Inline-Edit) ─────
function RecipeMatRow({ mat, index, total, productId, allMats, onSaved, onDelete, onReorder }: {
  mat: PM; index: number; total: number; productId: number
  allMats: Material[]; onSaved: () => void; onDelete: () => void
  onReorder: (dir: 'up' | 'down') => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    material_id: String(mat.material_id),
    quantity:    String(mat.quantity),
    unit:        mat.unit,
    waste_factor:String((mat.waste_factor * 100).toFixed(1)),
  })

  const navigate = useNavigate()

  // Lieferanten aus all_prices_json
  const prices: any[] = (() => { try { return mat.all_prices_json ? JSON.parse(mat.all_prices_json) : [] } catch { return [] } })()
  const minPrice = prices.length > 1 ? Math.min(...prices.map((p:any) => p.price_per_unit ?? 9999)) : null
  const maxPrice = prices.length > 1 ? Math.max(...prices.map((p:any) => p.price_per_unit ?? 0)) : null

  const saveM = useMutation({
    mutationFn: (d: unknown) => window.api.products.saveMaterial(productId, d),
    onSuccess: () => { onSaved(); setEditing(false); toast.success('Aktualisiert') },
    onError:   (e: Error) => toast.error('Fehler', e.message),
  })

  // Materialien nach Kategorie gruppiert
  const byCategory = useMemo(() => {
    const groups: Record<string, Material[]> = {}
    for (const m of allMats) {
      const cat = (m as any).product_type || 'Sonstige'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b))
  }, [allMats])

  const color = COLORS[index % COLORS.length]
  const mKg   = toKg(mat.quantity, mat.unit)

  if (editing) {
    return (
      <div className="rounded-xl p-3 space-y-3"
        style={{ background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.25)' }}>
        {/* Rohstoff-Dropdown kategorisiert */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Rohstoff</label>
          <select
            className="form-input text-xs w-full"
            value={form.material_id}
            onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}>
            {byCategory.map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                    {m.preferred_price != null
                      ? ` — ${fmt(m.preferred_price, 4)} €/${m.unit}`
                      : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Menge *</label>
            <input type="number" step="0.001" min="0"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="form-input text-xs w-full font-mono text-white"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Einheit</label>
            <select className="form-input text-xs w-full" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {['g','kg','ml','l'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Ausschuss %</label>
            <input type="number" step="0.1" min="0"
              value={form.waste_factor}
              onChange={e => setForm(f => ({ ...f, waste_factor: e.target.value }))}
              className="form-input text-xs w-full font-mono text-white"/>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" loading={saveM.isPending}
            disabled={!form.material_id || !form.quantity}
            onClick={() => saveM.mutate({
              id:           mat.id,
              material_id:  Number(form.material_id),
              quantity:     N(form.quantity),
              unit:         form.unit,
              waste_factor: N(form.waste_factor) / 100,
            })}>
            Speichern
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Abbrechen</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl group transition-colors hover:bg-white/[0.03]"
      style={{ borderLeft:`2px solid ${color}40`, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      {/* Index */}
      <span className="text-xs font-black shrink-0 w-5 text-center"
        style={{ color }}>
        {index + 1}
      </span>

      {/* Name + Lieferant */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{mat.material_name}</p>
        {/* Lieferant + Detail-Link */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {prices.length > 1 ? (
            <select
              className="text-[10px] font-mono rounded px-1 py-0"
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'#e2e8f0', maxWidth:180 }}
              defaultValue={prices.find((p:any) => p.is_preferred)?.supplier_id || ''}>
              {prices.map((p:any) => {
                const price = p.price_per_unit ?? p.pref_price ?? 0
                const isMin = minPrice !== null && Math.abs(price - minPrice) < 0.0001
                const isMax = maxPrice !== null && Math.abs(price - maxPrice) < 0.0001 && !isMin
                return (
                  <option key={p.supplier_id} value={p.supplier_id}
                    style={{ color: isMin ? '#4ade80' : isMax ? '#f87171' : '#e2e8f0' }}>
                    {p.is_preferred ? '★ ' : ''}{p.supplier_name}
                    {' – '}{fmt(price, 2)} €/{mat.unit}
                  </option>
                )
              })}
            </select>
          ) : (
            <span className="text-[10px]" style={{ color:'#e2e8f0' }}>
              {mat.pref_supplier_name || mat.material_code}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); navigate('/materials', { state: { highlightId: mat.material_id } }) }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-semibold transition-all shrink-0"
            style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}
            title="Rohstoff Details öffnen">
            <ExternalLink size={9}/> Details
          </button>
        </div>
      </div>

      {/* Menge + Preis (rechts) */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white font-mono">
          {mKg >= 1
            ? fmt(mKg, mKg % 1 === 0 ? 0 : 2) + ' kg'
            : fmt(mKg * 1000, 0) + ' g'}
        </p>
        {mat.pref_price != null ? (
          <>
            <p className="text-sm font-bold font-mono" style={{ color:'#e2e8f0' }}>
              {fmt(mat.pref_price, 2)} €/{mat.unit}
            </p>
            <p className="text-[10px] font-mono" style={{ color:'#94a3b8' }}>
              {fmt(mat.pref_price, 4)} €/{mat.unit}
            </p>
          </>
        ) : (
          <p className="text-[10px]" style={{ color:'#f87171' }}>kein Preis</p>
        )}
      </div>

      {/* Aktionen */}
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1">
        <button onClick={() => onReorder('up')} disabled={index === 0}
          className="p-1 rounded transition-colors hover:bg-white/8 disabled:opacity-20"
          style={{ color:'#94a3b8' }} title="Nach oben">
          <ArrowUp size={11}/>
        </button>
        <button onClick={() => onReorder('down')} disabled={index === total - 1}
          className="p-1 rounded transition-colors hover:bg-white/8 disabled:opacity-20"
          style={{ color:'#94a3b8' }} title="Nach unten">
          <ArrowDown size={11}/>
        </button>
      </div>
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={() => setEditing(true)}
          className="p-1.5 rounded-lg transition-colors hover:bg-indigo-500/15"
          style={{ color:'#6366f1' }} title="Bearbeiten / Ersetzen">
          <Pencil size={12}/>
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/15"
          style={{ color:'#ef4444' }} title="Entfernen">
          <Trash2 size={12}/>
        </button>
      </div>
    </div>
  )
}

// ── Rohstoff hinzufügen (kompakt) ─────────────────────────────
function AddMatForm({ productId, allMats, onAdded, onCancel }: {
  productId: number; allMats: Material[]; onAdded: () => void; onCancel: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({ material_id:'', quantity:'', unit:'kg', waste_factor:'0' })

  const byCategory = useMemo(() => {
    const groups: Record<string, Material[]> = {}
    // Deduplicate by name
    const seen = new Map<string, Material>()
    for (const m of allMats) {
      const key = m.name.toLowerCase().replace(/\s+/g,'')
      if (!seen.has(key) || (m.preferred_price && !seen.get(key)?.preferred_price)) seen.set(key, m)
    }
    for (const m of seen.values()) {
      const cat = (m as any).product_type || 'Sonstige'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b))
  }, [allMats])

  const saveM = useMutation({
    mutationFn: (d: unknown) => window.api.products.saveMaterial(productId, d),
    onSuccess: () => { onAdded(); toast.success('Rohstoff hinzugefügt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })

  return (
    <div className="rounded-xl p-3 space-y-3 mt-2"
      style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.2)' }}>
      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1">Rohstoff *</label>
        <select className="form-input text-xs w-full" value={form.material_id}
          onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}>
          <option value="">– Wählen –</option>
          {byCategory.map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                  {m.preferred_price != null ? ` — ${fmt(m.preferred_price, 4)} €/${m.unit}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Menge *</label>
          <input type="number" step="0.001" min="0" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="form-input text-xs w-full font-mono text-white"
            placeholder="0"/>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Einheit</label>
          <select className="form-input text-xs w-full" value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
            {['g','kg','ml','l'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Ausschuss %</label>
          <input type="number" step="0.1" min="0" value={form.waste_factor}
            onChange={e => setForm(f => ({ ...f, waste_factor: e.target.value }))}
            className="form-input text-xs w-full font-mono text-white"/>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={saveM.isPending}
          disabled={!form.material_id || !form.quantity}
          onClick={() => saveM.mutate({
            material_id:  Number(form.material_id),
            quantity:     N(form.quantity),
            unit:         form.unit,
            waste_factor: N(form.waste_factor) / 100,
          })}>
          Hinzufügen
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>Abbrechen</Button>
      </div>
    </div>
  )
}

// ── Rezeptur-Karte ────────────────────────────────────────────
function RecipeCard({ product, defaultOpen = false }: { product: Product; defaultOpen?: boolean }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [open,    setOpen]    = useState(defaultOpen)
  const [showAdd, setShowAdd] = useState(false)

  const { data: detail } = useQuery<{ materials: PM[]; variants: any[] }>({
    queryKey: ['product-detail', product.id],
    queryFn:  () => window.api.products.get(product.id) as Promise<any>,
    enabled:  open,
  })
  const { data: allMats = [] } = useQuery<Material[]>({
    queryKey: ['materials'],
    queryFn:  () => window.api.materials.list() as Promise<Material[]>,
  })

  const invD = useCallback(() =>
    qc.invalidateQueries({ queryKey: ['product-detail', product.id] })
  , [qc, product.id])

  const delMat = useMutation({
    mutationFn: (id: number) => window.api.products.deleteMaterial(product.id, id),
    onSuccess:  invD,
  })

  const mats = detail?.materials ?? []

  return (
    <div className="glass-card overflow-hidden mb-2">
      {/* Card-Header */}
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background:`${product.group_color||'#8b5cf6'}20`, color:product.group_color||'#8b5cf6' }}>
            {product.code.slice(0,2)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">{product.name}</p>
              <span className="badge-blue text-xs font-mono">{product.code}</span>
              {product.group_name && <span className="text-xs text-slate-500">{product.group_name}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
              <FilePlus size={12}/> Rezept hinzufügen
            </button>
          ) : (
            <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.35)', color:'#6ee7b7' }}>
              <BookOpen size={12}/> Rezept bearbeiten
            </button>
          )}
          {open ? <ChevronUp size={15} className="text-slate-500 shrink-0"/> : <ChevronDown size={15} className="text-slate-500 shrink-0"/>}
        </div>
      </div>

      {/* Aufgeklappter Body */}
      {open && (
        <div className="border-t border-white/5">
          <div className="flex gap-4 p-4 items-start">

            {/* ── Linke Seite: Rohstoff-Liste (wie Bild 2) ── */}
            <div className="flex-1 min-w-0">
              {/* Batch-Info */}
              <div className="flex items-center gap-2 mb-3 pb-2"
                style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs font-bold text-white">{product.name}</p>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-500">{product.batch_size} {product.batch_unit} Batch</span>
                <span className="badge-blue text-xs ml-auto">{mats.length} Rohstoffe</span>
              </div>

              {/* Zutaten nummeriert */}
              <div className="space-y-0.5">
                {mats.map((m, i) => (
                  <RecipeMatRow
                    key={m.id}
                    mat={m}
                    index={i}
                    total={mats.length}
                    productId={product.id}
                    allMats={allMats as Material[]}
                    onSaved={invD}
                    onDelete={() => delMat.mutate(m.id)}
                    onReorder={async (dir) => {
                      await window.api.products.reorderMaterial(product.id, m.id, dir)
                      invD()
                    }}/>
                ))}
              </div>

              {/* Rohstoff hinzufügen */}
              {showAdd ? (
                <AddMatForm
                  productId={product.id}
                  allMats={allMats as Material[]}
                  onAdded={() => { invD(); setShowAdd(false) }}
                  onCancel={() => setShowAdd(false)}/>
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-xl text-xs transition-colors hover:text-slate-300 text-slate-500"
                  style={{ border:'1px dashed rgba(255,255,255,0.08)' }}>
                  <Plus size={11}/> Rohstoff hinzufügen
                </button>
              )}
            </div>

            {/* ── Rechte Seite: Live-Kalkulation (wie Bild 1) ── */}
            {mats.length > 0 && (
              <LiveCalcPanel mats={mats} product={product}/>
            )}
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
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterGroup,     setFilterGroup]     = useState('')
  const [sortBy,          setSortBy]          = useState('name_asc')
  const [showNew,         setShowNew]         = useState(false)
  const [newForm,         setNewForm]         = useState({
    name:'', code:'', product_group_id:'',
    batch_size:1000, batch_unit:'g',
    overhead_factor:5, has_recipe:true,
  })

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', debouncedSearch, filterGroup],
    queryFn:  () => window.api.products.list({
      search:   debouncedSearch || undefined,
      group_id: filterGroup ? Number(filterGroup) : undefined,
    }) as Promise<Product[]>,
  })
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['product-groups'],
    queryFn:  () => window.api.productGroups.list() as Promise<any[]>,
  })

  const sorted = ([...products] as Product[]).sort((a, b) =>
    sortBy === 'name_desc' ? b.name.localeCompare(a.name) :
    sortBy === 'mats_desc' ? (b.material_count ?? 0) - (a.material_count ?? 0) :
    a.name.localeCompare(b.name)
  )
  const withRecipe    = sorted.filter(p => (p.material_count ?? 0) > 0)
  const withoutRecipe = sorted.filter(p => (p.material_count ?? 0) === 0)

  const inv = () => qc.invalidateQueries({ queryKey: ['products'] })
  const createM = useMutation({
    mutationFn: (d: unknown) => window.api.products.create(d),
    onSuccess:  () => { inv(); setShowNew(false); toast.success('Angelegt') },
    onError:    (e: Error) => toast.error('Fehler', e.message),
  })

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title">Rezepturen & Komponenten</h2>
          <p className="page-subtitle">{withRecipe.length} mit Rezept · {withoutRecipe.length} Einzelartikel</p>
        </div>
        <Button icon={<Plus size={14}/>} onClick={() => setShowNew(true)}>Produkt anlegen</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-full text-sm" placeholder="Suchen …"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="form-input w-40 text-sm" value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}>
          <option value="">Alle Gruppen</option>
          {(groups as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-input w-36 text-sm" value={sortBy}
          onChange={e => setSortBy(e.target.value)}>
          {SORT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {!products.length && (
        <EmptyState icon={<FlaskConical size={40}/>} title="Noch keine Produkte"
          action={<Button icon={<Plus size={12}/>} onClick={() => setShowNew(true)}>Erstes Produkt</Button>}/>
      )}

      {withRecipe.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={12} className="text-brand-400"/>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Mit Rezeptur ({withRecipe.length})
            </span>
          </div>
          {withRecipe.map(p => <RecipeCard key={p.id} product={p}/>)}
        </div>
      )}

      {withoutRecipe.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical size={12} className="text-slate-500"/>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Einzelartikel ohne Rezept ({withoutRecipe.length})
            </span>
          </div>
          {withoutRecipe.map(p => <RecipeCard key={p.id} product={p}/>)}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Neues Produkt / Komponente" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Name *" value={newForm.name} autoFocus
                onChange={e => setNewForm(f => ({
                  ...f, name: e.target.value,
                  code: e.target.value.toUpperCase().replace(/\s+/g,'-').slice(0,12),
                }))}/>
            </div>
            <Input label="Code *" value={newForm.code}
              onChange={e => setNewForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}/>
            <Select label="Produktgruppe" value={newForm.product_group_id}
              onChange={e => setNewForm(f => ({ ...f, product_group_id: e.target.value }))}>
              <option value="">– Keine –</option>
              {(groups as any[]).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Batch-Größe" type="number" value={newForm.batch_size}
              onChange={e => setNewForm(f => ({ ...f, batch_size: Number(e.target.value) }))}/>
            <Select label="Einheit" value={newForm.batch_unit}
              onChange={e => setNewForm(f => ({ ...f, batch_unit: e.target.value }))}>
              {['g','kg','ml','l'].map(u => <option key={u}>{u}</option>)}
            </Select>
          </div>
          <div className="flex gap-3">
            {[{v:true,l:'🧪 Mit Rezeptur'},{v:false,l:'📦 Ohne Rezeptur'}].map(opt => (
              <button key={String(opt.v)} type="button"
                onClick={() => setNewForm(f => ({ ...f, has_recipe: opt.v }))}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  newForm.has_recipe === opt.v ? 'bg-brand-500/20 border-brand-500/40 text-white' : 'border-white/8 text-slate-400'
                }`}>
                {opt.l}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowNew(false)}>Abbrechen</Button>
            <Button disabled={!newForm.name || !newForm.code} loading={createM.isPending}
              onClick={() => createM.mutate({
                ...newForm,
                product_group_id: newForm.product_group_id ? Number(newForm.product_group_id) : null,
                overhead_factor:  1 + newForm.overhead_factor / 100,
              })}>
              Anlegen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
