import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Truck, Mail, Phone, Power } from 'lucide-react'
import { api }          from '@/lib/api'
import { Button }       from '@/components/ui/Input'
import { Modal }        from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { ViewControls }       from '@/components/ui/ViewControls'
import { SupplierConditions } from '@/components/ui/SupplierConditions'
import { useToast }     from '@/hooks/useToast'
import { CURRENCIES } from '@/lib/countries'
import { CountrySelect } from '@/components/ui/CountrySelect'
import type { Supplier, SupplierFormData } from '@/types'

const SORT_OPTIONS = [
  {value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},
  {value:'code_asc',label:'Code A–Z'},{value:'city_asc',label:'Stadt A–Z'},
  {value:'mats_desc',label:'Meiste Materialien'},
]
const EMPTY: SupplierFormData = {
  name:'',code:'',contact_person:'',email:'',phone:'',website:'',
  address:'',postal_code:'',city:'',country:'DE',tax_id:'',
  payment_terms:30,lead_time_days:14,currency:'EUR',
  discount_percent:0,notes:'',is_active:1,
}

function SupplierForm({initial,onSubmit,onCancel,loading}:{initial?:Supplier;onSubmit:(d:SupplierFormData)=>Promise<void>;onCancel:()=>void;loading?:boolean}) {
  const [form,setForm]=useState<SupplierFormData>(initial?{name:initial.name,code:initial.code,contact_person:initial.contact_person??'',email:initial.email??'',phone:initial.phone??'',website:initial.website??'',address:initial.address??'',postal_code:initial.postal_code??'',city:initial.city??'',country:initial.country,tax_id:initial.tax_id??'',payment_terms:initial.payment_terms,lead_time_days:initial.lead_time_days,currency:initial.currency,discount_percent:initial.discount_percent,notes:initial.notes??'',is_active:initial.is_active}:EMPTY)
  const [errors,setErrors]=useState<Partial<Record<keyof SupplierFormData,string>>>({})
  const set=(k:keyof SupplierFormData,v:string|number)=>setForm(f=>({...f,[k]:v}))
  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault()
    const err:Partial<Record<keyof SupplierFormData,string>>={}
    if(!form.name.trim())err.name='Name erforderlich'
    if(!form.code.trim())err.code='Code erforderlich'
    setErrors(err);if(Object.keys(err).length)return
    await onSubmit(form)
  }
  return(
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><Input label="Firmenname *" value={form.name} error={errors.name} autoFocus onChange={e=>set('name',e.target.value)}/></div>
        <Input label="Code *" value={form.code} error={errors.code} onChange={e=>set('code',e.target.value.toUpperCase())} hint="Eindeutiger Lieferantencode"/>
        <Input label="Ansprechpartner" value={form.contact_person} onChange={e=>set('contact_person',e.target.value)}/>
        <Input label="E-Mail" type="email" value={form.email} onChange={e=>set('email',e.target.value)}/>
        <Input label="Telefon" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
        <div className="col-span-2"><Input label="Website" value={form.website} onChange={e=>set('website',e.target.value)}/></div>
        <div className="col-span-2"><Input label="Adresse" value={form.address} onChange={e=>set('address',e.target.value)}/></div>
        <Input label="PLZ" value={form.postal_code} onChange={e=>set('postal_code',e.target.value)}/>
        <Input label="Stadt" value={form.city} onChange={e=>set('city',e.target.value)}/>
        <CountrySelect label="Land" value={form.country} onChange={(code:string)=>set('country',code)}/>
        <Input label="USt-ID" value={form.tax_id} onChange={e=>set('tax_id',e.target.value)}/>
        <Input label="Zahlungsziel (Tage)" type="number" min={0} value={form.payment_terms} onChange={e=>set('payment_terms',Number(e.target.value))}/>
        <Input label="Lieferzeit (Tage)" type="number" min={0} value={form.lead_time_days} onChange={e=>set('lead_time_days',Number(e.target.value))}/>
        <Input label="Rabatt (%)" type="number" min={0} max={100} step={0.1} value={form.discount_percent} onChange={e=>set('discount_percent',Number(e.target.value))}/>
        <Select label="Währung" value={form.currency} onChange={e=>set('currency',e.target.value)}>
          {CURRENCIES.map(cu=><option key={cu}>{cu}</option>)}
        </Select>
        <Select label="Status" value={form.is_active} onChange={e=>set('is_active',Number(e.target.value))}>
          <option value={1}>Aktiv</option><option value={0}>Inaktiv</option>
        </Select>
        <div className="col-span-2"><Textarea label="Notizen" value={form.notes} rows={2} onChange={e=>set('notes',e.target.value)}/></div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" loading={loading}>{initial?'Speichern':'Anlegen'}</Button>
      </div>
    </form>
  )
}

