/**
 * PaymentProfilesPage — Payment-Provider + Gebührenprofile
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, Plus, Pencil, Trash2, Check, X,
  ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog, Spinner } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

const PROVIDER_COLORS = ['#003087','#000000','#6772e5','#ffb3c7','#003399','#1a1a2e','#e67e22','#16a085']

function FeeRow({ fee, onSave, onDelete }: { fee: any; onSave:(d:any)=>void; onDelete:()=>void }) {
  const [editing, setEditing] = useState(!fee.id)
  const [form, setForm] = useState({
    method_code:  fee.method_code  ?? 'standard',
    method_label: fee.method_label ?? '',
    fee_fixed_eur:fee.fee_fixed_eur?? 0,
    fee_pct:      fee.fee_pct      ?? 0,
    valid_from:   fee.valid_from   ?? new Date().toISOString().slice(0,10),
    notes:        fee.notes        ?? '',
  })
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const fmtFee = (fixed: number, pct: number) => {
    const parts = []
    if (pct > 0) parts.push(`${pct}%`)
    if (fixed > 0) parts.push(`+ ${Number(fixed).toFixed(2).replace('.',',')} €`)
    return parts.length ? parts.join(' ') : '0 €'
  }

  if (!editing) return (
    <div className="flex items-center px-4 py-2.5 group hover:bg-white/2 transition-colors"
      style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{fee.method_label || fee.method_code}</p>
        <p className="text-[10px] font-mono text-slate-500">{fee.method_code}</p>
      </div>
      <div className="w-32 text-right">
        <p className="text-sm font-bold font-mono text-white">{fmtFee(fee.fee_fixed_eur, fee.fee_pct)}</p>
        <p className="text-[10px] text-slate-600">ab {fee.valid_from?.slice(0,10)}</p>
      </div>
      {fee.notes && <p className="text-xs text-slate-600 ml-4 max-w-32 truncate">{fee.notes}</p>}
      <div className="flex gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEditing(true)} className="btn-ghost p-1 text-slate-400"><Pencil size={11}/></button>
        <button onClick={onDelete} className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
      </div>
    </div>
  )

  return (
    <div className="grid gap-2 px-4 py-3" style={{ gridTemplateColumns:'1.5fr 2fr 1fr 1fr 1.5fr auto', background:'rgba(99,102,241,0.05)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
      <input className="form-input text-xs" placeholder="Code" value={form.method_code} onChange={f('method_code')}/>
      <input className="form-input text-xs" placeholder="Bezeichnung" value={form.method_label} onChange={f('method_label')}/>
      <div className="flex items-center gap-1">
        <input type="number" step="0.01" className="form-input text-xs w-full font-mono" placeholder="% Geb." value={form.fee_pct} onChange={f('fee_pct')}/>
        <span className="text-xs text-slate-600 shrink-0">%</span>
      </div>
      <div className="flex items-center gap-1">
        <input type="number" step="0.01" className="form-input text-xs w-full font-mono" placeholder="Fix €" value={form.fee_fixed_eur} onChange={f('fee_fixed_eur')}/>
        <span className="text-xs text-slate-600 shrink-0">€</span>
      </div>
      <input type="date" className="form-input text-xs" value={form.valid_from} onChange={f('valid_from')}/>
      <div className="flex gap-1">
        <button onClick={() => { onSave({ ...fee, ...form, fee_fixed_eur:Number(form.fee_fixed_eur), fee_pct:Number(form.fee_pct) }); setEditing(false) }}
          className="btn-ghost p-1.5 text-emerald-400"><Check size={12}/></button>
        {fee.id && <button onClick={() => setEditing(false)} className="btn-ghost p-1.5 text-slate-500"><X size={12}/></button>}
      </div>
    </div>
  )
}

function ProviderCard({ provider }: { provider: any }) {
  const qc   = useQueryClient()
  const toast = useToast()
  const [open,    setOpen]    = useState(false)
  const [newFee,  setNewFee]  = useState(false)
  const [delConf, setDelConf] = useState(false)

  const { data: fees = [] } = useQuery<any[]>({
    queryKey: ['payment-fees', provider.id],
    queryFn:  () => window.api.payment.fees.list(provider.id) as Promise<any[]>,
    enabled: open,
  })

  const inv = () => qc.invalidateQueries({ queryKey:['payment-fees', provider.id] })
  const saveFee = useMutation({
    mutationFn: (d: any) => window.api.payment.fees.save(d),
    onSuccess: () => { inv(); setNewFee(false); toast.success('Gespeichert') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const delFee = useMutation({
    mutationFn: (id: number) => window.api.payment.fees.delete(id),
    onSuccess: inv,
  })
  const delProvider = useMutation({
    mutationFn: (id: number) => window.api.payment.providers.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['payment-providers'] }); toast.success('Gelöscht') },
  })

  // Berechne Beispiel-Gebühr für 50 €
  const ex = (fees as any[]).find((f: any) => !f.valid_to || f.valid_to >= new Date().toISOString().slice(0,10))
  const exFee = ex ? (50 * ex.fee_pct / 100 + Number(ex.fee_fixed_eur)).toFixed(2) : null

  return (
    <div className="glass-card overflow-hidden mb-3" style={{ borderColor:`${provider.color}20` }}>
      {/* Header */}
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/2 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
          style={{ background:`linear-gradient(135deg,${provider.color},${provider.color}99)`, boxShadow:`0 0 12px ${provider.color}40` }}>
          {provider.name.slice(0,2)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white">{provider.name}</p>
            <span className="text-[10px] font-mono text-slate-500">{provider.code}</span>
            {provider.website && (
              <a href={provider.website} target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-slate-600 hover:text-slate-300">
                <ExternalLink size={10}/>
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {provider.method_count} Zahlungsmethoden
            {exFee && <span className="ml-2 text-slate-600">· Beispiel 50 €: <span className="font-mono text-slate-400">{exFee} € Geb.</span></span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={e => { e.stopPropagation(); setDelConf(true) }}
            className="btn-ghost p-1.5 text-red-400"><Trash2 size={12}/></button>
          {open ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}
        </div>
      </div>

      {/* Gebührentabelle */}
      {open && (
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          {/* Spalten-Header */}
          <div className="grid px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600"
            style={{ gridTemplateColumns:'1.5fr 2fr 1fr 1fr 1.5fr auto', background:'rgba(255,255,255,0.02)' }}>
            <span>Code</span><span>Bezeichnung</span><span>%</span><span>Fix €</span><span>Gültig ab</span><span/>
          </div>

          {(fees as any[]).map((fee: any) => (
            <FeeRow key={fee.id} fee={fee}
              onSave={d => saveFee.mutate(d)}
              onDelete={() => delFee.mutate(fee.id)}/>
          ))}

          {newFee && (
            <FeeRow fee={{ provider_id: provider.id }}
              onSave={d => saveFee.mutate({ ...d, provider_id: provider.id })}
              onDelete={() => setNewFee(false)}/>
          )}

          {!(fees as any[]).length && !newFee && (
            <p className="text-xs text-slate-600 italic px-4 py-3">Noch keine Gebühren hinterlegt</p>
          )}

          <button onClick={() => setNewFee(true)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
            style={{ borderTop:'1px dashed rgba(255,255,255,0.06)' }}>
            <Plus size={11}/> Zahlungsmethode hinzufügen
          </button>
        </div>
      )}

      <ConfirmDialog open={delConf} title="Provider löschen?"
        message={`"${provider.name}" und alle Gebühren wirklich entfernen?`}
        onConfirm={() => delProvider.mutate(provider.id)}
        onCancel={() => setDelConf(false)} loading={delProvider.isPending}/>
    </div>
  )
}

export default function PaymentProfilesPage() {
  const qc   = useQueryClient()
  const toast = useToast()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ name:'', code:'', website:'', color: PROVIDER_COLORS[0] })

  const { data: providers = [], isLoading } = useQuery<any[]>({
    queryKey: ['payment-providers'],
    queryFn:  () => window.api.payment.providers.list() as Promise<any[]>,
  })

  const createM = useMutation({
    mutationFn: (d: any) => window.api.payment.providers.save(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['payment-providers'] }); setShowModal(false); toast.success('Angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <CreditCard size={20} className="text-brand-400"/>
            Zahlungsprofile
          </h2>
          <p className="page-subtitle">
            PayPal, Mollie, Stripe & Co. · Gebühren nach Methode · versioniert
          </p>
        </div>
        <Button icon={<Plus size={14}/>} onClick={() => { setForm({name:'',code:'',website:'',color:PROVIDER_COLORS[0]}); setShowModal(true) }}>
          Provider hinzufügen
        </Button>
      </div>

      {!providers.length ? (
        <div className="glass-card p-12 text-center">
          <CreditCard size={48} className="text-slate-700 mx-auto mb-4"/>
          <p className="text-slate-400 font-semibold">Noch keine Payment-Provider</p>
          <p className="text-slate-600 text-sm mt-1">PayPal, Mollie und Stripe sind bereits vorausgefüllt nach Neustart</p>
        </div>
      ) : (
        <div>
          {(providers as any[]).map((p: any) => (
            <ProviderCard key={p.id} provider={p}/>
          ))}
        </div>
      )}

      {/* Info-Box */}
      <div className="glass-card p-4 mt-4 text-xs text-slate-500"
        style={{ borderColor:'rgba(99,102,241,0.2)' }}>
        <p className="font-semibold text-slate-300 mb-1">💡 Gebühren-Berechnung</p>
        <p>Formel: <span className="font-mono text-slate-300">Gebühr = Betrag × (% / 100) + Fix-Betrag</span></p>
        <p className="mt-1">Beispiel PayPal: 50 € × 2,99% + 0,35 € = <span className="font-mono text-white">1,85 €</span></p>
        <p className="mt-1 text-slate-600">Gebühren fließen automatisch in die Margenkalkulation ein wenn ein Zahlungsprofil zugewiesen ist.</p>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Neuer Payment-Provider" size="sm">
        <div className="space-y-3">
          <Input label="Name *" value={form.name} autoFocus
            onChange={e => setForm(p => ({ ...p, name: e.target.value,
              code: p.code || e.target.value.toUpperCase().replace(/\s/g,'').slice(0,10)
            }))}/>
          <Input label="Code *" value={form.code}
            onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}/>
          <Input label="Website" value={form.website}
            onChange={e => setForm(p => ({ ...p, website: e.target.value }))}/>
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-semibold">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {PROVIDER_COLORS.map(col => (
                <button key={col} onClick={() => setForm(p => ({ ...p, color: col }))}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{ background:col, outline:form.color===col?'2px solid white':'none', outlineOffset:2 }}/>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Abbrechen</Button>
            <Button loading={createM.isPending} disabled={!form.name}
              onClick={() => createM.mutate(form)}>Anlegen</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
