/**
 * WettbewerbPage — Wettbewerber-Preispflege + Vergleichsansicht
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Swords, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  ExternalLink, TrendingUp, TrendingDown, Minus, Save, X
} from 'lucide-react'
import { Button, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog, Spinner } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

const safeNum = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n }
const eur = (v: unknown) => safeNum(v) > 0
  ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeNum(v)) + ' €'
  : '–'
const eur4 = (v: unknown) => safeNum(v) > 0
  ? new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(safeNum(v)) + ' €'
  : '–'

const COLORS = ['#ef4444','#f97316','#eab308','#10b981','#06b6d4','#6366f1','#a78bfa','#ec4899']

// ── Preis-Editor Zeile ─────────────────────────────────────────
function PriceRow({ price, onSave, onDelete }: {
  price: any; onSave: (d: any) => void; onDelete: (id: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    price_brutto: String(price.price_brutto).replace('.', ','),
    product_name: price.product_name || 'Standard',
    valid_from: price.valid_from || new Date().toISOString().slice(0, 10),
    url: price.url || '',
  })

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div className="border-t border-white/5">
      {!editing ? (
        <div className="flex items-center px-4 py-2.5 hover:bg-white/2 group transition-colors">
          <span className="w-20 font-bold text-white text-sm">
            {price.size_kg % 1 === 0 ? price.size_kg : price.size_kg.toFixed(2).replace('.', ',')} kg
          </span>
          <span className="flex-1 text-slate-400 text-xs">{price.product_name}</span>
          <span className="w-28 text-right font-mono font-bold text-white">{eur(price.price_brutto)}</span>
          <span className="w-28 text-right font-mono text-slate-400 text-xs">{eur4(price.price_per_kg)} /kg</span>
          <span className="w-24 text-right text-slate-600 text-xs">{price.valid_from?.slice(0,10) || '–'}</span>
          <div className="w-16 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="btn-ghost p-1 text-slate-400 hover:text-white">
              <Pencil size={11}/>
            </button>
            <button onClick={() => onDelete(price.id)} className="btn-ghost p-1 text-red-400">
              <Trash2 size={11}/>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(99,102,241,0.06)' }}>
          <span className="w-20 font-bold text-white text-sm">
            {price.size_kg % 1 === 0 ? price.size_kg : price.size_kg.toFixed(2).replace('.', ',')} kg
          </span>
          <input className="form-input text-xs w-28" placeholder="Preis Brutto" value={form.price_brutto}
            onChange={f('price_brutto')}/>
          <input className="form-input text-xs flex-1" placeholder="Produktname" value={form.product_name}
            onChange={f('product_name')}/>
          <input className="form-input text-xs w-28" type="date" value={form.valid_from}
            onChange={f('valid_from')}/>
          <button onClick={() => {
            onSave({ ...price, price_brutto: parseFloat(form.price_brutto.replace(',','.')),
              product_name: form.product_name, valid_from: form.valid_from, url: form.url })
            setEditing(false)
          }} className="btn-ghost p-1.5 text-emerald-400"><Save size={12}/></button>
          <button onClick={() => setEditing(false)} className="btn-ghost p-1.5 text-slate-500"><X size={12}/></button>
        </div>
      )}
    </div>
  )
}

// ── Wettbewerber-Karte ─────────────────────────────────────────
function CompetitorCard({ comp, onEdit, onDelete }: {
  comp: any; onEdit: (c: any) => void; onDelete: (id: number) => void
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [addSize, setAddSize] = useState('')
  const [addPrice, setAddPrice] = useState('')

  const { data: prices = [] } = useQuery<any[]>({
    queryKey: ['competitor-prices', comp.id],
    queryFn: () => window.api.competitors.prices.list(comp.id) as Promise<any[]>,
    enabled: open,
  })

  const invP = () => qc.invalidateQueries({ queryKey: ['competitor-prices', comp.id] })

  const savePrice = useMutation({
    mutationFn: (d: any) => window.api.competitors.prices.save(comp.id, d),
    onSuccess: () => { invP(); toast.success('Gespeichert') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const delPrice = useMutation({
    mutationFn: (id: number) => window.api.competitors.prices.delete(id),
    onSuccess: invP,
  })

  const handleAddPrice = () => {
    const size  = parseFloat(addSize.replace(',', '.'))
    const price = parseFloat(addPrice.replace(',', '.'))
    if (!size || !price) return
    savePrice.mutate({ size_kg: size, price_brutto: price })
    setAddSize(''); setAddPrice('')
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/2 transition-colors"
        onClick={() => setOpen(v => !v)}>
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: comp.color }}/>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-white text-sm">{comp.name}</p>
            <span className="text-xs font-mono text-slate-500">{comp.code}</span>
            {comp.website && (
              <a href={comp.website} target="_blank" rel="noreferrer"
                className="text-slate-600 hover:text-slate-300 transition-colors"
                onClick={e => e.stopPropagation()}>
                <ExternalLink size={10}/>
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{comp.price_count || 0} Preiseinträge</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(comp) }}
            className="btn-ghost p-1.5 text-slate-400 hover:text-white">
            <Pencil size={12}/>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(comp.id) }}
            className="btn-ghost p-1.5 text-red-400">
            <Trash2 size={12}/>
          </button>
          {open ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-500"/>}
        </div>
      </div>

      {/* Preisliste */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Tabellen-Header */}
          <div className="flex items-center px-4 py-2 text-[10px] uppercase tracking-wider text-slate-600"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <span className="w-20">Größe</span>
            <span className="flex-1">Produkt</span>
            <span className="w-28 text-right">Brutto</span>
            <span className="w-28 text-right">€ / KG</span>
            <span className="w-24 text-right">Gültig ab</span>
            <span className="w-16"/>
          </div>

          {!prices.length && (
            <p className="px-4 py-3 text-xs text-slate-600 italic">Noch keine Preiseinträge</p>
          )}
          {prices.map((p: any) => (
            <PriceRow key={p.id} price={p}
              onSave={d => savePrice.mutate(d)}
              onDelete={id => delPrice.mutate(id)}/>
          ))}

          {/* Preis hinzufügen */}
          <div className="flex items-center gap-2 px-4 py-3"
            style={{ borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-slate-500 shrink-0">+ Größe:</span>
            <input className="form-input text-xs w-20" placeholder="z.B. 1,5"
              value={addSize} onChange={e => setAddSize(e.target.value)}/>
            <span className="text-xs text-slate-500 shrink-0">kg Preis Brutto:</span>
            <input className="form-input text-xs w-24" placeholder="z.B. 24,99"
              value={addPrice} onChange={e => setAddPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPrice()}/>
            <button onClick={handleAddPrice}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
              style={{ background: `${comp.color}30`, border: `1px solid ${comp.color}50` }}>
              Hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────
export default function WettbewerbPage() {
  const qc = useQueryClient()
  const toast = useToast()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', code: '', website: '', color: COLORS[0], notes: '' })

  const { data: competitors = [], isLoading } = useQuery<any[]>({
    queryKey: ['competitors'],
    queryFn: () => window.api.competitors.list() as Promise<any[]>,
  })

  const inv = () => qc.invalidateQueries({ queryKey: ['competitors'] })

  const createM = useMutation({
    mutationFn: (d: any) => window.api.competitors.create(d),
    onSuccess: () => { inv(); setShowNew(false); toast.success('Wettbewerber angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })
  const updateM = useMutation({
    mutationFn: ({ id, d }: any) => window.api.competitors.update(id, d),
    onSuccess: () => { inv(); setEditing(null); toast.success('Gespeichert') },
  })
  const deleteM = useMutation({
    mutationFn: (id: number) => window.api.competitors.delete(id),
    onSuccess: () => { inv(); setDeleting(null); toast.success('Gelöscht') },
  })

  const activeForm = editing || form
  const setActiveForm = editing
    ? (fn: any) => setEditing((p: any) => ({ ...p, ...fn(p) }))
    : (fn: any) => setForm((p: any) => ({ ...p, ...fn(p) }))

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header mb-5">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Swords size={20} className="text-red-400"/>
            Wettbewerb
          </h2>
          <p className="page-subtitle">
            {competitors.length} Wettbewerber · Preisvergleich direkt in der Preistabelle sichtbar
          </p>
        </div>
        <Button icon={<Plus size={14}/>} onClick={() => { setShowNew(true); setEditing(null) }}>
          Wettbewerber anlegen
        </Button>
      </div>

      {/* Karten */}
      {!competitors.length ? (
        <div className="glass-card p-12 text-center">
          <Swords size={48} className="text-slate-700 mx-auto mb-4"/>
          <p className="text-slate-400 font-semibold">Noch keine Wettbewerber</p>
          <p className="text-slate-600 text-sm mt-1">Epodex, Dipoxy und andere sind bereits in der DB vorausgefüllt</p>
          <Button className="mt-4" icon={<Plus size={14}/>} onClick={() => setShowNew(true)}>
            Ersten anlegen
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c: any) => (
            <CompetitorCard key={c.id} comp={c}
              onEdit={c => { setEditing(c); setShowNew(true) }}
              onDelete={id => setDeleting(id)}/>
          ))}
        </div>
      )}

      {/* Modal: Anlegen / Bearbeiten */}
      <Modal
        open={showNew || !!editing}
        onClose={() => { setShowNew(false); setEditing(null) }}
        title={editing ? `Bearbeiten — ${editing.name}` : 'Neuer Wettbewerber'}
        size="sm"
      >
        <div className="space-y-3">
          <Input label="Name *" value={activeForm.name}
            onChange={e => setActiveForm((p: any) => ({ ...p, name: e.target.value,
              code: editing ? p.code : e.target.value.toUpperCase().replace(/\s+/g,'').slice(0,8) }))}
            autoFocus/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code" value={activeForm.code}
              onChange={e => setActiveForm((p: any) => ({ ...p, code: e.target.value.toUpperCase() }))}/>
            <Input label="Website" value={activeForm.website}
              onChange={e => setActiveForm((p: any) => ({ ...p, website: e.target.value }))}/>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-2 block">Farbe</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} onClick={() => setActiveForm((p: any) => ({ ...p, color: c }))}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{ background: c, outline: activeForm.color === c ? `2px solid white` : 'none', outlineOffset: 2 }}/>
              ))}
            </div>
          </div>
          <Input label="Notizen" value={activeForm.notes}
            onChange={e => setActiveForm((p: any) => ({ ...p, notes: e.target.value }))}/>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setShowNew(false); setEditing(null) }}>Abbrechen</Button>
            <Button
              loading={createM.isPending || updateM.isPending}
              disabled={!activeForm.name}
              onClick={() => {
                if (editing) updateM.mutate({ id: editing.id, d: activeForm })
                else createM.mutate(activeForm)
              }}
            >
              {editing ? 'Speichern' : 'Anlegen'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Wettbewerber löschen?"
        message="Alle Preiseinträge werden ebenfalls gelöscht."
        onConfirm={() => deleting && deleteM.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        loading={deleteM.isPending}
      />
    </div>
  )
}
