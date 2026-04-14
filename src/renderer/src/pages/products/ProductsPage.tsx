import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, Package, ChevronRight,
  FlaskConical, Star, Calculator, Layers,
} from 'lucide-react'
import { useToast }    from '@/hooks/useToast'
import { Button }      from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }       from '@/components/ui/Modal'
import { Spinner, Card, EmptyState, ConfirmDialog, Badge } from '@/components/ui/Badge'

// ─── Types ───────────────────────────────────────────────────
interface ProductGroup {
  id: number; name: string; code: string; color: string; product_count?: number
}
interface Product {
  id: number; product_group_id: number | null; name: string; code: string
  group_name?: string; group_color?: string
  batch_size: number; batch_unit: string; overhead_factor: number
  material_count?: number; variant_count?: number
}
interface ProductMaterial {
  id: number; material_id: number; material_name: string; material_code: string
  quantity: number; unit: string; waste_factor: number; sort_order: number
  pref_price: number | null; pref_currency: string | null; pref_supplier_name: string | null
  all_prices_json: string | null
}
interface SupplierPrice {
  supplier_id: number; supplier_name: string; price_per_unit: number
  currency: string; unit: string; is_preferred: number
}
interface ProductVariant {
  id: number; name: string; code: string; fill_quantity: number; fill_unit: string
  packaging_name?: string; packaging_price?: number
  label_name?: string; label_price?: number
  carton_name?: string; carton_price?: number
  extra_cost: number
}
interface VariantCost {
  total_cost: number; material_cost: number; packaging_cost: number
  label_cost: number; carton_cost: number; extra_cost: number
  price_per_kg: number; currency: string
  material_breakdown: Array<{ material_name: string; cost_in_batch: number; quantity: number; unit: string }>
}

const fmt = (v: number, cur = 'EUR') =>
  new Intl.NumberFormat('de-DE', { style:'currency', currency:cur, minimumFractionDigits:2 }).format(v)

const GROUP_COLORS = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']

