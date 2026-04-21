import React, { useState } from 'react'
import { useNavigate }     from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Pencil, Trash2, Search, Package, Layers, Plus,
  FlaskConical, ArrowRight, Save, X,
} from 'lucide-react'
import { useToast }     from '@/hooks/useToast'
import { Button }       from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }        from '@/components/ui/Modal'
import {
  Spinner, EmptyState, ConfirmDialog, SkeletonList, SkeletonCard,
} from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────
interface ProductGroup { id: number; name: string; code: string; color: string }
interface Product {
  id: number; name: string; code: string
  product_group_id: number | null; group_name?: string; group_color?: string
  batch_size: number; batch_unit: string; overhead_factor: number
  material_count?: number; variant_count?: number
}
interface ProductVariant {
  id: number; name: string; code: string; sku?: string; ean?: string
  fill_quantity: number; fill_unit: string
  packaging_name?: string; packaging_price?: number; packaging_item_id?: number | null
  label_name?: string;    label_price?: number;    label_item_id?: number | null
  carton_name?: string;   carton_price?: number;   carton_item_id?: number | null
  units_per_carton: number; extra_cost: number; extra_cost_note?: string
}
interface VariantCost {
  total_cost: number; material_cost: number; packaging_cost: number
  label_cost: number; carton_cost: number; extra_cost: number; price_per_kg: number
}

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)

const GROUP_COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']

const EMPTY_VARIANT = {
  name: '', code: '', sku: '', ean: '',
  fill_quantity: '', fill_unit: 'kg',
  packaging_item_id: '', label_item_id: '', carton_item_id: '',
  units_per_carton: 1, extra_cost: 0, extra_cost_note: '',
}

// ── Kostenanzeige pro Variante ────────────────────────────────
function VariantCostCard({ variantId }: { variantId: number }) {
  const { data: cost } = useQuery<VariantCost>({
    queryKey: ['variant-cost', variantId],
    queryFn:  () => window.api.products.calcVariantCost(variantId) as Promise<VariantCost>,
    staleTime: 60_000,
  })
  if (!cost) return <span className="text-xs text-slate-600">Berechne …</span>
  return (
    <div className="text-xs space-y-1 mt-2 pt-2 border-t border-white/6">
      {cost.material_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Rohstoff</span>
          <span className="font-mono text-slate-300">{fmt(cost.material_cost)}</span>
        </div>
      )}
      {cost.packaging_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Verpackung</span>
          <span className="font-mono text-slate-300">{fmt(cost.packaging_cost)}</span>
        </div>
      )}
      {cost.label_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Etikett</span>
          <span className="font-mono text-slate-300">{fmt(cost.label_cost)}</span>
        </div>
      )}
      {cost.carton_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Karton (ant.)</span>
          <span className="font-mono text-slate-300">{fmt(cost.carton_cost)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold pt-1 border-t border-white/6">
        <span className="text-slate-300">EK gesamt</span>
        <span className="font-mono text-white">{fmt(cost.total_cost)}</span>
      </div>
      {cost.price_per_kg > 0 && (
        <div className="flex justify-between text-slate-500">
          <span>€ / kg</span>
          <span className="font-mono">{cost.price_per_kg.toFixed(4).replace('.', ',')} €</span>
        </div>
      )}
    </div>
  )
}

