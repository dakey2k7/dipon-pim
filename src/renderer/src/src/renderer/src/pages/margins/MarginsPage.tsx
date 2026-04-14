import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  Copy, Download, BarChart2, Pencil, Check, X,
  TrendingUp, TrendingDown, Layers, ArrowRight,
} from 'lucide-react'
import { useToast }   from '@/hooks/useToast'
import { Button }     from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }      from '@/components/ui/Modal'
import { Spinner, Card, EmptyState, ConfirmDialog } from '@/components/ui/Badge'

// ─── Types ────────────────────────────────────────────────────
interface CalcProfile {
  id: number; name: string; code: string; description: string | null
  channel: string; currency: string; color: string
  is_default: number; sort_order: number; step_count?: number
}
interface CalcStep {
  id: number; profile_id: number; sort_order: number
  step_type: string; label: string; value_source: string
  value_manual: number | null; value_percent: number | null
  linked_id: number | null; linked_type: string | null
  percent_base: string; is_subtotal: number; is_result: number
  is_visible: number; notes: string | null
}
interface StepResult {
  step: CalcStep; delta: number; running: number
  base: number; lastSubtotal: number
}
interface CalcResult {
  steps: StepResult[]; final: number; base: number
  margin: number | null; markup: number | null; currency: string
}

const STEP_TYPES = [
  { value: 'start',         label: '▶ Ausgangswert',       color: '#8b5cf6' },
  { value: 'add_fixed',     label: '+ Fixer Betrag',        color: '#10b981' },
  { value: 'sub_fixed',     label: '− Fixer Betrag',        color: '#ef4444' },
  { value: 'add_percent',   label: '+ Prozent',             color: '#10b981' },
  { value: 'sub_percent',   label: '− Prozent',             color: '#ef4444' },
  { value: 'markup',        label: '× Aufschlag %',         color: '#f59e0b' },
  { value: 'margin_target', label: '◎ Ziel-Marge %',        color: '#a78bfa' },
  { value: 'tax',           label: '§ Steuer %',            color: '#6b7280' },
  { value: 'subtotal',      label: '── Zwischensumme',      color: '#60a5fa' },
  { value: 'result',        label: '══ Endergebnis',        color: '#fbbf24' },
  { value: 'divider',       label: '── Trennlinie',         color: '#374151' },
]

const CHANNELS = [
  { value: 'shop',      label: '🛒 Online Shop' },
  { value: 'amazon',    label: '📦 Amazon' },
  { value: 'ebay',      label: '🏷 eBay' },
  { value: 'etsy',      label: '🎨 Etsy' },
  { value: 'wholesale', label: '🏭 Großhandel' },
  { value: 'b2b',       label: '🤝 B2B' },
  { value: 'b2c',       label: '👤 B2C' },
  { value: 'distributor',label: '🔄 Distributor' },
  { value: 'custom',    label: '✏️ Benutzerdefiniert' },
]

const PROFILE_COLORS = ['#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899','#6366f1']