// ─── Product Group Form ───────────────────────────────────────
function GroupModal({ group, onSave, onClose }: {
  group?: ProductGroup; onSave:(d:unknown)=>void; onClose:()=>void
}) {
  const [form, setForm] = useState({ name:group?.name??'', code:group?.code??'', color:group?.color??'#8b5cf6' })
  return (
    <Modal open onClose={onClose} title={group?'Gruppe bearbeiten':'Neue Produktgruppe'} size="sm">
      <div className="space-y-4">
        <Input label="Name *" value={form.name} autoFocus onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        <Input label="Code *" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}/>
        <div>
          <label className="form-label">Farbe</label>
          <div className="flex gap-2 mt-1.5">
            {GROUP_COLORS.map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} type="button"
                className={`w-7 h-7 rounded-lg transition-all ${form.color===c?'ring-2 ring-white/50 scale-110':'opacity-60 hover:opacity-100'}`}
                style={{backgroundColor:c}}/>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button onClick={()=>onSave({...group,...form})}>{group?'Speichern':'Anlegen'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Material Row mit Lieferantenpreisauswahl ─────────────────
function MaterialRow({ mat, onDelete }: { mat: ProductMaterial; onDelete:(id:number)=>void }) {
  const [selectedSupplier, setSelectedSupplier] = useState<number|null>(null)
  let prices: SupplierPrice[] = []
  try { prices = mat.all_prices_json ? JSON.parse(mat.all_prices_json) : [] } catch {}

  const activePrice = prices.find(p => selectedSupplier
    ? p.supplier_id === selectedSupplier
    : p.is_preferred === 1
  ) ?? prices[0]

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 group">
      <FlaskConical size={14} className="text-brand-400 shrink-0"/>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{mat.material_name}</p>
        <p className="text-xs text-slate-500">{mat.quantity} {mat.unit}
          {mat.waste_factor > 0 && <span className="ml-1 text-amber-500">+{(mat.waste_factor*100).toFixed(0)}% Ausschuss</span>}
        </p>
      </div>
      {/* Lieferanten-Preisauswahl */}
      <div className="flex items-center gap-2 shrink-0">
        {prices.length > 1 ? (
          <select
            className="form-input text-xs py-1 w-44"
            value={selectedSupplier ?? (prices.find(p=>p.is_preferred)?.supplier_id ?? prices[0]?.supplier_id ?? '')}
            onChange={e=>setSelectedSupplier(Number(e.target.value))}
          >
            {prices.map(p=>(
              <option key={p.supplier_id} value={p.supplier_id}>
                {p.is_preferred?'★ ':''}{p.supplier_name} – {fmt(p.price_per_unit)} /{p.unit}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-slate-400">
            {activePrice ? `${activePrice.supplier_name}` : 'Kein Preis'}
          </span>
        )}
        {activePrice && (
          <span className="text-sm font-mono font-semibold text-slate-200">
            {fmt(activePrice.price_per_unit)}/{activePrice.unit}
          </span>
        )}
        {!activePrice && <span className="text-xs text-red-400">Kein Preis!</span>}
      </div>
      <button onClick={()=>onDelete(mat.id)} className="btn-ghost p-1.5 text-red-400 opacity-0 group-hover:opacity-100">
        <Trash2 size={12}/>
      </button>
    </div>
  )
}

// ─── Variant Cost Card ────────────────────────────────────────
function VariantCostCard({ variantId }: { variantId: number }) {
  const { data: cost } = useQuery<VariantCost>({
    queryKey: ['variant-cost', variantId],
    queryFn:  () => window.api.products.calcVariantCost(variantId) as Promise<VariantCost>,
    staleTime: 30_000,
  })
  if (!cost) return <div className="text-xs text-slate-600 italic">Berechne …</div>
  return (
    <div className="text-xs space-y-1">
      <div className="flex justify-between">
        <span className="text-slate-500">Rohstoff</span>
        <span className="text-slate-300 font-mono">{fmt(cost.material_cost)}</span>
      </div>
      {cost.packaging_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Verpackung</span>
          <span className="text-slate-300 font-mono">{fmt(cost.packaging_cost)}</span>
        </div>
      )}
      {cost.label_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Etikett</span>
          <span className="text-slate-300 font-mono">{fmt(cost.label_cost)}</span>
        </div>
      )}
      {cost.carton_cost > 0 && (
        <div className="flex justify-between">
          <span className="text-slate-500">Karton (ant.)</span>
          <span className="text-slate-300 font-mono">{fmt(cost.carton_cost)}</span>
        </div>
      )}
      <div className="flex justify-between pt-1 border-t border-white/5 font-semibold">
        <span className="text-slate-300">Gesamt EK</span>
        <span className="text-white font-mono">{fmt(cost.total_cost)}</span>
      </div>
      <div className="flex justify-between text-slate-500">
        <span>Preis/kg</span>
        <span className="font-mono">{fmt(cost.price_per_kg)}/kg</span>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function ProductsPage() {
  const qc    = useQueryClient()
  const toast = useToast()

  const [search, setSearch]           = useState('')
  const [filterGroup, setFilterGroup] = useState<number|null>(null)
  const [selectedProduct, setSelectedProduct] = useState<number|null>(null)
  const [showGroupModal, setShowGroupModal]   = useState(false)
  const [editingGroup, setEditingGroup]       = useState<ProductGroup|undefined>()
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct]     = useState<Product|undefined>()
  const [showMatModal, setShowMatModal]         = useState(false)
  const [deletingProduct, setDeletingProduct]   = useState<Product|undefined>()
  const [newMatForm, setNewMatForm]             = useState({ material_id:'', quantity:'', unit:'g', waste_factor:'0' })

  const { data: groups=[] } = useQuery<ProductGroup[]>({
    queryKey: ['product-groups'],
    queryFn: () => window.api.productGroups.list() as Promise<ProductGroup[]>,
  })
  const { data: products=[], isLoading } = useQuery<Product[]>({
    queryKey: ['products', search, filterGroup],
    queryFn:  () => window.api.products.list({ search:search||undefined, group_id:filterGroup||undefined }) as Promise<Product[]>,
  })
  const { data: productDetail } = useQuery({
    queryKey: ['product-detail', selectedProduct],
    queryFn:  () => selectedProduct ? window.api.products.get(selectedProduct) : null,
    enabled: !!selectedProduct,
  })
  const { data: allMaterials=[] } = useQuery({
    queryKey: ['materials'],
    queryFn:  () => window.api.materials.list() as Promise<unknown[]>,
  })

  const invGroups   = () => qc.invalidateQueries({ queryKey: ['product-groups'] })
  const invProducts = () => {
    qc.invalidateQueries({ queryKey: ['products'] })
    qc.invalidateQueries({ queryKey: ['product-detail', selectedProduct] })
  }

  const createGroup  = useMutation({ mutationFn:(d:unknown)=>window.api.productGroups.create(d), onSuccess:()=>{invGroups();setShowGroupModal(false);toast.success('Gruppe angelegt')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const updateGroup  = useMutation({ mutationFn:({id,d}:{id:number;d:unknown})=>window.api.productGroups.update(id,d), onSuccess:()=>{invGroups();setShowGroupModal(false);toast.success('Gespeichert')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const createProd   = useMutation({ mutationFn:(d:unknown)=>window.api.products.create(d), onSuccess:()=>{invProducts();setShowProductModal(false);toast.success('Produkt angelegt')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const updateProd   = useMutation({ mutationFn:({id,d}:{id:number;d:unknown})=>window.api.products.update(id,d), onSuccess:()=>{invProducts();setShowProductModal(false);toast.success('Gespeichert')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const deleteProd   = useMutation({ mutationFn:(id:number)=>window.api.products.delete(id), onSuccess:()=>{invProducts();setDeletingProduct(undefined);setSelectedProduct(null);toast.success('Gelöscht')} })
  const saveMat      = useMutation({ mutationFn:({d}:{d:unknown})=>window.api.products.saveMaterial(selectedProduct!,d), onSuccess:()=>{invProducts();setShowMatModal(false);toast.success('Rohstoff hinzugefügt')}, onError:(e:Error)=>toast.error('Fehler',e.message) })
  const deleteMat    = useMutation({ mutationFn:({matId}:{matId:number})=>window.api.products.deleteMaterial(selectedProduct!,matId), onSuccess:invProducts })

  const detail = productDetail as { materials?: ProductMaterial[]; variants?: ProductVariant[] } | null

  if (isLoading) return <Spinner/>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Produkte</h2>
          <p className="page-subtitle">{products.length} Produkte · {groups.length} Gruppen</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Plus size={12}/>}
            onClick={()=>{setEditingGroup(undefined);setShowGroupModal(true)}}>
            Gruppe
          </Button>
          <Button icon={<Plus size={14}/>}
            onClick={()=>{setEditingProduct(undefined);setShowProductModal(true)}}>
            Produkt anlegen
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Linke Spalte – Gruppen + Liste */}
        <div className="w-72 shrink-0 space-y-3">
          {/* Filter */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input className="form-input pl-9 text-sm" placeholder="Produkt suchen …"
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          {/* Gruppen als Filter */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={()=>setFilterGroup(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${!filterGroup?'bg-brand-500/20 border-brand-500/30 text-white':'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}>
              Alle
            </button>
            {groups.map(g=>(
              <button key={g.id} onClick={()=>setFilterGroup(g.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${filterGroup===g.id?'text-white border-opacity-40':'bg-white/3 border-white/8 text-slate-400 hover:text-slate-200'}`}
                style={filterGroup===g.id ? { backgroundColor:`${g.color}25`, borderColor:`${g.color}50`, color:'white' } : {}}>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:g.color}}/>
                  {g.name}
                </span>
              </button>
            ))}
          </div>

          {/* Produkt-Liste */}
          <div className="space-y-1.5">
            {!products.length && (
              <EmptyState icon={<Package size={32}/>} title="Keine Produkte"
                action={<Button size="sm" icon={<Plus size={12}/>} onClick={()=>setShowProductModal(true)}>Erstes Produkt</Button>}/>
            )}
            {products.map(p=>(
              <div key={p.id} onClick={()=>setSelectedProduct(p.id)}
                className={`glass-card p-3 cursor-pointer transition-all group ${selectedProduct===p.id?'border-brand-500/40':'hover:border-white/10'}`}
                style={selectedProduct===p.id ? { borderColor:`${p.group_color||'#8b5cf6'}50`, boxShadow:`0 0 16px ${p.group_color||'#8b5cf6'}15` } : {}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:p.group_color||'#8b5cf6'}}/>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.code}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={e=>{e.stopPropagation();setEditingProduct(p);setShowProductModal(true)}} className="btn-ghost p-1"><Pencil size={11}/></button>
                    <button onClick={e=>{e.stopPropagation();setDeletingProduct(p)}} className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {p.group_name && <span className="text-xs text-slate-500">{p.group_name}</span>}
                  <span className="badge-slate text-[10px]">{p.material_count??0} Stoffe</span>
                  <span className="badge-blue text-[10px]">{p.variant_count??0} Var.</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Rechte Spalte – Detailansicht */}
        {!selectedProduct ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={<Package size={40}/>} title="Produkt auswählen"
              description="Wähle links ein Produkt oder lege ein neues an."/>
          </div>
        ) : !detail ? <Spinner/> : (
          <div className="flex-1 space-y-4">
            {/* Header */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{(detail as any).name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {(detail as any).group_name} · {(detail as any).batch_size} {(detail as any).batch_unit} Batch · Overhead {(((detail as any).overhead_factor-1)*100).toFixed(0)}%
                  </p>
                </div>
                <Button size="sm" variant="secondary" icon={<Pencil size={12}/>}
                  onClick={()=>{setEditingProduct(detail as any);setShowProductModal(true)}}>
                  Bearbeiten
                </Button>
              </div>
            </div>

            {/* Rohstoffe */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FlaskConical size={14} className="text-brand-400"/> Rohstoffe / Rezeptur
                </h4>
                <Button size="sm" icon={<Plus size={12}/>} onClick={()=>setShowMatModal(true)}>
                  Rohstoff
                </Button>
              </div>
              {!detail.materials?.length ? (
                <p className="text-xs text-slate-600 text-center py-4">Noch keine Rohstoffe</p>
              ) : (
                <div className="space-y-2">
                  {detail.materials.map(m=>(
                    <MaterialRow key={m.id} mat={m} onDelete={id=>deleteMat.mutate({matId:id})}/>
                  ))}
                </div>
              )}
            </div>

            {/* Varianten */}
            <div className="glass-card p-4">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
                <Layers size={14} className="text-cyan-400"/> Varianten & Kosten
              </h4>
              {!detail.variants?.length ? (
                <p className="text-xs text-slate-600 text-center py-4">Noch keine Varianten</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detail.variants.map(v=>(
                    <div key={v.id} className="p-3 rounded-xl bg-white/3 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{v.name}</p>
                          <p className="text-xs text-slate-500">{v.fill_quantity} {v.fill_unit}</p>
                        </div>
                        <span className="badge-blue text-xs">{v.code}</span>
                      </div>
                      {v.packaging_name && <p className="text-xs text-slate-500 mb-1">📦 {v.packaging_name}</p>}
                      {v.label_name     && <p className="text-xs text-slate-500 mb-1">🏷 {v.label_name}</p>}
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <VariantCostCard variantId={v.id}/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showGroupModal && (
        <GroupModal group={editingGroup}
          onSave={d=>editingGroup?updateGroup.mutate({id:editingGroup.id,d}):createGroup.mutate(d)}
          onClose={()=>setShowGroupModal(false)}/>
      )}

      {showProductModal && (
        <Modal open onClose={()=>setShowProductModal(false)}
          title={editingProduct?'Produkt bearbeiten':'Neues Produkt'} size="md">
          <ProductForm
            initial={editingProduct} groups={groups}
            onSave={d=>editingProduct?updateProd.mutate({id:editingProduct.id,d}):createProd.mutate(d)}
            onClose={()=>setShowProductModal(false)}
            loading={createProd.isPending||updateProd.isPending}/>
        </Modal>
      )}

      {showMatModal && selectedProduct && (
        <Modal open onClose={()=>setShowMatModal(false)} title="Rohstoff hinzufügen" size="sm">
          <div className="space-y-3">
            <Select label="Rohstoff *" value={newMatForm.material_id}
              onChange={e=>setNewMatForm(f=>({...f,material_id:e.target.value}))}>
              <option value="">– Wählen –</option>
              {(allMaterials as any[]).map((m:any)=>(
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Menge *" type="number" step="0.001" value={newMatForm.quantity}
                onChange={e=>setNewMatForm(f=>({...f,quantity:e.target.value}))}/>
              <Select label="Einheit" value={newMatForm.unit}
                onChange={e=>setNewMatForm(f=>({...f,unit:e.target.value}))}>
                {['g','kg','ml','l'].map(u=><option key={u}>{u}</option>)}
              </Select>
              <Input label="Ausschuss %" type="number" step="0.01" value={newMatForm.waste_factor}
                onChange={e=>setNewMatForm(f=>({...f,waste_factor:e.target.value}))}/>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={()=>setShowMatModal(false)}>Abbrechen</Button>
              <Button loading={saveMat.isPending}
                disabled={!newMatForm.material_id||!newMatForm.quantity}
                onClick={()=>saveMat.mutate({d:{
                  material_id:Number(newMatForm.material_id),
                  quantity:Number(newMatForm.quantity),
                  unit:newMatForm.unit,
                  waste_factor:Number(newMatForm.waste_factor)/100,
                }})}>
                Hinzufügen
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deletingProduct} title="Produkt löschen?"
        message={`"${deletingProduct?.name}" und alle Varianten wirklich löschen?`}
        onConfirm={()=>deletingProduct&&deleteProd.mutate(deletingProduct.id)}
        onCancel={()=>setDeletingProduct(undefined)} loading={deleteProd.isPending}/>
    </div>
  )
}

function ProductForm({ initial, groups, onSave, onClose, loading }: {
  initial?: Product; groups: ProductGroup[]; onSave:(d:unknown)=>void; onClose:()=>void; loading?:boolean
}) {
  const [form, setForm] = useState({
    name:             initial?.name            ?? '',
    code:             initial?.code            ?? '',
    product_group_id: initial?.product_group_id?.toString() ?? '',
    batch_size:       initial?.batch_size       ?? 1000,
    batch_unit:       initial?.batch_unit       ?? 'g',
    overhead_factor:  initial ? ((initial.overhead_factor-1)*100) : 5,
  })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input label="Name *" value={form.name} autoFocus onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
        </div>
        <Input label="Code *" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))}/>
        <Select label="Produktgruppe" value={form.product_group_id}
          onChange={e=>setForm(f=>({...f,product_group_id:e.target.value}))}>
          <option value="">– Keine –</option>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <Input label="Batch-Größe" type="number" value={form.batch_size}
          onChange={e=>setForm(f=>({...f,batch_size:Number(e.target.value)}))}/>
        <Select label="Batch-Einheit" value={form.batch_unit}
          onChange={e=>setForm(f=>({...f,batch_unit:e.target.value}))}>
          {['g','kg','ml','l'].map(u=><option key={u}>{u}</option>)}
        </Select>
        <Input label="Overhead %" type="number" step="0.1" value={form.overhead_factor}
          onChange={e=>setForm(f=>({...f,overhead_factor:Number(e.target.value)}))}
          hint="z.B. 5 = 5% Aufschlag auf Rohstoffkosten"/>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button loading={loading} onClick={()=>onSave({
          ...initial, ...form,
          product_group_id: form.product_group_id ? Number(form.product_group_id) : null,
          overhead_factor: 1 + form.overhead_factor/100,
        })}>{initial?'Speichern':'Anlegen'}</Button>
      </div>
    </div>
  )
}
