/**
 * PsmKalkulationPage — PrestaShop-Preisstaffel-Kalkulation
 * Ordner · Kalkulations-Tabelle · Ergebnistabelle · Import/Export
 */
import React, { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FolderOpen, Folder, Plus, Pencil, Trash2, Save, Download, Upload,
  FileText, Tag, ChevronRight, MoreHorizontal, Star, StarOff,
  Check, X, RefreshCw, Info,
} from 'lucide-react'
import { Button, Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog, Spinner } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

// ── Typen ────────────────────────────────────────────────────
interface PsmCalc {
  id: number; name: string; folder_id: number | null
  unit_type: string; unit_label: string | null; vat_pct: number
  tags: string[]; row_count: number; updated_at: string
}
interface PsmRow {
  id?: number; menge: number; form: string
  preis_brutto: number; preis_netto: number
  is_standard: number; sort_order?: number
  // calculated
  unit_netto?: number; unit_brutto?: number
  aufschlag_netto?: number; auswirkung_gesamt?: number
}

const N  = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }
const eur = (v: unknown, d = 2) => new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: d, maximumFractionDigits: d
}).format(N(v)) + ' €'

const UNIT_OPTIONS = [
  { value:'liter',  label:'Literpreis' },
  { value:'kg',     label:'Kilogrammpreis' },
  { value:'stk',    label:'Stückpreis' },
  { value:'custom', label:'Benutzerdefiniert' },
]

const FOLDER_COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#a78bfa']

// ── Berechnungslogik (Client-seitig für Live-Preview) ─────────
function calcRows(rows: PsmRow[], unitType: string): PsmRow[] {
  const std = rows.find(r => r.is_standard) || rows[0]
  if (!std) return rows
  const std_netto   = N(std.preis_netto) || N(std.preis_brutto) / 1.19
  const std_unit_n  = std.menge > 0 ? std_netto / std.menge : 0

  return rows.map(r => {
    const netto       = N(r.preis_netto) || N(r.preis_brutto) / 1.19
    const unit_netto  = r.menge > 0 ? netto / r.menge : 0
    const unit_brutto = r.menge > 0 ? N(r.preis_brutto) / r.menge : 0
    return {
      ...r,
      preis_netto:      Math.round(netto * 100) / 100,
      unit_netto:       Math.round(unit_netto * 100) / 100,
      unit_brutto:      Math.round(unit_brutto * 100) / 100,
      aufschlag_netto:  Math.round((unit_netto - std_unit_n) * 10000) / 10000,
      auswirkung_gesamt:Math.round((netto - std_netto) * 100) / 100,
    }
  })
}

// ── Leere Zeile ───────────────────────────────────────────────
const emptyRow = (): PsmRow => ({
  menge: 1, form: 'flüssig', preis_brutto: 0, preis_netto: 0, is_standard: 0,
})

