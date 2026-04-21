/**
 * VatRatesPage — EU OSS / MwSt-Tabelle mit Flaggen + Historien seit 2021
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Globe, ChevronDown, ChevronUp, Plus, Pencil, Check,
  History, AlertCircle, Search, X,
} from 'lucide-react'
import { Button, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import { Spinner } from '@/components/ui/Badge'

type Region = 'all' | 'eu' | 'eea' | 'other'

const REGION_LABELS: Record<string, string> = {
  eu:'EU (27)', eea:'EWR / CH / UK', ch:'Schweiz', uk:'UK', other:'Drittländer', eu_candidate:'EU-Kandidat'
}

function VatBadge({ rate, reduced }: { rate: number; reduced?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-2 py-0.5 rounded-lg text-xs font-bold font-mono"
        style={{ background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.3)' }}>
        {rate}%
      </span>
      {reduced != null && (
        <span className="text-[10px] text-slate-500 font-mono">{reduced}%</span>
      )}
    </div>
  )
}

function HistoryRow({ iso2 }: { iso2: string }) {
  const { data: history = [] } = useQuery<any[]>({
    queryKey: ['vat-history', iso2],
    queryFn:  () => window.api.geo.vat.history(iso2) as Promise<any[]>,
  })
  if (!history.length) return <p className="text-xs text-slate-600 italic py-2 px-4">Keine Historien</p>
  return (
    <div className="px-4 py-2 space-y-1">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">MwSt-Historien</p>
      <div className="grid grid-cols-6 gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">
        <span>Gültig ab</span><span>Bis</span><span>Standard</span>
        <span>Reduziert 1</span><span>Reduziert 2</span><span>Quelle</span>
      </div>
      {history.map((h: any) => (
        <div key={h.id}
          className="grid grid-cols-6 gap-2 text-xs py-1.5 px-2 rounded-lg"
          style={{
            background: !h.valid_to ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
            border: !h.valid_to ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.04)',
          }}>
          <span className="font-mono text-slate-300">{h.valid_from?.slice(0,10) || '–'}</span>
          <span className="font-mono text-slate-500">{h.valid_to?.slice(0,10) || <span className="text-emerald-400">aktuell</span>}</span>
          <span className="font-bold font-mono text-white">{h.vat_standard}%</span>
          <span className="font-mono text-slate-400">{h.vat_reduced_1 != null ? h.vat_reduced_1+'%' : '–'}</span>
          <span className="font-mono text-slate-400">{h.vat_reduced_2 != null ? h.vat_reduced_2+'%' : '–'}</span>
          <span className="text-slate-600">{h.source || '–'}</span>
        </div>
      ))}
    </div>
  )
}

function AddVatModal({ country, onClose }: { country: any; onClose: () => void }) {
  const qc   = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState({
    vat_standard: '', vat_reduced_1: '', vat_reduced_2: '',
    valid_from: new Date().toISOString().slice(0,10),
    notes: '',
  })
  const saveM = useMutation({
    mutationFn: (d: any) => window.api.geo.vat.save(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vat-all-current'] })
      qc.invalidateQueries({ queryKey: ['vat-history', country.iso2] })
      onClose(); toast.success('MwSt-Satz gespeichert')
    },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  return (
    <Modal open onClose={onClose}
      title={`${country.flag_emoji} ${country.name_de} — Neuen MwSt-Satz anlegen`} size="sm">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Der bisherige Satz wird automatisch mit dem „Gültig bis" Datum geschlossen.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Standard *" type="number" step="0.1" placeholder="z.B. 19"
            value={form.vat_standard}
            onChange={e => setForm(p => ({ ...p, vat_standard: e.target.value }))}/>
          <Input label="Reduziert 1" type="number" step="0.1" placeholder="z.B. 7"
            value={form.vat_reduced_1}
            onChange={e => setForm(p => ({ ...p, vat_reduced_1: e.target.value }))}/>
          <Input label="Reduziert 2" type="number" step="0.1" placeholder="opt."
            value={form.vat_reduced_2}
            onChange={e => setForm(p => ({ ...p, vat_reduced_2: e.target.value }))}/>
        </div>
        <Input label="Gültig ab *" type="date" value={form.valid_from}
          onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))}/>
        <Input label="Notizen" value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          placeholder="z.B. Gesetzesänderung Nr. ..."/>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button loading={saveM.isPending} disabled={!form.vat_standard || !form.valid_from}
            onClick={() => saveM.mutate({
              country_iso2: country.iso2,
              vat_standard: Number(form.vat_standard),
              vat_reduced_1: form.vat_reduced_1 ? Number(form.vat_reduced_1) : undefined,
              vat_reduced_2: form.vat_reduced_2 ? Number(form.vat_reduced_2) : undefined,
              valid_from: form.valid_from, notes: form.notes || undefined,
            })}>
            Speichern
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function VatRatesPage() {
  const [region,       setRegion]      = useState<Region>('eu')
  const [search,       setSearch]      = useState('')
  const [expanded,     setExpanded]    = useState<Set<string>>(new Set())
  const [addVatFor,    setAddVatFor]   = useState<any>(null)

  const { data: countries = [], isLoading } = useQuery<any[]>({
    queryKey: ['vat-all-current'],
    queryFn:  () => window.api.geo.vat.allCurrent() as Promise<any[]>,
  })

  const filtered = useMemo(() => {
    let list = countries
    if (region === 'eu')    list = list.filter((c: any) => c.region === 'eu')
    if (region === 'eea')   list = list.filter((c: any) => ['eea','ch','uk'].includes(c.region))
    if (region === 'other') list = list.filter((c: any) => !['eu','eea','ch','uk'].includes(c.region))
    if (search) list = list.filter((c: any) =>
      c.name_de.toLowerCase().includes(search.toLowerCase()) ||
      c.iso2.toLowerCase().includes(search.toLowerCase())
    )
    return list
  }, [countries, region, search])

  const toggle = (iso2: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(iso2) ? next.delete(iso2) : next.add(iso2)
    return next
  })

  if (isLoading) return <Spinner/>

  return (
    <div>
      {/* Header */}
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Globe size={20} className="text-brand-400"/>
            EU OSS / Mehrwertsteuer
          </h2>
          <p className="page-subtitle">
            {countries.filter((c: any) => c.region==='eu').length} EU-Länder ·
            Historische Sätze seit 2021 · One-Stop-Shop
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex p-0.5 rounded-xl gap-0.5"
          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
          {([
            { v:'eu',    l:`🇪🇺 EU (27)` },
            { v:'eea',   l:`🌐 EWR/CH/UK` },
            { v:'other', l:`🌍 Drittländer` },
            { v:'all',   l:'Alle' },
          ] as { v: Region; l: string }[]).map(r => (
            <button key={r.v} onClick={() => setRegion(r.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${region === r.v ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {r.l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-full text-sm" placeholder="Land suchen …"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <span className="text-xs text-slate-500">{filtered.length} Länder</span>
      </div>

      {/* Tabelle */}
      <div className="glass-card overflow-hidden">
        {/* Header */}
        <div className="grid text-[10px] font-bold uppercase tracking-wider text-slate-600 px-4 py-2.5"
          style={{
            gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr 1fr 1.5fr auto',
            background:'rgba(255,255,255,0.03)',
            borderBottom:'1px solid rgba(255,255,255,0.08)',
          }}>
          <span>Land</span>
          <span>EU-Mitglied seit</span>
          <span>MwSt Standard</span>
          <span>Reduziert 1</span>
          <span>Reduziert 2</span>
          <span>Gültig ab</span>
          <span>OSS / B2C</span>
          <span></span>
        </div>

        {filtered.map((c: any) => {
          const isExp  = expanded.has(c.iso2)
          const isEu   = c.region === 'eu'
          const noVat  = !c.vat_required

          return (
            <div key={c.iso2}
              style={{ borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              {/* Zeile */}
              <div
                className="grid items-center px-4 py-2.5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                style={{ gridTemplateColumns:'2fr 2fr 1.5fr 1fr 1fr 1.5fr 1.5fr auto' }}
                onClick={() => toggle(c.iso2)}>
                {/* Land + Flagge */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xl leading-none shrink-0">{c.flag_emoji || '🏳'}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{c.name_de}</p>
                    <p className="text-[10px] font-mono text-slate-500">{c.iso2}</p>
                  </div>
                </div>

                {/* EU seit */}
                <div>
                  {c.eu_since ? (
                    <span className="text-xs text-slate-400">
                      {isEu ? '✅ ' : ''}
                      {new Date(c.eu_since).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">{c.region === 'eu' ? '—' : 'Kein EU-Mitglied'}</span>
                  )}
                </div>

                {/* Steuersätze */}
                {noVat ? (
                  <div className="col-span-4">
                    <span className="text-xs text-slate-600 italic">Drittland — keine MwSt (Reverse Charge)</span>
                  </div>
                ) : (
                  <>
                    <div>
                      {c.vat_standard != null
                        ? <VatBadge rate={c.vat_standard}/>
                        : <span className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={10}/>Fehlt</span>
                      }
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {c.vat_reduced_1 != null ? c.vat_reduced_1+'%' : '–'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {c.vat_reduced_2 != null ? c.vat_reduced_2+'%' : '–'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      {c.valid_from?.slice(0,10) || '–'}
                    </span>
                  </>
                )}

                {/* OSS B2C Info */}
                <div>
                  {isEu && !noVat && c.vat_standard != null ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                      style={{ background:'rgba(16,185,129,0.1)', color:'#6ee7b7', border:'1px solid rgba(16,185,129,0.2)' }}>
                      OSS {c.vat_standard}%
                    </span>
                  ) : noVat ? (
                    <span className="text-[10px] text-slate-600">0% (Drittland)</span>
                  ) : null}
                </div>

                {/* Aktionen */}
                <div className="flex items-center gap-1.5 justify-end" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setAddVatFor(c)}
                    className="btn-ghost p-1.5 text-slate-500 hover:text-white"
                    title="Neuen MwSt-Satz hinzufügen">
                    <Plus size={12}/>
                  </button>
                  <button onClick={() => toggle(c.iso2)} className="btn-ghost p-1.5 text-slate-500">
                    {isExp ? <ChevronUp size={12}/> : <History size={12}/>}
                  </button>
                </div>
              </div>

              {/* Historien */}
              {isExp && (
                <div style={{ background:'rgba(255,255,255,0.01)', borderTop:'1px dashed rgba(255,255,255,0.06)' }}>
                  <HistoryRow iso2={c.iso2}/>
                </div>
              )}
            </div>
          )
        })}

        {!filtered.length && (
          <div className="py-12 text-center">
            <Globe size={32} className="text-slate-700 mx-auto mb-2"/>
            <p className="text-slate-500 text-sm">Keine Länder gefunden</p>
          </div>
        )}

        {/* Fußzeile */}
        <div className="px-4 py-2.5 flex items-center gap-4 text-[10px] text-slate-600"
          style={{ borderTop:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
          <span>Quelle: EU-Kommission, nationale Steuerbehörden</span>
          <span className="ml-auto">EU OSS gültig seit 01.07.2021 · Schwellenwert 10.000 € überschritten</span>
        </div>
      </div>

      {addVatFor && <AddVatModal country={addVatFor} onClose={() => setAddVatFor(null)}/>}
    </div>
  )
}
