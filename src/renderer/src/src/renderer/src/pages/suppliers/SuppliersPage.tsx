import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Truck, Mail, Phone, Power, FlaskConical, X, ChevronRight, Building2, FileText, Upload, CreditCard, MapPin, Clock } from 'lucide-react'
import { api }          from '@/lib/api'
import { FlagIcon }    from '@/components/ui/FlagImg'
import { GlowCard }    from '@/components/ui/GlowCard'
import { Button }       from '@/components/ui/Input'
import { Modal }        from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge, SkeletonTable } from '@/components/ui/Badge'
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
  iban:'',swift:'',bank_name:'',customer_number:'',fax:'',street:'',
  discount_percent:0,notes:'',is_active:1,
}

function SupplierForm({initial,onSubmit,onCancel,loading}:{initial?:Supplier;onSubmit:(d:SupplierFormData)=>Promise<void>;onCancel:()=>void;loading?:boolean}) {
  const [form,setForm]=useState<SupplierFormData>(initial?{name:initial.name,code:initial.code,contact_person:initial.contact_person??'',email:initial.email??'',phone:initial.phone??'',website:initial.website??'',address:initial.address??'',postal_code:initial.postal_code??'',city:initial.city??'',country:initial.country,tax_id:initial.tax_id??'',payment_terms:initial.payment_terms,lead_time_days:initial.lead_time_days,currency:initial.currency,discount_percent:initial.discount_percent,notes:initial.notes??'',is_active:initial.is_active,iban:(initial as any).iban??'',swift:(initial as any).swift??'',bank_name:(initial as any).bank_name??'',customer_number:(initial as any).customer_number??'',fax:(initial as any).fax??'',street:(initial as any).street??''}:EMPTY)
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
        <Input label="Kundennummer" value={(form as any).customer_number||''} onChange={e=>set('customer_number',e.target.value)}/>
        <Input label="Fax" value={(form as any).fax||''} onChange={e=>set('fax',e.target.value)}/>
        <div className="col-span-2 pt-2 border-t border-white/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Bankverbindung</p>
        </div>
        <Input label="IBAN" value={(form as any).iban||''} onChange={e=>set('iban',e.target.value)} placeholder="DE89..."/>
        <Input label="SWIFT / BIC" value={(form as any).swift||''} onChange={e=>set('swift',e.target.value)} placeholder="BELADEBE..."/>
        <Input label="Bank / Institut" value={(form as any).bank_name||''} onChange={e=>set('bank_name',e.target.value)}/>
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

// ── Lieferanten-Materialien Drawer ───────────────────────────
const fmtEur=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:4}).format(v)
const WGK_COLORS:Record<string,string>={'-':'#64748b','WGK1':'#22c55e','WGK2':'#f59e0b','WGK3':'#ef4444'}

