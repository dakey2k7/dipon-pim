/**
 * RmiiPage — Raw Material Increase Impact Simulator
 * Simuliere Rohstoffpreisänderungen → sofortige Auswirkung auf alle Produkte/Varianten
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Plus, Trash2, Play, RotateCcw, AlertTriangle,
  ChevronDown, ChevronUp, FlaskConical, Package, Save, X,
} from 'lucide-react'
import { Button, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

const N = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }
const fmt = (v: number, d = 2) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v)
const pct = (v: number) => (v >= 0 ? '+' : '') + fmt(v, 2) + '%'
const eur = (v: number, d = 2) => (v >= 0 ? '+' : '') + fmt(Math.abs(v), d) + ' €'

type ChangeType = 'pct' | 'absolute'

interface SimItem {
  material_id: number
  material_name: string
  material_code: string
  change_type: ChangeType
  change_value: number
  old_price: number
  new_price: number
}

interface ResultRow {
  product_id: number
  product_name: string
  product_code: string
  variant_name?: string
  old_ek: number
  new_ek: number
  old_margin_pct: number
  new_margin_pct: number
  delta_eur: number
  delta_pct: number
  warning: boolean
}

// ── Simulator-Zeile pro Rohstoff ──────────────────────────────
function SimRow({ item, onUpdate, onRemove }: {
  item: SimItem
  onUpdate: (updates: Partial<SimItem>) => void
  onRemove: () => void
}) {
  const newPrice = item.change_type === 'pct'
    ? item.old_price * (1 + item.change_value / 100)
    : item.old_price + item.change_value
  const delta = newPrice - item.old_price
  const deltaPct = item.old_price > 0 ? (delta / item.old_price) * 100 : 0

  return (
    <div className="flex items-center gap-3 px-4 py-3 group"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Material-Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.material_name}</p>
        <p className="text-[10px] font-mono text-slate-500">{item.material_code}</p>
      </div>

      {/* Aktueller Preis */}
      <div className="text-right shrink-0 w-28">
        <p className="text-xs text-slate-400">Aktuell</p>
        <p className="text-sm font-mono font-bold text-white">{fmt(item.old_price, 4)} €/kg</p>
      </div>

      {/* Änderungstyp */}
      <div className="flex rounded-lg overflow-hidden shrink-0"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        {(['pct', 'absolute'] as ChangeType[]).map(t => (
          <button key={t}
            onClick={() => onUpdate({ change_type: t })}
            className="px-2.5 py-1.5 text-xs font-bold transition-all"
            style={item.change_type === t
              ? { background: 'rgba(99,102,241,0.3)', color: '#c7d2fe' }
              : { color: '#475569' }}>
            {t === 'pct' ? '% ' : '€'}
          </button>
        ))}
      </div>

      {/* Änderungswert */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number" step={item.change_type === 'pct' ? '0.1' : '0.001'}
          value={item.change_value}
          onChange={e => onUpdate({ change_value: N(e.target.value) })}
          className="form-input text-xs w-24 font-mono text-right text-white"/>
        <span className="text-xs text-slate-500 w-4">{item.change_type === 'pct' ? '%' : '€'}</span>
      </div>

      {/* Neuer Preis + Delta */}
      <div className="text-right shrink-0 w-36">
        <p className="text-sm font-mono font-bold text-white">{fmt(newPrice, 4)} €/kg</p>
        <p className="text-[10px] font-mono font-bold"
          style={{ color: delta > 0 ? '#f87171' : delta < 0 ? '#4ade80' : '#64748b' }}>
          {delta !== 0 ? (delta > 0 ? '+' : '') + fmt(delta, 4) + ' € (' + pct(deltaPct) + ')' : '–'}
        </p>
      </div>

      <button onClick={onRemove}
        className="btn-ghost p-1.5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 size={13}/>
      </button>
    </div>
  )
}

