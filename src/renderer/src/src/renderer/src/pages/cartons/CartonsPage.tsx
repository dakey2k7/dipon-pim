import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Box } from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { ViewControls } from '@/components/ui/ViewControls'
import { useToast } from '@/hooks/useToast'

interface CartonItem { id:number; name:string; code:string; width_mm:number|null; height_mm:number|null; depth_mm:number|null; weight_g:number|null; max_weight_kg:number|null; units_per_carton:number; price_per_unit:number; currency:string; min_order_qty:number; supplier_name:string|null; is_active:number; notes:string|null }
const fmt=(v:number,c='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency:c,minimumFractionDigits:2}).format(v)
const SORT_OPTIONS=[{value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},{value:'size_asc',label:'Größe ↑'},{value:'price_asc',label:'Preis ↑'}]
const EMPTY={name:'',code:'',width_mm:'',height_mm:'',depth_mm:'',weight_g:'',max_weight_kg:'',units_per_carton:1,price_per_unit:'',currency:'EUR',min_order_qty:100,notes:'',is_active:1}

export default function CartonsPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState(''); const [viewMode,setViewMode]=useState<'grid'|'list'>('list')
  const [sortBy,setSortBy]=useState('name_asc'); const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<CartonItem|undefined>(); const [deleting,setDeleting]=useState<CartonItem|undefined>()
  const [form,setForm]=useState<any>(EMPTY)
  const s=(k:string,v:unknown)=>setForm((p:any)=>({...p,[k]:v}))

  const {data=[],isLoading}=useQuery<CartonItem[]>({queryKey:['cartons',search],queryFn:()=>window.api.cartons.list(search||undefined) as Promise<CartonItem[]>})
  const items=([...data] as CartonItem[]).sort((a,b)=>{
    if(sortBy==='name_asc')  return a.name.localeCompare(b.name)
    if(sortBy==='name_desc') return b.name.localeCompare(a.name)
    if(sortBy==='price_asc') return a.price_per_unit-b.price_per_unit
    if(sortBy==='size_asc')  return ((a.width_mm??0)*(a.height_mm??0)*(a.depth_mm??0))-((b.width_mm??0)*(b.height_mm??0)*(b.depth_mm??0))
    return 0
  })
  const inv=()=>qc.invalidateQueries({queryKey:['cartons']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.cartons.create(d),onSuccess:()=>{inv();setOpen(false);toast.success('Karton angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:unknown})=>window.api.cartons.update(id,d),onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.cartons.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})
  const openNew=()=>{setForm(EMPTY);setEditing(undefined);setOpen(true)}
  const openEdit=(i:CartonItem)=>{setForm({...i,width_mm:i.width_mm||'',height_mm:i.height_mm||'',depth_mm:i.depth_mm||'',weight_g:i.weight_g||'',max_weight_kg:i.max_weight_kg||'',price_per_unit:i.price_per_unit||''});setEditing(i);setOpen(true)}
  const submit=()=>{
    const d={...form,width_mm:form.width_mm?Number(form.width_mm):null,height_mm:form.height_mm?Number(form.height_mm):null,depth_mm:form.depth_mm?Number(form.depth_mm):null,weight_g:form.weight_g?Number(form.weight_g):null,max_weight_kg:form.max_weight_kg?Number(form.max_weight_kg):null,price_per_unit:Number(form.price_per_unit),units_per_carton:Number(form.units_per_carton)}
    editing?updateM.mutate({id:editing.id,d}):createM.mutate(d)
  }

  if(isLoading) return <Spinner/>
  return(
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Kartonagen</h2><p className="page-subtitle">{items.length} Kartons</p></div>
        <Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>
      </div>
      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy} sortOptions={SORT_OPTIONS} search={search} onSearch={setSearch} searchPlaceholder="Name, Code…"/>
      {viewMode==='grid'&&(!items.length?<div className="glass-card"><EmptyState icon={<Box size={40}/>} title="Keine Kartonagen" action={<Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>}/></div>:
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(i=>(
            <div key={i.id} className="glass-card p-4 group hover:border-white/10">
              <Box size={20} className="text-teal-400 mb-3"/>
              <p className="text-sm font-bold text-slate-200 truncate">{i.name}</p>
              <p className="text-xs text-slate-500 mb-2">{i.code}</p>
              {i.width_mm&&<p className="text-xs text-slate-400">{i.width_mm}×{i.height_mm}×{i.depth_mm} mm</p>}
              {i.max_weight_kg&&<p className="text-xs text-slate-500">Max {i.max_weight_kg} kg</p>}
              <p className="text-xs text-slate-500">{i.units_per_carton} Stk/Karton</p>
              <p className="text-sm font-bold text-brand-400 mt-2">{fmt(i.price_per_unit,i.currency)}</p>
              <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100">
                <Button size="sm" variant="secondary" icon={<Pencil size={11}/>} onClick={()=>openEdit(i)}>Edit</Button>
                <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(i)}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {viewMode==='list'&&(
        <div className="glass-card overflow-hidden">
          {!items.length?<EmptyState icon={<Box size={40}/>} title="Keine Kartonagen" action={<Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>}/>:(
            <table className="w-full"><thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
              <th className="table-th">Name</th><th className="table-th text-right">Maße (mm)</th>
              <th className="table-th text-right">Max. kg</th><th className="table-th text-right">Stk/Karton</th>
              <th className="table-th text-right">Preis</th><th className="table-th text-right"/>
            </tr></thead><tbody>
              {items.map(i=>(
                <tr key={i.id} className="table-row group">
                  <td className="table-td"><p className="font-medium text-slate-200">{i.name}</p><p className="text-xs text-slate-500">{i.code}</p></td>
                  <td className="table-td text-right font-mono text-slate-300 text-xs">{i.width_mm?`${i.width_mm}×${i.height_mm}×${i.depth_mm}`:'–'}</td>
                  <td className="table-td text-right text-slate-400">{i.max_weight_kg??'–'}</td>
                  <td className="table-td text-right text-slate-400">{i.units_per_carton}</td>
                  <td className="table-td text-right font-mono font-semibold text-slate-200">{fmt(i.price_per_unit,i.currency)}</td>
                  <td className="table-td text-right"><div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100">
                    <button className="btn-ghost p-1.5" onClick={()=>openEdit(i)}><Pencil size={13}/></button>
                    <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(i)}><Trash2 size={13}/></button>
                  </div></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      )}
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Karton bearbeiten':'Neuer Karton'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Input label="Name *" value={form.name} autoFocus onChange={e=>s('name',e.target.value)}/></div>
            <Input label="Code *" value={form.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
            <Input label="Stk/Karton" type="number" min="1" value={form.units_per_carton} onChange={e=>s('units_per_carton',e.target.value)}/>
            <Input label="Breite (mm)" type="number" step="1" value={form.width_mm} onChange={e=>s('width_mm',e.target.value)}/>
            <Input label="Höhe (mm)" type="number" step="1" value={form.height_mm} onChange={e=>s('height_mm',e.target.value)}/>
            <Input label="Tiefe (mm)" type="number" step="1" value={form.depth_mm} onChange={e=>s('depth_mm',e.target.value)}/>
            <Input label="Eigengewicht (g)" type="number" step="1" value={form.weight_g} onChange={e=>s('weight_g',e.target.value)}/>
            <Input label="Max. Nutzlast (kg)" type="number" step="0.1" value={form.max_weight_kg} onChange={e=>s('max_weight_kg',e.target.value)}/>
            <Input label="Preis/Stück *" type="number" step="0.0001" value={form.price_per_unit} onChange={e=>s('price_per_unit',e.target.value)}/>
            <Select label="Währung" value={form.currency} onChange={e=>s('currency',e.target.value)}>
              {['EUR','USD','GBP','CHF','PLN'].map(c=><option key={c}>{c}</option>)}
            </Select>
            <Input label="Mindestmenge" type="number" step="1" value={form.min_order_qty} onChange={e=>s('min_order_qty',Number(e.target.value))}/>
            <div className="col-span-2"><Textarea label="Notizen" value={form.notes} rows={2} onChange={e=>s('notes',e.target.value)}/></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={()=>setOpen(false)}>Abbrechen</Button>
            <Button loading={createM.isPending||updateM.isPending} onClick={submit}>{editing?'Speichern':'Anlegen'}</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Löschen?" message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