function SupplierDrawer({supplier, onClose, onEdit}:{supplier:any; onClose:()=>void; onEdit:()=>void}) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'info'|'materials'|'docs'>('info')
  const [expandedMat, setExpandedMat] = useState<number|null>(null)

  const {data:materials=[],isLoading:matsLoading}=useQuery<any[]>({
    queryKey:['supplier-materials',supplier.id],
    queryFn:()=>window.api.suppliers.getMaterials(supplier.id) as Promise<any[]>,
    enabled: tab==='materials',
  })
  const {data:docs=[],isLoading:docsLoading}=useQuery<any[]>({
    queryKey:['supplier-docs',supplier.id],
    queryFn:()=>window.api.documents.list('supplier',supplier.id) as Promise<any[]>,
    enabled: tab==='docs',
  })

  const uploadDoc = async () => {
    const result = await window.api.documents.upload('supplier', supplier.id)
    if (result) qc.invalidateQueries({queryKey:['supplier-docs',supplier.id]})
  }
  const deleteDoc = useMutation({
    mutationFn:(id:number)=>window.api.documents.purge(id),
    onSuccess:()=>qc.invalidateQueries({queryKey:['supplier-docs',supplier.id]})
  })

  const byType = new Map<string,any[]>()
  for(const m of materials){
    const k=m.product_type||'Sonstige'
    byType.set(k,[...(byType.get(k)||[]),m])
  }

  const fmtDate = (s:string) => s ? new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}) : '–'

  return(
    <div className="fixed inset-0 flex justify-end" style={{zIndex:9999,background:'rgba(4,6,14,0.55)',backdropFilter:'blur(18px)',WebkitBackdropFilter:'blur(18px)'}}>
      <div className="h-full flex flex-col shadow-2xl overflow-hidden" style={{
        width:720,maxWidth:'calc(100vw - 40px)',
        background:'linear-gradient(160deg,rgba(15,12,30,0.98) 0%,rgba(10,8,22,0.99) 100%)',
        borderLeft:'1px solid rgba(255,255,255,0.08)',
        backdropFilter:'blur(24px)',
        boxShadow:'-4px 0 48px rgba(0,0,0,0.6), inset 1px 0 0 rgba(255,255,255,0.05)'
      }}>

        {/* ── Header ── */}
        <div className="shrink-0 p-5" style={{
          background:'linear-gradient(180deg,rgba(139,92,246,0.06) 0%,transparent 100%)',
          borderBottom:'1px solid rgba(255,255,255,0.06)'
        }}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black text-white shrink-0"
                style={{background:'linear-gradient(135deg,#7c3aed,#4a57e5)'}}>
                {supplier.name.slice(0,2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{supplier.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500">{supplier.code}</p>
                  {supplier.country&&<><span className="text-slate-700">·</span><FlagIcon code={supplier.country} size="sm" rounded/><span className="text-xs text-slate-500">{supplier.country}</span></>}
                  <span className="text-slate-700">·</span>
                  <span className="text-xs text-slate-500">{materials.length} Rohstoffe</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all"
                style={{border:'1px solid rgba(255,255,255,0.1)'}}>
                <Pencil size={12}/>Bearbeiten
              </button>
              <button onClick={onClose} className="btn-ghost p-2"><X size={16}/></button>
            </div>
          </div>

          {/* Tabs – Frozen Glass */}
          <div className="flex gap-0 p-0.5 rounded-2xl overflow-hidden mt-3"
            style={{
              background:'rgba(0,0,0,0.4)',
              border:'1px solid rgba(255,255,255,0.07)',
              backdropFilter:'blur(24px)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 12px rgba(0,0,0,0.5)',
              width:'fit-content'
            }}>
            {([['info','Steckbrief',Building2],['materials','Rohstoffe',FlaskConical],['docs','Dokumente',FileText]] as [string,string,any][]).map(([id,label,Icon])=>(
              <button key={id} onClick={()=>setTab(id as any)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all relative"
                style={tab===id?{
                  background:'linear-gradient(135deg,rgba(139,92,246,0.25),rgba(99,102,241,0.15))',
                  color:'#e2e8f0',
                  borderRadius:'14px',
                  boxShadow:'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.3)',
                }:{color:'rgba(100,116,139,0.8)'}}>
                <Icon size={12} style={tab===id?{color:'#a78bfa'}:{}}/>
                {label}
                {tab===id&&<span className="absolute inset-0 rounded-2xl pointer-events-none" style={{background:'linear-gradient(to bottom,rgba(255,255,255,0.04),transparent)'}}/>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Steckbrief ── */}
        {tab==='info' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {/* Adresse */}
            <div className="glass-card p-4 space-y-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><MapPin size={11}/>Adresse</p>
              <div className="text-sm text-slate-300 space-y-0.5">
                {supplier.street&&<p>{supplier.street}</p>}
                {!supplier.street&&supplier.address&&<p>{supplier.address}</p>}
                <p className="flex items-center gap-2">
                  {supplier.postal_code&&<span>{supplier.postal_code}</span>}
                  {supplier.city&&<span>{supplier.city}</span>}
                  {supplier.country&&<span className="flex items-center gap-1"><FlagIcon code={supplier.country} size="sm" rounded/><span className="text-slate-500">{supplier.country}</span></span>}
                </p>
              </div>
            </div>

            {/* Kontakt */}
            <div className="glass-card p-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Phone size={11}/>Kontakt</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {supplier.contact_person&&<div><span className="text-slate-600">Ansprechpartner</span><p className="text-slate-200 mt-0.5">{supplier.contact_person}</p></div>}
                {supplier.email&&<div><span className="text-slate-600">E-Mail</span><a href={`mailto:${supplier.email}`} className="block text-brand-400 hover:text-brand-300 mt-0.5">{supplier.email}</a></div>}
                {supplier.phone&&<div><span className="text-slate-600">Telefon</span><p className="text-slate-200 mt-0.5">{supplier.phone}</p></div>}
                {supplier.fax&&<div><span className="text-slate-600">Fax</span><p className="text-slate-200 mt-0.5">{supplier.fax}</p></div>}
                {supplier.website&&<div className="col-span-2"><span className="text-slate-600">Website</span><a href={supplier.website} className="block text-brand-400 hover:text-brand-300 mt-0.5">{supplier.website}</a></div>}
              </div>
            </div>

            {/* Konditionen */}
            <div className="glass-card p-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock size={11}/>Konditionen</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div><span className="text-slate-600">Zahlungsziel</span><p className="text-slate-200 font-bold mt-0.5">{supplier.payment_terms||30} Tage</p></div>
                <div><span className="text-slate-600">Lieferzeit</span><p className="text-slate-200 mt-0.5">{supplier.lead_time_days||14} Tage</p></div>
                <div><span className="text-slate-600">Währung</span><p className="text-slate-200 mt-0.5">{supplier.currency||'EUR'}</p></div>
                {supplier.customer_number&&<div><span className="text-slate-600">Kundennummer</span><p className="text-slate-200 font-mono mt-0.5">{supplier.customer_number}</p></div>}
                {supplier.tax_id&&<div><span className="text-slate-600">USt-ID</span><p className="text-slate-200 font-mono mt-0.5">{supplier.tax_id}</p></div>}
                {supplier.discount_percent>0&&<div><span className="text-slate-600">Rabatt</span><p className="text-emerald-400 font-bold mt-0.5">{supplier.discount_percent}%</p></div>}
              </div>
            </div>

            {/* Bankverbindung */}
            {(supplier.iban||supplier.swift||supplier.bank_name)&&(
              <div className="glass-card p-4 space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><CreditCard size={11}/>Bankverbindung</p>
                <div className="text-xs space-y-1.5">
                  {supplier.bank_name&&<div className="flex gap-3"><span className="text-slate-600 w-16 shrink-0">Bank</span><span className="text-slate-200">{supplier.bank_name}</span></div>}
                  {supplier.iban&&<div className="flex gap-3"><span className="text-slate-600 w-16 shrink-0">IBAN</span><span className="text-slate-200 font-mono tracking-wider">{supplier.iban}</span></div>}
                  {supplier.swift&&<div className="flex gap-3"><span className="text-slate-600 w-16 shrink-0">SWIFT</span><span className="text-slate-200 font-mono">{supplier.swift}</span></div>}
                </div>
              </div>
            )}

            {/* Notizen */}
            {supplier.notes&&(
              <div className="glass-card p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notizen</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{supplier.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Rohstoffe ── */}
        {tab==='materials' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {matsLoading&&<div className="text-center py-8 text-slate-600">Lädt…</div>}
            {!matsLoading&&!materials.length&&(
              <div className="text-center py-12">
                <FlaskConical size={40} className="text-slate-700 mx-auto mb-3"/>
                <p className="text-slate-500 text-sm">Keine Rohstoffe für diesen Lieferanten</p>
              </div>
            )}
            {[...byType.entries()].map(([type,mats])=>(
              <div key={type}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">{type} ({mats.length})</p>
                <div className="space-y-1.5">
                  {mats.map((m:any)=>{
                    const wgkColor=WGK_COLORS[m.wgk||'-']
                    return(
                      <div key={m.id} className="rounded-xl overflow-hidden"
                        style={{background:'rgb(255 255 255/0.03)',border:expandedMat===m.id?'1px solid rgb(139 92 246/0.3)':'1px solid rgb(255 255 255/0.06)'}}>
                        <div className="flex items-start justify-between p-3 cursor-pointer hover:bg-white/3"
                          onClick={()=>setExpandedMat(expandedMat===m.id?null:m.id)}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FlaskConical size={13} className="text-brand-400 shrink-0"/>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-200 truncate">{m.name}</p>
                                <span className="text-[10px] font-mono text-slate-600">{m.code}</span>
                              </div>
                              {m.container_type&&<p className="text-[10px] text-slate-600">{m.container_type} {m.container_size}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full"style={{background:`${wgkColor}20`,color:wgkColor}}>{m.wgk||'-'}</span>
                            {m.price_per_kg_calc!=null&&<span className="text-sm font-bold font-mono text-slate-200">{fmtEur(m.price_per_kg_calc)}<span className="text-slate-500 text-xs font-normal">/kg</span></span>}
                          </div>
                          <ChevronRight size={13} className={`text-slate-600 ml-2 shrink-0 transition-transform ${expandedMat===m.id?'rotate-90':''}`}/>
                        </div>
                        {expandedMat===m.id&&(
                          <div className="px-3 pb-3 border-t border-white/5 pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                            {m.cas_number&&<span className="text-slate-500">CAS: <strong className="text-slate-300 font-mono">{m.cas_number}</strong></span>}
                            {m.base_price&&<span className="text-slate-500">EK: <strong className="text-slate-300">{m.base_price} € / {m.base_quantity} {m.base_unit}</strong></span>}
                            {m.surcharge_energy>0&&<span className="text-amber-400">+Maut: {m.surcharge_energy} €/{m.surcharge_energy_unit}</span>}
                            {m.surcharge_adr>0&&<span className="text-red-400">+ADR: {m.surcharge_adr} €/{m.surcharge_adr_unit}</span>}
                            {m.valid_from&&<span className="text-slate-600">Gültig ab: {m.valid_from}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Dokumente ── */}
        {tab==='docs' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{docs.length} Dokument{docs.length!==1?'e':''}</p>
              <button onClick={uploadDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all"
                style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                <Upload size={12}/>Dokument hochladen
              </button>
            </div>

            {docsLoading&&<div className="text-center py-8 text-slate-600">Lädt…</div>}
            {!docsLoading&&!docs.length&&(
              <div className="text-center py-12">
                <FileText size={40} className="text-slate-700 mx-auto mb-3"/>
                <p className="text-slate-500 text-sm">Keine Dokumente vorhanden</p>
                <button onClick={uploadDoc}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white mx-auto"
                  style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                  <Upload size={12}/>Erstes Dokument hochladen
                </button>
              </div>
            )}

            {/* Docs sortiert nach Datum (neu → alt) */}
            {[...docs].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()).map((doc:any)=>(
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl group"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{background:'rgb(139 92 246/0.15)',color:'#a78bfa'}}>
                    <FileText size={14}/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{doc.original_name||doc.file_name}</p>
                    <p className="text-[10px] text-slate-500">{fmtDate(doc.created_at)} · {doc.file_type||doc.mime_type||'–'}</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                  <button onClick={()=>window.api.documents.open(doc.id)}
                    className="btn-ghost p-1.5 text-xs text-brand-400">Öffnen</button>
                  <button onClick={()=>deleteDoc.mutate(doc.id)}
                    className="btn-ghost p-1.5 text-red-400"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SuppliersPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState('')
  const [viewMode,setViewMode]=useState<'grid'|'list'>('list')
  const [sortBy,setSortBy]=useState('name_asc')
  const [open,setOpen]=useState(false)
  const [editing,setEditing]=useState<Supplier|undefined>()
  const [deleting,setDeleting]=useState<Supplier|undefined>()
  const [drawerSupplier,setDrawerSupplier]=useState<any>(null)
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
            <div key={s.id} className="glass-card group hover:border-white/10 transition-all duration-150 cursor-pointer"
              onClick={()=>setDrawerSupplier(s)}>
              <div className="flex items-start justify-between p-5 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{background:'rgb(16 185 129 / 0.1)',border:'1px solid rgb(16 185 129 / 0.2)',color:'#10b981'}}>
                    {s.code.slice(0,2)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">{s.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-slate-500">{s.code}</p>
                      {s.country&&<><span className="text-slate-700">·</span><FlagIcon code={s.country} size="sm" rounded/><span className="text-xs text-slate-600">{s.country}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={e=>e.stopPropagation()}>
                  <button className="btn-ghost p-1.5" onClick={()=>{setEditing(s);setOpen(true)}}><Pencil size={12}/></button>
                  <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(s)}><Trash2 size={12}/></button>
                </div>
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
                <th className="table-th">Land</th><th className="table-th">Stadt</th><th className="table-th text-center">Mat.</th>
                <th className="table-th">Zahlungsziel</th>
                <th className="table-th text-right">Aktionen</th>
              </tr></thead>
              <tbody>
                {suppliers.map(s=>(
                  <tr key={s.id} className="table-row group cursor-pointer"
                    onClick={()=>setDrawerSupplier(s)}>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{background:'rgb(16 185 129/0.1)',border:'1px solid rgb(16 185 129/0.2)',color:'#10b981'}}>
                          {s.code.slice(0,2)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{s.name}</p>
                          <p className="text-[10px] font-mono text-slate-600">{s.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-slate-400 text-xs">{s.contact_person??'–'}</td>
                    <td className="table-td">
                      {s.country
                        ?<div className="flex items-center gap-1.5"><FlagIcon code={s.country} size="sm" rounded/><span className="text-[10px] text-slate-500">{s.country}</span></div>
                        :<span className="text-slate-600 text-xs">–</span>}
                    </td>
                    <td className="table-td text-slate-400 text-xs">{s.city??'–'}</td>
                    <td className="table-td text-center text-slate-400 text-sm font-semibold">{s.materials_count??0}</td>
                    <td className="table-td text-slate-400 text-xs">{s.payment_terms??30} Tage</td>
                    <td className="table-td text-right" onClick={e=>e.stopPropagation()}>
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
      {drawerSupplier&&createPortal(<SupplierDrawer supplier={drawerSupplier} onClose={()=>setDrawerSupplier(null)} onEdit={()=>{setEditing(drawerSupplier);setDrawerSupplier(null);setOpen(true)}}/>, document.body)}
      <ConfirmDialog open={!!deleting} title="Lieferant löschen?" message={`"${deleting?.name}" wirklich löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