// ── Ergebnis-Zeile ────────────────────────────────────────────
function ResultRowItem({ row }: { row: ResultRow }) {
  return (
    <div className="flex items-center px-4 py-2.5 gap-3"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: row.warning ? 'rgba(239,68,68,0.05)' : 'transparent',
      }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {row.warning && <AlertTriangle size={11} className="text-red-400 shrink-0"/>}
          <p className="text-xs font-semibold text-white truncate">{row.product_name}</p>
          <span className="text-[10px] font-mono text-slate-500">{row.product_code}</span>
        </div>
        {row.variant_name && <p className="text-[10px] text-slate-600">{row.variant_name}</p>}
      </div>

      {/* EK alt → neu */}
      <div className="text-right shrink-0 w-28">
        <p className="text-[10px] text-slate-500">EK alt</p>
        <p className="text-xs font-mono text-slate-300">{fmt(row.old_ek, 4)} €</p>
      </div>
      <div className="text-right shrink-0 w-28">
        <p className="text-[10px] text-slate-500">EK neu</p>
        <p className="text-xs font-mono font-bold text-white">{fmt(row.new_ek, 4)} €</p>
      </div>

      {/* Delta */}
      <div className="text-right shrink-0 w-28">
        <p className="text-xs font-mono font-bold"
          style={{ color: row.delta_eur > 0 ? '#f87171' : row.delta_eur < 0 ? '#4ade80' : '#64748b' }}>
          {row.delta_eur !== 0 ? eur(row.delta_eur) : '±0,00 €'}
        </p>
        <p className="text-[10px] font-mono"
          style={{ color: row.delta_pct > 0 ? '#f87171' : '#64748b' }}>
          {pct(row.delta_pct)}
        </p>
      </div>

      {/* Marge alt → neu */}
      <div className="text-right shrink-0 w-24">
        <p className="text-[10px] text-slate-500">Marge alt</p>
        <p className="text-xs font-mono text-slate-300">{fmt(row.old_margin_pct, 1)}%</p>
      </div>
      <div className="text-right shrink-0 w-24">
        <p className="text-[10px] text-slate-500">Marge neu</p>
        <p className="text-xs font-mono font-bold"
          style={{ color: row.new_margin_pct < 10 ? '#f87171' : row.new_margin_pct < 20 ? '#f59e0b' : '#4ade80' }}>
          {fmt(row.new_margin_pct, 1)}%
        </p>
      </div>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
export default function RmiiPage() {
  const toast = useToast()

  const [items,         setItems]        = useState<SimItem[]>([])
  const [results,       setResults]      = useState<ResultRow[]>([])
  const [simulating,    setSimulating]   = useState(false)
  const [showMaterial,  setShowMaterial] = useState(false)
  const [simName,       setSimName]      = useState('')

  const { data: materials = [] } = useQuery<any[]>({
    queryKey: ['materials'],
    queryFn: () => window.api.materials.list() as Promise<any[]>,
  })
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn: () => window.api.products.list() as Promise<any[]>,
  })

  // Materialien die noch nicht in der Simulation sind
  const availableMats = (materials as any[]).filter(m =>
    !items.some(it => it.material_id === m.id) &&
    (m.preferred_price || m.price_per_kg_calc || m.base_price)
  )

  const addMaterial = (mat: any) => {
    const price = N(mat.preferred_price || mat.price_per_kg_calc || mat.base_price || 0)
    setItems(prev => [...prev, {
      material_id: mat.id,
      material_name: mat.name,
      material_code: mat.code,
      change_type: 'pct',
      change_value: 0,
      old_price: price,
      new_price: price,
    }])
    setShowMaterial(false)
  }

  const updateItem = (idx: number, updates: Partial<SimItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...updates } : it))

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx))

  // Simulation berechnen (client-side, kein IPC nötig für Preview)
  const simulate = async () => {
    if (!items.length) return toast.error('Fehler', 'Keine Rohstoffe ausgewählt')
    setSimulating(true)

    try {
      // Neue Preise berechnen
      const priceMap: Record<number, number> = {}
      for (const item of items) {
        const newPrice = item.change_type === 'pct'
          ? item.old_price * (1 + item.change_value / 100)
          : item.old_price + item.change_value
        priceMap[item.material_id] = newPrice
      }

      // Für jedes Produkt EK neu berechnen
      const rows: ResultRow[] = []
      for (const product of products as any[]) {
        const detail = await window.api.products.get(product.id)
        if (!detail?.materials?.length) continue

        const mats = detail.materials as any[]
        const totalQty = mats.reduce((s: number, m: any) => {
          const kg = m.unit === 'g' ? m.quantity / 1000 : m.unit === 'ml' ? m.quantity / 1000 : m.quantity
          return s + kg
        }, 0)
        if (totalQty <= 0) continue

        let old_ek = 0, new_ek = 0
        for (const m of mats) {
          const kg = m.unit === 'g' ? m.quantity / 1000 : m.unit === 'ml' ? m.quantity / 1000 : m.quantity
          const frac = kg / totalQty
          const oldPrice = N(m.pref_price || 0)
          const newPrice = priceMap[m.material_id] ?? oldPrice
          old_ek += frac * oldPrice
          new_ek += frac * newPrice
        }

        // Marge: angenommener VP = 2× EK (vereinfacht, später aus Preistabelle)
        const vp = old_ek * 2 || 1
        const old_margin_pct = old_ek > 0 ? ((vp - old_ek) / vp) * 100 : 0
        const new_margin_pct = new_ek > 0 ? ((vp - new_ek) / vp) * 100 : 0
        const delta_eur = new_ek - old_ek
        const delta_pct = old_ek > 0 ? (delta_eur / old_ek) * 100 : 0

        if (Math.abs(delta_eur) > 0.0001) {
          rows.push({
            product_id: product.id,
            product_name: product.name,
            product_code: product.code,
            old_ek: Math.round(old_ek * 10000) / 10000,
            new_ek: Math.round(new_ek * 10000) / 10000,
            old_margin_pct: Math.round(old_margin_pct * 100) / 100,
            new_margin_pct: Math.round(new_margin_pct * 100) / 100,
            delta_eur: Math.round(delta_eur * 10000) / 10000,
            delta_pct: Math.round(delta_pct * 100) / 100,
            warning: new_margin_pct < 0 || (new_margin_pct < old_margin_pct - 5),
          })
        }
      }
      rows.sort((a, b) => Math.abs(b.delta_eur) - Math.abs(a.delta_eur))
      setResults(rows)
      if (!rows.length) toast.info?.('Keine Auswirkungen auf Produkte gefunden')
    } catch (e: any) {
      toast.error('Simulationsfehler', e.message)
    } finally {
      setSimulating(false)
    }
  }

  const reset = () => { setItems([]); setResults([]) }

  const warnings   = results.filter(r => r.warning).length
  const totalDelta = results.reduce((s, r) => s + r.delta_eur, 0)
  const affectedCount = results.length

  // Kategorien aus Materialien
  const matsByType = useMemo(() => {
    const groups: Record<string, any[]> = {}
    for (const m of availableMats as any[]) {
      const t = m.product_type || 'Sonstige'
      if (!groups[t]) groups[t] = []
      groups[t].push(m)
    }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b))
  }, [availableMats])

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-400"/>
            RMII — Rohstoffpreis-Simulator
          </h2>
          <p className="page-subtitle">
            Simuliere Preisänderungen · sofortige Auswirkung auf alle Produkte
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<RotateCcw size={13}/>} onClick={reset}>
            Zurücksetzen
          </Button>
          <Button icon={<Play size={13}/>} loading={simulating} onClick={simulate}
            disabled={!items.length}>
            Simulation starten
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* ── Rohstoff-Auswahl ─────────────────────────── */}
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <FlaskConical size={15} className="text-brand-400"/>
              Rohstoffe mit Preisänderung
              {items.length > 0 && <span className="badge-blue">{items.length}</span>}
            </p>
            <Button size="sm" icon={<Plus size={12}/>} onClick={() => setShowMaterial(true)}>
              Rohstoff hinzufügen
            </Button>
          </div>

          {!items.length ? (
            <div className="py-10 text-center">
              <FlaskConical size={32} className="text-slate-700 mx-auto mb-2"/>
              <p className="text-sm text-slate-500">Noch keine Rohstoffe gewählt</p>
              <p className="text-xs text-slate-600 mt-1">Füge Rohstoffe hinzu und gib die Preisänderung in % oder € an</p>
            </div>
          ) : (
            <>
              {/* Spalten-Header */}
              <div className="flex items-center px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 gap-3"
                style={{ background: 'rgba(255,255,255,0.02)' }}>
                <span className="flex-1">Rohstoff</span>
                <span className="w-28 text-right">Aktuell</span>
                <span className="w-16 text-center">Typ</span>
                <span className="w-28 text-right">Änderung</span>
                <span className="w-36 text-right">Neuer Preis</span>
                <span className="w-6"/>
              </div>
              {items.map((item, idx) => (
                <SimRow key={item.material_id} item={item}
                  onUpdate={updates => updateItem(idx, updates)}
                  onRemove={() => removeItem(idx)}/>
              ))}
            </>
          )}
        </div>

        {/* ── Ergebnisse ───────────────────────────────── */}
        {results.length > 0 && (
          <div className="glass-card overflow-hidden">
            {/* Summary */}
            <div className="px-4 py-3 flex items-center gap-6"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Package size={15} className="text-emerald-400"/>
                Auswirkung auf {affectedCount} Produkte
              </p>
              <div className="flex gap-4 ml-auto">
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Ø EK-Änderung</p>
                  <p className="text-sm font-mono font-bold"
                    style={{ color: totalDelta > 0 ? '#f87171' : '#4ade80' }}>
                    {totalDelta > 0 ? '+' : ''}{fmt(totalDelta / affectedCount, 4)} €/kg
                  </p>
                </div>
                {warnings > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertTriangle size={13} className="text-red-400"/>
                    <span className="text-xs font-bold text-red-400">{warnings} Warnungen</span>
                  </div>
                )}
              </div>
            </div>

            {/* Spalten-Header */}
            <div className="flex items-center px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 gap-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="flex-1">Produkt</span>
              <span className="w-28 text-right">EK alt</span>
              <span className="w-28 text-right">EK neu</span>
              <span className="w-28 text-right">Delta</span>
              <span className="w-24 text-right">Marge alt</span>
              <span className="w-24 text-right">Marge neu</span>
            </div>

            {results.map(row => <ResultRowItem key={row.product_id} row={row}/>)}
          </div>
        )}
      </div>

      {/* Rohstoff-Auswahl Modal */}
      {showMaterial && (
        <Modal open onClose={() => setShowMaterial(false)}
          title="Rohstoff zur Simulation hinzufügen" size="md">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {matsByType.map(([type, mats]) => (
              <div key={type}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-1 mt-3">
                  {type}
                </p>
                {mats.map((m: any) => {
                  const price = N(m.preferred_price || m.price_per_kg_calc || m.base_price || 0)
                  return (
                    <button key={m.id} onClick={() => addMaterial(m)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors group">
                      <div className="flex items-center gap-2 min-w-0">
                        <FlaskConical size={12} className="text-brand-400 shrink-0"/>
                        <span className="font-semibold text-white truncate">{m.name}</span>
                        <span className="text-[10px] font-mono text-slate-500">{m.code}</span>
                      </div>
                      <div className="text-right shrink-0">
                        {price > 0
                          ? <span className="font-mono text-xs text-white">{fmt(price, 4)} €/kg</span>
                          : <span className="text-xs text-slate-600">kein Preis</span>
                        }
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
            {!availableMats.length && (
              <p className="text-sm text-slate-500 text-center py-8">Alle Rohstoffe bereits hinzugefügt</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