// ── Eingabe-Tabelle ───────────────────────────────────────────
function InputTable({ rows, unitType, unitLabel, vatPct, onChange }: {
  rows: PsmRow[]; unitType: string; unitLabel: string
  vatPct: number; onChange: (rows: PsmRow[]) => void
}) {
  const calc = useMemo(() => calcRows(rows, unitType), [rows, unitType])
  const unitHead = unitType === 'custom' ? unitLabel : UNIT_OPTIONS.find(o => o.value === unitType)?.label || 'Einheitspreis'

  const update = useCallback((idx: number, field: keyof PsmRow, value: any) => {
    onChange(rows.map((r, i) => {
      if (i !== idx) return r
      const updated = { ...r, [field]: value }
      // Auto-berechne Netto aus Brutto wenn Netto leer
      if (field === 'preis_brutto' && !r.preis_netto) {
        updated.preis_netto = Math.round(N(value) / (1 + vatPct/100) * 100) / 100
      }
      return updated
    }))
  }, [rows, onChange, vatPct])

  const setStandard = (idx: number) => {
    onChange(rows.map((r, i) => ({ ...r, is_standard: i === idx ? 1 : 0 })))
  }

  const addRow = () => onChange([...rows, emptyRow()])
  const delRow = (idx: number) => onChange(rows.filter((_, i) => i !== idx))

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.04)', borderBottom:'2px solid rgba(255,255,255,0.1)' }}>
              <th className="px-2 py-2.5 text-left text-slate-500 font-bold uppercase tracking-wider w-8">Std</th>
              <th className="px-2 py-2.5 text-left text-slate-400 font-bold uppercase tracking-wider">Menge</th>
              <th className="px-2 py-2.5 text-left text-slate-400 font-bold uppercase tracking-wider">Form</th>
              <th className="px-2 py-2.5 text-right text-slate-400 font-bold uppercase tracking-wider">Preis Brutto</th>
              <th className="px-2 py-2.5 text-right text-slate-400 font-bold uppercase tracking-wider">Preis Netto</th>
              <th className="px-2 py-2.5 text-right text-indigo-400 font-bold uppercase tracking-wider whitespace-nowrap">{unitHead} Brutto</th>
              <th className="px-2 py-2.5 text-right text-indigo-400 font-bold uppercase tracking-wider whitespace-nowrap">{unitHead} Netto</th>
              <th className="px-2 py-2.5 text-right text-amber-400 font-bold uppercase tracking-wider whitespace-nowrap">Aufschlag Netto</th>
              <th className="px-2 py-2.5 text-right text-emerald-400 font-bold uppercase tracking-wider whitespace-nowrap">Auswirkung</th>
              <th className="w-8"/>
            </tr>
          </thead>
          <tbody>
            {calc.map((row, idx) => (
              <tr key={idx}
                className="group"
                style={{
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                  background: row.is_standard ? 'rgba(99,102,241,0.06)' : 'transparent',
                }}>
                {/* Standard-Radio */}
                <td className="px-2 py-1.5 text-center">
                  <button onClick={() => setStandard(idx)}
                    className="transition-colors"
                    title="Als Standardvariante setzen">
                    {row.is_standard
                      ? <Star size={13} className="text-amber-400 fill-amber-400"/>
                      : <StarOff size={13} className="text-slate-600 hover:text-amber-400"/>}
                  </button>
                </td>
                {/* Menge */}
                <td className="px-1 py-1">
                  <input type="number" step="0.01" min="0"
                    value={row.menge || ''}
                    onChange={e => update(idx, 'menge', N(e.target.value))}
                    className="form-input text-xs w-20 font-mono text-white"/>
                </td>
                {/* Form */}
                <td className="px-1 py-1">
                  <input type="text"
                    value={row.form}
                    onChange={e => update(idx, 'form', e.target.value)}
                    className="form-input text-xs w-24 text-white"
                    placeholder="flüssig"/>
                </td>
                {/* Preis Brutto */}
                <td className="px-1 py-1">
                  <div className="flex items-center gap-0.5 justify-end">
                    <input type="number" step="0.01" min="0"
                      value={row.preis_brutto || ''}
                      onChange={e => {
                        const brutto = N(e.target.value)
                        const netto  = Math.round(brutto / (1 + vatPct/100) * 100) / 100
                        onChange(rows.map((r,i) => i===idx ? {...r, preis_brutto:brutto, preis_netto:netto} : r))
                      }}
                      className="form-input text-xs w-24 font-mono text-white text-right"/>
                    <span className="text-slate-600 text-xs shrink-0">€</span>
                  </div>
                </td>
                {/* Preis Netto */}
                <td className="px-1 py-1">
                  <div className="flex items-center gap-0.5 justify-end">
                    <input type="number" step="0.01" min="0"
                      value={row.preis_netto || ''}
                      onChange={e => {
                        const netto  = N(e.target.value)
                        const brutto = Math.round(netto * (1 + vatPct/100) * 100) / 100
                        onChange(rows.map((r,i) => i===idx ? {...r, preis_netto:netto, preis_brutto:brutto} : r))
                      }}
                      className="form-input text-xs w-24 font-mono text-white text-right"/>
                    <span className="text-slate-600 text-xs shrink-0">€</span>
                  </div>
                </td>
                {/* Unit Brutto (calculated) */}
                <td className="px-2 py-1.5 text-right font-mono text-indigo-300 text-xs whitespace-nowrap">
                  {N(row.unit_brutto) > 0 ? eur(row.unit_brutto) : '–'}
                </td>
                {/* Unit Netto (calculated) */}
                <td className="px-2 py-1.5 text-right font-mono text-indigo-300 text-xs whitespace-nowrap">
                  {N(row.unit_netto) > 0 ? eur(row.unit_netto) : '–'}
                </td>
                {/* Aufschlag Netto */}
                <td className="px-2 py-1.5 text-right font-mono text-xs whitespace-nowrap"
                  style={{ color: N(row.aufschlag_netto) < 0 ? '#4ade80' : N(row.aufschlag_netto) > 0 ? '#f87171' : '#64748b' }}>
                  {row.is_standard
                    ? <span className="text-slate-600">Referenz</span>
                    : (N(row.aufschlag_netto) >= 0 ? '+' : '') + N(row.aufschlag_netto).toFixed(2).replace('.',',') + ' €'
                  }
                </td>
                {/* Auswirkung */}
                <td className="px-2 py-1.5 text-right font-mono text-xs whitespace-nowrap"
                  style={{ color: N(row.auswirkung_gesamt) >= 0 ? '#4ade80' : '#f87171' }}>
                  {row.is_standard
                    ? <span className="text-slate-600">—</span>
                    : (N(row.auswirkung_gesamt) >= 0 ? '+' : '') + eur(row.auswirkung_gesamt)
                  }
                </td>
                {/* Löschen */}
                <td className="px-1">
                  <button onClick={() => delRow(idx)}
                    className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={11}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={addRow}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        style={{ borderTop:'1px dashed rgba(255,255,255,0.08)' }}>
        <Plus size={11}/> Zeile hinzufügen
      </button>
    </div>
  )
}

// ── Ergebnistabelle ───────────────────────────────────────────
function ResultTable({ rows, unitType, unitLabel }: {
  rows: PsmRow[]; unitType: string; unitLabel: string
}) {
  const calc = useMemo(() => calcRows(rows, unitType), [rows, unitType])
  const std  = calc.find(r => r.is_standard) || calc[0]
  const unitHead = unitType === 'custom' ? unitLabel : UNIT_OPTIONS.find(o => o.value === unitType)?.label || 'Einheitspreis'

  if (!calc.length) return null

  return (
    <div className="glass-card overflow-hidden mt-4">
      <div className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <Info size={14} className="text-indigo-400 shrink-0"/>
        <p className="text-sm font-bold text-white">Ergebnistabelle — PrestaShop Staffelpreise</p>
        {std && (
          <span className="text-xs text-slate-500 ml-2">
            Referenz: <span className="text-amber-400 font-mono">{std.menge} — {eur(std.preis_brutto)} Brutto</span>
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-wider">Menge</th>
              <th className="px-3 py-2 text-left text-slate-500 font-bold uppercase tracking-wider">Form</th>
              <th className="px-3 py-2 text-right text-white font-bold uppercase tracking-wider">Preis Brutto</th>
              <th className="px-3 py-2 text-right text-white font-bold uppercase tracking-wider">Preis Netto</th>
              <th className="px-3 py-2 text-right text-indigo-400 font-bold uppercase tracking-wider whitespace-nowrap">{unitHead} Netto</th>
              <th className="px-3 py-2 text-right text-amber-400 font-bold uppercase tracking-wider whitespace-nowrap">Aufschlag Netto</th>
              <th className="px-3 py-2 text-right text-emerald-400 font-bold uppercase tracking-wider whitespace-nowrap">Auswirkung (Gesamt)</th>
            </tr>
          </thead>
          <tbody>
            {calc.map((row, idx) => (
              <tr key={idx}
                style={{
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                  background: row.is_standard ? 'rgba(251,191,36,0.06)' : 'transparent',
                }}>
                <td className="px-3 py-2.5 font-bold text-white font-mono">
                  {row.menge}
                  {row.is_standard && (
                    <span className="ml-2 text-[10px] text-amber-400 font-sans">⭐ Standard</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-400">{row.form}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-white">{eur(row.preis_brutto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-slate-300">{eur(row.preis_netto)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-indigo-300">{eur(row.unit_netto)}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap"
                  style={{ color: row.is_standard ? '#64748b' : N(row.aufschlag_netto) <= 0 ? '#4ade80' : '#f87171' }}>
                  {row.is_standard ? '0,00 €' : (N(row.aufschlag_netto) >= 0 ? '+' : '') + N(row.aufschlag_netto).toFixed(2).replace('.',',') + ' €'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap"
                  style={{ color: row.is_standard ? '#64748b' : N(row.auswirkung_gesamt) >= 0 ? '#4ade80' : '#f87171' }}>
                  {row.is_standard ? '—' : (N(row.auswirkung_gesamt) >= 0 ? '+' : '') + eur(row.auswirkung_gesamt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Haupt-Seite ───────────────────────────────────────────────
export default function PsmKalkulationPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [selectedFolder, setSelectedFolder]     = useState<number | null | 'all'>('all')
  const [selectedCalc,   setSelectedCalc]       = useState<number | null>(null)
  const [showFolderModal,setShowFolderModal]     = useState(false)
  const [showCalcModal,  setShowCalcModal]       = useState(false)
  const [editFolder,     setEditFolder]          = useState<any>(null)
  const [editCalc,       setEditCalc]            = useState<any>(null)
  const [deletingFolder, setDeletingFolder]      = useState<any>(null)
  const [deletingCalc,   setDeletingCalc]        = useState<any>(null)
  const [rows,           setRows]                = useState<PsmRow[]>([])
  const [dirty,          setDirty]               = useState(false)
  const [tagInput,       setTagInput]            = useState('')
  const [folderForm,     setFolderForm]          = useState({ name:'', color: FOLDER_COLORS[0] })
  const [calcForm,       setCalcForm]            = useState({
    name:'', description:'', unit_type:'liter', unit_label:'', vat_pct:19, tags:[] as string[],
  })

  const { data: folders = [] } = useQuery<any[]>({
    queryKey: ['psm-folders'],
    queryFn:  () => window.api.psm.folders.list() as Promise<any[]>,
  })
  const { data: calcs = [] } = useQuery<any[]>({
    queryKey: ['psm-calcs', selectedFolder],
    queryFn:  () => window.api.psm.calcs.list(selectedFolder === 'all' ? undefined : selectedFolder) as Promise<any[]>,
  })
  const { data: calcDetail } = useQuery<any>({
    queryKey: ['psm-calc-detail', selectedCalc],
    queryFn:  () => selectedCalc ? window.api.psm.calcs.get(selectedCalc) : null,
    enabled: !!selectedCalc,
  })

  // Wenn Detail geladen → Rows in lokalen State
  React.useEffect(() => {
    if (calcDetail?.rows) { setRows(calcDetail.rows); setDirty(false) }
  }, [calcDetail?.id])

  const invFolders = () => qc.invalidateQueries({ queryKey:['psm-folders'] })
  const invCalcs   = () => qc.invalidateQueries({ queryKey:['psm-calcs', selectedFolder] })
  const invDetail  = () => qc.invalidateQueries({ queryKey:['psm-calc-detail', selectedCalc] })

  const saveFolder  = useMutation({ mutationFn:(d:any)=>window.api.psm.folders.save(d), onSuccess:()=>{invFolders();setShowFolderModal(false);toast.success('Ordner gespeichert')} })
  const delFolder   = useMutation({ mutationFn:(id:number)=>window.api.psm.folders.delete(id), onSuccess:()=>{invFolders();setDeletingFolder(null);if(selectedFolder===deletingFolder?.id)setSelectedFolder('all')} })
  const saveCalc    = useMutation({ mutationFn:(d:any)=>window.api.psm.calcs.save(d), onSuccess:()=>{invCalcs();setShowCalcModal(false);toast.success('Gespeichert')} })
  const delCalc     = useMutation({ mutationFn:(id:number)=>window.api.psm.calcs.delete(id), onSuccess:()=>{invCalcs();setDeletingCalc(null);setSelectedCalc(null);toast.success('Gelöscht')} })
  const saveRows    = useMutation({
    mutationFn: () => window.api.psm.rows.save(selectedCalc!, rows),
    onSuccess: () => { invDetail(); setDirty(false); toast.success('Gespeichert') },
    onError: (e:Error) => toast.error('Fehler', e.message),
  })

  const handleRowChange = useCallback((newRows: PsmRow[]) => {
    setRows(newRows); setDirty(true)
  }, [])

  const unitLabel = calcDetail?.unit_type === 'custom'
    ? (calcDetail?.unit_label || 'Einheit')
    : (UNIT_OPTIONS.find(o => o.value === calcDetail?.unit_type)?.label || 'Literpreis')

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <FileText size={20} className="text-brand-400"/>
            PSM-Kalkulation
          </h2>
          <p className="page-subtitle">PrestaShop Preisstaffel-Modell · Aufschläge · Ergebnistabelle</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => { const r = await window.api.psm.import(); if(r?.ok){invCalcs();invFolders();toast.success('Importiert')} }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white border border-white/10 transition-colors">
            <Upload size={12}/> Import
          </button>
          {selectedCalc && (
            <button onClick={() => window.api.psm.export(selectedCalc)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white border border-white/10 transition-colors">
              <Download size={12}/> Export
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Linke Spalte — Ordner + Kalk.-Liste */}
        <div className="w-64 shrink-0 space-y-2">
          {/* Ordner-Header */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Ordner</p>
            <button onClick={() => { setEditFolder(null); setFolderForm({name:'',color:FOLDER_COLORS[0]}); setShowFolderModal(true) }}
              className="btn-ghost p-1 text-slate-500 hover:text-white"><Plus size={12}/></button>
          </div>

          {/* "Alle" Ordner */}
          <button onClick={() => setSelectedFolder('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selectedFolder==='all'?'bg-white/8 text-white':'text-slate-400 hover:text-slate-200'}`}>
            <FolderOpen size={13} className="text-slate-500"/> Alle Kalkulationen
            <span className="ml-auto text-slate-600">{calcs.length}</span>
          </button>

          {(folders as any[]).map((f: any) => (
            <div key={f.id} className="group">
              <button onClick={() => setSelectedFolder(f.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${selectedFolder===f.id?'bg-white/8 text-white':'text-slate-400 hover:text-slate-200'}`}>
                <Folder size={13} style={{ color: f.color }}/>
                <span className="flex-1 text-left truncate">{f.name}</span>
                <span className="text-slate-600 shrink-0">{f.calc_count}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={e=>{e.stopPropagation();setEditFolder(f);setFolderForm({name:f.name,color:f.color});setShowFolderModal(true)}}
                    className="p-0.5 text-slate-500 hover:text-white"><Pencil size={10}/></button>
                  <button onClick={e=>{e.stopPropagation();setDeletingFolder(f)}}
                    className="p-0.5 text-red-400"><Trash2 size={10}/></button>
                </div>
              </button>
            </div>
          ))}

          <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:8, marginTop:8 }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Kalkulationen</p>
              <button onClick={() => { setEditCalc(null); setCalcForm({name:'',description:'',unit_type:'liter',unit_label:'',vat_pct:19,tags:[]}); setShowCalcModal(true) }}
                className="btn-ghost p-1 text-slate-500 hover:text-white"><Plus size={12}/></button>
            </div>

            {!(calcs as any[]).length && (
              <p className="text-xs text-slate-600 italic px-1 py-2">Noch keine Kalkulationen</p>
            )}

            {(calcs as any[]).map((c: any) => (
              <div key={c.id}
                onClick={() => setSelectedCalc(c.id)}
                className={`p-2.5 rounded-xl cursor-pointer transition-all mb-1 group ${selectedCalc===c.id?'bg-brand-500/15 border border-brand-500/30':' hover:bg-white/3 border border-transparent'}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={e=>{e.stopPropagation();setEditCalc(c);setCalcForm({name:c.name,description:c.description||'',unit_type:c.unit_type,unit_label:c.unit_label||'',vat_pct:c.vat_pct,tags:c.tags||[]});setShowCalcModal(true)}}
                      className="p-0.5 text-slate-500 hover:text-white"><Pencil size={10}/></button>
                    <button onClick={e=>{e.stopPropagation();setDeletingCalc(c)}}
                      className="p-0.5 text-red-400"><Trash2 size={10}/></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-600">{c.row_count} Varianten</span>
                  {(c.tags||[]).map((t: string) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background:'rgba(99,102,241,0.2)', color:'#a5b4fc' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rechts: Editor */}
        {!selectedCalc ? (
          <div className="flex-1 glass-card flex flex-col items-center justify-center py-20">
            <FileText size={48} className="text-slate-700 mb-4"/>
            <p className="text-slate-400 font-semibold">Kalkulation auswählen oder anlegen</p>
            <p className="text-slate-600 text-sm mt-1">
              Für PrestaShop Staffelpreise · Aufschläge · Literpreise
            </p>
            <Button className="mt-4" icon={<Plus size={14}/>}
              onClick={() => { setEditCalc(null); setCalcForm({name:'',description:'',unit_type:'liter',unit_label:'',vat_pct:19,tags:[]}); setShowCalcModal(true) }}>
              Neue Kalkulation
            </Button>
          </div>
        ) : (
          <div className="flex-1 min-w-0 space-y-4">
            {/* Kalk.-Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{calcDetail?.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{unitLabel}</span>
                  <span>·</span>
                  <span>MwSt {calcDetail?.vat_pct}%</span>
                  {(calcDetail?.tags||[]).length > 0 && <span>·</span>}
                  {(calcDetail?.tags||[]).map((t: string) => (
                    <span key={t} className="px-1.5 py-0.5 rounded-full text-[10px]"
                      style={{ background:'rgba(99,102,241,0.2)', color:'#a5b4fc' }}>{t}</span>
                  ))}
                </p>
              </div>
              {dirty && (
                <Button icon={<Save size={13}/>} loading={saveRows.isPending} onClick={() => saveRows.mutate()}>
                  Änderungen speichern
                </Button>
              )}
            </div>

            {/* Eingabe-Tabelle */}
            <InputTable
              rows={rows}
              unitType={calcDetail?.unit_type || 'liter'}
              unitLabel={calcDetail?.unit_label || ''}
              vatPct={calcDetail?.vat_pct || 19}
              onChange={handleRowChange}/>

            {/* Ergebnis-Tabelle */}
            {rows.length > 0 && (
              <ResultTable
                rows={rows}
                unitType={calcDetail?.unit_type || 'liter'}
                unitLabel={calcDetail?.unit_label || ''}/>
            )}
          </div>
        )}
      </div>

      {/* Ordner Modal */}
      <Modal open={showFolderModal} onClose={()=>setShowFolderModal(false)}
        title={editFolder?'Ordner bearbeiten':'Neuer Ordner'} size="sm">
        <div className="space-y-3">
          <Input label="Name *" value={folderForm.name} autoFocus
            onChange={e => setFolderForm(p=>({...p,name:e.target.value}))}/>
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-semibold">Farbe</label>
            <div className="flex gap-2">
              {FOLDER_COLORS.map(col=>(
                <button key={col} onClick={()=>setFolderForm(p=>({...p,color:col}))}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{background:col,outline:folderForm.color===col?'2px solid white':'none',outlineOffset:2}}/>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={()=>setShowFolderModal(false)}>Abbrechen</Button>
            <Button disabled={!folderForm.name} loading={saveFolder.isPending}
              onClick={()=>saveFolder.mutate({...editFolder,...folderForm})}>
              {editFolder?'Speichern':'Anlegen'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Kalkulation Modal */}
      <Modal open={showCalcModal} onClose={()=>setShowCalcModal(false)}
        title={editCalc?'Kalkulation bearbeiten':'Neue Kalkulation'} size="md">
        <div className="space-y-4">
          <Input label="Name *" value={calcForm.name} autoFocus
            onChange={e=>setCalcForm(p=>({...p,name:e.target.value}))}
            placeholder="z.B. Nitro Verdünnung"/>
          <Input label="Beschreibung" value={calcForm.description}
            onChange={e=>setCalcForm(p=>({...p,description:e.target.value}))}/>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Select label="Einheitspreistyp" value={calcForm.unit_type}
                onChange={e=>setCalcForm(p=>({...p,unit_type:e.target.value}))}>
                {UNIT_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <Input label="MwSt %" type="number" value={calcForm.vat_pct}
              onChange={e=>setCalcForm(p=>({...p,vat_pct:Number(e.target.value)}))}/>
          </div>
          {calcForm.unit_type === 'custom' && (
            <Input label="Benutzerdefinierte Einheit *" value={calcForm.unit_label}
              onChange={e=>setCalcForm(p=>({...p,unit_label:e.target.value}))}
              placeholder="z.B. m², Stk, Paar"/>
          )}
          {/* Tags */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-semibold flex items-center gap-1">
              <Tag size={11}/> Tags (Produktgruppen)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {calcForm.tags.map((t,i)=>(
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                  style={{background:'rgba(99,102,241,0.2)',color:'#a5b4fc',border:'1px solid rgba(99,102,241,0.3)'}}>
                  {t}
                  <button onClick={()=>setCalcForm(p=>({...p,tags:p.tags.filter((_,j)=>j!==i)}))}>
                    <X size={9}/>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="form-input text-xs flex-1" placeholder="Tag hinzufügen …"
                value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&tagInput.trim()){setCalcForm(p=>({...p,tags:[...p.tags,tagInput.trim()]}));setTagInput('')}}}/>
              <button onClick={()=>{if(tagInput.trim()){setCalcForm(p=>({...p,tags:[...p.tags,tagInput.trim()]}));setTagInput('')}}}
                className="btn-ghost p-2 text-brand-400"><Plus size={13}/></button>
            </div>
          </div>
          {/* Ordner */}
          <Select label="Ordner (optional)" value={String(calcForm.unit_type==='liter'?editCalc?.folder_id||'':editCalc?.folder_id||'')}
            onChange={e=>setEditCalc((p: any)=>({...(p||{}),folder_id:e.target.value?Number(e.target.value):null}))}>
            <option value="">– Kein Ordner –</option>
            {(folders as any[]).map((f:any)=><option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={()=>setShowCalcModal(false)}>Abbrechen</Button>
            <Button disabled={!calcForm.name} loading={saveCalc.isPending}
              onClick={()=>saveCalc.mutate({
                ...(editCalc||{}), ...calcForm,
                folder_id: editCalc?.folder_id||null,
              })}>
              {editCalc?'Speichern':'Anlegen'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deletingFolder} title="Ordner löschen?"
        message={`Ordner "${deletingFolder?.name}" löschen? Kalkulationen bleiben erhalten.`}
        onConfirm={()=>deletingFolder&&delFolder.mutate(deletingFolder.id)}
        onCancel={()=>setDeletingFolder(null)} loading={delFolder.isPending}/>
      <ConfirmDialog open={!!deletingCalc} title="Kalkulation löschen?"
        message={`"${deletingCalc?.name}" und alle Varianten löschen?`}
        onConfirm={()=>deletingCalc&&delCalc.mutate(deletingCalc.id)}
        onCancel={()=>setDeletingCalc(null)} loading={delCalc.isPending}/>
    </div>
  )
}
