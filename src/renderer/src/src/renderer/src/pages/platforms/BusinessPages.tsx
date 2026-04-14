// ── Plattformprofile ──────────────────────────────────────────
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Store, CreditCard, Users, Percent, Edit2 } from 'lucide-react'
import { Button } from '@/components/ui/Input'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

// ── Gemeinsame Typen ──────────────────────────────────────────
interface FeeRule { id:number; name:string; fee_type:string; value:number; min_amount:number|null; applies_to:string; sort_order:number }
const FEE_TYPES=[{v:'percent',l:'Prozent %'},{v:'fixed',l:'Fixer Betrag €'},{v:'per_item',l:'Pro Artikel €'},{v:'min',l:'Mindestgebühr €'}]
const fmt=(v:number,c='EUR')=>new Intl.NumberFormat('de-DE',{style:'currency',currency:c,minimumFractionDigits:2}).format(v)

// ═══════════════════════════════════════════════════════════════
// PLATTFORMPROFILE
// ═══════════════════════════════════════════════════════════════
const PLATFORMS=[{v:'shop',l:'🛒 Online Shop'},{v:'amazon',l:'📦 Amazon'},{v:'ebay',l:'🏷 eBay'},{v:'etsy',l:'🎨 Etsy'},{v:'b2b',l:'🤝 B2B'},{v:'wholesale',l:'🏭 Großhandel'},{v:'custom',l:'✏️ Benutzerdefiniert'}]
const PLATFORM_COLORS=['#8b5cf6','#f59e0b','#ef4444','#10b981','#06b6d4','#ec4899']

