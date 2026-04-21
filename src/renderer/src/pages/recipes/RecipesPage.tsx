import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Trash2, Search, Package, AlertCircle, ChevronDown, ChevronUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

interface Product { id:number; name:string; code:string; group_name:string|null; group_color:string|null; batch_size:number; batch_unit:string; material_count:number; variant_count:number }
interface Material { id:number; name:string; code:string; unit:string; preferred_price:number|null; preferred_currency:string|null }
type PM = { id:number; material_id:number; material_name:string; material_code:string; quantity:number; unit:string; waste_factor:number; pref_price:number|null; pref_currency:string|null; pref_supplier_name:string|null; all_prices_json:string|null }

const fmt=(v:number,c='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency:c,minimumFractionDigits:4}).format(v)
const SORT=[{value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},{value:'mats_desc',label:'Meiste Stoffe'}]

function RecipeCard({product,defaultOpen=false}:{product:Product;defaultOpen?:boolean}) {
  const qc=useQueryClient(); const toast=useToast()
  const [open,setOpen]=useState(defaultOpen)
  const [showAdd,setShowAdd]=useState(false)
  const [addForm,setAddForm]=useState({material_id:'',quantity:'',unit:'g',waste_factor:'0'})
  const {data:detail}=useQuery<{materials:PM[];variants:any[]}>({queryKey:['product-detail',product.id],queryFn:()=>window.api.products.get(product.id) as Promise<any>,enabled:open})
  const {data:allMats=[]}=useQuery<Material[]>({queryKey:['materials'],queryFn:()=>window.api.materials.list() as Promise<Material[]>})
  const invD=()=>qc.invalidateQueries({queryKey:['product-detail',product.id]})
  const saveMat=useMutation({mutationFn:(d:unknown)=>window.api.products.saveMaterial(product.id,d),onSuccess:()=>{invD();setShowAdd(false);setAddForm({material_id:'',quantity:'',unit:'g',waste_factor:'0'});toast.success('Rohstoff hinzugefügt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const delMat=useMutation({mutationFn:(id:number)=>window.api.products.deleteMaterial(product.id,id),onSuccess:invD})
  const mats=detail?.materials??[]

  return(
    <div className="glass-card overflow-hidden mb-2">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/3 transition-colors" onClick={()=>setOpen(v=>!v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
            style={{background:`${product.group_color||'#8b5cf6'}20`,color:product.group_color||'#8b5cf6'}}>
            {product.code.slice(0,2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-200">{product.name}</p>
              <span className="badge-blue text-xs font-mono">{product.code}</span>
              {product.group_name&&<span className="text-xs text-slate-500">{product.group_name}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-slate-500">{product.batch_size} {product.batch_unit} Batch</span>
              {product.material_count>0
                ?<span className="badge-blue text-xs">{product.material_count} Rohstoffe</span>
                :<span className="text-xs text-slate-600 flex items-center gap-1"><AlertCircle size={10}/>Kein Rezept</span>}
              {product.variant_count>0&&<span className="badge-slate text-xs">{product.variant_count} Varianten</span>}
            </div>
          </div>
        </div>
        {open?<ChevronUp size={15} className="text-slate-500 shrink-0"/>:<ChevronDown size={15} className="text-slate-500 shrink-0"/>}
      </div>
      {open&&(
        <div className="px-4 pb-4 border-t border-white/5 space-y-2">
          {!mats.length&&<p className="text-xs text-slate-600 italic py-2">Noch keine Rohstoffe in der Rezeptur</p>}
          {mats.map((m:PM)=>{
            let prices:any[]=[]
            try{prices=m.all_prices_json?JSON.parse(m.all_prices_json):[]}catch{}
            return(
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl group"
                style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.05)'}}>
                <div className="flex items-center gap-2">
                  <FlaskConical size={12} className="text-brand-400 shrink-0"/>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{m.material_name}</p>
                    <p className="text-[10px] text-slate-500">{m.quantity} {m.unit}{m.waste_factor>0?` +${(m.waste_factor*100).toFixed(0)}% Ausschuss`:''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {prices.length>1&&(
                    <select className="form-input text-xs py-0.5 w-36" defaultValue={prices.find((p:any)=>p.is_preferred)?.supplier_id||''}>
                      {prices.map((p:any)=><option key={p.supplier_id} value={p.supplier_id}>{p.is_preferred?'★ ':''}{p.supplier_name}</option>)}
                    </select>
                  )}
                  <span className="text-xs font-mono text-slate-300">{m.pref_price!=null?`${fmt(m.pref_price,m.pref_currency||'EUR')}/${m.unit}`:'-'}</span>
                  <button onClick={()=>delMat.mutate(m.id)} className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={11}/></button>
                </div>
              </div>
            )
          })}
          {showAdd?(
            <div className="p-3 rounded-xl space-y-2" style={{background:'rgb(139 92 246/0.05)',border:'1px solid rgb(139 92 246/0.2)'}}>
              <Select label="Rohstoff *" value={addForm.material_id} onChange={e=>setAddForm(f=>({...f,material_id:e.target.value}))}>
                <option value="">– Wählen –</option>
                {allMats.map((m:Material)=><option key={m.id} value={m.id}>{m.name} ({m.code}){m.preferred_price!=null?` — ${fmt(m.preferred_price,m.preferred_currency||'EUR')}/${m.unit}`:''}</option>)}
              </Select>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Menge *" type="number" step="0.001" value={addForm.quantity} onChange={e=>setAddForm(f=>({...f,quantity:e.target.value}))}/>
                <Select label="Einheit" value={addForm.unit} onChange={e=>setAddForm(f=>({...f,unit:e.target.value}))}>
                  {['g','kg','ml','l'].map(u=><option key={u}>{u}</option>)}
                </Select>
                <Input label="Ausschuss %" type="number" step="0.1" value={addForm.waste_factor} onChange={e=>setAddForm(f=>({...f,waste_factor:e.target.value}))}/>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={saveMat.isPending} disabled={!addForm.material_id||!addForm.quantity}
                  onClick={()=>saveMat.mutate({material_id:Number(addForm.material_id),quantity:Number(addForm.quantity),unit:addForm.unit,waste_factor:Number(addForm.waste_factor)/100})}>
                  Hinzufügen
                </Button>
                <Button size="sm" variant="secondary" onClick={()=>setShowAdd(false)}>Abbrechen</Button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowAdd(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
              style={{border:'1px dashed rgb(255 255 255/0.08)'}}>
              <Plus size={11}/> Rohstoff hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState('')
  const [filterGroup,setFilterGroup]=useState('')
  const [sortBy,setSortBy]=useState('name_asc')
  const [showNew,setShowNew]=useState(false)
  const [showImport,setShowImport]=useState(false)   // ← war missing
  const [newForm,setNewForm]=useState({name:'',code:'',product_group_id:'',batch_size:1000,batch_unit:'g',overhead_factor:5,has_recipe:true})
  const [deleting,setDeleting]=useState<Product|undefined>()

  const {data:products=[],isLoading}=useQuery<Product[]>({queryKey:['products',search,filterGroup],queryFn:()=>window.api.products.list({search:search||undefined,group_id:filterGroup?Number(filterGroup):undefined}) as Promise<Product[]>})
  const {data:groups=[]}=useQuery<any[]>({queryKey:['product-groups'],queryFn:()=>window.api.productGroups.list() as Promise<any[]>})
  const sorted=([...products] as Product[]).sort((a,b)=>sortBy==='name_desc'?b.name.localeCompare(a.name):sortBy==='mats_desc'?(b.material_count??0)-(a.material_count??0):a.name.localeCompare(b.name))
  const inv=()=>qc.invalidateQueries({queryKey:['products']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.products.create(d),onSuccess:()=>{inv();setShowNew(false);toast.success('Angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.products.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})
  const withRecipe=sorted.filter(p=>(p.material_count??0)>0)
  const withoutRecipe=sorted.filter(p=>(p.material_count??0)===0)

  if(isLoading) return <Spinner/>
  return(
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Rezepturen & Komponenten</h2>
          <p className="page-subtitle">{withRecipe.length} mit Rezept · {withoutRecipe.length} Einzelartikel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Upload size={14}/>} onClick={()=>setShowImport(true)}>
            Excel Import
          </Button>
          <Button icon={<Plus size={14}/>} onClick={()=>setShowNew(true)}>Produkt anlegen</Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-full text-sm" placeholder="Suchen …" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input w-44 text-sm" value={filterGroup} onChange={e=>setFilterGroup(e.target.value)}>
          <option value="">Alle Gruppen</option>
          {groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="form-input w-40 text-sm" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
          {SORT.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!sorted.length
        ?<div className="glass-card p-12 text-center">
          <FlaskConical size={48} className="text-slate-700 mx-auto mb-4"/>
          <p className="text-slate-500">Noch keine Produkte.<br/>Lege Produkte mit oder ohne Rezeptur an.</p>
          <Button className="mt-4" icon={<Plus size={14}/>} onClick={()=>setShowNew(true)}>Erstes Produkt</Button>
        </div>
        :<div className="space-y-4">
          {withRecipe.length>0&&<div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-2">
              <FlaskConical size={11}/>Mit Rezeptur ({withRecipe.length})
            </p>
            {withRecipe.map(p=><RecipeCard key={p.id} product={p}/>)}
          </div>}
          {withoutRecipe.length>0&&<div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-2">
              <Package size={11}/>Einzelartikel ohne Rezept ({withoutRecipe.length})
            </p>
            {withoutRecipe.map(p=><RecipeCard key={p.id} product={p}/>)}
          </div>}
        </div>
      }

      {/* Modal: Neues Produkt */}
      <Modal open={showNew} onClose={()=>setShowNew(false)} title="Neues Produkt" size="md">
        <div className="space-y-4">
          <p className="text-xs text-slate-500 p-3 rounded-xl" style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.2)'}}>
            Produkte können mit oder ohne Rezeptur angelegt werden.
          </p>
          <div className="flex gap-3">
            {[{v:true,l:'🧪 Mit Rezeptur',s:'LuminaCast, Lacke, Harze …'},{v:false,l:'📦 Ohne Rezeptur',s:'Tiegeldosen, Kartons, Zubehör …'}].map(opt=>(
              <button key={String(opt.v)} type="button" onClick={()=>setNewForm(f=>({...f,has_recipe:opt.v}))}
                className={`flex-1 p-3 rounded-xl text-left border transition-all ${newForm.has_recipe===opt.v?'bg-brand-500/15 border-brand-500/30':'bg-white/3 border-white/8 hover:border-white/15'}`}>
                <p className="text-sm font-semibold text-slate-200">{opt.l}</p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.s}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Name *" value={newForm.name} autoFocus onChange={e=>setNewForm(f=>({...f,name:e.target.value,code:e.target.value.toUpperCase().replace(/\s+/g,'-').slice(0,12)}))}/>
            </div>
            <Input label="Code *" value={newForm.code} onChange={e=>setNewForm(f=>({...f,code:e.target.value.toUpperCase()}))}/>
            <Select label="Gruppe" value={newForm.product_group_id} onChange={e=>setNewForm(f=>({...f,product_group_id:e.target.value}))}>
              <option value="">– Keine –</option>
              {groups.map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
            {newForm.has_recipe&&(
              <>
                <Input label="Batch-Größe" type="number" value={newForm.batch_size} onChange={e=>setNewForm(f=>({...f,batch_size:Number(e.target.value)}))}/>
                <Select label="Batch-Einheit" value={newForm.batch_unit} onChange={e=>setNewForm(f=>({...f,batch_unit:e.target.value}))}>
                  {['g','kg','ml','l'].map(u=><option key={u}>{u}</option>)}
                </Select>
              </>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={()=>setShowNew(false)}>Abbrechen</Button>
            <Button loading={createM.isPending} disabled={!newForm.name||!newForm.code}
              onClick={()=>createM.mutate({name:newForm.name,code:newForm.code,product_group_id:newForm.product_group_id?Number(newForm.product_group_id):null,batch_size:newForm.has_recipe?newForm.batch_size:1,batch_unit:newForm.batch_unit,overhead_factor:1+newForm.overhead_factor/100})}>
              Anlegen
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Excel Import */}
      <Modal open={showImport} onClose={()=>setShowImport(false)} title="Rezepturen aus Excel importieren" size="md">
        <div className="space-y-4">
          <div className="p-4 rounded-xl text-center" style={{background:'rgb(59 130 246/0.05)',border:'2px dashed rgb(59 130 246/0.2)'}}>
            <Upload size={32} className="text-blue-400 mx-auto mb-3"/>
            <p className="text-sm font-semibold text-slate-200 mb-1">Excel-Datei hier ablegen oder klicken</p>
            <p className="text-xs text-slate-500">Unterstützt: .xlsx, .xls</p>
            <button className="mt-3 btn-primary text-sm px-4 py-2 rounded-lg">
              Datei auswählen
            </button>
          </div>
          <div className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
            <p className="text-xs font-semibold text-slate-400 mb-2">Erwartetes Format:</p>
            <p className="text-xs text-slate-500">Spalte A: Rohstoff-Name · B: Menge · C: Einheit · D: Ausschuss %</p>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={()=>setShowImport(false)}>Schließen</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Löschen?" message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
