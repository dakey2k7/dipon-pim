/**
 * SystemsPage — 2K-System-Manager
 * A-Komponente + N Härter (B), Mischungsverhältnis, vollständige Variantenpreis-Tabelle
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Layers, Plus, Pencil, Trash2, ChevronDown, Save, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Eye, EyeOff, FlaskConical,
  ArrowRight, Settings, X, Check,
} from 'lucide-react'
import { useToast }     from '@/hooks/useToast'
import { Button }       from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }        from '@/components/ui/Modal'
import { Spinner, ConfirmDialog } from '@/components/ui/Badge'

// ── Typen ────────────────────────────────────────────────────
interface System {
  id: number; name: string; code: string
  component_a_id: number | null; component_a_name?: string
  ratio_a: number; ratio_b: number
  color: string; description?: string
  hardener_count: number
}
interface Hardener {
  id: number; system_id: number
  component_b_id: number; component_b_name: string
  eff_ratio_a: number; eff_ratio_b: number
  mix_ratio_a: number | null; mix_ratio_b: number | null
  is_default: number; sort_order: number; notes?: string
}
interface PriceRow {
  size_kg: number; size_name: string; size_type: string
  qty_a: number; qty_b: number
  ek_a: number; ek_b: number; ek_combined: number; ek_per_kg: number
  ek_a_per_kg: number; ek_b_per_kg: number
  weight_factor: number
  vp_privat: number; vp_ba: number; vp_koop: number; vp_gewerbe: number
  vp_db37_1: number; vp_db39_5: number; vp_db40_10: number; vp_db41_20: number
  vp_db42_30: number; vp_db46_50: number; vp_db48_100: number; vp_db52_200: number
  vp_db45_1_ibc: number; vp_db49_2_ibc: number; vp_db50_3_ibc: number
  vp_privat_netto: number; vp_privat_brutto: number
  vp_a_standalone: number; vp_b_standalone: number
  probe_sum: number; probe_diff: number; probe_ok: number
  is_manual: number; saved_id: number | null
}

// ── Hilfsfunktionen ───────────────────────────────────────────
const N = (v: unknown): number => { const n = Number(v); return isNaN(n) ? 0 : n }
const eur = (v: unknown, d = 2) => N(v) > 0
  ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(N(v)) + ' €'
  : '–'
const fmt2 = (v: unknown) => N(v).toFixed(2).replace('.', ',')
const fmt4 = (v: unknown) => N(v).toFixed(4).replace('.', ',')

function probeColor(diff: number, ok: number): string {
  if (ok) return '#10b981'
  if (Math.abs(diff) <= 0.20) return '#f59e0b'
  return '#ef4444'
}

// Spalten-Definition (Standard + IBC)
const STANDARD_COLS = [
  { key:'vp_privat',   label:'Privat',      color:'#6366f1', short:'B2C'  },
  { key:'vp_ba',       label:'BA 20%',      color:'#10b981', short:'BA'   },
  { key:'vp_koop',     label:'Koop 15%',    color:'#06b6d4', short:'KOOP' },
  { key:'vp_gewerbe',  label:'GK 25%',      color:'#f59e0b', short:'GK'   },
  { key:'vp_db37_1',   label:'DB 37% 1-4',  color:'#f97316', short:'37%'  },
  { key:'vp_db39_5',   label:'DB 39% 5-9',  color:'#fb923c', short:'39%'  },
  { key:'vp_db40_10',  label:'DB 40% 10-19',color:'#fbbf24', short:'40%'  },
  { key:'vp_db41_20',  label:'DB 41% 20-29',color:'#a3e635', short:'41%'  },
  { key:'vp_db42_30',  label:'DB 42% 30-49',color:'#4ade80', short:'42%'  },
  { key:'vp_db46_50',  label:'DB 46% 50-99',color:'#34d399', short:'46%'  },
  { key:'vp_db48_100', label:'DB 48% 100+', color:'#22d3ee', short:'48%'  },
  { key:'vp_db52_200', label:'DB 52% 200+', color:'#a78bfa', short:'52%'  },
]
const IBC_COLS = [
  { key:'vp_db45_1_ibc',  label:'DB 45% 1 IBC',  color:'#f97316', short:'45%' },
  { key:'vp_db49_2_ibc',  label:'DB 49% 2 IBC',  color:'#fbbf24', short:'49%' },
  { key:'vp_db50_3_ibc',  label:'DB 50% 3 IBC',  color:'#a3e635', short:'50%' },
  { key:'vp_db51_4_ibc',  label:'DB 51% 4 IBC',  color:'#4ade80', short:'51%' },
  { key:'vp_db52_5_ibc',  label:'DB 52% 5 IBC',  color:'#34d399', short:'52%' },
  { key:'vp_db53_7_ibc',  label:'DB 53% 7 IBC',  color:'#22d3ee', short:'53%' },
  { key:'vp_db54_9_ibc',  label:'DB 54% 9 IBC',  color:'#a78bfa', short:'54%' },
  { key:'vp_db54_11_ibc', label:'DB 54% 11 IBC', color:'#c084fc', short:'54%' },
  { key:'vp_db54_13_ibc', label:'DB 54% 13 IBC', color:'#e879f9', short:'54%' },
]

// ── System-Modal ──────────────────────────────────────────────
function SystemModal({ system, products, onSave, onClose }: {
  system?: System; products: any[]; onSave: (d: any) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name:           system?.name           ?? '',
    code:           system?.code           ?? '',
    description:    system?.description    ?? '',
    component_a_id: system?.component_a_id?.toString() ?? '',
    ratio_a:        system?.ratio_a        ?? 100,
    ratio_b:        system?.ratio_b        ?? 50,
    color:          system?.color          ?? '#6366f1',
    notes:          '',
  })
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))
  const total = N(form.ratio_a) + N(form.ratio_b)
  const pctA  = total > 0 ? Math.round(N(form.ratio_a) / total * 100) : 0

  return (
    <Modal open onClose={onClose} title={system ? 'System bearbeiten' : 'Neues 2K-System'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Systemname *" value={form.name} autoFocus
              onChange={e => setForm(p => ({
                ...p, name: e.target.value,
                code: system ? p.code : e.target.value.toUpperCase().replace(/\s/g,'').slice(0,12)
              }))}
              placeholder="z.B. LuminaCast"/>
          </div>
          <Input label="Code *" value={form.code} onChange={f('code')}/>
          <Input label="Beschreibung" value={form.description} onChange={f('description')}/>
        </div>

        <Select label="Komponente A (Harz/Basis) *" value={form.component_a_id} onChange={f('component_a_id')}>
          <option value="">– Produkt wählen –</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </Select>

        {/* Mischungsverhältnis */}
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-bold text-slate-300">Standard-Mischungsverhältnis</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-indigo-400 block mb-1">Teile A</label>
              <input type="number" min="1" value={form.ratio_a} onChange={f('ratio_a')}
                className="form-input w-full text-sm font-mono text-white"/>
            </div>
            <span className="text-2xl text-slate-600 font-black mt-4">:</span>
            <div className="flex-1">
              <label className="text-[10px] text-cyan-400 block mb-1">Teile B</label>
              <input type="number" min="1" value={form.ratio_b} onChange={f('ratio_b')}
                className="form-input w-full text-sm font-mono text-white"/>
            </div>
          </div>
          <div className="flex rounded-full overflow-hidden h-2">
            <div style={{ width:`${pctA}%`, background:'#6366f1' }}/>
            <div style={{ width:`${100-pctA}%`, background:'#06b6d4' }}/>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-indigo-400">A: {pctA}%</span>
            <span className="text-cyan-400">B: {100-pctA}%</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Dieses Verhältnis gilt für alle Härter. Pro Härter überschreibbar.
          </p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!form.name || !form.component_a_id}
            onClick={() => onSave({ ...form, component_a_id: Number(form.component_a_id), ratio_a: N(form.ratio_a), ratio_b: N(form.ratio_b) })}>
            {system ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Preistabellen-Zeile (editierbar) ──────────────────────────
function PriceTableRow({
  row, vatPct, viewMode, showCols, systemId, hardenerId,
  onSave, isIbc,
}: {
  row: PriceRow; vatPct: number; viewMode: 'brutto' | 'netto'; showCols: string[]
  systemId: number; hardenerId: number | null
  onSave: (updates: Partial<PriceRow>) => void
  isIbc: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState({
    weight_factor:    row.weight_factor,
    vp_privat:        row.vp_privat,
    vp_a_standalone:  row.vp_a_standalone,
    vp_b_standalone:  row.vp_b_standalone,
  })

  const probe = useMemo(() => {
    const sum  = Math.round((local.vp_a_standalone + local.vp_b_standalone) * 100) / 100
    const diff = Math.round((local.vp_privat - sum) * 100) / 100
    const ok   = Math.abs(diff) <= 0.05 ? 1 : 0
    return { probe_sum: sum, probe_diff: diff, probe_ok: ok }
  }, [local])

  const getVal = (key: string) => {
    const v = N((row as any)[key])
    return viewMode === 'netto'
      ? Math.round(v / (1 + vatPct / 100) * 100) / 100
      : v
  }

  const rowBg = isIbc
    ? 'rgba(251,191,36,0.05)'
    : row.size_type === 'drum'
      ? 'rgba(99,102,241,0.05)'
      : 'transparent'

  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: rowBg }}
      className="hover:bg-white/[0.02] transition-colors group">

      {/* Größe */}
      <td className="px-2 py-2 sticky left-0 z-10 font-black text-white text-sm whitespace-nowrap"
        style={{ background: isIbc ? '#1a1a0a' : row.size_type === 'drum' ? '#0d0d1a' : '#0c0e1a', minWidth: 100 }}>
        {row.size_type === 'ibc' ? (
          <span className="text-amber-400">🔶 {row.size_name}</span>
        ) : row.size_type === 'drum' ? (
          <span className="text-indigo-400">🛢 {row.size_name}</span>
        ) : (
          row.size_name
        )}
      </td>

      {/* Mengen A + B */}
      <td className="px-2 py-2 text-right text-xs font-mono text-indigo-300 whitespace-nowrap">
        {fmt4(row.qty_a)} kg
      </td>
      <td className="px-2 py-2 text-right text-xs font-mono text-cyan-300 whitespace-nowrap">
        {fmt4(row.qty_b)} kg
      </td>

      {/* EK */}
      <td className="px-2 py-2 text-right text-xs font-mono text-slate-400 whitespace-nowrap">
        {eur(row.ek_combined, 4)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-mono text-slate-400 whitespace-nowrap">
        {eur(row.ek_per_kg, 4)}
      </td>

      {/* Gewichtung */}
      <td className="px-1 py-1 text-center" style={{ minWidth: 68 }}>
        {editing ? (
          <input type="number" min="0" max="1" step="0.01"
            value={local.weight_factor}
            onChange={e => setLocal(p => ({ ...p, weight_factor: N(e.target.value) }))}
            className="form-input text-xs w-16 font-mono text-center"/>
        ) : (
          <span className="text-xs font-mono text-slate-300 cursor-pointer hover:text-white"
            onClick={() => setEditing(true)}>{N(row.weight_factor).toFixed(2)}</span>
        )}
      </td>

      {/* Probe: A | B | A+B | Δ */}
      <td className="px-1 py-1" style={{ minWidth: 90 }}>
        {editing ? (
          <input type="number" step="0.01" value={fmt2(local.vp_a_standalone).replace(',','.')}
            onChange={e => setLocal(p => ({ ...p, vp_a_standalone: N(e.target.value) }))}
            className="form-input text-xs w-20 font-mono text-indigo-300"/>
        ) : (
          <span className="text-xs font-mono text-indigo-300 cursor-pointer hover:text-white"
            onClick={() => setEditing(true)}>
            {eur(row.vp_a_standalone)}
          </span>
        )}
      </td>
      <td className="px-1 py-1" style={{ minWidth: 90 }}>
        {editing ? (
          <input type="number" step="0.01" value={fmt2(local.vp_b_standalone).replace(',','.')}
            onChange={e => setLocal(p => ({ ...p, vp_b_standalone: N(e.target.value) }))}
            className="form-input text-xs w-20 font-mono text-cyan-300"/>
        ) : (
          <span className="text-xs font-mono text-cyan-300 cursor-pointer hover:text-white"
            onClick={() => setEditing(true)}>
            {eur(row.vp_b_standalone)}
          </span>
        )}
      </td>
      <td className="px-2 py-2 text-right text-xs font-mono font-bold whitespace-nowrap"
        style={{ color: probeColor(probe.probe_diff, probe.probe_ok) }}>
        {eur(probe.probe_sum)}
      </td>
      <td className="px-2 py-2 text-center whitespace-nowrap" title={`Δ ${fmt2(probe.probe_diff)} €`}>
        {probe.probe_ok
          ? <CheckCircle size={13} className="text-emerald-400 mx-auto"/>
          : Math.abs(probe.probe_diff) <= 0.20
            ? <AlertTriangle size={13} className="text-amber-400 mx-auto"/>
            : <XCircle size={13} className="text-red-400 mx-auto"/>
        }
        <span className="text-[9px] block" style={{ color: probeColor(probe.probe_diff, probe.probe_ok) }}>
          {probe.probe_diff > 0 ? '+' : ''}{fmt2(probe.probe_diff)} €
        </span>
      </td>

      {/* Preisspalten */}
      {showCols.map(key => {
        const v = getVal(key)
        return (
          <td key={key} className="px-2 py-2 text-right text-xs font-mono font-bold whitespace-nowrap"
            style={{ color: v > 0 ? '#e2e8f0' : '#475569' }}>
            {v > 0 ? eur(v) : '–'}
          </td>
        )
      })}

      {/* Aktion */}
      {editing && (
        <td className="px-1 py-1">
          <div className="flex gap-1">
            <button onClick={() => {
              onSave({ ...row, ...local, ...probe })
              setEditing(false)
            }} className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10">
              <Check size={12}/>
            </button>
            <button onClick={() => { setLocal({ weight_factor: row.weight_factor, vp_privat: row.vp_privat, vp_a_standalone: row.vp_a_standalone, vp_b_standalone: row.vp_b_standalone }); setEditing(false) }}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white/5">
              <X size={12}/>
            </button>
          </div>
        </td>
      )}
      {!editing && (
        <td className="px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-white">
            <Pencil size={11}/>
          </button>
        </td>
      )}
    </tr>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
export default function SystemsPage() {
  const qc   = useQueryClient()
  const toast = useToast()

  const [selectedSystem,   setSelectedSystem]   = useState<number | null>(null)
  const [selectedHardener, setSelectedHardener] = useState<number | null>(null)
  const [showSystemModal,  setShowSystemModal]  = useState(false)
  const [editingSystem,    setEditingSystem]    = useState<System | undefined>()
  const [showHardenerModal,setShowHardenerModal]= useState(false)
  const [deletingSystem,   setDeletingSystem]   = useState<System | undefined>()
  const [viewMode,         setViewMode]         = useState<'brutto' | 'netto'>('brutto')
  const [showIbc,          setShowIbc]          = useState(false)
  const [vatPct,           setVatPct]           = useState(19)
  const [pendingRows,      setPendingRows]       = useState<Record<number, PriceRow>>({})
  const [saving,           setSaving]           = useState(false)

  const { data: systems = [], isLoading: loadingSystems } = useQuery<System[]>({
    queryKey: ['systems'],
    queryFn:  () => window.api.systems.list() as Promise<System[]>,
  })

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn:  () => window.api.products.list() as Promise<any[]>,
  })

  const { data: systemDetail } = useQuery({
    queryKey: ['system-detail', selectedSystem],
    queryFn:  () => selectedSystem ? window.api.systems.get(selectedSystem) : null,
    enabled:  !!selectedSystem,
  })

  const { data: calcData, isFetching: calcFetching, refetch: recalc } = useQuery({
    queryKey: ['system-calc', selectedSystem, selectedHardener, vatPct],
    queryFn:  () => selectedSystem
      ? window.api.systems.calculate({ system_id: selectedSystem, hardener_id: selectedHardener, vat_pct: vatPct })
      : null,
    enabled: !!selectedSystem,
    staleTime: 0,
  })

  const hardeners = (systemDetail as any)?.hardeners ?? []

  const createSystem = useMutation({
    mutationFn: (d: any) => window.api.systems.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['systems'] }); setShowSystemModal(false); toast.success('System angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const updateSystem = useMutation({
    mutationFn: ({ id, d }: any) => window.api.systems.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['systems'] }); qc.invalidateQueries({ queryKey:['system-detail', selectedSystem] }); setShowSystemModal(false); toast.success('Gespeichert') },
  })
  const deleteSystem = useMutation({
    mutationFn: (id: number) => window.api.systems.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['systems'] }); setDeletingSystem(undefined); setSelectedSystem(null); toast.success('Gelöscht') },
  })
  const addHardener = useMutation({
    mutationFn: ({ system_id, d }: any) => window.api.systems.hardeners.add(system_id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['system-detail', selectedSystem] }); setShowHardenerModal(false); toast.success('Härter hinzugefügt') },
  })
  const removeHardener = useMutation({
    mutationFn: (id: number) => window.api.systems.hardeners.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['system-detail', selectedSystem] }); toast.success('Härter entfernt') },
  })

  // Zeile im pending-Buffer aktualisieren
  const handleRowUpdate = useCallback((row: PriceRow, updates: Partial<PriceRow>) => {
    const updated = { ...row, ...updates }
    setPendingRows(prev => ({ ...prev, [row.size_kg]: updated }))
  }, [])

  // Alle pending Zeilen speichern
  const saveAll = async () => {
    const rows = Object.values(pendingRows)
    if (!rows.length) return toast.info?.('Keine Änderungen')
    setSaving(true)
    try {
      await window.api.systems.prices.save(rows.map(r => ({
        system_id: selectedSystem!, hardener_id: selectedHardener ?? null,
        size_kg: r.size_kg, qty_a: r.qty_a, qty_b: r.qty_b,
        ek_a: r.ek_a, ek_b: r.ek_b, ek_combined: r.ek_combined, ek_per_kg: r.ek_per_kg,
        weight_factor: r.weight_factor,
        vp_privat: r.vp_privat, vp_ba: r.vp_ba, vp_koop: r.vp_koop, vp_gewerbe: r.vp_gewerbe,
        vp_db37_1: r.vp_db37_1, vp_db39_5: r.vp_db39_5, vp_db40_10: r.vp_db40_10,
        vp_db41_20: r.vp_db41_20, vp_db42_30: r.vp_db42_30, vp_db46_50: r.vp_db46_50,
        vp_db48_100: r.vp_db48_100, vp_db52_200: r.vp_db52_200,
        vp_a_standalone: r.vp_a_standalone, vp_b_standalone: r.vp_b_standalone,
        probe_sum: r.probe_sum, probe_diff: r.probe_diff, probe_ok: r.probe_ok,
        is_manual: r.is_manual ?? 0,
      })))
      setPendingRows({})
      recalc()
      toast.success(`${rows.length} Zeilen gespeichert`)
    } catch (e: any) {
      toast.error('Fehler', e.message)
    } finally {
      setSaving(false)
    }
  }

  const calcRows: PriceRow[] = calcData?.rows ?? []
  const standardRows = calcRows.filter(r => r.size_type === 'standard')
  const specialRows  = calcRows.filter(r => r.size_type !== 'standard')

  const activeCols = showIbc ? IBC_COLS : STANDARD_COLS
  const pendingCount = Object.keys(pendingRows).length

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Layers size={20} className="text-brand-400"/>
            2K-Systeme
          </h2>
          <p className="page-subtitle">
            Harz-Härter Systeme · Mischungsverhältnisse · A+B Preiskalkulation
          </p>
        </div>
        <Button icon={<Plus size={14}/>} onClick={() => { setEditingSystem(undefined); setShowSystemModal(true) }}>
          Neues System
        </Button>
      </div>

      <div className="flex gap-4 min-h-0">
        {/* Linke Spalte — Systemliste */}
        <div className="w-60 shrink-0 space-y-2">
          {loadingSystems && <Spinner/>}
          {!loadingSystems && !systems.length && (
            <div className="glass-card p-6 text-center">
              <Layers size={32} className="text-slate-700 mx-auto mb-2"/>
              <p className="text-xs text-slate-500">Noch keine Systeme</p>
              <Button size="sm" className="mt-3" icon={<Plus size={11}/>}
                onClick={() => setShowSystemModal(true)}>Anlegen</Button>
            </div>
          )}
          {systems.map(s => (
            <div key={s.id}
              onClick={() => { setSelectedSystem(s.id); setSelectedHardener(null); setPendingRows({}) }}
              className={`glass-card p-3 cursor-pointer transition-all group ${selectedSystem === s.id ? 'border-brand-500/40' : 'hover:border-white/10'}`}
              style={selectedSystem === s.id ? { borderColor:`${s.color}50`, boxShadow:`0 0 16px ${s.color}15` } : {}}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }}/>
                  <div>
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.code}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setEditingSystem(s); setShowSystemModal(true) }}
                    className="btn-ghost p-1"><Pencil size={11}/></button>
                  <button onClick={e => { e.stopPropagation(); setDeletingSystem(s) }}
                    className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {s.component_a_name && <span className="text-[10px] text-indigo-400">A: {s.component_a_name}</span>}
                <span className="text-[10px] text-slate-600">{s.hardener_count} Härter</span>
                <span className="text-[10px] text-slate-600">
                  {s.ratio_a}:{s.ratio_b}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Rechter Bereich */}
        {!selectedSystem ? (
          <div className="flex-1 glass-card flex flex-col items-center justify-center py-20">
            <Layers size={48} className="text-slate-700 mb-4"/>
            <p className="text-slate-400 font-semibold">System auswählen</p>
            <p className="text-slate-600 text-sm mt-1">Oder lege ein neues 2K-System an</p>
          </div>
        ) : (
          <div className="flex-1 min-w-0 space-y-4">
            {/* System Info + Härter */}
            <div className="glass-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-black text-white">
                    {(systemDetail as any)?.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    A: <span className="text-indigo-300">{(systemDetail as any)?.component_a_name}</span>
                    {' · '}
                    Verhältnis: <span className="text-white font-mono">
                      {(systemDetail as any)?.ratio_a}:{(systemDetail as any)?.ratio_b}
                    </span>
                    {calcData && (
                      <>
                        {' · '}EK A: <span className="text-emerald-400 font-mono">{eur(calcData.ek_a_per_kg, 4)}/kg</span>
                        {' · '}EK B: <span className="text-cyan-400 font-mono">{eur(calcData.ek_b_per_kg, 4)}/kg</span>
                      </>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={<Plus size={11}/>}
                  onClick={() => setShowHardenerModal(true)}>
                  Härter hinzufügen
                </Button>
              </div>

              {/* Härter-Liste */}
              {hardeners.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hardeners.map((h: Hardener) => (
                    <button key={h.id}
                      onClick={() => { setSelectedHardener(h.id === selectedHardener ? null : h.id); setPendingRows({}) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={selectedHardener === h.id ? {
                        background:'rgba(6,182,212,0.15)', border:'1px solid rgba(6,182,212,0.4)', color:'#67e8f9'
                      } : {
                        background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#94a3b8'
                      }}>
                      <FlaskConical size={10}/>
                      {h.component_b_name}
                      <span className="font-mono text-[10px]">
                        ({h.eff_ratio_a}:{h.eff_ratio_b})
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeHardener.mutate(h.id) }}
                        className="ml-1 text-red-400 hover:text-red-300">
                        <X size={9}/>
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {!hardeners.length && (
                <p className="text-xs text-slate-600 italic">
                  Noch keine Härter — klicke „Härter hinzufügen" um B-Komponenten zuzuordnen
                </p>
              )}
            </div>

            {/* Steuerleiste */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Netto/Brutto */}
              <div className="flex p-0.5 rounded-xl gap-0.5"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                {(['brutto', 'netto'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === m ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
                    {m === 'brutto' ? 'Brutto' : 'Netto'}
                  </button>
                ))}
              </div>

              {/* IBC Toggle */}
              <button onClick={() => setShowIbc(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${showIbc ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'text-slate-400 border-white/10'}`}>
                🔶 IBC Staffeln
              </button>

              {/* MwSt */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500">MwSt %</span>
                <input type="number" min="0" max="30" value={vatPct} onChange={e => setVatPct(Number(e.target.value))}
                  className="form-input text-xs w-14 font-mono text-center"/>
              </div>

              {/* Neu berechnen */}
              <button onClick={() => recalc()}
                className={`btn-ghost p-1.5 text-slate-400 ${calcFetching ? 'animate-spin' : ''}`}>
                <RefreshCw size={13}/>
              </button>

              {/* Speichern */}
              {pendingCount > 0 && (
                <Button size="sm" loading={saving} icon={<Save size={12}/>}
                  onClick={saveAll}>
                  {pendingCount} Änderungen speichern
                </Button>
              )}
            </div>

            {/* Preistabelle */}
            <div className="glass-card overflow-hidden">
              {calcFetching && !calcData && <div className="py-12"><Spinner/></div>}
              {calcData && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse"
                    style={{ minWidth: 900 + activeCols.length * 100 }}>
                    <thead>
                      <tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'2px solid rgba(255,255,255,0.1)' }}>
                        {/* Feste Spalten */}
                        <th className="px-2 py-2.5 text-left sticky left-0 z-10 font-bold uppercase tracking-wider text-slate-500 text-[10px]"
                          style={{ background:'#0d1020', minWidth:100 }}>Größe</th>
                        <th className="px-2 py-2 text-right text-indigo-400 text-[10px] font-bold whitespace-nowrap">qty A</th>
                        <th className="px-2 py-2 text-right text-cyan-400 text-[10px] font-bold whitespace-nowrap">qty B</th>
                        <th className="px-2 py-2 text-right text-slate-500 text-[10px] font-bold whitespace-nowrap">EK gesamt</th>
                        <th className="px-2 py-2 text-right text-slate-500 text-[10px] font-bold whitespace-nowrap">EK/kg</th>
                        <th className="px-2 py-2 text-center text-slate-500 text-[10px] font-bold whitespace-nowrap"
                          title="A/B Gewichtungsfaktor">Gew.</th>
                        {/* Probe */}
                        <th className="px-2 py-2 text-center text-indigo-400 text-[10px] font-bold whitespace-nowrap">A Preis</th>
                        <th className="px-2 py-2 text-center text-cyan-400 text-[10px] font-bold whitespace-nowrap">B Preis</th>
                        <th className="px-2 py-2 text-center text-white text-[10px] font-bold whitespace-nowrap">A+B</th>
                        <th className="px-2 py-2 text-center text-[10px] font-bold whitespace-nowrap text-slate-500">Probe</th>
                        {/* Preisspalten */}
                        {activeCols.map(col => (
                          <th key={col.key} className="px-2 py-2 text-right text-[10px] font-bold whitespace-nowrap"
                            style={{ color: col.color, minWidth: 90 }}>{col.short}</th>
                        ))}
                        <th className="w-8"/>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Standardgrößen */}
                      {standardRows.map(row => {
                        const r = pendingRows[row.size_kg] ?? row
                        return (
                          <PriceTableRow key={row.size_kg} row={r} vatPct={vatPct}
                            viewMode={viewMode} showCols={activeCols.map(c => c.key)}
                            systemId={selectedSystem!} hardenerId={selectedHardener}
                            isIbc={false}
                            onSave={updates => handleRowUpdate(row, updates)}/>
                        )
                      })}
                      {/* Trennzeile */}
                      {specialRows.length > 0 && (
                        <tr>
                          <td colSpan={10 + activeCols.length} className="py-1 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                            style={{ background:'rgba(251,191,36,0.06)', borderTop:'1px dashed rgba(251,191,36,0.3)', borderBottom:'1px dashed rgba(251,191,36,0.3)' }}>
                            Großgebinde
                          </td>
                        </tr>
                      )}
                      {specialRows.map(row => {
                        const r = pendingRows[row.size_kg] ?? row
                        return (
                          <PriceTableRow key={row.size_kg} row={r} vatPct={vatPct}
                            viewMode={viewMode} showCols={activeCols.map(c => c.key)}
                            systemId={selectedSystem!} hardenerId={selectedHardener}
                            isIbc={row.size_type === 'ibc'}
                            onSave={updates => handleRowUpdate(row, updates)}/>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Legende */}
              <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 flex-wrap text-[10px] text-slate-600">
                <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-400"/> Probe OK (≤0,05€)</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-400"/> Warnung (≤0,20€)</span>
                <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400"/> Abweichung &gt;0,20€</span>
                <span className="ml-auto">Zelle anklicken zum Bearbeiten · Gewichtung A/B = Preisverhältnis</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSystemModal && (
        <SystemModal
          system={editingSystem}
          products={products}
          onSave={d => editingSystem
            ? updateSystem.mutate({ id: editingSystem.id, d })
            : createSystem.mutate(d)
          }
          onClose={() => { setShowSystemModal(false); setEditingSystem(undefined) }}
        />
      )}

      {showHardenerModal && selectedSystem && (
        <HardenerModal
          systemId={selectedSystem}
          products={products}
          systemRatioA={(systemDetail as any)?.ratio_a ?? 100}
          systemRatioB={(systemDetail as any)?.ratio_b ?? 50}
          onSave={d => addHardener.mutate({ system_id: selectedSystem, d })}
          onClose={() => setShowHardenerModal(false)}
        />
      )}

      <ConfirmDialog open={!!deletingSystem} title="System löschen?"
        message={`"${deletingSystem?.name}" und alle Preisdaten wirklich löschen?`}
        onConfirm={() => deletingSystem && deleteSystem.mutate(deletingSystem.id)}
        onCancel={() => setDeletingSystem(undefined)} loading={deleteSystem.isPending}/>
    </div>
  )
}

// ── Härter-Modal ──────────────────────────────────────────────
function HardenerModal({ systemId, products, systemRatioA, systemRatioB, onSave, onClose }: {
  systemId: number; products: any[]; systemRatioA: number; systemRatioB: number
  onSave: (d: any) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    component_b_id: '',
    use_custom_ratio: false,
    mix_ratio_a: systemRatioA,
    mix_ratio_b: systemRatioB,
    is_default: false,
    notes: '',
  })
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal open onClose={onClose} title="Härter (B) hinzufügen" size="sm">
      <div className="space-y-3">
        <Select label="B-Komponente (Härter) *" value={form.component_b_id} onChange={f('component_b_id')}>
          <option value="">– Produkt wählen –</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </Select>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.use_custom_ratio}
            onChange={e => setForm(p => ({ ...p, use_custom_ratio: e.target.checked }))}
            className="rounded accent-indigo-500"/>
          <span className="text-xs text-slate-300">Abweichendes Mischungsverhältnis</span>
        </label>

        {form.use_custom_ratio && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-indigo-400 block mb-1">Teile A</label>
              <input type="number" min="1" value={form.mix_ratio_a}
                onChange={e => setForm(p => ({ ...p, mix_ratio_a: Number(e.target.value) }))}
                className="form-input w-full text-sm font-mono"/>
            </div>
            <div>
              <label className="text-[10px] text-cyan-400 block mb-1">Teile B</label>
              <input type="number" min="1" value={form.mix_ratio_b}
                onChange={e => setForm(p => ({ ...p, mix_ratio_b: Number(e.target.value) }))}
                className="form-input w-full text-sm font-mono"/>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_default}
            onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))}
            className="rounded accent-indigo-500"/>
          <span className="text-xs text-slate-300">Standard-Härter</span>
        </label>

        <Input label="Notizen" value={form.notes} onChange={f('notes')}/>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!form.component_b_id}
            onClick={() => onSave({
              component_b_id: Number(form.component_b_id),
              mix_ratio_a: form.use_custom_ratio ? form.mix_ratio_a : null,
              mix_ratio_b: form.use_custom_ratio ? form.mix_ratio_b : null,
              is_default: form.is_default,
              notes: form.notes || null,
            })}>
            Hinzufügen
          </Button>
        </div>
      </div>
    </Modal>
  )
}
