import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react'
import { Button }          from '@/components/ui/Input'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal }           from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { ViewControls }    from '@/components/ui/ViewControls'
import { useToast }        from '@/hooks/useToast'

interface PackagingItem {
  id:number; name:string; code:string; type:string; material_type:string|null
  volume_ml:number|null; weight_g:number|null; color:string|null
  price_per_unit:number; currency:string; min_order_qty:number
  supplier_name:string|null; is_active:number; notes:string|null
}

const TYPES = [
  {v:'bottle',   l:'🍶 Flasche'},   {v:'canister', l:'🪣 Kanister'},
  {v:'jar',      l:'🫙 Dose/Glas'}, {v:'tube',     l:'🪥 Tube'},
  {v:'bag',      l:'👜 Beutel'},    {v:'drum',     l:'🛢 Trommel'},
  {v:'other',    l:'📦 Sonstige'},
]
const SORT_OPTIONS = [
  {value:'name_asc',  label:'Name A–Z'},   {value:'name_desc', label:'Name Z–A'},
  {value:'code_asc',  label:'Code A–Z'},   {value:'vol_asc',   label:'Volumen ↑'},
  {value:'price_asc', label:'Preis ↑'},    {value:'price_desc',label:'Preis ↓'},
]
const fmt = (v:number,c='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency:c,minimumFractionDigits:2}).format(v)

const EMPTY = { name:'',code:'',type:'bottle',material_type:'',volume_ml:'',weight_g:'',
  color:'',supplier_id:'',price_per_unit:'',currency:'EUR',min_order_qty:1,notes:'',is_active:1 }

function PackagingForm({initial,suppliers,categories,onSave,onClose,loading}:any) {
  const [f,setF] = useState(initial ? {
    name:initial.name,code:initial.code,type:initial.type||'bottle',
    material_type:initial.material_type||'',volume_ml:initial.volume_ml||'',
    weight_g:initial.weight_g||'',color:initial.color||'',
    price_per_unit:initial.price_per_unit||'',currency:initial.currency||'EUR',
    min_order_qty:initial.min_order_qty||1,notes:initial.notes||'',is_active:initial.is_active??1,
  } : EMPTY)
  const s=(k:string,v:unknown)=>setF((p:any)=>({...p,[k]:v}))
  return(
    <form onSubmit={e=>{e.preventDefault();onSave(f)}} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Input label="Name *" value={f.name} autoFocus onChange={e=>s('name',e.target.value)}/></div>
        <Input label="Code *" value={f.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
        <Select label="Typ" value={f.type} onChange={e=>s('type',e.target.value)}>
          {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </Select>
        <Input label="Material" value={f.material_type} onChange={e=>s('material_type',e.target.value)} placeholder="PE, PP, Glas, Alu…"/>
        <Input label="Farbe" value={f.color} onChange={e=>s('color',e.target.value)} placeholder="weiß, natur, schwarz…"/>
        <Input label="Volumen (ml)" type="number" step="1" value={f.volume_ml} onChange={e=>s('volume_ml',e.target.value)}/>
        <Input label="Gewicht (g)" type="number" step="1" value={f.weight_g} onChange={e=>s('weight_g',e.target.value)}/>
        <Input label="Preis/Stück *" type="number" step="0.0001" value={f.price_per_unit} onChange={e=>s('price_per_unit',e.target.value)}/>
        <Select label="Währung" value={f.currency} onChange={e=>s('currency',e.target.value)}>
          {['EUR','USD','GBP','CHF','PLN'].map(c=><option key={c}>{c}</option>)}
        </Select>
        <Input label="Mindestmenge" type="number" step="1" min="1" value={f.min_order_qty} onChange={e=>s('min_order_qty',Number(e.target.value))}/>
        <Select label="Status" value={f.is_active} onChange={e=>s('is_active',Number(e.target.value))}>
          <option value={1}>Aktiv</option><option value={0}>Inaktiv</option>
        </Select>
        <div className="col-span-2"><Textarea label="Notizen" value={f.notes} rows={2} onChange={e=>s('notes',e.target.value)}/></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button type="submit" loading={loading}>{initial?'Speichern':'Anlegen'}</Button>
      </div>
    </form>
  )
}

export default function PackagingPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState(''); const [type,setType]=useState('')
  const [viewMode,setViewMode]=useState<'grid'|'list'>('grid')
  const [sortBy,setSortBy]=useState('name_asc')
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<PackagingItem|undefined>()
  const [deleting,setDeleting]=useState<PackagingItem|undefined>()

  const {data=[],isLoading}=useQuery<PackagingItem[]>({
    queryKey:['packaging',search,type],
    queryFn:()=>window.api.packaging.list({search:search||undefined,type:type||undefined}) as Promise<PackagingItem[]>,
  })
  const items=([...data] as PackagingItem[]).sort((a,b)=>{
    if(sortBy==='name_asc')  return a.name.localeCompare(b.name)
    if(sortBy==='name_desc') return b.name.localeCompare(a.name)
    if(sortBy==='code_asc')  return a.code.localeCompare(b.code)
    if(sortBy==='vol_asc')   return (a.volume_ml??0)-(b.volume_ml??0)
    if(sortBy==='price_asc') return a.price_per_unit-b.price_per_unit
    if(sortBy==='price_desc')return b.price_per_unit-a.price_per_unit
    return 0
  })
  const inv=()=>qc.invalidateQueries({queryKey:['packaging']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.packaging.create(d),onSuccess:()=>{inv();setOpen(false);toast.success('Angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:unknown})=>window.api.packaging.update(id,d),onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.packaging.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})
  const submit=(d:unknown)=>editing?updateM.mutate({id:editing.id,d}):createM.mutate(d)
  const typeIcon=(t:string)=>TYPES.find(x=>x.v===t)?.l.split(' ')[0]||'📦'

  if(isLoading) return <Spinner/>
  return(
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Verpackungen</h2><p className="page-subtitle">{items.length} Artikel</p></div>
        <Button icon={<Plus size={14}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>Anlegen</Button>
      </div>
      <div className="flex gap-2 mb-4">
        <select className="form-input w-40 text-sm" value={type} onChange={e=>setType(e.target.value)}>
          <option value="">Alle Typen</option>
          {TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
      </div>
      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy}
        sortOptions={SORT_OPTIONS} search={search} onSearch={setSearch} searchPlaceholder="Name, Code…"/>
      {/* Grid */}
      {viewMode==='grid'&&(!items.length?<div className="glass-card"><EmptyState icon={<Package size={40}/>} title="Keine Verpackungen" action={<Button icon={<Plus size={14}/>} onClick={()=>setOpen(true)}>Anlegen</Button>}/></div>:
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map(i=>(
            <div key={i.id} className="glass-card p-4 group hover:border-white/10 transition-all">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{typeIcon(i.type)}</span>
                <Badge variant={i.is_active?'green':'slate'}>{i.is_active?'Aktiv':'Inakt.'}</Badge>
              </div>
              <p className="text-sm font-bold text-slate-200 truncate">{i.name}</p>
              <p className="text-xs text-slate-500 mb-2">{i.code}</p>
              {i.volume_ml&&<p className="text-xs text-slate-400">{i.volume_ml} ml</p>}
              {i.material_type&&<p className="text-xs text-slate-500">{i.material_type}{i.color?` · ${i.color}`:''}</p>}
              <p className="text-sm font-bold text-brand-400 mt-2">{fmt(i.price_per_unit,i.currency)}</p>
              <p className="text-xs text-slate-600">Min. {i.min_order_qty} Stk</p>
              <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="secondary" icon={<Pencil size={11}/>} onClick={()=>{setEditing(i);setOpen(true)}}>Edit</Button>
                <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(i)}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Liste */}
      {viewMode==='list'&&(
        <div className="glass-card overflow-hidden">
          {!items.length?<EmptyState icon={<Package size={40}/>} title="Keine Verpackungen" action={<Button icon={<Plus size={14}/>} onClick={()=>setOpen(true)}>Anlegen</Button>}/>:(
            <table className="w-full"><thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
              <th className="table-th">Name</th><th className="table-th">Typ</th><th className="table-th text-right">Volumen</th>
              <th className="table-th">Material</th><th className="table-th text-right">Preis</th>
              <th className="table-th text-center">Status</th><th className="table-th text-right"/>
            </tr></thead><tbody>
              {items.map(i=>(
                <tr key={i.id} className="table-row group">
                  <td className="table-td"><div className="flex items-center gap-2"><span>{typeIcon(i.type)}</span><div><p className="font-medium text-slate-200">{i.name}</p><p className="text-xs text-slate-500">{i.code}</p></div></div></td>
                  <td className="table-td text-slate-400 text-sm">{TYPES.find(t=>t.v===i.type)?.l.replace(/^./,'').trim()}</td>
                  <td className="table-td text-right font-mono text-slate-300">{i.volume_ml?`${i.volume_ml} ml`:'–'}</td>
                  <td className="table-td text-slate-400 text-sm">{i.material_type||'–'}</td>
                  <td className="table-td text-right font-mono font-semibold text-slate-200">{fmt(i.price_per_unit,i.currency)}</td>
                  <td className="table-td text-center"><Badge variant={i.is_active?'green':'slate'}>{i.is_active?'Aktiv':'Inakt.'}</Badge></td>
                  <td className="table-td text-right"><div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100">
                    <button className="btn-ghost p-1.5" onClick={()=>{setEditing(i);setOpen(true)}}><Pencil size={13}/></button>
                    <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(i)}><Trash2 size={13}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Verpackung bearbeiten':'Neue Verpackung'} size="lg">
        <PackagingForm initial={editing} onSave={submit} onClose={()=>setOpen(false)} loading={createM.isPending||updateM.isPending}/>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Löschen?" message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
