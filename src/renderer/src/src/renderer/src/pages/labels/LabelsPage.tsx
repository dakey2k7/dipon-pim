import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tag, Zap } from 'lucide-react'
import { Button }          from '@/components/ui/Input'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal }           from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { ViewControls }    from '@/components/ui/ViewControls'
import { useToast }        from '@/hooks/useToast'

interface LabelItem {
  id:number; name:string; code:string; label_type:string; print_type:string
  width_mm:number|null; height_mm:number|null; shape:string
  material:string|null; finish:string|null
  price_per_unit:number; price_per_1000:number|null; currency:string
  min_order_qty:number; supplier_name:string|null; is_active:number; notes:string|null
}

const PRINT_TYPES=[{v:'digital',l:'Digital'},{v:'offset',l:'Offsetdruck'},{v:'flexo',l:'Flexodruck'},{v:'screen',l:'Siebdruck'},{v:'thermal',l:'Thermotransfer'}]
const LABEL_TYPES=[{v:'front',l:'Frontetikett'},{v:'back',l:'Rücketikett'},{v:'neck',l:'Halsetikett'},{v:'wrap',l:'Rundumetikett'},{v:'top',l:'Decketikett'},{v:'other',l:'Sonstiges'}]
const SORT_OPTIONS=[{value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},{value:'price_asc',label:'Preis ↑'},{value:'price_desc',label:'Preis ↓'},{value:'size_asc',label:'Größe ↑'}]
const fmt=(v:number,c='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency:c,minimumFractionDigits:3}).format(v)

const EMPTY={name:'',code:'',label_type:'front',print_type:'digital',width_mm:'',height_mm:'',shape:'rectangle',material:'',finish:'',price_per_unit:'',price_per_1000:'',currency:'EUR',min_order_qty:500,notes:'',is_active:1}

export default function LabelsPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState(''); const [viewMode,setViewMode]=useState<'grid'|'list'>('list')
  const [sortBy,setSortBy]=useState('name_asc'); const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<LabelItem|undefined>(); const [deleting,setDeleting]=useState<LabelItem|undefined>()
  const [form,setForm]=useState<any>(EMPTY)
  const s=(k:string,v:unknown)=>setForm((p:any)=>({...p,[k]:v}))

  const {data=[],isLoading}=useQuery<LabelItem[]>({queryKey:['labels',search],queryFn:()=>window.api.labels.list(search||undefined) as Promise<LabelItem[]>})
  const items=([...data] as LabelItem[]).sort((a,b)=>{
    if(sortBy==='name_asc')  return a.name.localeCompare(b.name)
    if(sortBy==='name_desc') return b.name.localeCompare(a.name)
    if(sortBy==='price_asc') return a.price_per_unit-b.price_per_unit
    if(sortBy==='price_desc')return b.price_per_unit-a.price_per_unit
    if(sortBy==='size_asc')  return ((a.width_mm??0)*(a.height_mm??0))-((b.width_mm??0)*(b.height_mm??0))
    return 0
  })
  const inv=()=>qc.invalidateQueries({queryKey:['labels']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.labels.create(d),onSuccess:()=>{inv();setOpen(false);toast.success('Etikett angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:unknown})=>window.api.labels.update(id,d),onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.labels.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})
  const openNew=()=>{setForm(EMPTY);setEditing(undefined);setOpen(true)}
  const openEdit=(i:LabelItem)=>{setForm({...i,width_mm:i.width_mm||'',height_mm:i.height_mm||'',price_per_unit:i.price_per_unit||'',price_per_1000:i.price_per_1000||''});setEditing(i);setOpen(true)}
  const submit=()=>{const d={...form,width_mm:form.width_mm?Number(form.width_mm):null,height_mm:form.height_mm?Number(form.height_mm):null,price_per_unit:Number(form.price_per_unit),price_per_1000:form.price_per_1000?Number(form.price_per_1000):null};editing?updateM.mutate({id:editing.id,d}):createM.mutate(d)}

  if(isLoading) return <Spinner/>
  return(
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Etiketten</h2><p className="page-subtitle">{items.length} Etiketten</p></div>
        <Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>
      </div>
      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy}
        sortOptions={SORT_OPTIONS} search={search} onSearch={setSearch} searchPlaceholder="Name, Code…"/>
      {viewMode==='grid'&&(!items.length
        ?<div className="glass-card"><EmptyState icon={<Tag size={40}/>} title="Keine Etiketten" action={<Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>}/></div>
        :<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map(i=>(
            <div key={i.id} className="glass-card p-4 group hover:border-white/10">
              <div className="flex justify-between mb-2">
                <Tag size={18} className="text-pink-400"/>
                <Badge variant={i.is_active?'green':'slate'}>{i.is_active?'Aktiv':'Inakt.'}</Badge>
              </div>
              <p className="text-sm font-bold text-slate-200 truncate">{i.name}</p>
              <p className="text-xs text-slate-500 mb-2">{i.code}</p>
              {i.width_mm&&i.height_mm&&<p className="text-xs text-slate-400">{i.width_mm}×{i.height_mm} mm</p>}
              <p className="text-xs text-slate-500">{PRINT_TYPES.find(t=>t.v===i.print_type)?.l}</p>
              <p className="text-sm font-bold text-brand-400 mt-2">{fmt(i.price_per_unit,i.currency)}/Stk</p>
              {i.price_per_1000&&<p className="text-xs text-slate-500">{fmt(i.price_per_1000,i.currency)}/1000</p>}
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
          {!items.length?<EmptyState icon={<Tag size={40}/>} title="Keine Etiketten" action={<Button icon={<Plus size={14}/>} onClick={openNew}>Anlegen</Button>}/>:(
            <table className="w-full"><thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
              <th className="table-th">Name</th><th className="table-th">Typ</th>
              <th className="table-th text-right">Maße (mm)</th><th className="table-th">Druck</th>
              <th className="table-th text-right">Preis/Stk</th><th className="table-th text-right">Preis/1000</th>
              <th className="table-th text-center">Status</th><th className="table-th text-right"/>
            </tr></thead><tbody>
              {items.map(i=>(
                <tr key={i.id} className="table-row group">
                  <td className="table-td"><p className="font-medium text-slate-200">{i.name}</p><p className="text-xs text-slate-500">{i.code}</p></td>
                  <td className="table-td text-slate-400 text-xs">{LABEL_TYPES.find(t=>t.v===i.label_type)?.l}</td>
                  <td className="table-td text-right font-mono text-slate-300 text-xs">{i.width_mm&&i.height_mm?`${i.width_mm}×${i.height_mm}`:'–'}</td>
                  <td className="table-td text-slate-400 text-xs">{PRINT_TYPES.find(t=>t.v===i.print_type)?.l}</td>
                  <td className="table-td text-right font-mono font-semibold text-slate-200">{fmt(i.price_per_unit,i.currency)}</td>
                  <td className="table-td text-right font-mono text-slate-400">{i.price_per_1000?fmt(i.price_per_1000,i.currency):'–'}</td>
                  <td className="table-td text-center"><Badge variant={i.is_active?'green':'slate'}>{i.is_active?'Aktiv':'Inakt.'}</Badge></td>
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
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Etikett bearbeiten':'Neues Etikett'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Input label="Name *" value={form.name} autoFocus onChange={e=>s('name',e.target.value)}/></div>
            <Input label="Code *" value={form.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
            <Select label="Etikett-Typ" value={form.label_type} onChange={e=>s('label_type',e.target.value)}>
              {LABEL_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
            <Select label="Druckverfahren" value={form.print_type} onChange={e=>s('print_type',e.target.value)}>
              {PRINT_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </Select>
            <Select label="Form" value={form.shape} onChange={e=>s('shape',e.target.value)}>
              {['rectangle','round','oval','square'].map(s=><option key={s} value={s}>{s==='rectangle'?'Rechteck':s==='round'?'Rund':s==='oval'?'Oval':'Quadrat'}</option>)}
            </Select>
            <Input label="Breite (mm)" type="number" step="0.1" value={form.width_mm} onChange={e=>s('width_mm',e.target.value)}/>
            <Input label="Höhe (mm)" type="number" step="0.1" value={form.height_mm} onChange={e=>s('height_mm',e.target.value)}/>
            <Input label="Material" value={form.material} onChange={e=>s('material',e.target.value)} placeholder="PP, PE, Papier, Folie…"/>
            <Input label="Oberfläche" value={form.finish} onChange={e=>s('finish',e.target.value)} placeholder="matt, glanz, soft-touch…"/>
            <Input label="Preis/Stück *" type="number" step="0.0001" value={form.price_per_unit} onChange={e=>s('price_per_unit',e.target.value)}/>
            <Input label="Preis/1000 Stk" type="number" step="0.01" value={form.price_per_1000} onChange={e=>s('price_per_1000',e.target.value)}/>
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