function fmt(v: number, cur = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style:'currency', currency:cur, minimumFractionDigits:2 }).format(v)
}
function fmtPct(v: number | null) {
  if (v == null) return '–'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} %`
}

// ─── Step Row ────────────────────────────────────────────────
function StepRow({ step, result, overrides, onOverride, onEdit, onDelete, dragging }: {
  step: CalcStep; result?: StepResult
  overrides: Record<number,number>
  onOverride: (id: number, v: number | null) => void
  onEdit: (s: CalcStep) => void
  onDelete: (id: number) => void
  dragging?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [tempVal, setTempVal] = useState('')

  const isDivider  = step.step_type === 'divider'
  const isSubtotal = step.step_type === 'subtotal' || step.is_subtotal
  const isResult   = step.step_type === 'result'   || step.is_result
  const isNeg      = result && result.delta < 0
  const overridden = overrides[step.id] != null

  if (isDivider) return (
    <div className="flex items-center gap-3 py-1 px-4 opacity-30">
      <div className="flex-1 border-t border-white/10"/>
      {step.label && <span className="text-xs text-slate-500 shrink-0">{step.label}</span>}
      <div className="flex-1 border-t border-white/10"/>
    </div>
  )

  return (
    <div className={`group flex items-center gap-2 px-4 py-2 transition-all ${
      isResult   ? 'bg-brand-500/8 border-y border-brand-500/20' :
      isSubtotal ? 'bg-white/3' : 'hover:bg-white/[0.03]'
    } ${dragging ? 'opacity-50' : ''}`}>
      {/* Drag Handle */}
      <GripVertical size={14} className="text-slate-700 cursor-grab shrink-0"/>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${
          isResult   ? 'font-bold text-white' :
          isSubtotal ? 'font-semibold text-slate-200' :
          'text-slate-300'
        }`}>
          {step.label}
        </span>
        {step.notes && <p className="text-xs text-slate-600 truncate">{step.notes}</p>}
      </div>

      {/* Wert-Eingabe */}
      <div className="flex items-center gap-2 shrink-0">
        {!isSubtotal && !isResult && !isDivider && (
          editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number" step="0.01"
                value={tempVal}
                onChange={e => setTempVal(e.target.value)}
                className="w-24 px-2 py-1 rounded-lg text-xs text-right form-input"
                autoFocus
              />
              <button onClick={() => {
                const v = parseFloat(tempVal)
                if (!isNaN(v)) onOverride(step.id, v)
                setEditing(false)
              }} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Check size={12}/>
              </button>
              <button onClick={() => { onOverride(step.id, null); setEditing(false) }}
                className="p-1 text-red-400 hover:text-red-300">
                <X size={12}/>
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setTempVal(String(overrides[step.id] ?? step.value_manual ?? step.value_percent ?? '')); setEditing(true) }}
              className={`text-xs px-2 py-1 rounded-lg transition-all ${
                overridden
                  ? 'text-amber-400 border border-amber-500/30 bg-amber-500/10'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent hover:border-white/10'
              }`}
            >
              {step.value_percent != null
                ? `${step.value_percent} %`
                : overrides[step.id] != null
                  ? fmt(overrides[step.id])
                  : step.value_manual != null
                    ? fmt(step.value_manual)
                    : '–'
              }
            </button>
          )
        )}

        {/* Delta */}
        {result && !isDivider && (
          <span className={`text-sm font-mono w-28 text-right ${
            isResult   ? 'font-bold text-white' :
            isSubtotal ? 'font-semibold text-slate-200' :
            isNeg      ? 'text-red-400' : result.delta > 0 ? 'text-emerald-400' : 'text-slate-500'
          }`}>
            {isSubtotal || isResult
              ? fmt(result.running)
              : result.delta !== 0
                ? (result.delta > 0 ? '+' : '') + fmt(result.delta)
                : '–'
            }
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(step)} className="btn-ghost p-1"><Pencil size={11}/></button>
        <button onClick={() => onDelete(step.id)} className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
      </div>
    </div>
  )
}

// ─── Step Edit Modal ─────────────────────────────────────────
function StepModal({ step, profileId, onSave, onClose }: {
  step?: CalcStep; profileId: number; onSave: (d: unknown) => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    step_type:     step?.step_type     ?? 'add_fixed',
    label:         step?.label         ?? '',
    value_manual:  step?.value_manual  ?? '',
    value_percent: step?.value_percent ?? '',
    percent_base:  step?.percent_base  ?? 'running',
    notes:         step?.notes         ?? '',
    is_subtotal:   step?.is_subtotal   ?? 0,
    is_result:     step?.is_result     ?? 0,
  })
  const set = (k: string, v: unknown) => setForm(f => ({...f,[k]:v}))
  const needsPercent = ['add_percent','sub_percent','markup','margin_target','tax'].includes(form.step_type)
  const needsAmount  = ['start','add_fixed','sub_fixed'].includes(form.step_type)
  const isMarker     = ['subtotal','result','divider'].includes(form.step_type)

  return (
    <Modal open onClose={onClose} title={step ? 'Schritt bearbeiten' : 'Schritt hinzufügen'} size="md">
      <div className="space-y-4">
        <Select label="Typ" value={form.step_type} onChange={e => set('step_type', e.target.value)}>
          {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Input label="Bezeichnung" value={form.label}
          onChange={e => set('label', e.target.value)} placeholder="z.B. Verpackungskosten"/>
        {needsAmount && (
          <Input label="Betrag (€)" type="number" step="0.01" value={form.value_manual}
            onChange={e => set('value_manual', e.target.value)} placeholder="0.00"/>
        )}
        {needsPercent && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prozent (%)" type="number" step="0.1" value={form.value_percent}
              onChange={e => set('value_percent', e.target.value)} placeholder="15.0"/>
            {!['tax','markup'].includes(form.step_type) && (
              <Select label="Basis" value={form.percent_base} onChange={e => set('percent_base', e.target.value)}>
                <option value="running">Laufendes Total</option>
                <option value="base">Ausgangswert</option>
                <option value="subtotal">Letzte Zwischensumme</option>
              </Select>
            )}
          </div>
        )}
        <Input label="Notiz (optional)" value={form.notes}
          onChange={e => set('notes', e.target.value)} placeholder="Interne Anmerkung …"/>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave({
            ...step, ...form,
            profile_id:    profileId,
            value_manual:  form.value_manual  !== '' ? Number(form.value_manual)  : null,
            value_percent: form.value_percent !== '' ? Number(form.value_percent) : null,
          })}>Speichern</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Profile Form ────────────────────────────────────────────