export default function SuppliersPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState('')
  const [viewMode,setViewMode]=useState<'grid'|'list'>('grid')
  const [sortBy,setSortBy]=useState('name_asc')
  const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<Supplier|undefined>()
  const [deleting,setDeleting]=useState<Supplier|undefined>()
  const {data,isLoading}=useQuery<Supplier[]>({queryKey:['suppliers',search],queryFn:()=>api.suppliers.list(search||undefined)})
  const suppliers=(data??[]).sort((a,b)=>{
    if(sortBy==='name_asc')  return a.name.localeCompare(b.name)
    if(sortBy==='name_desc') return b.name.localeCompare(a.name)
    if(sortBy==='code_asc')  return a.code.localeCompare(b.code)
    if(sortBy==='city_asc')  return (a.city??'').localeCompare(b.city??'')
    if(sortBy==='mats_desc') return (b.materials_count??0)-(a.materials_count??0)
    return 0
  })
  const inv=()=>qc.invalidateQueries({queryKey:['suppliers']})
  const createM=useMutation({mutationFn:(d:SupplierFormData)=>api.suppliers.create(d),onSuccess:()=>{inv();setOpen(false);toast.success('Lieferant angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:SupplierFormData})=>api.suppliers.update(id,d),onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const toggleM=useMutation({mutationFn:(id:number)=>api.suppliers.toggleActive(id),onSuccess:inv})
  const deleteM=useMutation({mutationFn:(id:number)=>api.suppliers.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const submit=async(form:SupplierFormData)=>{if(editing)await updateM.mutateAsync({id:editing.id,d:form});else await createM.mutateAsync(form)}
  if(isLoading) return <Spinner/>
  return (
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Lieferanten</h2><p className="page-subtitle">{suppliers.length} Lieferanten</p></div>
        <Button icon={<Plus size={16}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>Anlegen</Button>
      </div>
      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy}
        sortOptions={SORT_OPTIONS} search={search} onSearch={setSearch} searchPlaceholder="Name, Code, Stadt …"/>
      {/* Grid */}
      {viewMode==='grid'&&(
        !suppliers.length?<div className="glass-card"><EmptyState icon={<Truck size={40}/>} title="Keine Lieferanten" action={<Button icon={<Plus size={16}/>} onClick={()=>setOpen(true)}>Anlegen</Button>}/></div>
        :<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(s=>(
            <div key={s.id} className="glass-card group hover:border-white/10 transition-all duration-150">
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{background:'rgb(16 185 129 / 0.1)',border:'1px solid rgb(16 185 129 / 0.2)',color:'#10b981'}}>
                    {s.code.slice(0,2)}
                  </div>
                  <div><p className="font-semibold text-slate-100">{s.name}</p><p className="text-xs text-slate-500">{s.code}</p></div>
                </div>
                <Badge variant={s.is_active?'green':'slate'}>{s.is_active?'Aktiv':'Inaktiv'}</Badge>
              </div>
              <div className="px-5 pb-3 space-y-1 text-xs text-slate-400">
                {s.city&&<p>{s.city}{s.country!=='DE'?`, ${s.country}`:''}</p>}
                {s.contact_person&&<p>👤 {s.contact_person}</p>}
                {s.email&&<a href={`mailto:${s.email}`} className="flex items-center gap-1 hover:text-brand-400"><Mail size={11}/>{s.email}</a>}
                {s.phone&&<p className="flex items-center gap-1"><Phone size={11}/>{s.phone}</p>}
              </div>
              <div className="px-5 py-2.5 flex items-center gap-3 text-xs text-slate-500" style={{borderTop:'1px solid rgb(255 255 255 / 0.05)'}}>
                <span>{s.materials_count??0} Mat.</span><span>·</span><span>ZZ {s.payment_terms}d</span><span>·</span><span>{s.currency}</span>
              </div>
              <div className="px-5 pb-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="btn-ghost text-xs" onClick={()=>{setEditing(s);setOpen(true)}}><Pencil size={12}/>Bearbeiten</button>
                <button className="btn-ghost text-xs" onClick={()=>toggleM.mutate(s.id)}><Power size={12}/>{s.is_active?'Deaktiv.':'Aktivieren'}</button>
                <button className="btn-ghost text-xs text-red-400 ml-auto" onClick={()=>setDeleting(s)}><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Liste */}
      {viewMode==='list'&&(
        <div className="glass-card overflow-hidden">
          {!suppliers.length?<EmptyState icon={<Truck size={40}/>} title="Keine Lieferanten" action={<Button icon={<Plus size={16}/>} onClick={()=>setOpen(true)}>Anlegen</Button>}/>:(
            <table className="w-full">
              <thead style={{borderBottom:'1px solid rgb(255 255 255 / 0.05)'}}><tr>
                <th className="table-th">Lieferant</th><th className="table-th">Kontakt</th>
                <th className="table-th">Stadt</th><th className="table-th text-center">Mat.</th>
                <th className="table-th">Währung</th><th className="table-th text-center">Status</th>
                <th className="table-th text-right">Aktionen</th>
              </tr></thead>
              <tbody>
                {suppliers.map(s=>(
                  <tr key={s.id} className="table-row group">
                    <td className="table-td"><div className="flex items-center gap-2">
                      <span className="badge-blue font-mono text-xs">{s.code}</span>
                      <span className="font-medium text-slate-200">{s.name}</span>
                    </div></td>
                    <td className="table-td text-slate-400 text-xs">{s.contact_person??'–'}</td>
                    <td className="table-td text-slate-400 text-xs">{s.city??'–'}</td>
                    <td className="table-td text-center text-slate-400">{s.materials_count??0}</td>
                    <td className="table-td text-slate-400">{s.currency}</td>
                    <td className="table-td text-center"><Badge variant={s.is_active?'green':'slate'}>{s.is_active?'Aktiv':'Inaktiv'}</Badge></td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="btn-ghost p-1.5" onClick={()=>{setEditing(s);setOpen(true)}}><Pencil size={13}/></button>
                        <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(s)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Lieferant bearbeiten':'Neuer Lieferant'} subtitle={editing?.name} size="lg">
        <SupplierForm initial={editing} onSubmit={submit} onCancel={()=>setOpen(false)} loading={createM.isPending||updateM.isPending}/>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Lieferant löschen?" message={`"${deleting?.name}" wirklich löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