// ── Varianten-Modal (Anlegen + Bearbeiten) ────────────────────
function VariantModal({
  productId, variant, packaging, labels, cartons, onClose, onSaved,
}: {
  productId: number; variant?: ProductVariant
  packaging: any[]; labels: any[]; cartons: any[]
  onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState(variant ? {
    name:             variant.name,
    code:             variant.code,
    sku:              variant.sku  || '',
    ean:              variant.ean  || '',
    fill_quantity:    String(variant.fill_quantity),
    fill_unit:        variant.fill_unit,
    packaging_item_id: String(variant.packaging_item_id || ''),
    label_item_id:    String(variant.label_item_id    || ''),
    carton_item_id:   String(variant.carton_item_id   || ''),
    units_per_carton: variant.units_per_carton,
    extra_cost:       variant.extra_cost,
    extra_cost_note:  variant.extra_cost_note || '',
  } : { ...EMPTY_VARIANT })

  const saveM = useMutation({
    mutationFn: (d: unknown) => window.api.products.saveVariant(productId, d),
    onSuccess: () => { onSaved(); onClose(); toast.success(variant ? 'Variante gespeichert' : 'Variante angelegt') },
    onError: (e: Error) => toast.error('Fehler', e.message),
  })

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <Modal open onClose={onClose} title={variant ? 'Variante bearbeiten' : 'Neue Variante'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Bezeichnung *" value={form.name} autoFocus
              onChange={e => setForm(p => ({
                ...p, name: e.target.value,
                code: variant ? p.code : e.target.value.toUpperCase().replace(/[\s,]/g, '-').slice(0, 16),
              }))}
              placeholder="z.B. 0,75 kg Set"
            />
          </div>
          <Input label="Code *" value={form.code} onChange={f('code')}
            placeholder="z.B. LC1-075KG"/>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Füllmenge *" type="number" step="0.001" value={form.fill_quantity}
              onChange={f('fill_quantity')} placeholder="z.B. 0.75"/>
            <Select label="Einheit" value={form.fill_unit} onChange={f('fill_unit')}>
              {['kg','g','l','ml','stk'].map(u => <option key={u}>{u}</option>)}
            </Select>
          </div>
          <Input label="EAN" value={form.ean} onChange={f('ean')} placeholder="Barcode"/>
          <Input label="SKU" value={form.sku} onChange={f('sku')} placeholder="Artikel-Nr."/>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select label="Verpackung" value={form.packaging_item_id} onChange={f('packaging_item_id')}>
            <option value="">– keine –</option>
            {packaging.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.price_per_unit || 0} €)</option>
            ))}
          </Select>
          <Select label="Etikett" value={form.label_item_id} onChange={f('label_item_id')}>
            <option value="">– kein –</option>
            {labels.map((l: any) => (
              <option key={l.id} value={l.id}>{l.name} ({l.price_per_unit || 0} €)</option>
            ))}
          </Select>
          <Select label="Karton" value={form.carton_item_id} onChange={f('carton_item_id')}>
            <option value="">– kein –</option>
            {cartons.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} ({c.price_per_unit || 0} €)</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Stk/Karton" type="number" min="1"
            value={form.units_per_carton}
            onChange={e => setForm(p => ({ ...p, units_per_carton: Number(e.target.value) }))}/>
          <Input label="Zusatzkosten €" type="number" step="0.01"
            value={form.extra_cost}
            onChange={e => setForm(p => ({ ...p, extra_cost: Number(e.target.value) }))}/>
          <Input label="Notiz Zusatzkosten" value={form.extra_cost_note} onChange={f('extra_cost_note')}/>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} icon={<X size={13}/>}>Abbrechen</Button>
          <Button
            loading={saveM.isPending}
            disabled={!form.name || !form.code || !form.fill_quantity}
            icon={<Save size={13}/>}
            onClick={() => saveM.mutate({
              ...(variant ? { id: variant.id } : {}),
              name:              form.name,
              code:              form.code.toUpperCase(),
              sku:               form.sku  || null,
              ean:               form.ean  || null,
              fill_quantity:     Number(form.fill_quantity),
              fill_unit:         form.fill_unit,
              packaging_item_id: form.packaging_item_id ? Number(form.packaging_item_id) : null,
              label_item_id:     form.label_item_id     ? Number(form.label_item_id)     : null,
              carton_item_id:    form.carton_item_id    ? Number(form.carton_item_id)    : null,
              units_per_carton:  form.units_per_carton,
              extra_cost:        form.extra_cost,
              extra_cost_note:   form.extra_cost_note || null,
            })}
          >
            {variant ? 'Speichern' : 'Anlegen'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Produktgruppen-Modal ───────────────────────────────────────
function GroupModal({ group, onSave, onClose }: {
  group?: ProductGroup; onSave: (d: unknown) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ name: group?.name ?? '', code: group?.code ?? '', color: group?.color ?? '#8b5cf6' })
  return (
    <Modal open onClose={onClose} title={group ? 'Gruppe bearbeiten' : 'Neue Produktgruppe'} size="sm">
      <div className="space-y-4">
        <Input label="Name *" value={form.name} autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
        <Input label="Code *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}/>
        <div>
          <label className="form-label">Farbe</label>
          <div className="flex gap-2 mt-1.5">
            {GROUP_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-white/50 scale-110' : 'opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c }}/>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={() => onSave({ ...group, ...form })}>{group ? 'Speichern' : 'Anlegen'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Hauptseite ─────────────────────────────────────────────────
export default function ProductsPage() {
  const nav   = useNavigate()
  const qc    = useQueryClient()
  const toast = useToast()

  const [tab,            setTab]            = useState<'products' | '2k'>('products')
  const [show2kModal,    setShow2kModal]    = useState(false)
  const [search,         setSearch]         = useState('')
  const [filterGroup,    setFilterGroup]    = useState<number | null>(null)
  const [selectedProduct,setSelectedProduct]= useState<number | null>(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup,   setEditingGroup]   = useState<ProductGroup | undefined>()
  const [showVariantModal,  setShowVariantModal]   = useState(false)
  const [editingVariant,    setEditingVariant]     = useState<ProductVariant | undefined>()
  const [deletingProduct,   setDeletingProduct]    = useState<Product | undefined>()
  const [deletingVariant,   setDeletingVariant]    = useState<ProductVariant | undefined>()
  const [showGenerator,     setShowGenerator]     = useState(false)
  const [showCopyModal,     setShowCopyModal]     = useState(false)

  const { data: groups = [] } = useQuery<ProductGroup[]>({
    queryKey: ['product-groups'],
    queryFn:  () => window.api.productGroups.list() as Promise<ProductGroup[]>,
  })
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search, filterGroup],
    queryFn:  () => window.api.products.list({ search: search || undefined, group_id: filterGroup || undefined }) as Promise<Product[]>,
  })
  const { data: productDetail } = useQuery({
    queryKey: ['product-detail', selectedProduct],
    queryFn:  () => selectedProduct ? window.api.products.get(selectedProduct) : null,
    enabled:  !!selectedProduct,
  })
  const { data: packaging = [] } = useQuery<any[]>({ queryKey: ['packaging'], queryFn: () => window.api.packaging.list() as Promise<any[]> })
  const { data: labels    = [] } = useQuery<any[]>({ queryKey: ['labels'],    queryFn: () => window.api.labels.list()    as Promise<any[]> })
  const { data: cartons   = [] } = useQuery<any[]>({ queryKey: ['cartons'],   queryFn: () => window.api.cartons.list()   as Promise<any[]> })

  const invGroups   = () => qc.invalidateQueries({ queryKey: ['product-groups'] })
  const invProducts = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['product-detail', selectedProduct] })
  }

  const createGroup = useMutation({ mutationFn: (d: unknown) => window.api.productGroups.create(d), onSuccess: () => { invGroups(); setShowGroupModal(false); toast.success('Gruppe angelegt') }, onError: (e: Error) => toast.error('Fehler', e.message) })
  const updateGroup = useMutation({ mutationFn: ({ id, d }: { id: number; d: unknown }) => window.api.productGroups.update(id, d), onSuccess: () => { invGroups(); setShowGroupModal(false); toast.success('Gespeichert') }, onError: (e: Error) => toast.error('Fehler', e.message) })
  const deleteProd  = useMutation({ mutationFn: (id: number) => window.api.products.delete(id), onSuccess: () => { invProducts(); setDeletingProduct(undefined); setSelectedProduct(null); toast.success('Gelöscht') } })
  const deleteVar   = useMutation({ mutationFn: ({ vid }: { vid: number }) => window.api.products.deleteVariant(selectedProduct!, vid), onSuccess: () => { invProducts(); setDeletingVariant(undefined); toast.success('Variante gelöscht') } })

  const detail   = productDetail as { name?: string; code?: string; group_name?: string; variants?: ProductVariant[] } | null
  const variants = (detail?.variants ?? []) as ProductVariant[]

  if (isLoading) return (
    <div>
      <div className="page-header mb-4"><div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse"/></div>
      <div className="flex gap-4">
        <div className="w-72 space-y-2"><SkeletonList items={6}/></div>
        <div className="flex-1 space-y-3"><SkeletonCard/></div>
      </div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Produkte</h2>
          <p className="page-subtitle">{products.length} Produkte · {groups.length} Gruppen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Plus size={12}/>}
            onClick={() => { setEditingGroup(undefined); setShowGroupModal(true) }}>
            Gruppe
          </Button>
          {tab === '2k' && (
            <Button icon={<Plus size={14}/>} onClick={() => setShow2kModal(true)}>
              2K-Produkt anlegen
            </Button>
          )}
          {tab === 'products' && (
            <button
              onClick={() => nav('/recipes')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}
            >
              <FlaskConical size={14}/>
              Produkt anlegen → Rezepturen
              <ArrowRight size={13}/>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[{ id: 'products', l: 'Rezepturen / Komponenten' }, { id: '2k', l: '2K-Produkte' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === t.id ? 'bg-brand-500/20 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === '2k' && <Products2kTab externalOpen={show2kModal} onExternalOpenHandled={() => setShow2kModal(false)}/>}

      {tab === 'products' && (
        <div className="flex gap-4">
          {/* Linke Spalte */}
          <div className="w-72 shrink-0 space-y-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input className="form-input pl-9 text-sm w-full" placeholder="Produkt suchen …"
                value={search} onChange={e => setSearch(e.target.value)}/>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setFilterGroup(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${!filterGroup ? 'bg-brand-500/20 border-brand-500/30 text-white' : 'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}>
                Alle
              </button>
              {groups.map(g => (
                <button key={g.id} onClick={() => setFilterGroup(g.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${filterGroup === g.id ? 'text-white' : 'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}
                  style={filterGroup === g.id ? { backgroundColor: `${g.color}25`, borderColor: `${g.color}50`, color: 'white' } : {}}>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }}/>
                    {g.name}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {!products.length && (
                <div className="text-center py-8">
                  <Package size={32} className="text-slate-700 mx-auto mb-2"/>
                  <p className="text-slate-500 text-sm">Keine Produkte</p>
                  <button onClick={() => nav('/recipes')}
                    className="mt-2 text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mx-auto">
                    → Unter Rezepturen anlegen
                  </button>
                </div>
              )}
              {products.map(p => (
                <div key={p.id} onClick={() => setSelectedProduct(p.id)}
                  className={`glass-card p-3 cursor-pointer transition-all group ${selectedProduct === p.id ? 'border-brand-500/40' : 'hover:border-white/10'}`}
                  style={selectedProduct === p.id ? { borderColor: `${p.group_color || '#8b5cf6'}50`, boxShadow: `0 0 16px ${p.group_color || '#8b5cf6'}15` } : {}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.group_color || '#8b5cf6' }}/>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.code}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); nav('/recipes') }}
                        className="btn-ghost p-1 text-slate-400" title="In Rezepturen bearbeiten">
                        <Pencil size={11}/>
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeletingProduct(p) }}
                        className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    {p.group_name && <span className="text-xs text-slate-500">{p.group_name}</span>}
                    <span className="badge-blue text-[10px]">{p.variant_count ?? 0} Varianten</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rechte Spalte – nur Varianten */}
          {!selectedProduct ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Package size={48} className="text-slate-700 mx-auto mb-4"/>
                <p className="text-slate-400 font-semibold">Produkt auswählen</p>
                <p className="text-slate-600 text-sm mt-1">
                  Produkte anlegen: <button onClick={() => nav('/recipes')} className="text-brand-400 hover:text-brand-300">→ Rezepturen</button>
                </p>
              </div>
            </div>
          ) : !detail ? <Spinner/> : (
            <div className="flex-1 space-y-4">
              {/* Header — nur Name + Gruppe */}
              <div className="glass-card p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{detail.name}</h3>
                  {detail.group_name && (
                    <p className="text-sm text-slate-500 mt-0.5">{detail.group_name}</p>
                  )}
                </div>
                <button onClick={() => nav('/recipes')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                  <FlaskConical size={12}/>
                  Rezeptur bearbeiten
                  <ArrowRight size={11}/>
                </button>
              </div>

              {/* Varianten */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Layers size={14} className="text-cyan-400"/> Varianten
                    <span className="text-xs text-slate-500 font-normal">({variants.length})</span>
                  </h4>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" icon={<Plus size={12}/>}
                      onClick={() => setShowCopyModal(true)}
                      title="Varianten von anderem Produkt kopieren">
                      Kopieren
                    </Button>
                    <Button size="sm" variant="secondary"
                      onClick={() => setShowGenerator(true)}>
                      Generator
                    </Button>
                    <Button size="sm" icon={<Plus size={12}/>}
                      onClick={() => { setEditingVariant(undefined); setShowVariantModal(true) }}>
                      Variante anlegen
                    </Button>
                  </div>
                </div>

                {!variants.length ? (
                  <div className="text-center py-8">
                    <Layers size={28} className="text-slate-700 mx-auto mb-2"/>
                    <p className="text-slate-500 text-sm">Noch keine Varianten</p>
                    <p className="text-slate-600 text-xs mt-1">Lege Varianten mit Füllmenge, Verpackung und Etikett an</p>
                    <Button className="mt-3" size="sm" icon={<Plus size={12}/>}
                      onClick={() => { setEditingVariant(undefined); setShowVariantModal(true) }}>
                      Erste Variante anlegen
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {variants.map(v => (
                      <div key={v.id} className="p-4 rounded-xl group"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-bold text-white">{v.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {v.fill_quantity} {v.fill_unit}
                            </p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingVariant(v); setShowVariantModal(true) }}
                              className="btn-ghost p-1 text-slate-400 hover:text-white">
                              <Pencil size={11}/>
                            </button>
                            <button onClick={() => setDeletingVariant(v)}
                              className="btn-ghost p-1 text-red-400">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 text-xs">
                          {v.ean && <p className="text-slate-600 font-mono">EAN: {v.ean}</p>}
                          {v.packaging_name && (
                            <p className="text-slate-500">📦 {v.packaging_name}
                              {v.packaging_price ? <span className="text-slate-600 ml-1">({fmt(v.packaging_price)})</span> : ''}
                            </p>
                          )}
                          {v.label_name && (
                            <p className="text-slate-500">🏷 {v.label_name}
                              {v.label_price ? <span className="text-slate-600 ml-1">({fmt(v.label_price)})</span> : ''}
                            </p>
                          )}
                          {v.carton_name && (
                            <p className="text-slate-500">📫 {v.carton_name}
                              {v.carton_price ? <span className="text-slate-600 ml-1">({fmt(v.carton_price)} / {v.units_per_carton} Stk)</span> : ''}
                            </p>
                          )}
                          {v.extra_cost > 0 && (
                            <p className="text-slate-500">+ {fmt(v.extra_cost)} Zusatz{v.extra_cost_note ? ` (${v.extra_cost_note})` : ''}</p>
                          )}
                        </div>
                        <VariantCostCard variantId={v.id}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showGroupModal && (
        <GroupModal group={editingGroup}
          onSave={d => editingGroup ? updateGroup.mutate({ id: editingGroup.id, d }) : createGroup.mutate(d)}
          onClose={() => setShowGroupModal(false)}/>
      )}

      {showVariantModal && selectedProduct && (
        <VariantModal
          productId={selectedProduct}
          variant={editingVariant}
          packaging={packaging}
          labels={labels}
          cartons={cartons}
          onClose={() => { setShowVariantModal(false); setEditingVariant(undefined) }}
          onSaved={invProducts}
        />
      )}


      {showGenerator && selectedProduct && (
        <VariantGenerator
          productId={selectedProduct}
          productCode={(detail as any)?.code || 'PRD'}
          packaging={packaging}
          labels={labels}
          cartons={cartons}
          onClose={() => setShowGenerator(false)}
          onSaved={invProducts}
        />
      )}

      {showCopyModal && selectedProduct && (
        <CopyVariantsModal
          productId={selectedProduct}
          allProducts={products}
          onClose={() => setShowCopyModal(false)}
          onSaved={invProducts}
        />
      )}

      <ConfirmDialog open={!!deletingProduct} title="Produkt löschen?"
        message={`"${deletingProduct?.name}" und alle Varianten wirklich löschen?`}
        onConfirm={() => deletingProduct && deleteProd.mutate(deletingProduct.id)}
        onCancel={() => setDeletingProduct(undefined)} loading={deleteProd.isPending}/>

      <ConfirmDialog open={!!deletingVariant} title="Variante löschen?"
        message={`"${deletingVariant?.name}" löschen?`}
        onConfirm={() => deletingVariant && deleteVar.mutate({ vid: deletingVariant.id })}
        onCancel={() => setDeletingVariant(undefined)} loading={deleteVar.isPending}/>
    </div>
  )
}

// ── 2K PRODUKTE TAB (unverändert) ────────────────────────────


// ── STANDARD GRÖßEN (aus Preistabelle) ────────────────────────
const STANDARD_SIZES = [
  { kg: 0.5,  label: '500 ml / 0,5 kg' },
  { kg: 0.75, label: '0,75 kg' },
  { kg: 1.0,  label: '1,0 kg' },
  { kg: 1.5,  label: '1,5 kg' },
  { kg: 2.25, label: '2,25 kg' },
  { kg: 3.0,  label: '3,0 kg' },
  { kg: 4.5,  label: '4,5 kg' },
  { kg: 6.0,  label: '6,0 kg' },
  { kg: 7.5,  label: '7,5 kg' },
  { kg: 9.0,  label: '9,0 kg' },
  { kg: 12.0, label: '12,0 kg' },
  { kg: 15.0, label: '15,0 kg' },
  { kg: 22.5, label: '22,5 kg' },
  { kg: 30.0, label: '30,0 kg' },
  { kg: 45.0, label: '45,0 kg' },
  { kg: 60.0, label: '60,0 kg' },
]

interface GenConfig {
  name: string; code: string; fill_unit: string
  packaging_id: string; packaging_qty: number
  label_id: string
  carton_id: string; units_per_carton: number
  extra_cost: number
}

// ── Varianten-Generator ─────────────────────────────────────────
function VariantGenerator({ productId, productCode, packaging, labels, cartons, onClose, onSaved }: {
  productId: number; productCode: string
  packaging: any[]; labels: any[]; cartons: any[]
  onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [step, setStep]     = useState<1|2>(1)
  const [selected, setSelected] = useState<number[]>([])
  const [configs, setConfigs]   = useState<Record<number, GenConfig>>({})
  const [saving, setSaving]     = useState(false)

  // Default config für eine Größe
  const defaultConfig = (kg: number): GenConfig => ({
    name: `${kg % 1 === 0 ? kg : String(kg).replace('.',',')} kg Set`,
    code: `${productCode}-${String(kg).replace('.','_')}KG`.toUpperCase(),
    fill_unit: 'kg',
    packaging_id: '', packaging_qty: 1,
    label_id: '',
    carton_id: '', units_per_carton: 1,
    extra_cost: 0,
  })

  const toggleSize = (kg: number) => {
    setSelected(prev => {
      if (prev.includes(kg)) return prev.filter(k => k !== kg)
      setConfigs(c => ({ ...c, [kg]: c[kg] || defaultConfig(kg) }))
      return [...prev, kg].sort((a, b) => a - b)
    })
  }

  const setConfig = (kg: number, key: keyof GenConfig, value: any) =>
    setConfigs(c => ({ ...c, [kg]: { ...c[kg], [key]: value } }))

  const saveAll = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      for (const kg of selected) {
        const cfg = configs[kg] || defaultConfig(kg)
        await window.api.products.saveVariant(productId, {
          name:              cfg.name,
          code:              cfg.code.toUpperCase(),
          fill_quantity:     kg,
          fill_unit:         cfg.fill_unit,
          packaging_item_id: cfg.packaging_id ? Number(cfg.packaging_id) : null,
          packaging_quantity: cfg.packaging_qty || 1,
          label_item_id:     cfg.label_id  ? Number(cfg.label_id)  : null,
          carton_item_id:    cfg.carton_id ? Number(cfg.carton_id) : null,
          units_per_carton:  cfg.units_per_carton || 1,
          extra_cost:        cfg.extra_cost || 0,
        })
      }
      toast.success(`${selected.length} Varianten angelegt`)
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error('Fehler', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Varianten-Generator" size="xl">
      <div className="space-y-4">
        {/* Step 1: Größen auswählen */}
        {step === 1 && (
          <>
            <p className="text-xs text-slate-400">Wähle alle gewünschten Füllmengen aus. Im nächsten Schritt konfigurierst du Verpackung, Etikett und Karton pro Variante.</p>
            <div className="grid grid-cols-4 gap-2">
              {STANDARD_SIZES.map(({ kg, label }) => {
                const isSelected = selected.includes(kg)
                return (
                  <button key={kg} onClick={() => toggleSize(kg)}
                    className="p-3 rounded-xl text-left transition-all border"
                    style={isSelected ? {
                      background: 'rgba(99,102,241,0.15)',
                      borderColor: 'rgba(99,102,241,0.5)',
                    } : {
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}>
                    <p className="text-sm font-bold" style={{ color: isSelected ? '#a5b4fc' : '#e2e8f0' }}>
                      {kg % 1 === 0 ? kg : String(kg).replace('.', ',')} kg
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
                    {isSelected && <p className="text-[10px] text-indigo-400 mt-1">✓ ausgewählt</p>}
                  </button>
                )
              })}
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-xs text-slate-500">{selected.length} Größen ausgewählt</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
                <Button disabled={!selected.length} onClick={() => setStep(2)}>
                  Weiter → Konfigurieren
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Konfiguration pro Größe */}
        {step === 2 && (
          <>
            <p className="text-xs text-slate-400">
              Konfiguriere Verpackung, Etikett und Karton für jede Variante.
              Bei z.B. 15 kg: Kanister auswählen + Anzahl = 3 eingeben.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 800 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Größe', 'Bezeichnung', 'Code', 'Verpackung', 'Anz.', 'Etikett', 'Karton', 'Stk/Kt', 'Extra €'].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map(kg => {
                    const cfg = configs[kg] || defaultConfig(kg)
                    const upd = (k: keyof GenConfig, v: any) => setConfig(kg, k, v)
                    return (
                      <tr key={kg} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td className="px-2 py-2 font-black text-white whitespace-nowrap">
                          {kg % 1 === 0 ? kg : String(kg).replace('.', ',')} kg
                        </td>
                        <td className="px-1 py-1">
                          <input className="form-input text-xs w-32" value={cfg.name}
                            onChange={e => upd('name', e.target.value)}/>
                        </td>
                        <td className="px-1 py-1">
                          <input className="form-input text-xs w-28 font-mono" value={cfg.code}
                            onChange={e => upd('code', e.target.value.toUpperCase())}/>
                        </td>
                        <td className="px-1 py-1">
                          <select className="form-input text-xs w-36" value={cfg.packaging_id}
                            onChange={e => upd('packaging_id', e.target.value)}>
                            <option value="">– kein –</option>
                            {packaging.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.price_per_unit||0}€)</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" min="1" className="form-input text-xs w-14 font-mono text-center"
                            value={cfg.packaging_qty}
                            onChange={e => upd('packaging_qty', Number(e.target.value) || 1)}
                            title="Anzahl dieser Verpackung (z.B. 3 × 5L Kanister)"/>
                        </td>
                        <td className="px-1 py-1">
                          <select className="form-input text-xs w-32" value={cfg.label_id}
                            onChange={e => upd('label_id', e.target.value)}>
                            <option value="">– kein –</option>
                            {labels.map((l: any) => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <select className="form-input text-xs w-32" value={cfg.carton_id}
                            onChange={e => upd('carton_id', e.target.value)}>
                            <option value="">– kein –</option>
                            {cartons.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" min="1" className="form-input text-xs w-14 font-mono text-center"
                            value={cfg.units_per_carton}
                            onChange={e => upd('units_per_carton', Number(e.target.value) || 1)}/>
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" min="0" step="0.01" className="form-input text-xs w-16 font-mono"
                            value={cfg.extra_cost}
                            onChange={e => upd('extra_cost', Number(e.target.value))}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/6">
              <Button variant="secondary" onClick={() => setStep(1)}>← Zurück</Button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">{selected.length} Varianten werden angelegt</span>
                <Button loading={saving} onClick={saveAll}
                  icon={saving ? undefined : undefined}>
                  {selected.length} Varianten anlegen
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Varianten kopieren ──────────────────────────────────────────
function CopyVariantsModal({ productId, allProducts, onClose, onSaved }: {
  productId: number; allProducts: any[]
  onClose: () => void; onSaved: () => void
}) {
  const toast = useToast()
  const [sourceId, setSourceId] = useState('')
  const [sourceVariants, setSourceVariants] = useState<any[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [loading, setLoading]   = useState(false)
  const [saving, setSaving]     = useState(false)

  const loadSource = async (id: number) => {
    setLoading(true)
    try {
      const detail = await window.api.products.get(id) as any
      setSourceVariants(detail?.variants ?? [])
      setSelected((detail?.variants ?? []).map((v: any) => v.id))
    } finally {
      setLoading(false)
    }
  }

  const copySelected = async () => {
    if (!selected.length) return
    setSaving(true)
    try {
      const toCopy = sourceVariants.filter(v => selected.includes(v.id))
      for (const v of toCopy) {
        await window.api.products.saveVariant(productId, {
          name:              v.name,
          code:              v.code + (toCopy.length > 1 ? '' : '-COPY'),
          fill_quantity:     v.fill_quantity,
          fill_unit:         v.fill_unit,
          packaging_item_id: v.packaging_item_id,
          packaging_quantity: (v as any).packaging_quantity || 1,
          label_item_id:     v.label_item_id,
          carton_item_id:    v.carton_item_id,
          units_per_carton:  v.units_per_carton,
          extra_cost:        v.extra_cost,
          extra_cost_note:   v.extra_cost_note,
          ean: null, sku: null,
        })
      }
      toast.success(`${selected.length} Varianten kopiert`)
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error('Fehler', e.message)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (v: number) => v > 0 ? `${v % 1 === 0 ? v : String(v).replace('.',',')} kg` : ''

  return (
    <Modal open onClose={onClose} title="Varianten kopieren von …" size="md">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1.5 block">
            Quellprodukt auswählen
          </label>
          <select className="form-input w-full text-sm text-white"
            value={sourceId}
            onChange={e => { setSourceId(e.target.value); if (e.target.value) loadSource(Number(e.target.value)) }}>
            <option value="">– Produkt wählen –</option>
            {allProducts.filter(p => p.id !== productId).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code}) — {p.variant_count || 0} Varianten</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-xs text-slate-500 text-center py-4">Lade Varianten …</p>}

        {!loading && sourceVariants.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Varianten auswählen ({selected.length}/{sourceVariants.length})
              </label>
              <button className="text-xs text-brand-400 hover:text-brand-300"
                onClick={() => setSelected(selected.length === sourceVariants.length ? [] : sourceVariants.map(v => v.id))}>
                {selected.length === sourceVariants.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {sourceVariants.map(v => (
                <label key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: selected.includes(v.id) ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected.includes(v.id) ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                  <input type="checkbox" checked={selected.includes(v.id)}
                    onChange={e => setSelected(prev => e.target.checked ? [...prev, v.id] : prev.filter(id => id !== v.id))}
                    className="w-4 h-4 rounded accent-indigo-500"/>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-200">{v.name}</p>
                    <p className="text-xs text-slate-500">
                      {fmt(v.fill_quantity)} {v.fill_unit}
                      {v.packaging_name && ` · ${v.packaging_name}`}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-600">{v.code}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {!loading && sourceId && !sourceVariants.length && (
          <p className="text-xs text-slate-600 text-center py-4 italic">Dieses Produkt hat keine Varianten</p>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-white/6">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button disabled={!selected.length} loading={saving} onClick={copySelected}>
            {selected.length} Varianten kopieren
          </Button>
        </div>
      </div>
    </Modal>
  )
}


// ── 2K PRODUKTE TAB ─────────────────────────────────────────
interface Product2k {
  id: number; name: string; code: string
  product_group_id: number|null; group_name?: string; group_color?: string
  component_a_id: number|null; component_a_name: string|null
  component_b_id: number|null; component_b_name: string|null
  mix_ratio_a: number; mix_ratio_b: number; mix_ratio_display: string
  variant_count: number; ratio_a_pct: number; ratio_b_pct: number
  description: string|null; notes: string|null
}
interface Variant2k {
  id?: number; name: string; code: string; total_fill_kg: number
  packaging_a_id?: number|null; lid_a_id?: number|null
  packaging_b_id?: number|null; lid_b_id?: number|null
  label_a_id?: number|null; carton_id?: number|null
  units_per_carton: number; extra_cost: number; extra_cost_note?: string
  sku?: string; ean?: string
}

const EMPTY_2K = {
  name:'', code:'', product_group_id:'', description:'',
  component_a_id:'', component_a_name:'',
  component_b_id:'', component_b_name:'',
  mix_ratio_a:'100', mix_ratio_b:'50', notes:''
}
const EMPTY_2K_VARIANT: Omit<Variant2k,'id'> = {
  name:'', code:'', total_fill_kg:0,
  packaging_a_id:null, lid_a_id:null,
  packaging_b_id:null, lid_b_id:null,
  label_a_id:null, carton_id:null,
  units_per_carton:1, extra_cost:0
}

function MixBar({a,b}:{a:number;b:number}) {
  const total = a+b; const pA = (a/total)*100; const pB = (b/total)*100
  return (
    <div className="flex rounded-full overflow-hidden h-1.5 w-full">
      <div style={{width:`${pA}%`,background:'#8b5cf6'}}/>
      <div style={{width:`${pB}%`,background:'#06b6d4'}}/>
    </div>
  )
}

export function Products2kTab({externalOpen=false, onExternalOpenHandled}:{externalOpen?:boolean;onExternalOpenHandled?:()=>void}) {
  const qc = useQueryClient(); const toast = useToast()
  const [search, setSearch]   = useState('')
  const [filterGroup, setFilterGroup] = useState<number|null>(null)
  const [selected, setSelected] = useState<number|null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<Product2k|undefined>()
  const [deleting, setDeleting] = useState<Product2k|undefined>()
  const [showVariantModal, setShowVariantModal] = useState(false)
  const [editingVariant, setEditingVariant]     = useState<Variant2k|undefined>()
  const [variantForm, setVariantForm]           = useState<typeof EMPTY_2K_VARIANT>(EMPTY_2K_VARIANT)
  const [selectedSizes, setSelectedSizes]       = useState<number[]>([])
  const [variantMode, setVariantMode]           = useState<'generator'|'manual'>('generator')
  const [assignDetails, setAssignDetails]       = useState<Record<number,{ean:string;article_number:string;price:string;vat:string}>>({})
  const [form, setForm] = useState(EMPTY_2K)

  // External open trigger from parent header button
  React.useEffect(()=>{
    if(externalOpen){
      setEditing(undefined);setForm(EMPTY_2K);setShowModal(true)
      onExternalOpenHandled?.()
    }
  },[externalOpen])

  const {data:groups=[]}   = useQuery<any[]>({queryKey:['product-groups'],queryFn:()=>window.api.productGroups.list()})
  const {data:products=[]} = useQuery<Product2k[]>({
    queryKey:['products2k', search, filterGroup],
    queryFn: ()=>window.api.products2k.list({search:search||undefined, group_id:filterGroup||undefined}) as Promise<Product2k[]>
  })
  const {data:detail}      = useQuery<any>({
    queryKey:['products2k-detail', selected],
    queryFn: ()=>selected?window.api.products2k.get(selected):null,
    enabled:!!selected
  })
  const {data:allProducts=[]} = useQuery<any[]>({queryKey:['products'],queryFn:()=>window.api.products.list()})
  const {data:packaging=[]}   = useQuery<any[]>({queryKey:['packaging'],queryFn:()=>window.api.packaging.list()})
  const {data:cartons=[]}     = useQuery<any[]>({queryKey:['cartons'],queryFn:()=>window.api.cartons.list()})
  const {data:labels=[]}      = useQuery<any[]>({queryKey:['labels'],queryFn:()=>window.api.labels.list()})
  const {data:allTemplates=[]} = useQuery<any[]>({queryKey:['variant-templates'],queryFn:()=>window.api.variantTemplates.list()})
  const {data:assignments=[]}  = useQuery<any[]>({
    queryKey:['variant-assignments', selected],
    queryFn: ()=>selected?(window.api.variantTemplates.getAssignments(selected) as Promise<any[]>):Promise.resolve([]),
    enabled: !!selected,
  })

  const inv = () => { qc.invalidateQueries({queryKey:['products2k']}); qc.invalidateQueries({queryKey:['products2k-detail',selected]}) }

  const createM  = useMutation({mutationFn:(d:unknown)=>window.api.products2k.create(d),onSuccess:()=>{inv();setShowModal(false);toast.success('2K-Produkt angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM  = useMutation({mutationFn:({id,d}:{id:number;d:unknown})=>window.api.products2k.update(id,d),onSuccess:()=>{inv();setShowModal(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const assignM   = useMutation({
    mutationFn:({tid,d}:{tid:number;d:unknown})=>window.api.variantTemplates.assign(selected!,tid,d),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['variant-assignments',selected]});toast.success('Variante zugewiesen')}
  })
  const unassignM = useMutation({
    mutationFn:(tid:number)=>window.api.variantTemplates.unassign(selected!,tid),
    onSuccess:()=>{qc.invalidateQueries({queryKey:['variant-assignments',selected]});toast.success('Zuweisung entfernt')}
  })
  const deleteM  = useMutation({mutationFn:(id:number)=>window.api.products2k.delete(id),onSuccess:()=>{inv();setDeleting(undefined);setSelected(null);toast.success('Gelöscht')}})
  const saveVar  = useMutation({mutationFn:({d}:{d:unknown})=>window.api.products2k.saveVariant(selected!,d),onSuccess:()=>{inv();setShowVariantModal(false);toast.success('Variante gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const delVar   = useMutation({mutationFn:({vid}:{vid:number})=>window.api.products2k.deleteVariant(selected!,vid),onSuccess:inv})

  const openModal = (p?: Product2k) => {
    if (p) { setEditing(p); setForm({name:p.name,code:p.code,product_group_id:String(p.product_group_id||''),description:p.description||'',component_a_id:String(p.component_a_id||''),component_a_name:p.component_a_name||'',component_b_id:String(p.component_b_id||''),component_b_name:p.component_b_name||'',mix_ratio_a:String(p.mix_ratio_a),mix_ratio_b:String(p.mix_ratio_b),notes:p.notes||''}) }
    else { setEditing(undefined); setForm(EMPTY_2K) }
    setShowModal(true)
  }

  const submitForm = () => {
    const d = {...form, product_group_id:form.product_group_id?Number(form.product_group_id):null, component_a_id:form.component_a_id?Number(form.component_a_id):null, component_b_id:form.component_b_id?Number(form.component_b_id):null, mix_ratio_a:Number(form.mix_ratio_a)||100, mix_ratio_b:Number(form.mix_ratio_b)||50 }
    editing ? updateM.mutate({id:editing.id,d}) : createM.mutate(d)
  }

  const ratioA = Number(form.mix_ratio_a)||100
  const ratioB = Number(form.mix_ratio_b)||50
  const ratioTotal = ratioA + ratioB

  // Variante: automatischer Code
  const autoVariantCode = (kg: number) => {
    const base = editing?.code || form.code || 'PRD'
    return `${base}-${String(kg).replace('.','_')}KG`
  }

  return (
    <div className="flex gap-4">
      {/* ── Linke Spalte ── */}
      <div className="w-72 shrink-0 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 text-sm" placeholder="2K-Produkt suchen …"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>

        {/* Gruppenfilter */}
        <div className="flex flex-wrap gap-1.5">
          <button onClick={()=>setFilterGroup(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${!filterGroup?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}>
            Alle
          </button>
          {(groups as any[]).map((g:any)=>(
            <button key={g.id} onClick={()=>setFilterGroup(g.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${filterGroup===g.id?'text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}
              style={filterGroup===g.id?{backgroundColor:`${g.color}25`,borderColor:`${g.color}50`,color:'white'}:{}}>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:g.color}}/>
                {g.name}
              </span>
            </button>
          ))}
        </div>

        {/* Produktliste */}
        <div className="space-y-1.5">
          {products.map((p:Product2k)=>(
            <button key={p.id} onClick={()=>setSelected(p.id)}
              className={`w-full text-left p-3 rounded-xl transition-all border ${selected===p.id?'border-brand-500/40 bg-brand-500/10':'border-white/6 bg-white/2 hover:border-white/10'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-200 truncate">{p.name}</span>
                {p.group_color && <span className="w-2 h-2 rounded-full shrink-0" style={{background:p.group_color}}/>}
              </div>
              <MixBar a={p.mix_ratio_a} b={p.mix_ratio_b}/>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] font-mono text-slate-500">{p.mix_ratio_display}</span>
                <span className="text-[10px] text-slate-600">{p.variant_count} Varianten</span>
              </div>
            </button>
          ))}
          {!products.length && (
            <div className="text-center py-8">
              <Layers size={28} className="text-slate-700 mx-auto mb-2"/>
              <p className="text-slate-500 text-xs">Keine 2K-Produkte</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Rechte Detailspalte ── */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="glass-card flex flex-col items-center justify-center py-16">
            <Layers size={40} className="text-slate-700 mb-3"/>
            <p className="text-slate-500">2K-Produkt auswählen</p>
          </div>
        ) : detail && (
          <div className="space-y-4">
            {/* Header */}
            <div className="glass-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{detail.name}</h3>
                  <p className="text-xs text-slate-500">{detail.code} · {detail.group_name||'–'}</p>
                  {detail.description && <p className="text-xs text-slate-400 mt-1">{detail.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>openModal(detail as Product2k)}
                    className="btn-ghost p-2"><Pencil size={14}/></button>
                  <button onClick={()=>setDeleting(detail as Product2k)}
                    className="btn-ghost p-2 text-red-400"><Trash2 size={14}/></button>
                </div>
              </div>

              {/* Mischungsverhältnis */}
              <div className="mt-4 p-3 rounded-xl" style={{background:'rgba(255,255,255,0.03)'}}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Mischungsverhältnis</p>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-white">{detail.mix_ratio_display}</p>
                    <p className="text-[10px] text-slate-500">= {(detail.mix_ratio_a/detail.mix_ratio_b).toFixed(2).replace(/\.?0+$/,'')}:1</p>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-brand-400 font-semibold">A: {detail.component_a_name||'–'}</span>
                        <span className="text-slate-500">{detail.ratio_a_pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-brand-500" style={{width:`${detail.ratio_a_pct}%`}}/>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-cyan-400 font-semibold">B: {detail.component_b_name||'–'}</span>
                        <span className="text-slate-500">{detail.ratio_b_pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-cyan-500" style={{width:`${detail.ratio_b_pct}%`}}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Varianten */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-200">Varianten</p>
                <Button size="sm" icon={<Plus size={12}/>}
                  onClick={()=>{setEditingVariant(undefined);setVariantForm({...EMPTY_2K_VARIANT});setShowVariantModal(true)}}>
                  Varianten zuweisen
                </Button>
              </div>

              {/* Zugewiesene Varianten aus Vorlagen */}
              {(assignments as any[]).length > 0 ? (
                <div className="space-y-2">
                  {(assignments as any[]).map((a:any)=>{
                    const ratioA = detail.mix_ratio_a/(detail.mix_ratio_a+detail.mix_ratio_b)
                    const ratioB = detail.mix_ratio_b/(detail.mix_ratio_a+detail.mix_ratio_b)
                    const kgA = (a.fill_amount*ratioA).toFixed(3)
                    const kgB = (a.fill_amount*ratioB).toFixed(3)
                    const ppu = a.target_price_net&&a.fill_amount>0?a.target_price_net/a.fill_amount:null
                    return(
                      <div key={a.id} className="p-3 rounded-xl group"
                        style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{a.template_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              <span className="text-brand-400">{kgA} {a.fill_unit} A</span>
                              <span className="text-slate-600 mx-1">+</span>
                              <span className="text-cyan-400">{kgB} {a.fill_unit} B</span>
                            </p>
                            {a.ean&&<p className="text-[10px] font-mono text-slate-600">EAN: {a.ean}</p>}
                            {a.article_number&&<p className="text-[10px] font-mono text-slate-600">Art.-Nr.: {a.article_number}</p>}
                          </div>
                          <div className="text-right">
                            {a.target_price_net!=null&&<p className="text-sm font-bold text-white">{a.target_price_net.toFixed(2).replace('.',',')} €</p>}
                            {ppu&&<p className="text-[10px] text-emerald-400">{ppu.toFixed(4).replace('.',',')} €/{a.fill_unit}</p>}
                            <div className="flex gap-1 mt-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={()=>{setEditingVariant(a);setVariantForm({...EMPTY_2K_VARIANT,total_fill_kg:a.fill_amount});setShowVariantModal(true)}}
                                className="btn-ghost p-1"><Pencil size={11}/></button>
                              <button onClick={()=>unassignM.mutate(a.template_id)}
                                className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-600 text-xs">Noch keine Varianten zugewiesen</p>
                  <p className="text-[10px] text-slate-700 mt-1">Klicke „Varianten zuweisen" um Vorlagen auszuwählen</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Produkt Modal ── */}
      {showModal && (
        <Modal open={showModal} onClose={()=>setShowModal(false)}
          title={editing?'2K-Produkt bearbeiten':'Neues 2K-Produkt'} size="lg">
          <div className="space-y-4 mt-2">
            {/* Stammdaten */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Produktname *" value={form.name} autoFocus
                  onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                  placeholder="z.B. LuminaCast 1"/>
              </div>
              <Input label="Code *" value={form.code}
                onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}
                placeholder="z.B. LC-1"/>
              <Select label="Produktgruppe" value={form.product_group_id}
                onChange={e=>setForm(f=>({...f,product_group_id:e.target.value}))}>
                <option value="">– keine –</option>
                {(groups as any[]).map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <div className="col-span-2">
                <Input label="Beschreibung" value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
              </div>
            </div>

            {/* Mischungsverhältnis */}
            <div className="p-4 rounded-xl space-y-3"
              style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)'}}>
              <p className="text-xs font-bold text-slate-300">Mischungsverhältnis</p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-brand-400 block mb-1">Teile Komp. A</label>
                  <input type="number" value={form.mix_ratio_a}
                    onChange={e=>setForm(f=>({...f,mix_ratio_a:e.target.value}))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-brand-500/30 outline-none focus:border-brand-500"/>
                </div>
                <span className="text-2xl text-slate-600 font-black mt-4">:</span>
                <div className="flex-1">
                  <label className="text-[10px] text-cyan-400 block mb-1">Teile Komp. B</label>
                  <input type="number" value={form.mix_ratio_b}
                    onChange={e=>setForm(f=>({...f,mix_ratio_b:e.target.value}))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-cyan-500/30 outline-none focus:border-cyan-500"/>
                </div>
              </div>
              <div className="space-y-1">
                <MixBar a={ratioA} b={ratioB}/>
                <div className="flex justify-between text-[10px]">
                  <span className="text-brand-400">{((ratioA/ratioTotal)*100).toFixed(1)}% A</span>
                  <span className="text-slate-500">= {(ratioA/ratioB).toFixed(2)}:1</span>
                  <span className="text-cyan-400">{((ratioB/ratioTotal)*100).toFixed(1)}% B</span>
                </div>
              </div>
            </div>

            {/* Komponenten */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1.5">Komponente A (Harz)</p>
                <select value={form.component_a_id}
                  onChange={e=>{const p=(allProducts as any[]).find((x:any)=>x.id===Number(e.target.value));setForm(f=>({...f,component_a_id:e.target.value,component_a_name:p?.name||''}))}}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-brand-500/20 outline-none">
                  <option value="">– Rezeptur wählen –</option>
                  {(allProducts as any[]).map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">Komponente B (Härter)</p>
                <select value={form.component_b_id}
                  onChange={e=>{const p=(allProducts as any[]).find((x:any)=>x.id===Number(e.target.value));setForm(f=>({...f,component_b_id:e.target.value,component_b_name:p?.name||''}))}}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-cyan-500/20 outline-none">
                  <option value="">– Rezeptur wählen –</option>
                  {(allProducts as any[]).map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <Button variant="secondary" onClick={()=>setShowModal(false)}>Abbrechen</Button>
              <Button onClick={submitForm} loading={createM.isPending||updateM.isPending}>
                {editing?'Speichern':'Anlegen'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Varianten Zuweisung Modal ── */}
      {showVariantModal && (
        <Modal open={showVariantModal} onClose={()=>{setShowVariantModal(false);setSelectedSizes([]);setAssignDetails({})}}
          title="Varianten zuweisen" size="lg">
          <div className="space-y-3 mt-2">
            {(editingVariant || variantMode==='manual') && (<><div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Gesamtmenge (kg) *</label>
                <input type="number" step="0.01" value={variantForm.total_fill_kg||''}
                  onChange={e=>{const kg=Number(e.target.value);setVariantForm(f=>({...f,total_fill_kg:kg,name:f.name||`${kg} kg Set`,code:f.code||autoVariantCode(kg)}))}}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-brand-500"
                  placeholder="z.B. 1.5"/>
              </div>
              <Input label="Bezeichnung *" value={variantForm.name}
                onChange={e=>setVariantForm(f=>({...f,name:e.target.value}))}
                placeholder="z.B. 1,5 kg Set"/>
              <Input label="Code *" value={variantForm.code}
                onChange={e=>setVariantForm(f=>({...f,code:e.target.value.toUpperCase()}))}/>
              <Input label="SKU" value={variantForm.sku||''}
                onChange={e=>setVariantForm(f=>({...f,sku:e.target.value}))}/>
            </div>

            {/* Mengenvorschau */}
            {variantForm.total_fill_kg>0 && detail && (
              <div className="p-3 rounded-xl flex gap-4"
                style={{background:'rgba(255,255,255,0.03)'}}>
                <div className="text-center">
                  <p className="text-[10px] text-brand-400">Komp. A</p>
                  <p className="text-lg font-black text-white">
                    {(variantForm.total_fill_kg*(detail.mix_ratio_a/(detail.mix_ratio_a+detail.mix_ratio_b))).toFixed(3)} kg
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-cyan-400">Komp. B</p>
                  <p className="text-lg font-black text-white">
                    {(variantForm.total_fill_kg*(detail.mix_ratio_b/(detail.mix_ratio_a+detail.mix_ratio_b))).toFixed(3)} kg
                  </p>
                </div>
              </div>
            )}

            {/* Gebinde */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {l:'Gebinde A',k:'packaging_a_id',c:'brand',data:packaging},
                {l:'Gebinde B',k:'packaging_b_id',c:'cyan',data:packaging},
              ].map(({l,k,c,data})=>(
                <div key={k}>
                  <p className={`text-[10px] font-bold text-${c}-400 uppercase tracking-wider mb-1`}>{l}</p>
                  <select value={(variantForm as any)[k]||''}
                    onChange={e=>setVariantForm(f=>({...f,[k]:Number(e.target.value)||null}))}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/8 outline-none">
                    <option value="">– kein –</option>
                    {(data as any[]).map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.price_per_unit||0} €)</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Karton */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Karton</p>
                <select value={variantForm.carton_id||''}
                  onChange={e=>setVariantForm(f=>({...f,carton_id:Number(e.target.value)||null}))}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/8 outline-none">
                  <option value="">– kein –</option>
                  {(cartons as any[]).map((c:any)=><option key={c.id} value={c.id}>{c.name} ({c.price_per_unit||0} €)</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Sets pro Karton</label>
                <input type="number" min="1" value={variantForm.units_per_carton}
                  onChange={e=>setVariantForm(f=>({...f,units_per_carton:Math.max(1,Number(e.target.value))}))}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/8 outline-none"/>
              </div>
            </div>

            </>)}
            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <Button variant="secondary" onClick={()=>setShowVariantModal(false)}>Abbrechen</Button>
              {(editingVariant || variantMode==='manual') && <Button onClick={()=>saveVar.mutate({d:{...variantForm,...(editingVariant?.id?{id:editingVariant.id}:{})}})} loading={saveVar.isPending}>
                {editingVariant?'Speichern':'Anlegen'}
              </Button>}
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleting} title="2K-Produkt löschen?"
        message={`"${deleting?.name}" und alle Varianten löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)}
        onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