function ProfileModal({ profile, onSave, onClose }: {
  profile?: CalcProfile; onSave: (d: unknown) => void; onClose: () => void
}) {
  const isCustomChannel = (ch: string) => !['shop','amazon','ebay','etsy','wholesale','b2b','b2c','distributor'].includes(ch)
  const [form, setForm] = useState({
    name:          profile?.name        ?? '',
    code:          profile?.code        ?? '',
    description:   profile?.description ?? '',
    channel:       isCustomChannel(profile?.channel ?? 'shop') ? 'custom' : (profile?.channel ?? 'shop'),
    customChannel: isCustomChannel(profile?.channel ?? '') ? (profile?.channel ?? '') : '',
    currency:      profile?.currency    ?? 'EUR',
    color:         profile?.color       ?? '#8b5cf6',
  })
  const set = (k: string, v: string) => setForm(f => ({...f,[k]:v}))
  return (
    <Modal open onClose={onClose} title={profile ? 'Profil bearbeiten' : 'Neues Profil'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Name *" value={form.name} autoFocus
              onChange={e => { set('name', e.target.value); if (!profile) set('code', e.target.value.toUpperCase().replace(/\s+/g,'-').slice(0,16)) }}/>
          </div>
          <Input label="Code *" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}/>
          <Select label="Kanal" value={form.channel} onChange={e => set('channel', e.target.value)}>
            {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Input label="Beschreibung" value={form.description} onChange={e => set('description', e.target.value)}/>
          <Select label="Währung" value={form.currency} onChange={e => set('currency', e.target.value)}>
            {['EUR','USD','GBP','CHF'].map(c => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <label className="form-label">Farbe</label>
          <div className="flex gap-2 mt-1.5">
            {PROFILE_COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className={`w-7 h-7 rounded-lg transition-all ${form.color===c?'ring-2 ring-white/50 scale-110':'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c }}/>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave({ ...profile, ...form, channel: form.channel === 'custom' ? (form.customChannel || 'custom') : form.channel })}>{profile ? 'Speichern' : 'Anlegen'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ───────────────────────────────────────────────
export default function MarginsPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [activeProfileId, setActiveProfileId] = useState<number | null>(null)
  const [overrides, setOverrides]             = useState<Record<number,number>>({})
  const [compareIds, setCompareIds]           = useState<number[]>([])
  const [showCompare, setShowCompare]         = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile]   = useState<CalcProfile | undefined>()
  const [showStepModal, setShowStepModal]     = useState(false)
  const [editingStep, setEditingStep]         = useState<CalcStep | undefined>()
  const [deletingProfile, setDeletingProfile] = useState<CalcProfile | undefined>()

  // ── Queries ────────────────────────────────────────────────
  const { data: profiles = [], isLoading } = useQuery<CalcProfile[]>({
    queryKey: ['calc-profiles'],
    queryFn:  () => window.api.calc.listProfiles() as Promise<CalcProfile[]>,
  })

  const { data: profileDetail } = useQuery({
    queryKey: ['calc-profile', activeProfileId],
    queryFn:  () => activeProfileId
      ? window.api.calc.getProfile(activeProfileId) as Promise<CalcProfile & { steps: CalcStep[] }>
      : null,
    enabled: !!activeProfileId,
  })

  const { data: calcResult } = useQuery<CalcResult>({
    queryKey: ['calc-result', activeProfileId, overrides],
    queryFn:  () => activeProfileId
      ? window.api.calc.run(activeProfileId, overrides) as Promise<CalcResult>
      : null,
    enabled: !!activeProfileId,
  })

  const { data: compareResults } = useQuery<Record<number, CalcResult>>({
    queryKey: ['calc-compare', compareIds],
    queryFn:  () => compareIds.length > 0
      ? window.api.calc.runMultiple(compareIds) as Promise<Record<number, CalcResult>>
      : null,
    enabled: compareIds.length > 0 && showCompare,
  })

  const inv = (key?: string) => {
    qc.invalidateQueries({ queryKey: ['calc-profiles'] })
    if (key) qc.invalidateQueries({ queryKey: [key, activeProfileId] })
  }

  // ── Mutations ──────────────────────────────────────────────
  const createProfile = useMutation({
    mutationFn: (d: unknown) => window.api.calc.createProfile(d),
    onSuccess: () => { inv(); setShowProfileModal(false); toast.success('Profil angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const updateProfile = useMutation({
    mutationFn: ({ id, d }: { id: number; d: unknown }) => window.api.calc.updateProfile(id, d),
    onSuccess: () => { inv('calc-profile'); setShowProfileModal(false); toast.success('Gespeichert') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const deleteProfile = useMutation({
    mutationFn: (id: number) => window.api.calc.deleteProfile(id),
    onSuccess: () => { inv(); setDeletingProfile(undefined); setActiveProfileId(null); toast.success('Profil gelöscht') },
  })
  const duplicateProfile = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => window.api.calc.duplicateProfile(id, name),
    onSuccess: () => { inv(); toast.success('Profil dupliziert') },
  })
  const saveStep = useMutation({
    mutationFn: (d: unknown) => window.api.calc.saveStep(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calc-profile', activeProfileId] }); qc.invalidateQueries({ queryKey: ['calc-result'] }); setShowStepModal(false); toast.success('Schritt gespeichert') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const deleteStep = useMutation({
    mutationFn: (id: number) => window.api.calc.deleteStep(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calc-profile', activeProfileId] }); qc.invalidateQueries({ queryKey: ['calc-result'] }) },
  })

  const handleOverride = useCallback((id: number, v: number | null) => {
    setOverrides(prev => {
      const next = { ...prev }
      if (v == null) delete next[id]
      else next[id] = v
      return next
    })
  }, [])

  const steps  = profileDetail?.steps ?? []
  const active = profiles.find(p => p.id === activeProfileId)

  // Vergleichs-Auswahl togglen
  const toggleCompare = (id: number) => {
    setCompareIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Margenkalkulation</h2>
          <p className="page-subtitle">{profiles.length} Profile</p>
        </div>
        <div className="flex items-center gap-2">
          {compareIds.length >= 2 && (
            <Button variant="secondary" icon={<BarChart2 size={14}/>}
              onClick={() => setShowCompare(v => !v)}>
              Vergleich ({compareIds.length})
            </Button>
          )}
          <Button icon={<Plus size={14}/>}
            onClick={() => { setEditingProfile(undefined); setShowProfileModal(true) }}>
            Profil anlegen
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* ── Profil-Liste ─────────────────────────────────── */}
        <div className="w-64 shrink-0 space-y-2">
          {profiles.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <Layers size={32} className="text-slate-700 mx-auto mb-3"/>
              <p className="text-sm text-slate-500">Noch keine Profile</p>
              <Button size="sm" className="mt-3" icon={<Plus size={12}/>}
                onClick={() => { setEditingProfile(undefined); setShowProfileModal(true) }}>
                Erstes Profil
              </Button>
            </div>
          ) : profiles.map(p => (
            <div
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className={`glass-card p-3.5 cursor-pointer transition-all group ${
                activeProfileId === p.id ? 'border-brand-500/40' : 'hover:border-white/10'
              }`}
              style={activeProfileId === p.id ? {
                borderColor: p.color + '60',
                boxShadow: `0 0 20px ${p.color}20`,
              } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }}/>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <input type="checkbox" checked={compareIds.includes(p.id)}
                    onChange={() => toggleCompare(p.id)}
                    onClick={e => e.stopPropagation()}
                    className="rounded border-white/20 bg-slate-800 text-brand-500"
                    title="Zum Vergleich hinzufügen"/>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="badge-blue text-xs">{p.step_count ?? 0} Schritte</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={e => { e.stopPropagation(); setEditingProfile(p); setShowProfileModal(true) }}
                    className="btn-ghost p-1"><Pencil size={11}/></button>
                  <button onClick={e => { e.stopPropagation(); duplicateProfile.mutate({ id: p.id, name: p.name + ' (Kopie)' }) }}
                    className="btn-ghost p-1"><Copy size={11}/></button>
                  <button onClick={e => { e.stopPropagation(); setDeletingProfile(p) }}
                    className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Builder + Preview ─────────────────────────────── */}
        {!activeProfileId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<Layers size={40}/>}
              title="Profil auswählen"
              description="Wähle links ein Profil oder lege ein neues an."
              action={<Button icon={<Plus size={14}/>}
                onClick={() => { setEditingProfile(undefined); setShowProfileModal(true) }}>
                Profil anlegen
              </Button>}
            />
          </div>
        ) : (
          <div className="flex-1 flex gap-4 min-w-0">
            {/* Builder */}
            <div className="flex-1 min-w-0">
              <div className="glass-card overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: active?.color }}/>
                    <span className="text-sm font-bold text-white">{active?.name}</span>
                    <span className="badge-slate text-xs">{active?.channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {Object.keys(overrides).length > 0 && (
                      <button onClick={() => setOverrides({})}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                        <X size={11}/> Overrides zurücksetzen
                      </button>
                    )}
                    <Button size="sm" icon={<Download size={12}/>} variant="secondary"
                      onClick={() => window.api.calc.exportCSV(activeProfileId, overrides).then(() => toast.success('CSV exportiert'))}>
                      CSV
                    </Button>
                    <Button size="sm" icon={<Plus size={12}/>}
                      onClick={() => { setEditingStep(undefined); setShowStepModal(true) }}>
                      Schritt
                    </Button>
                  </div>
                </div>

                {/* Schritte */}
                {steps.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-slate-500 text-sm mb-3">Noch keine Schritte</p>
                    <Button size="sm" icon={<Plus size={12}/>}
                      onClick={() => { setEditingStep(undefined); setShowStepModal(true) }}>
                      Ersten Schritt hinzufügen
                    </Button>
                  </div>
                ) : steps.map(step => {
                  const res = calcResult?.steps.find(r => r.step.id === step.id)
                  return (
                    <StepRow key={step.id} step={step} result={res}
                      overrides={overrides} onOverride={handleOverride}
                      onEdit={s => { setEditingStep(s); setShowStepModal(true) }}
                      onDelete={id => deleteStep.mutate(id)}/>
                  )
                })}

                {/* Add Button unten */}
                {steps.length > 0 && (
                  <div className="px-4 py-3 border-t border-white/5">
                    <button onClick={() => { setEditingStep(undefined); setShowStepModal(true) }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      style={{ border: '1px dashed rgb(255 255 255 / 0.08)' }}>
                      <Plus size={12}/> Schritt hinzufügen
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Live-Preview Panel */}
            {calcResult && (
              <div className="w-52 shrink-0 space-y-3">
                {/* Haupt-KPIs */}
                <div className="glass-card p-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ergebnis</p>

                  <div>
                    <p className="text-xs text-slate-500">Ausgangswert</p>
                    <p className="text-lg font-bold text-slate-200">{fmt(calcResult.base, calcResult.currency)}</p>
                  </div>
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-xs text-slate-500">Endwert</p>
                    <p className="text-2xl font-black text-white">{fmt(calcResult.final, calcResult.currency)}</p>
                  </div>
                </div>

                {/* Marge */}
                <div className="glass-card p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marge</p>
                  {calcResult.margin != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Marge %</span>
                      <span className={`text-sm font-bold ${calcResult.margin >= 20 ? 'text-emerald-400' : calcResult.margin >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                        {calcResult.margin.toFixed(1)} %
                      </span>
                    </div>
                  )}
                  {calcResult.markup != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Aufschlag</span>
                      <span className="text-sm font-semibold text-slate-300">
                        {calcResult.markup.toFixed(1)} %
                      </span>
                    </div>
                  )}
                  {calcResult.base > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Marge</span>
                        <span>{calcResult.margin?.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(Math.max(calcResult.margin ?? 0, 0), 100)}%`,
                            background: (calcResult.margin ?? 0) >= 20 ? '#10b981' : (calcResult.margin ?? 0) >= 10 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Schritt-Breakdown */}
                <div className="glass-card p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Aufbau</p>
                  <div className="space-y-1">
                    {calcResult.steps.filter(s => s.delta !== 0 || s.step.is_subtotal || s.step.is_result).map(s => (
                      <div key={s.step.id} className="flex items-center justify-between text-xs">
                        <span className={`truncate mr-2 ${s.step.is_result ? 'font-bold text-white' : s.step.is_subtotal ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
                          {s.step.label}
                        </span>
                        <span className={`shrink-0 font-mono ${
                          s.step.is_result ? 'font-bold text-white' :
                          s.step.is_subtotal ? 'text-slate-300' :
                          s.delta < 0 ? 'text-red-400' : s.delta > 0 ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {s.step.is_subtotal || s.step.is_result
                            ? fmt(s.running, calcResult.currency)
                            : (s.delta > 0 ? '+' : '') + fmt(s.delta, calcResult.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Vergleichsansicht ──────────────────────────────── */}
      {showCompare && compareIds.length >= 2 && compareResults && (
        <div className="mt-6 glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Profilvergleich</h3>
            <button onClick={() => setShowCompare(false)} className="btn-ghost p-1"><X size={14}/></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="table-th w-40">Kennzahl</th>
                  {compareIds.map(pid => {
                    const p = profiles.find(x => x.id === pid)
                    return (
                      <th key={pid} className="table-th text-right">
                        <span className="flex items-center justify-end gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p?.color }}/>
                          {p?.name}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {(['base','final','margin','markup'] as const).map(key => (
                  <tr key={key} className="table-row">
                    <td className="table-td text-slate-500 capitalize">
                      {key === 'base'   ? 'Ausgangswert' :
                       key === 'final'  ? 'Endwert' :
                       key === 'margin' ? 'Marge %' : 'Aufschlag %'}
                    </td>
                    {compareIds.map(pid => {
                      const r = compareResults[pid]
                      const v = r?.[key]
                      const isBest = key === 'margin' || key === 'markup'
                        ? compareIds.every(oid => (compareResults[oid]?.[key] ?? -Infinity) <= (v ?? -Infinity))
                        : false
                      return (
                        <td key={pid} className="table-td text-right font-mono">
                          <span className={isBest ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                            {v == null ? '–' :
                             key === 'margin' || key === 'markup' ? `${v.toFixed(1)} %` :
                             fmt(v, r?.currency)}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProfileModal && (
        <ProfileModal
          profile={editingProfile}
          onSave={d => editingProfile
            ? updateProfile.mutate({ id: editingProfile.id, d })
            : createProfile.mutate(d)}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showStepModal && activeProfileId && (
        <StepModal
          step={editingStep}
          profileId={activeProfileId}
          onSave={d => saveStep.mutate(d)}
          onClose={() => setShowStepModal(false)}
        />
      )}
      <ConfirmDialog
        open={!!deletingProfile}
        title="Profil löschen?"
        message={`"${deletingProfile?.name}" und alle Schritte wirklich löschen?`}
        onConfirm={() => deletingProfile && deleteProfile.mutate(deletingProfile.id)}
        onCancel={() => setDeletingProfile(undefined)}
        loading={deleteProfile.isPending}
      />
    </div>
  )
}
