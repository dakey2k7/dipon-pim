import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Percent, Calendar, Truck } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Button }        from '@/components/ui/Input'
import { useToast }      from '@/hooks/useToast'

interface Condition {
  id: number; supplier_id: number; type: string; label: string
  value_pct: number; payment_days: number | null; min_order_value: number | null
  valid_from: string | null; valid_until: string | null; notes: string | null
}

const CONDITION_TYPES = [
  { value:'skonto',   label:'💳 Skonto (Zahlungsrabatt)', icon:'💳' },
  { value:'discount', label:'% Genereller Rabatt',        icon:'%'  },
  { value:'volume',   label:'📦 Mengenrabatt',             icon:'📦' },
  { value:'loyalty',  label:'⭐ Treuerabatt',              icon:'⭐' },
]

const TYPE_COLORS: Record<string, string> = {
  skonto: '#06b6d4', discount: '#10b981', volume: '#f59e0b', loyalty: '#8b5cf6',
}

const EMPTY = { type:'skonto', label:'', value_pct:'', payment_days:'', min_order_value:'', valid_from:'', valid_until:'', notes:'' }

export function SupplierConditions({ supplierId }: { supplierId: number }) {
  const qc    = useQueryClient()
  const toast = useToast()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<number|null>(null)

  const { data: conditions = [] } = useQuery<Condition[]>({
    queryKey: ['sup-conditions', supplierId],
    queryFn:  () => window.api.suppliers.getConditions(supplierId) as Promise<Condition[]>,
  })
  const inv = () => qc.invalidateQueries({ queryKey: ['sup-conditions', supplierId] })

  const saveMut = useMutation({
    mutationFn: (d: unknown) => window.api.suppliers.saveCondition(supplierId, d),
    onSuccess: () => { inv(); setShowForm(false); setForm(EMPTY); setEditId(null); toast.success('Kondition gespeichert') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const delMut = useMutation({
    mutationFn: (id: number) => window.api.suppliers.deleteCondition(id),
    onSuccess: inv,
  })

  const set = (k: string, v: string) => setForm(f => ({...f, [k]: v}))

  const handleSave = () => {
    if (!form.label.trim() || !form.value_pct) { toast.error('Label und Wert erforderlich'); return }
    saveMut.mutate({
      id: editId,
      type: form.type,
      label: form.label,
      value_pct: Number(form.value_pct),
      payment_days: form.payment_days ? Number(form.payment_days) : null,
      min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      notes: form.notes || null,
    })
  }

  const startEdit = (c: Condition) => {
    setEditId(c.id)
    setForm({
      type: c.type, label: c.label, value_pct: String(c.value_pct),
      payment_days: c.payment_days != null ? String(c.payment_days) : '',
      min_order_value: c.min_order_value != null ? String(c.min_order_value) : '',
      valid_from: c.valid_from ?? '', valid_until: c.valid_until ?? '', notes: c.notes ?? '',
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-3">
      {/* Liste */}
      {conditions.length > 0 && (
        <div className="space-y-2">
          {conditions.map(c => {
            const color = TYPE_COLORS[c.type] ?? '#64748b'
            return (
              <div key={c.id}
                className="flex items-center justify-between p-3 rounded-xl group"
                style={{ background: `${color}0d`, border: `1px solid ${color}25` }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: `${color}20`, color }}>
                    {c.type === 'skonto' ? '💳' : c.type === 'volume' ? '📦' : '%'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{c.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.type === 'skonto' && c.payment_days != null && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar size={10}/> innerhalb {c.payment_days} Tagen
                        </span>
                      )}
                      {c.min_order_value != null && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Truck size={10}/> ab {c.min_order_value} €
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black" style={{ color }}>
                    {c.value_pct % 1 === 0
                      ? `${c.value_pct.toFixed(0)} %`
                      : `${c.value_pct.toFixed(2)} %`}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn-ghost p-1.5 text-xs"
                      onClick={() => startEdit(c)}>✎</button>
                    <button className="btn-ghost p-1.5 text-red-400"
                      onClick={() => delMut.mutate(c.id)}><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formular */}
      {showForm ? (
        <div className="p-4 rounded-xl space-y-3"
          style={{ background: 'rgb(139 92 246 / 0.05)', border: '1px solid rgb(139 92 246 / 0.2)' }}>
          <p className="text-xs font-bold text-brand-400 uppercase tracking-wider">
            {editId ? 'Kondition bearbeiten' : 'Neue Kondition'}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Typ" value={form.type} onChange={e => set('type', e.target.value)}>
              {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Input label="Bezeichnung *" value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="z.B. Skonto 14 Tage"/>
            <Input label="Rabatt % *" type="number" step="0.01" min="0" max="100"
              value={form.value_pct}
              onChange={e => set('value_pct', e.target.value)}
              placeholder="z.B. 2.5"/>
            {form.type === 'skonto' && (
              <Input label="Zahlungsziel (Tage)" type="number" min="0"
                value={form.payment_days}
                onChange={e => set('payment_days', e.target.value)}
                placeholder="z.B. 14"/>
            )}
            {(form.type === 'volume' || form.type === 'discount') && (
              <Input label="Ab Bestellwert (€)" type="number" step="0.01"
                value={form.min_order_value}
                onChange={e => set('min_order_value', e.target.value)}
                placeholder="optional"/>
            )}
            <Input label="Gültig ab" type="date" value={form.valid_from}
              onChange={e => set('valid_from', e.target.value)}/>
            <Input label="Gültig bis" type="date" value={form.valid_until}
              onChange={e => set('valid_until', e.target.value)}/>
          </div>
          <Input label="Notiz" value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Interne Anmerkung …"/>
          <div className="flex gap-2 pt-1">
            <Button loading={saveMut.isPending} onClick={handleSave}>Speichern</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setForm(EMPTY); setEditId(null) }}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs text-slate-500
            hover:text-slate-300 hover:border-white/10 transition-all"
          style={{ border: '1px dashed rgb(255 255 255 / 0.08)' }}>
          <Plus size={12}/> Rabatt oder Skonto hinzufügen
        </button>
      )}

      {/* Zusammenfassung */}
      {conditions.filter(c => c.type === 'skonto').length > 0 && (
        <div className="p-3 rounded-xl text-xs" style={{ background: 'rgb(6 182 212 / 0.08)', border: '1px solid rgb(6 182 212 / 0.2)' }}>
          <p className="text-cyan-400 font-semibold mb-1.5">Skonto-Zusammenfassung</p>
          {conditions.filter(c => c.type === 'skonto').map(c => (
            <p key={c.id} className="text-slate-400">
              {c.payment_days != null ? `${c.payment_days} Tage` : 'Sofort'}: <strong className="text-white">{c.value_pct} %</strong>
              {c.label ? ` — ${c.label}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