export function PlatformsPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<any>(undefined)
  const [selectedId,setSelectedId]=useState<number|null>(null)
  const [form,setForm]=useState({name:'',code:'',platform:'shop',description:'',color:'#8b5cf6'})
  const [ruleForm,setRuleForm]=useState({name:'',fee_type:'percent',value:'',min_amount:'',applies_to:'selling_price',sort_order:0})
  const s=(k:string,v:unknown)=>setForm((p:any)=>({...p,[k]:v}))
  const rs=(k:string,v:unknown)=>setRuleForm((p:any)=>({...p,[k]:v}))

  const {data:profiles=[]}=useQuery<any[]>({queryKey:['platform-profiles'],queryFn:()=>window.api.calc.listProfiles() as Promise<any[]>})
  const {data:detail}=useQuery<any>({queryKey:['platform-detail',selectedId],queryFn:()=>selectedId?window.api.calc.getProfile(selectedId):null,enabled:!!selectedId})
  const inv=()=>{qc.invalidateQueries({queryKey:['platform-profiles']});qc.invalidateQueries({queryKey:['platform-detail',selectedId]})}
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.calc.createProfile(d),onSuccess:()=>{inv();setOpen(false);toast.success('Profil angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.calc.deleteProfile(id),onSuccess:()=>{inv();setSelectedId(null);toast.success('Gelöscht')}})
  const saveStep=useMutation({mutationFn:(d:unknown)=>window.api.calc.saveStep(d),onSuccess:()=>{inv();setRuleForm({name:'',fee_type:'percent',value:'',min_amount:'',applies_to:'selling_price',sort_order:0});toast.success('Gebührenregel gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const delStep=useMutation({mutationFn:(id:number)=>window.api.calc.deleteStep(id),onSuccess:inv})

  const steps=detail?.steps||[]
  const selected=profiles.find((p:any)=>p.id===selectedId)

  return(
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Plattformprofile</h2><p className="page-subtitle">{profiles.length} Profile</p></div>
        <Button icon={<Plus size={14}/>} onClick={()=>{setForm({name:'',code:'',platform:'shop',description:'',color:'#8b5cf6'});setEditing(undefined);setOpen(true)}}>Anlegen</Button>
      </div>
      <div className="flex gap-4">
        {/* Profile-Liste */}
        <div className="w-64 shrink-0 space-y-2">
          {!profiles.length?<div className="glass-card p-6 text-center text-slate-600 text-sm">Noch keine Profile</div>:
            profiles.map((p:any)=>(
              <div key={p.id} onClick={()=>setSelectedId(p.id)}
                className={`glass-card p-3.5 cursor-pointer transition-all group ${selectedId===p.id?'border-brand-500/40':''}`}
                style={selectedId===p.id?{borderColor:p.color+'60',boxShadow:`0 0 20px ${p.color}20`}:{}}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor:p.color}}/><div><p className="text-sm font-semibold text-slate-200">{p.name}</p><p className="text-xs text-slate-500">{p.code}</p></div></div>
                  <button onClick={e=>{e.stopPropagation();deleteM.mutate(p.id)}} className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={11}/></button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="badge-blue text-xs">{PLATFORMS.find((x:any)=>x.v===p.channel)?.l||p.channel}</span>
                  <span className="badge-slate text-xs">{p.step_count||0} Regeln</span>
                </div>
              </div>
            ))}
        </div>
        {/* Detail */}
        {selectedId&&detail?(
          <div className="flex-1 space-y-4">
            <div className="glass-card p-4">
              <h3 className="text-sm font-bold text-slate-200 mb-3">Gebührenregeln für {selected?.name}</h3>
              {steps.map((step:any)=>(
                <div key={step.id} className="flex items-center justify-between p-2.5 rounded-xl mb-2 group"
                  style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
                  <div>
                    <p className="text-sm text-slate-200">{step.label}</p>
                    <p className="text-xs text-slate-500">{FEE_TYPES.find(f=>f.v===step.step_type)?.l||step.step_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-brand-400">
                      {step.value_percent!=null?`${step.value_percent} %`:step.value_manual!=null?fmt(step.value_manual):'–'}
                    </span>
                    <button onClick={()=>delStep.mutate(step.id)} className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={12}/></button>
                  </div>
                </div>
              ))}
              {/* Neue Regel */}
              <div className="mt-4 p-3 rounded-xl space-y-3" style={{background:'rgb(139 92 246/0.05)',border:'1px solid rgb(139 92 246/0.2)'}}>
                <p className="text-xs font-bold text-brand-400">Neue Gebührenregel</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Bezeichnung" value={ruleForm.name} onChange={e=>rs('name',e.target.value)} placeholder="z.B. Verkaufsgebühr"/>
                  <Select label="Typ" value={ruleForm.fee_type} onChange={e=>rs('fee_type',e.target.value)}>
                    {FEE_TYPES.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}
                  </Select>
                  <Input label="Wert" type="number" step="0.01" value={ruleForm.value} onChange={e=>rs('value',e.target.value)} placeholder="z.B. 8.0"/>
                </div>
                <Button size="sm" icon={<Plus size={12}/>} disabled={!ruleForm.name||!ruleForm.value}
                  onClick={()=>saveStep.mutate({profile_id:selectedId,step_type:ruleForm.fee_type==='percent'?'sub_percent':'sub_fixed',label:ruleForm.name,value_manual:ruleForm.fee_type!=='percent'?Number(ruleForm.value):null,value_percent:ruleForm.fee_type==='percent'?Number(ruleForm.value):null})}>
                  Regel hinzufügen
                </Button>
              </div>
            </div>
          </div>
        ):(
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center"><Store size={40} className="text-slate-700 mx-auto mb-3"/><p className="text-slate-500 text-sm">Profil auswählen</p></div>
          </div>
        )}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title="Neues Plattformprofil" size="sm">
        <div className="space-y-4">
          <Input label="Name *" value={form.name} autoFocus onChange={e=>s('name',e.target.value)}/>
          <Input label="Code *" value={form.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
          <Select label="Plattform" value={form.platform} onChange={e=>s('platform',e.target.value)}>
            {PLATFORMS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
          </Select>
          <div><label className="form-label">Farbe</label>
            <div className="flex gap-2 mt-1.5">{PLATFORM_COLORS.map(c=>(<button key={c} onClick={()=>s('color',c)} className={`w-7 h-7 rounded-lg transition-all ${form.color===c?'ring-2 ring-white/50 scale-110':'opacity-60'}`} style={{backgroundColor:c}}/>))}</div>
          </div>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={()=>setOpen(false)}>Abbrechen</Button><Button onClick={()=>createM.mutate({...form,channel:form.platform})}>Anlegen</Button></div>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// KUNDENGRUPPEN
// ═══════════════════════════════════════════════════════════════
export function CustomersPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<any>()
  const [deleting,setDeleting]=useState<any>()
  const [form,setForm]=useState({name:'',code:'',description:'',color:'#06b6d4',discount_default_pct:0,payment_terms:30,credit_limit:0,is_active:1})
  const s=(k:string,v:unknown)=>setForm((p:any)=>({...p,[k]:v}))
  const COLORS=['#06b6d4','#8b5cf6','#10b981','#f59e0b','#ef4444','#ec4899']

  // CustomerGroups über calc_profiles mit channel='customer_group'
  const {data:groups=[]}=useQuery<any[]>({queryKey:['customer-groups'],queryFn:async()=>{
    const all=await window.api.calc.listProfiles() as any[]
    return all.filter((p:any)=>p.channel==='customer_group'||p.channel==='b2b'||p.channel==='b2c'||p.channel==='distributor')
  }})
  const inv=()=>qc.invalidateQueries({queryKey:['customer-groups']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.calc.createProfile(d),onSuccess:()=>{inv();setOpen(false);toast.success('Kundengruppe angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.calc.deleteProfile(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})

  return(
    <div>
      <div className="page-header">
        <div><h2 className="page-title">Kundengruppen</h2><p className="page-subtitle">{groups.length} Gruppen</p></div>
        <Button icon={<Plus size={14}/>} onClick={()=>{setForm({name:'',code:'',description:'',color:'#06b6d4',discount_default_pct:0,payment_terms:30,credit_limit:0,is_active:1});setOpen(true)}}>Anlegen</Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {!groups.length?(
          <div className="col-span-full glass-card"><EmptyState icon={<Users size={40}/>} title="Keine Kundengruppen"
            description="Lege B2C, B2B oder eigene Gruppen an."
            action={<Button icon={<Plus size={14}/>} onClick={()=>setOpen(true)}>Erste Gruppe</Button>}/></div>
        ):groups.map((g:any)=>(
          <div key={g.id} className="glass-card p-5 group hover:border-white/10 transition-all"
            style={{borderColor:`${g.color}30`}}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
                style={{background:`${g.color}20`,color:g.color}}>{g.name.slice(0,2).toUpperCase()}</div>
              <button onClick={()=>setDeleting(g)} className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={13}/></button>
            </div>
            <p className="text-base font-bold text-white">{g.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{g.code}</p>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <span className="badge-slate text-xs">{g.step_count||0} Regeln</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:`${g.color}20`,color:g.color}}>{g.channel}</span>
            </div>
          </div>
        ))}
      </div>
      <Modal open={open} onClose={()=>setOpen(false)} title="Neue Kundengruppe" size="sm">
        <div className="space-y-4">
          <Input label="Name *" value={form.name} autoFocus onChange={e=>s('name',e.target.value)}/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code *" value={form.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
            <Select label="Typ" value={form.description} onChange={e=>s('description',e.target.value)}>
              <option value="b2c">B2C (Endkunde)</option><option value="b2b">B2B (Geschäft)</option>
              <option value="distributor">Distributor</option><option value="custom">Benutzerdefiniert</option>
            </Select>
          </div>
          <Input label="Standard-Rabatt (%)" type="number" step="0.1" value={form.discount_default_pct} onChange={e=>s('discount_default_pct',e.target.value)}/>
          <div><label className="form-label">Farbe</label>
            <div className="flex gap-2 mt-1.5">{COLORS.map(c=>(<button key={c} onClick={()=>s('color',c)} className={`w-7 h-7 rounded-lg transition-all ${form.color===c?'ring-2 ring-white/50 scale-110':'opacity-60'}`} style={{backgroundColor:c}}/>))}</div>
          </div>
          <div className="flex justify-end gap-3"><Button variant="secondary" onClick={()=>setOpen(false)}>Abbrechen</Button>
            <Button onClick={()=>createM.mutate({name:form.name,code:form.code,channel:form.description||'custom',color:form.color,description:form.description})}>Anlegen</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Löschen?" message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// RABATTREGELN
// ═══════════════════════════════════════════════════════════════
export function DiscountsPage() {
  const toast=useToast()
  const [form,setForm]=useState({name:'',type:'flat',value:'',min_qty:'',min_value:'',group:'all',valid_from:'',valid_until:'',notes:''})
  const [rules,setRules]=useState<any[]>([])
  const s=(k:string,v:unknown)=>setForm((p:any)=>({...p,[k]:v}))
  const addRule=()=>{
    if(!form.name||!form.value){toast.error('Name und Wert erforderlich');return}
    setRules(r=>[...r,{...form,id:Date.now()}])
    setForm({name:'',type:'flat',value:'',min_qty:'',min_value:'',group:'all',valid_from:'',valid_until:'',notes:''})
    toast.success('Rabattregel hinzugefügt')
  }
  const TYPE_COLORS:Record<string,string>={flat:'#10b981',percent:'#8b5cf6',tiered:'#f59e0b',bundle:'#06b6d4'}
  return(
    <div>
      <div className="page-header"><div><h2 className="page-title">Rabattregeln</h2><p className="page-subtitle">{rules.length} Regeln</p></div></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Neue Rabattregel</h3>
          <Input label="Bezeichnung *" value={form.name} onChange={e=>s('name',e.target.value)} placeholder="z.B. Mengenrabatt 10+ Stk"/>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Typ" value={form.type} onChange={e=>s('type',e.target.value)}>
              <option value="percent">Prozent %</option><option value="flat">Fixer Betrag €</option>
              <option value="tiered">Staffelrabatt</option><option value="bundle">Bundle-Rabatt</option>
            </Select>
            <Input label={form.type==='percent'?'Rabatt (%)':'Rabatt (€)'} type="number" step="0.01" value={form.value} onChange={e=>s('value',e.target.value)}/>
            <Input label="Ab Menge (Stk)" type="number" value={form.min_qty} onChange={e=>s('min_qty',e.target.value)}/>
            <Input label="Ab Bestellwert (€)" type="number" step="0.01" value={form.min_value} onChange={e=>s('min_value',e.target.value)}/>
            <Select label="Kundengruppe" value={form.group} onChange={e=>s('group',e.target.value)}>
              <option value="all">Alle</option><option value="b2c">B2C</option><option value="b2b">B2B</option><option value="distributor">Distributor</option>
            </Select>
            <Input label="Gültig ab" type="date" value={form.valid_from} onChange={e=>s('valid_from',e.target.value)}/>
            <div className="col-span-2"><Input label="Gültig bis (leer = bis auf Widerruf)" type="date" value={form.valid_until} onChange={e=>s('valid_until',e.target.value)}/></div>
          </div>
          <Textarea label="Notizen" value={form.notes} rows={2} onChange={e=>s('notes',e.target.value)}/>
          <Button icon={<Plus size={14}/>} onClick={addRule} disabled={!form.name||!form.value}>Regel anlegen</Button>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200">Aktive Regeln</h3>
          {!rules.length?<div className="glass-card p-8 text-center"><Percent size={32} className="text-slate-700 mx-auto mb-2"/><p className="text-slate-600 text-sm">Noch keine Regeln</p></div>:
            rules.map((r:any)=>(
              <div key={r.id} className="glass-card p-4" style={{borderColor:`${TYPE_COLORS[r.type]||'#64748b'}30`}}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-200">{r.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{background:`${TYPE_COLORS[r.type]||'#64748b'}20`,color:TYPE_COLORS[r.type]||'#64748b'}}>{r.type}</span>
                      {r.group!=='all'&&<span className="badge-slate text-xs">{r.group}</span>}
                      {r.min_qty&&<span className="text-xs text-slate-500">ab {r.min_qty} Stk</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black" style={{color:TYPE_COLORS[r.type]||'#64748b'}}>
                      {r.type==='percent'?`${r.value} %`:`${r.value} €`}
                    </span>
                    <button onClick={()=>setRules(rs=>rs.filter(x=>x.id!==r.id))} className="btn-ghost p-1 text-red-400"><Trash2 size={13}/></button>
                  </div>
                </div>
                {r.valid_until&&<p className="text-xs text-slate-600 mt-1">Gültig bis {r.valid_until}</p>}
                {!r.valid_until&&<p className="text-xs text-emerald-600 mt-1">Gültig bis auf Widerruf</p>}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
