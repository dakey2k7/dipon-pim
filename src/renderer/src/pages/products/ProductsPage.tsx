import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, Package, ChevronRight,
  FlaskConical, Star, Calculator, Layers, Download, Upload, FileSpreadsheet,
} from 'lucide-react'
import { useToast }    from '@/hooks/useToast'
import { Button }      from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal }       from '@/components/ui/Modal'
import { Spinner, Card, EmptyState, ConfirmDialog, Badge, SkeletonList, SkeletonCard } from '@/components/ui/Badge'

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
  const nav = useNavigate()
  const qc    = useQueryClient()
  const toast = useToast()

  const [tab, setTab] = useState<'products'|'2k'>('products')
  const [show2kModal, setShow2kModal] = useState(false)
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

  if (isLoading) return (
    <div>
      <div className="page-header mb-4">
        <div><div className="h-7 w-32 bg-white/5 rounded-lg animate-pulse"/></div>
      </div>
      <div className="flex gap-4">
        <div className="w-72 space-y-2"><SkeletonList items={6}/></div>
        <div className="flex-1 space-y-3"><SkeletonCard/><SkeletonCard/></div>
      </div>
    </div>
  )

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
          {tab === 'products' && (<>
            <div className="flex items-center gap-1">
              <button onClick={async()=>{const r=await (window.api as any).exportImport?.exportProductsTemplate?.();if(r?.success){}}}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                <Download size={11}/>Vorlage
              </button>
              <button onClick={async()=>{const r=await (window.api as any).exportImport?.exportProductsXlsx?.();}}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                <FileSpreadsheet size={11}/>Excel
              </button>
              <button onClick={async()=>{const r=await (window.api as any).exportImport?.importProducts?.();if(r?.success)qc.invalidateQueries({queryKey:['products']})}}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                <Upload size={11}/>Import
              </button>
            </div>
            <Button icon={<Plus size={14}/>}
              onClick={()=>nav('/products/new')}>
              Produkt anlegen
            </Button>
          </>)}
          {tab === '2k' && (
            <Button icon={<Plus size={14}/>}
              onClick={()=>setShow2kModal(true)}>
              2K-Produkt anlegen
            </Button>
          )}
        </div>
      </div>

      {/* Tab-Leiste */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)'}}>
        {[{id:'products',l:'Rezepturen / Komponenten'},{id:'2k',l:'2K-Produkte'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab===t.id?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='2k' && <Products2kTab externalOpen={show2kModal} onExternalOpenHandled={()=>setShow2kModal(false)}/>}

      {tab==='products' && <div className="flex gap-4">
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

        {/* Rechte Spalte – Detailansicht + Live-Kalkulation */}
        {!selectedProduct ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState icon={<Package size={40}/>} title="Produkt auswählen"
              description="Wähle links ein Produkt oder lege ein neues an."/>
          </div>
        ) : !detail ? <Spinner/> : (
          <div className="flex-1 flex gap-4 min-w-0">
          <div className="flex-1 space-y-4 min-w-0">
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
                <button onClick={()=>nav(`/products/new`)}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <Pencil size={11}/>Rezeptur bearbeiten →
                </button>
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

          {/* Live-Kalkulation Panel */}
          {detail.materials?.length > 0 && (() => {
            const mats = detail.materials as any[]
            const total = mats.reduce((s:number,m:any)=>s+(m.quantity||0),0)
            const colors = ['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#ef4444','#a78bfa','#34d399']
            const priceKg = mats.reduce((s:number,m:any,i:number)=>{
              const qty=m.quantity||0; const p=m.pref_price||0
              return s + (total>0?(qty/total)*p:0)
            },0)
            return (
              <div className="w-60 shrink-0">
                <div className="glass-card p-4 sticky top-4" style={{border:'1px solid rgba(139,92,246,0.2)'}}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Live-Kalkulation</p>
                  {/* Prozentbalken */}
                  <div className="flex rounded-full overflow-hidden h-2 mb-3">
                    {mats.filter((m:any)=>m.quantity>0).map((m:any,i:number)=>{
                      const pct=total>0?((m.quantity||0)/total)*100:0
                      return <div key={m.id} style={{width:`${pct}%`,background:colors[i%colors.length]}} title={`${m.material_name}: ${pct.toFixed(1)}%`}/>
                    })}
                  </div>
                  {/* Zeilen */}
                  <div className="space-y-1 mb-3">
                    {mats.map((m:any,i:number)=>{
                      const pct=total>0?((m.quantity||0)/total)*100:0
                      return (
                        <div key={m.id} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-slate-600">{i+1}</span>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{background:colors[i%colors.length]}}/>
                            <span className="text-slate-400 truncate">{m.material_name}</span>
                          </div>
                          <div className="text-right shrink-0 ml-1">
                            <span className="text-slate-300 font-mono">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Gewicht */}
                  <div className="border-t border-white/8 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Charge</span>
                      <span className="font-mono text-slate-300">{total} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">pro kg</span>
                      <span className="font-mono text-slate-300">{(total/1000*1).toFixed(4)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">pro 100g</span>
                      <span className="font-mono text-slate-300">{(total/10000).toFixed(4)} kg</span>
                    </div>
                  </div>
                  {/* Preis */}
                  {priceKg>0&&(
                    <div className="mt-3 p-2 rounded-xl text-center" style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.2)'}}>
                      <p className="text-[10px] text-slate-500 mb-0.5">Preis / kg</p>
                      <p className="text-lg font-black text-white font-mono">{priceKg.toFixed(4).replace('.',',')} €</p>
                    </div>
                  )}
                  {/* Delete product button */}
                  <button onClick={()=>setDeletingProduct(detail as any)}
                    className="mt-3 w-full py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-all border border-red-500/20 flex items-center justify-center gap-1.5">
                    <Trash2 size={11}/>Produkt löschen
                  </button>
                </div>
              </div>
            )
          })()}
          </div>
        )}
      </div>}

      {tab==='products' && <>{/* Modals */}
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

      </>}
    {/* Delete confirmation - always rendered */}
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

// ─────────────────────────────────────────────────────────────
// 2K PRODUKTE SECTION (wird in Tab integriert)
// ─────────────────────────────────────────────────────────────

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
const EMPTY_VARIANT: Omit<Variant2k,'id'> = {
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
  const [variantForm, setVariantForm]           = useState<typeof EMPTY_VARIANT>(EMPTY_VARIANT)
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
                  onClick={()=>{setEditingVariant(undefined);setVariantForm({...EMPTY_VARIANT});setShowVariantModal(true)}}>
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
                              <button onClick={()=>{setEditingVariant(a);setVariantForm({...EMPTY_VARIANT,total_fill_kg:a.fill_amount});setShowVariantModal(true)}}
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
