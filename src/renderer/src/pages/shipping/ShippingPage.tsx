/**
 * ShippingPage — Versandkosten-Manager
 * Flaggen · Carrier-Logos · Zone-CRUD · Gewichtsstaffeln
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Truck, Plus, Pencil, Trash2, Package, Globe, Check, X, Search,
} from 'lucide-react'
import { Button, Input } from '@/components/ui/Input'
import { Modal }   from '@/components/ui/Modal'
import { ConfirmDialog, Spinner } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

// ── Carrier-Logo SVG (Markenfarben) ───────────────────────────
function CarrierLogo({ name, code, color, size = 32 }: {
  name: string; code: string; color: string; size?: number
}) {
  // Bekannte Carrier-Logos als SVG/CSS
  const logos: Record<string, React.ReactNode> = {
    DHL_PAKET: (
      <svg width={size} height={size} viewBox="0 0 40 20">
        <rect width="40" height="20" fill="#FFCC00" rx="3"/>
        <text x="50%" y="14" textAnchor="middle" fill="#D40511"
          fontFamily="Arial Black,Arial" fontSize="10" fontWeight="900">DHL</text>
      </svg>
    ),
    DHL_EXPRESS: (
      <svg width={size} height={size*0.6} viewBox="0 0 40 20">
        <rect width="40" height="20" fill="#D40511" rx="3"/>
        <text x="50%" y="14" textAnchor="middle" fill="white"
          fontFamily="Arial Black,Arial" fontSize="8" fontWeight="900">EXPRESS</text>
      </svg>
    ),
    DPD: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" fill="#DC0032" rx="4"/>
        <text x="50%" y="26" textAnchor="middle" fill="white"
          fontFamily="Arial Black,Arial" fontSize="14" fontWeight="900">DPD</text>
      </svg>
    ),
    UPS: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" fill="#351C15" rx="4"/>
        <text x="50%" y="26" textAnchor="middle" fill="#FFB500"
          fontFamily="Arial Black,Arial" fontSize="14" fontWeight="900">UPS</text>
      </svg>
    ),
    GLS: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" fill="#009EE0" rx="4"/>
        <text x="50%" y="26" textAnchor="middle" fill="white"
          fontFamily="Arial Black,Arial" fontSize="16" fontWeight="900">GLS</text>
      </svg>
    ),
    HERMES: (
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" fill="#00A859" rx="4"/>
        <text x="50%" y="26" textAnchor="middle" fill="white"
          fontFamily="Arial" fontSize="10" fontWeight="700">HERM</text>
      </svg>
    ),
  }

  if (logos[code]) return <span className="shrink-0">{logos[code]}</span>

  // Fallback: Farb-Kreis mit Initials
  return (
    <div className="shrink-0 rounded-lg flex items-center justify-center text-white font-black text-xs"
      style={{ width: size, height: size, background: color }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Länder-Auswahl mit Flaggen ────────────────────────────────
function CountrySelector({ zoneId, allCountries, currentIsos, onSave, onCancel }: {
  zoneId: number; allCountries: any[]; currentIsos: string[]
  onSave: (isos: string[]) => void; onCancel: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIsos))
  const [search, setSearch]     = useState('')

  const filtered = useMemo(() =>
    allCountries.filter((c: any) =>
      !search || c.name_de.toLowerCase().includes(search.toLowerCase()) ||
      c.iso2.toLowerCase().includes(search.toLowerCase())
    )
  , [allCountries, search])

  // Gruppen
  const eu    = filtered.filter((c: any) => c.region === 'eu')
  const eea   = filtered.filter((c: any) => ['eea','ch','uk'].includes(c.region))
  const other = filtered.filter((c: any) => !['eu','eea','ch','uk'].includes(c.region))

  const toggle = (iso2: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(iso2) ? next.delete(iso2) : next.add(iso2)
      return next
    })
  }

  const selectGroup = (countries: any[]) => {
    setSelected(prev => {
      const next = new Set(prev)
      const allIn = countries.every(c => next.has(c.iso2))
      countries.forEach(c => allIn ? next.delete(c.iso2) : next.add(c.iso2))
      return next
    })
  }

  function CountryGroup({ title, countries }: { title: string; countries: any[] }) {
    if (!countries.length) return null
    const allIn = countries.every(c => selected.has(c.iso2))
    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => selectGroup(countries)}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all ${allIn ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-slate-300'}`}>
            {title} ({countries.length})
            {allIn ? ' ✓' : ''}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {countries.map((c: any) => (
            <label key={c.iso2}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                selected.has(c.iso2) ? 'bg-indigo-500/12 border border-indigo-500/30' : 'hover:bg-white/3 border border-transparent'
              }`}>
              <input type="checkbox" checked={selected.has(c.iso2)} onChange={() => toggle(c.iso2)}
                className="w-3.5 h-3.5 rounded accent-indigo-500 shrink-0"/>
              <span className="text-base leading-none shrink-0">{c.flag_emoji || '🏳'}</span>
              <span className="text-[11px] font-mono text-slate-500 shrink-0 w-6">{c.iso2}</span>
              <span className="text-[11px] text-slate-300 truncate">{c.name_de}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-white">
          Länder der Zone
          <span className="ml-2 text-xs text-indigo-400 font-normal">{selected.size} ausgewählt</span>
        </p>
        <div className="relative w-48">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-8 text-xs w-full" placeholder="Land suchen …"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
        <CountryGroup title="🇪🇺 EU" countries={eu}/>
        {!search && <div className="border-t border-white/6 my-2"/>}
        <CountryGroup title="🌐 EWR / CH / UK" countries={eea}/>
        {!search && <div className="border-t border-white/6 my-2"/>}
        <CountryGroup title="🌍 Drittländer" countries={other}/>
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-white/8">
        <Button onClick={() => onSave(Array.from(selected))} icon={<Check size={13}/>}>
          {selected.size} Länder speichern
        </Button>
        <Button variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <button onClick={() => setSelected(new Set())}
          className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors">
          Alle abwählen
        </button>
      </div>
    </div>
  )
}

// ── Gewichtsstufen-Zeile ──────────────────────────────────────
function WeightTierRow({ tier, onSave, onDelete }: {
  tier: any; onSave: (d: any) => void; onDelete: () => void
}) {
  const [editing, setEditing] = useState(!tier.id)
  const [form, setForm] = useState({
    weight_from_g: tier.weight_from_g ?? 0,
    weight_to_g:   tier.weight_to_g   ?? 31500,
    price_eur:     tier.price_eur      ?? 0,
    notes:         tier.notes          ?? '',
  })
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const fmtG = (g: number) => {
    if (g >= 1000000) return '∞'
    return g >= 1000 ? `${(g/1000).toFixed(g%1000===0?0:2).replace('.',',')} kg` : `${g} g`
  }

  if (!editing) return (
    <div className="flex items-center px-4 py-2 group hover:bg-white/[0.02] transition-colors"
      style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <span className="w-32 text-xs font-mono text-slate-400">{fmtG(Number(tier.weight_from_g))}</span>
      <span className="text-slate-700 mx-1 text-xs">→</span>
      <span className="w-32 text-xs font-mono text-slate-400">{fmtG(Number(tier.weight_to_g))}</span>
      <span className="flex-1"/>
      <span className="font-mono font-bold text-white text-sm mr-4">
        {Number(tier.price_eur).toFixed(2).replace('.',',')} €
      </span>
      {tier.notes && <span className="text-xs text-slate-600 mr-3">{tier.notes}</span>}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="btn-ghost p-1.5 text-slate-400"><Pencil size={11}/></button>
        <button onClick={onDelete} className="btn-ghost p-1.5 text-red-400"><Trash2 size={11}/></button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-2 px-3 py-2.5"
      style={{ background:'rgba(99,102,241,0.05)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-slate-500 shrink-0">von</span>
        <input type="number" className="form-input text-xs w-24 font-mono" placeholder="g"
          value={form.weight_from_g} onChange={f('weight_from_g')}/>
        <span className="text-[10px] text-slate-500 shrink-0">bis</span>
        <input type="number" className="form-input text-xs w-24 font-mono" placeholder="g"
          value={form.weight_to_g} onChange={f('weight_to_g')}/>
        <span className="text-[10px] text-slate-500 shrink-0">g</span>
      </div>
      <div className="flex items-center gap-1.5 ml-3">
        <input type="number" step="0.01" className="form-input text-xs w-20 font-mono" placeholder="€"
          value={form.price_eur} onChange={f('price_eur')}/>
        <span className="text-[10px] text-slate-500">€</span>
      </div>
      <input className="form-input text-xs w-32" placeholder="Notiz" value={form.notes} onChange={f('notes')}/>
      <button
        onClick={() => {
          onSave({ ...tier, weight_from_g: Number(form.weight_from_g), weight_to_g: Number(form.weight_to_g), price_eur: Number(form.price_eur), notes: form.notes })
          setEditing(false)
        }}
        className="btn-ghost p-1.5 text-emerald-400 shrink-0"><Check size={12}/></button>
      {tier.id && <button onClick={() => setEditing(false)} className="btn-ghost p-1.5 text-slate-500 shrink-0"><X size={12}/></button>}
    </div>
  )
}

// ── Zone-Panel ────────────────────────────────────────────────
function ZonePanel({ zone, allCountries, onDelete }: {
  zone: any; allCountries: any[]; onDelete: () => void
}) {
  const qc   = useQueryClient()
  const toast = useToast()
  const [showCountries, setShowCountries] = useState(false)
  const [newTier,       setNewTier]       = useState(false)
  const [confirmDel,    setConfirmDel]    = useState(false)

  const { data: tiers = [] } = useQuery<any[]>({
    queryKey: ['shipping-tiers', zone.id],
    queryFn:  () => window.api.shipping.tiers.list(zone.id) as Promise<any[]>,
  })
  const { data: zoneCountries = [] } = useQuery<any[]>({
    queryKey: ['zone-countries', zone.id],
    queryFn:  () => window.api.shipping.zones.countries.list(zone.id) as Promise<any[]>,
  })

  const invT  = () => qc.invalidateQueries({ queryKey:['shipping-tiers', zone.id] })
  const invZC = () => {
    qc.invalidateQueries({ queryKey:['zone-countries', zone.id] })
    qc.invalidateQueries({ queryKey:['shipping-zones'] })
  }

  const saveTier = useMutation({
    mutationFn: (d: any) => window.api.shipping.tiers.save(d),
    onSuccess: () => { invT(); setNewTier(false); toast.success('Gespeichert') },
  })
  const delTier = useMutation({
    mutationFn: (id: number) => window.api.shipping.tiers.delete(id),
    onSuccess: invT,
  })
  const saveCountries = useMutation({
    mutationFn: (isos: string[]) => window.api.shipping.zones.countries.set(zone.id, isos),
    onSuccess: () => { invZC(); setShowCountries(false); toast.success('Länder gespeichert') },
  })

  const currentIsos = (zoneCountries as any[]).map((c: any) => c.iso2)

  return (
    <div className="glass-card overflow-hidden mb-3">
      {/* Zone Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: tiers.length ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div>
          <p className="text-sm font-bold text-white">{zone.name}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[10px] text-slate-500">
              {zone.country_count} Länder · {zone.tier_count} Staffeln
            </p>
            {/* Flaggen-Preview */}
            {(zoneCountries as any[]).slice(0,8).map((c: any) => (
              <span key={c.iso2} title={c.name_de} className="text-base leading-none">{c.flag_emoji || c.iso2}</span>
            ))}
            {(zoneCountries as any[]).length > 8 && (
              <span className="text-[10px] text-slate-600">+{(zoneCountries as any[]).length - 8}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCountries(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: showCountries ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border:'1px solid rgba(255,255,255,0.1)', color: showCountries ? '#a5b4fc' : '#94a3b8' }}>
            <Globe size={12}/> Länder {showCountries ? 'schließen' : 'bearbeiten'}
          </button>
          <button onClick={() => setConfirmDel(true)}
            className="btn-ghost p-1.5 text-red-400 hover:text-red-300" title="Zone löschen">
            <Trash2 size={13}/>
          </button>
        </div>
      </div>

      {/* Länder-Auswahl */}
      {showCountries && (
        <div className="px-4 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.01)' }}>
          <CountrySelector
            zoneId={zone.id}
            allCountries={allCountries}
            currentIsos={currentIsos}
            onSave={isos => saveCountries.mutate(isos)}
            onCancel={() => setShowCountries(false)}/>
        </div>
      )}

      {/* Gewichtsstaffeln */}
      {tiers.length > 0 && (
        <div>
          <div className="flex px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600"
            style={{ background:'rgba(255,255,255,0.02)' }}>
            <span className="w-32">Von</span>
            <span className="w-8 mx-1"/>
            <span className="w-32">Bis</span>
            <span className="flex-1"/>
            <span className="mr-4">Preis</span>
          </div>
          {(tiers as any[]).map(t => (
            <WeightTierRow key={t.id} tier={t}
              onSave={d => saveTier.mutate({ ...d, zone_id: zone.id })}
              onDelete={() => delTier.mutate(t.id)}/>
          ))}
        </div>
      )}

      {newTier && (
        <WeightTierRow
          tier={{ zone_id: zone.id }}
          onSave={d => saveTier.mutate({ ...d, zone_id: zone.id })}
          onDelete={() => setNewTier(false)}/>
      )}

      <button onClick={() => setNewTier(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
        style={{ borderTop:'1px dashed rgba(255,255,255,0.08)' }}>
        <Plus size={11}/> Gewichtsstufe hinzufügen
      </button>

      <ConfirmDialog open={confirmDel} title="Zone löschen?"
        message={`Zone "${zone.name}" mit allen Staffeln und Länderzuordnungen löschen?`}
        onConfirm={() => { onDelete(); setConfirmDel(false) }}
        onCancel={() => setConfirmDel(false)}/>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
const CARRIER_COLORS = ['#FFCC00','#D40511','#DC0032','#351C15','#009EE0','#00A859','#3b82f6','#9333ea']

export default function ShippingPage() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [selectedCarrier,  setSelectedCarrier]  = useState<number | null>(null)
  const [showCarrierModal, setShowCarrierModal] = useState(false)
  const [showZoneModal,    setShowZoneModal]    = useState(false)
  const [editCarrier,      setEditCarrier]      = useState<any>(null)
  const [carrierForm,      setCarrierForm]      = useState({ name:'', code:'', color: CARRIER_COLORS[0] })
  const [zoneForm,         setZoneForm]         = useState({ code:'', name:'', description:'' })

  const { data: carriers = [], isLoading } = useQuery<any[]>({
    queryKey: ['shipping-carriers'],
    queryFn:  () => window.api.shipping.carriers.list() as Promise<any[]>,
  })
  const { data: zones = [] } = useQuery<any[]>({
    queryKey: ['shipping-zones', selectedCarrier],
    queryFn:  () => selectedCarrier ? window.api.shipping.zones.list(selectedCarrier) as Promise<any[]> : Promise.resolve([]),
    enabled: !!selectedCarrier,
  })
  const { data: allCountries = [] } = useQuery<any[]>({
    queryKey: ['countries-all'],
    queryFn:  () => window.api.geo.countries.list() as Promise<any[]>,
  })

  const invC = () => qc.invalidateQueries({ queryKey:['shipping-carriers'] })
  const invZ = () => qc.invalidateQueries({ queryKey:['shipping-zones', selectedCarrier] })

  const saveCarrier = useMutation({
    mutationFn: (d: any) => window.api.shipping.carriers.save(d),
    onSuccess: () => { invC(); setShowCarrierModal(false); toast.success('Gespeichert') },
  })
  const saveZone = useMutation({
    mutationFn: (d: any) => window.api.shipping.zones.save({ ...d, carrier_id: selectedCarrier }),
    onSuccess: () => { invZ(); setShowZoneModal(false); toast.success('Zone angelegt') },
  })
  const deleteZone = useMutation({
    mutationFn: (id: number) => window.api.shipping.zones.delete(id),
    onSuccess: () => { invZ(); toast.success('Zone gelöscht') },
  })

  const activeCarrier = (carriers as any[]).find((c: any) => c.id === selectedCarrier)

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Truck size={20} className="text-brand-400"/>
            Versandkosten-Manager
          </h2>
          <p className="page-subtitle">Carrier · Zonen · Gewichtsstaffeln · Länder</p>
        </div>
        <Button icon={<Plus size={14}/>}
          onClick={() => { setEditCarrier(null); setCarrierForm({name:'',code:'',color:CARRIER_COLORS[0]}); setShowCarrierModal(true) }}>
          Carrier hinzufügen
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Carrier-Liste */}
        <div className="w-56 shrink-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 px-1 mb-2">
            Versandanbieter
          </p>
          {(carriers as any[]).map((c: any) => (
            <div key={c.id}
              onClick={() => setSelectedCarrier(c.id)}
              className={`glass-card p-3 cursor-pointer transition-all group ${
                selectedCarrier === c.id ? '' : 'hover:border-white/10'
              }`}
              style={selectedCarrier === c.id ? {
                borderColor:`${c.color}50`, boxShadow:`0 0 12px ${c.color}15`
              } : {}}>
              <div className="flex items-center gap-2.5">
                <CarrierLogo name={c.name} code={c.code} color={c.color} size={32}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-500">{c.zone_count} Zonen</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setEditCarrier(c); setCarrierForm({name:c.name,code:c.code,color:c.color}); setShowCarrierModal(true) }}
                  className="btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pencil size={11}/>
                </button>
              </div>
            </div>
          ))}

          {!carriers.length && (
            <div className="glass-card p-4 text-center">
              <Truck size={24} className="text-slate-700 mx-auto mb-2"/>
              <p className="text-xs text-slate-600">Noch keine Carrier</p>
            </div>
          )}
        </div>

        {/* Zonen + Staffeln */}
        {!selectedCarrier ? (
          <div className="flex-1 glass-card flex flex-col items-center justify-center py-16">
            <Truck size={40} className="text-slate-700 mb-3"/>
            <p className="text-slate-500 text-sm">Carrier auswählen</p>
            <p className="text-slate-600 text-xs mt-1">dann Zonen und Gewichtsstaffeln verwalten</p>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-white flex items-center gap-2.5">
                <CarrierLogo name={activeCarrier?.name} code={activeCarrier?.code} color={activeCarrier?.color} size={24}/>
                {activeCarrier?.name} — Versandzonen
              </p>
              <Button size="sm" icon={<Plus size={11}/>}
                onClick={() => { setZoneForm({code:'',name:'',description:''}); setShowZoneModal(true) }}>
                Zone anlegen
              </Button>
            </div>

            {!(zones as any[]).length && (
              <div className="glass-card p-8 text-center">
                <Package size={28} className="text-slate-700 mx-auto mb-2"/>
                <p className="text-slate-500 text-sm">Noch keine Zonen für diesen Carrier</p>
                <p className="text-slate-600 text-xs mt-1">z.B. Deutschland, EU, Europa, Welt Zone 1</p>
                <Button className="mt-3" size="sm" icon={<Plus size={11}/>}
                  onClick={() => { setZoneForm({code:'',name:'',description:''}); setShowZoneModal(true) }}>
                  Erste Zone anlegen
                </Button>
              </div>
            )}

            {(zones as any[]).map((z: any) => (
              <ZonePanel
                key={z.id}
                zone={z}
                allCountries={allCountries}
                onDelete={() => deleteZone.mutate(z.id)}/>
            ))}
          </div>
        )}
      </div>

      {/* Carrier Modal */}
      {showCarrierModal && (
        <Modal open onClose={() => setShowCarrierModal(false)}
          title={editCarrier ? 'Carrier bearbeiten' : 'Neuer Carrier'} size="sm">
          <div className="space-y-3">
            <Input label="Name *" value={carrierForm.name} autoFocus
              onChange={e => setCarrierForm(p => ({
                ...p, name: e.target.value,
                code: editCarrier ? p.code : e.target.value.toUpperCase().replace(/\s/g,'_').slice(0,12),
              }))}/>
            <Input label="Code *" value={carrierForm.code}
              onChange={e => setCarrierForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}/>
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-semibold">Farbe / Marke</label>
              <div className="flex gap-2 flex-wrap">
                {CARRIER_COLORS.map(col => (
                  <button key={col} onClick={() => setCarrierForm(p => ({ ...p, color: col }))}
                    className="w-8 h-8 rounded-xl transition-all"
                    style={{ background:col, outline:carrierForm.color===col?'2px solid white':'none', outlineOffset:2 }}/>
                ))}
                <input type="color" value={carrierForm.color}
                  onChange={e => setCarrierForm(p => ({ ...p, color: e.target.value }))}
                  className="w-8 h-8 rounded-xl cursor-pointer border-0"
                  title="Eigene Farbe"/>
              </div>
            </div>
            {/* Vorschau */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.04)' }}>
              <CarrierLogo name={carrierForm.name||'XX'} code={carrierForm.code} color={carrierForm.color} size={40}/>
              <div>
                <p className="text-sm font-bold text-white">{carrierForm.name || 'Carrier Name'}</p>
                <p className="text-xs text-slate-500 font-mono">{carrierForm.code || 'CODE'}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowCarrierModal(false)}>Abbrechen</Button>
              <Button disabled={!carrierForm.name} loading={saveCarrier.isPending}
                onClick={() => saveCarrier.mutate({ ...editCarrier, ...carrierForm })}>
                {editCarrier ? 'Speichern' : 'Anlegen'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <Modal open onClose={() => setShowZoneModal(false)} title="Neue Versandzone" size="sm">
          <div className="space-y-3">
            <Input label="Code *" value={zoneForm.code} autoFocus
              onChange={e => setZoneForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              placeholder="z.B. DE, EU, WELT1"/>
            <Input label="Name *" value={zoneForm.name}
              onChange={e => setZoneForm(p => ({ ...p, name: e.target.value }))}
              placeholder="z.B. Deutschland, Europa, Welt Zone 1"/>
            <Input label="Beschreibung" value={zoneForm.description}
              onChange={e => setZoneForm(p => ({ ...p, description: e.target.value }))}/>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowZoneModal(false)}>Abbrechen</Button>
              <Button disabled={!zoneForm.name || !zoneForm.code}
                onClick={() => saveZone.mutate(zoneForm)} loading={saveZone.isPending}>
                Anlegen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
