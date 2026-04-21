import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Pencil, Trash2, Search, FlaskConical,
  ChevronDown, ChevronUp, Info, Download, Upload,
} from 'lucide-react'
import { Button }          from '@/components/ui/Input'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal }           from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge, SkeletonTable, SkeletonList } from '@/components/ui/Badge'
import { ViewControls }    from '@/components/ui/ViewControls'
import { FlagIcon }        from '@/components/ui/FlagImg'
import { GhsBadges, GhsPicker } from '@/components/ui/GhsSymbol'
import { useToast }        from '@/hooks/useToast'
import { GlowCard }       from '@/components/ui/GlowCard'

// ── Typen ─────────────────────────────────────────────────────
interface Material {
  id:number; name:string; code:string
  substance_name_de:string|null; substance_name_en:string|null
  density:string|null; cas_number:string|null
  eg_number:string|null; reach_number:string|null
  container_type:string|null; container_size:string|null
  base_price:number|null; base_quantity:number; base_unit:string
  surcharge_energy:number; surcharge_energy_unit:string
  surcharge_adr:number; surcharge_adr_unit:string
  price_per_kg_calc:number|null
  product_type:string|null; category_id:number|null
  deposit_amount:number; deposit_note:string|null
  wgk:string; valid_from:string|null
  supplier_id:number|null; supplier_name:string|null
  is_active:number; notes:string|null
  ghs_symbols:string
  un_number:string|null; customs_tariff:string|null
}

const WGK_OPTIONS = ['-','WGK1','WGK2','WGK3']
const WGK_COLORS:Record<string,string> = {'-':'#64748b','WGK1':'#22c55e','WGK2':'#f59e0b','WGK3':'#ef4444'}

const UNITS = ['kg','l','g','ml','stk']
const SORT_OPTIONS = [
  {value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},
  {value:'price_asc',label:'Preis ↑'},{value:'price_desc',label:'Preis ↓'},
  {value:'type',label:'Produktart'},
]
const fmtEur=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:4}).format(v)
const fmtEur2=(v:number)=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(v)

// GHS Badges from SVG component

// ── WGK Badge ────────────────────────────────────────────────
function WgkBadge({wgk}:{wgk:string}) {
  const color = WGK_COLORS[wgk] ?? '#64748b'
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
    style={{background:`${color}20`,color,border:`1px solid ${color}40`}}>{wgk}</span>
}

// ── Preis-Aufschlüsselung ─────────────────────────────────────
function PriceBreakdown({m}:{m:Material}) {
  if (!m.base_price) return <span className="text-slate-600 text-xs">Kein Preis</span>
  const base = m.base_price / m.base_quantity
  const energy = m.surcharge_energy > 0 ? m.surcharge_energy / (parseFloat(m.surcharge_energy_unit)||100) : 0
  const adr    = m.surcharge_adr > 0    ? m.surcharge_adr    / (parseFloat(m.surcharge_adr_unit)||100)    : 0
  const total  = base + energy + adr
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">EK ({m.base_price} € / {m.base_quantity} {m.base_unit})</span>
        <span className="text-slate-300 font-mono">{fmtEur(base)}</span>
      </div>
      {energy>0&&<div className="flex justify-between gap-4">
        <span className="text-slate-500">Maut/Energie ({m.surcharge_energy} € / {m.surcharge_energy_unit})</span>
        <span className="text-amber-400 font-mono">+{fmtEur(energy)}</span>
      </div>}
      {adr>0&&<div className="flex justify-between gap-4">
        <span className="text-slate-500">ADR ({m.surcharge_adr} € / {m.surcharge_adr_unit})</span>
        <span className="text-red-400 font-mono">+{fmtEur(adr)}</span>
      </div>}
      <div className="flex justify-between gap-4 pt-1 border-t border-white/8 font-bold">
        <span className="text-slate-300">Gesamt / 1 {m.base_unit}</span>
        <span className="text-white font-mono">{fmtEur(total)}</span>
      </div>
    </div>
  )
}

// ── Material-Form ─────────────────────────────────────────────
const EMPTY_FORM = {
  name:'',code:'',substance_name_de:'',substance_name_en:'',
  density:'',cas_number:'',eg_number:'',reach_number:'',
  container_type:'',container_size:'',
  base_price:'',base_quantity:'1',base_unit:'kg',
  surcharge_energy:'',surcharge_energy_unit:'100 kg',
  surcharge_adr:'',surcharge_adr_unit:'100 kg',
  product_type:'',category_id:'',supplier_id:'',
  deposit_amount:'',deposit_note:'',wgk:'-',
  valid_from:'',notes:'',is_active:1,
  un_number:'',customs_tariff:'',
  ghs_symbols: [] as string[],
}
type FormState = typeof EMPTY_FORM

function MaterialForm({initial,categories,suppliers,onSave,onClose,loading}:any) {
  const [f,setF]=useState<FormState>(initial ? {
    name:initial.name,code:initial.code,
    substance_name_de:initial.substance_name_de||'',
    substance_name_en:initial.substance_name_en||'',
    density:initial.density||'',cas_number:initial.cas_number||'',
    eg_number:initial.eg_number||'',reach_number:initial.reach_number||'',
    container_type:initial.container_type||'',container_size:initial.container_size||'',
    base_price:String(initial.base_price||''),
    base_quantity:String(initial.base_quantity||1),
    base_unit:initial.base_unit||'kg',
    surcharge_energy:String(initial.surcharge_energy||''),
    surcharge_energy_unit:initial.surcharge_energy_unit||'100 kg',
    surcharge_adr:String(initial.surcharge_adr||''),
    surcharge_adr_unit:initial.surcharge_adr_unit||'100 kg',
    product_type:initial.product_type||'',
    category_id:String(initial.category_id||''),
    supplier_id:String(initial.supplier_id||''),
    deposit_amount:String(initial.deposit_amount||''),
    deposit_note:initial.deposit_note||'',
    wgk:initial.wgk||'-',
    valid_from:initial.valid_from||'',
    notes:initial.notes||'',
    is_active:initial.is_active??1,
    un_number:initial.un_number||'',
    customs_tariff:initial.customs_tariff||'',
    ghs_symbols: initial.ghs_symbols ? JSON.parse(initial.ghs_symbols||'[]') : [],
  } : EMPTY_FORM)
  const s=(k:keyof FormState,v:unknown)=>setF(p=>({...p,[k]:v}))
  const [tab,setTab]=useState<'basis'|'preise'|'chemie'|'ghs'|'dokumente'>('basis')
  const toggleGhs=(g:string)=>setF(p=>({...p,ghs_symbols:p.ghs_symbols.includes(g)?p.ghs_symbols.filter(x=>x!==g):[...p.ghs_symbols,g]}))

  const TABS=[{id:'basis',l:'Stammdaten'},{id:'preise',l:'Preise & Zuschläge'},{id:'chemie',l:'Chemie & Zoll'},{id:'ghs',l:'GHS & WGK'},{id:'dokumente',l:'Dokumente'}]

  return(
    <div className="space-y-4" style={{minHeight:440}}>
      {/* Tab-Leiste */}
      <div className="flex rounded-xl overflow-hidden" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.06)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as typeof tab)}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${tab===t.id?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Stammdaten */}
      {tab==='basis'&&(
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Input label="Handelsname / Bezeichnung *" value={f.name} autoFocus onChange={e=>s('name',e.target.value)}/></div>
          <Input label="Code *" value={f.code} onChange={e=>s('code',e.target.value.toUpperCase())}/>
          <Input label="Produktart" value={f.product_type} onChange={e=>s('product_type',e.target.value)} placeholder="z.B. Epoxidharz (A), UV-Absorber"/>
          <Input label="Stoffbezeichnung (DE)" value={f.substance_name_de} onChange={e=>s('substance_name_de',e.target.value)} placeholder="IUPAC-Name"/>
          <Input label="Substance Name (EN)" value={f.substance_name_en} onChange={e=>s('substance_name_en',e.target.value)}/>
          <Input label="Dichte (20°C)" value={f.density} onChange={e=>s('density',e.target.value)} placeholder="z.B. 1,0450 g/ml"/>
          <Select label="Lieferant" value={f.supplier_id} onChange={e=>s('supplier_id',e.target.value)}>
            <option value="">– kein –</option>
            {suppliers.map((sup:any)=><option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </Select>
          <Select label="Kategorie" value={f.category_id} onChange={e=>s('category_id',e.target.value)}>
            <option value="">– keine –</option>
            {categories.map((cat:any)=><option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </Select>
          <Input label="Gültig ab" type="date" value={f.valid_from} onChange={e=>s('valid_from',e.target.value)}/>
          <Select label="Status" value={f.is_active} onChange={e=>s('is_active',Number(e.target.value))}>
            <option value={1}>Aktiv</option><option value={0}>Inaktiv</option>
          </Select>
          <div className="col-span-2"><Textarea label="Notizen" value={f.notes} rows={2} onChange={e=>s('notes',e.target.value)}/></div>
        </div>
      )}

      {/* Preise */}
      {tab==='preise'&&(
        <div className="space-y-4" style={{minHeight:440}}>
          <div>
            <p className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Gebindeart & Einkaufspreis</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Gebindeart" value={f.container_type} onChange={e=>s('container_type',e.target.value)} placeholder="z.B. IBC Container, Stahlfass"/>
              <Input label="Gebindegröße" value={f.container_size} onChange={e=>s('container_size',e.target.value)} placeholder="z.B. 1000 L, 216,5 l à 155 kg"/>
              <Input label="Preis (€ netto) *" type="number" step="0.01" value={f.base_price} onChange={e=>s('base_price',e.target.value)} hint="Gesamtpreis des Gebindes"/>
              <div className="flex gap-2">
                <Input label="Menge" type="number" step="1" value={f.base_quantity} onChange={e=>s('base_quantity',e.target.value)} hint="z.B. 100, 1000"/>
                <Select label="Einheit" value={f.base_unit} onChange={e=>s('base_unit',e.target.value)}>
                  {UNITS.map(u=><option key={u}>{u}</option>)}
                </Select>
              </div>
            </div>
            {f.base_price && f.base_quantity && (
              <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                = {fmtEur(Number(f.base_price)/Number(f.base_quantity))} pro 1 {f.base_unit}
              </p>
            )}
          </div>
          <div className="p-3 rounded-xl space-y-2" style={{background:'rgb(245 158 11/0.06)',border:'1px solid rgb(245 158 11/0.2)'}}>
            <p className="text-xs font-semibold text-amber-400">Maut / Energiezuschlag (optional)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Betrag (€)" type="number" step="0.01" value={f.surcharge_energy} onChange={e=>s('surcharge_energy',e.target.value)} placeholder="z.B. 8.95"/>
              <Input label="Pro ___ (Einheit)" value={f.surcharge_energy_unit} onChange={e=>s('surcharge_energy_unit',e.target.value)} placeholder="100 kg"/>
            </div>
          </div>
          <div className="p-3 rounded-xl space-y-2" style={{background:'rgb(239 68 68/0.06)',border:'1px solid rgb(239 68 68/0.2)'}}>
            <p className="text-xs font-semibold text-red-400">ADR-Zuschlag (optional – Gefahrgut)</p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Betrag (€)" type="number" step="0.01" value={f.surcharge_adr} onChange={e=>s('surcharge_adr',e.target.value)} placeholder="z.B. 14.50"/>
              <Input label="Pro ___ (Einheit)" value={f.surcharge_adr_unit} onChange={e=>s('surcharge_adr_unit',e.target.value)} placeholder="100 kg"/>
            </div>
          </div>
          <div className="p-3 rounded-xl space-y-2" style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
            <p className="text-xs font-semibold text-slate-300">Pfand <span className="text-slate-500 font-normal">(wird nicht in Kalkulation einbezogen)</span></p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Pfand (€)" type="number" step="0.01" value={f.deposit_amount} onChange={e=>s('deposit_amount',e.target.value)} placeholder="z.B. 192.00"/>
              <Input label="Hinweis" value={f.deposit_note} onChange={e=>s('deposit_note',e.target.value)} placeholder="z.B. pro IBC"/>
            </div>
          </div>
        </div>
      )}

      {/* Chemie */}
      {tab==='chemie'&&(
        <div className="grid grid-cols-2 gap-3">
          <Input label="CAS-Nummer" value={f.cas_number} onChange={e=>s('cas_number',e.target.value)} placeholder="z.B. 102-71-6"/>
          <Input label="EG-Nummer" value={f.eg_number} onChange={e=>s('eg_number',e.target.value)} placeholder="z.B. 203-049-8"/>
          <Input label="EU REACH-Reg. Nr." value={f.reach_number} onChange={e=>s('reach_number',e.target.value)} placeholder="01-2119..."/>
          <Input label="UN-Nummer" value={f.un_number} onChange={e=>s('un_number',e.target.value)} placeholder="z.B. UN 1263"/>
          <Input label="Zolltarifnummer" value={f.customs_tariff} onChange={e=>s('customs_tariff',e.target.value)} placeholder="z.B. 29054500"/>
          <p className="col-span-2 text-xs text-slate-500 p-2 rounded-lg"
            style={{background:'rgb(255 255 255/0.03)'}}>
            💡 Tipp: CAS-Nummer eingeben → System schlägt Stoffname, EG-Nr. und REACH-Nr. vor (Phase 4)
          </p>
        </div>
      )}

      {/* Dokumente */}
      {tab==='dokumente'&&initial?.id&&(
        <MaterialDocsTab materialId={initial.id}/>
      )}
      {tab==='dokumente'&&!initial?.id&&(
        <p className="text-xs text-center py-4" style={{color:'var(--text-muted)'}}>Bitte zuerst den Rohstoff speichern</p>
      )}

      {/* GHS & WGK */}
      {tab==='ghs'&&(
        <div className="space-y-4" style={{minHeight:440}}>
          <div>
            <p className="text-xs font-bold text-slate-300 mb-3">Wassergefährdungsklasse (WGK)</p>
            <div className="flex gap-2">
              {WGK_OPTIONS.map(w=>(
                <button key={w} type="button" onClick={()=>s('wgk',w)}
                  className="flex-1 py-2 rounded-xl text-sm font-bold transition-all border"
                  style={f.wgk===w?{background:`${WGK_COLORS[w]}20`,borderColor:`${WGK_COLORS[w]}50`,color:WGK_COLORS[w]}:{background:'rgb(255 255 255/0.03)',borderColor:'rgb(255 255 255/0.08)',color:'#64748b'}}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-300 mb-3">GHS-Gefahrenhinweise</p>
            <GhsPicker selected={f.ghs_symbols} onChange={v=>s('ghs_symbols',v)}/>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
        <Button loading={loading} onClick={()=>onSave({
          ...f,
          base_price: f.base_price ? Number(f.base_price) : null,
          base_quantity: Number(f.base_quantity)||1,
          surcharge_energy: Number(f.surcharge_energy)||0,
          surcharge_adr: Number(f.surcharge_adr)||0,
          deposit_amount: Number(f.deposit_amount)||0,
          category_id: f.category_id ? Number(f.category_id) : null,
          supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
          ghs_symbols: JSON.stringify(f.ghs_symbols),
        })}>
          {initial ? 'Speichern' : 'Anlegen'}
        </Button>
      </div>
    </div>
  )
}


// ── Dokumente-Tab für Rohstoffe ────────────────────────────────
const DOC_CAT_OPTIONS = [
  {id:'sicherheitsdatenblatt',label:'Sicherheitsdatenblatt',icon:'🛡️'},
  {id:'rechnung',label:'Rechnung',icon:'🧾'},
  {id:'zertifikat',label:'Zertifikat',icon:'🏆'},
  {id:'technisch',label:'Technische Info',icon:'⚙️'},
  {id:'lieferschein',label:'Lieferschein',icon:'📦'},
  {id:'vertrag',label:'Vertrag',icon:'📄'},
  {id:'other',label:'Sonstige',icon:'📁'},
]
function MaterialDocsTab({ materialId }:{ materialId:number }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { data:docs=[], isLoading } = useQuery<any[]>({
    queryKey:['material-docs', materialId],
    queryFn: ()=>(window.api as any).documents.list('material', materialId) as Promise<any[]>,
  })
  const [category, setCategory] = useState('sicherheitsdatenblatt')
  const upload = async () => {
    const r = await (window.api as any).documents.upload('material', materialId, { category })
    if (r?.success) { qc.invalidateQueries({queryKey:['material-docs',materialId]}); qc.invalidateQueries({queryKey:['documents:all']}); toast.success('Dokument hochgeladen') }
  }
  const del = useMutation({
    mutationFn:(id:number)=>(window.api as any).documents.purge(id),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:['material-docs',materialId]}); qc.invalidateQueries({queryKey:['documents:all']}) }
  })
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={category} onChange={e=>setCategory(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl text-sm" style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',color:'var(--text-primary)'}}>
          {DOC_CAT_OPTIONS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <button onClick={upload} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
          style={{background:'var(--accent)20',border:'1px solid var(--accent)40',color:'var(--text-primary)'}}>
          <Upload size={12}/>Hochladen
        </button>
      </div>
      {isLoading&&<p className="text-xs text-center py-3" style={{color:'var(--text-muted)'}}>Lädt…</p>}
      {!isLoading&&!docs.length&&<p className="text-xs text-center py-4" style={{color:'var(--text-muted)'}}>Keine Dokumente</p>}
      <div className="space-y-1.5">
        {[...docs].sort((a,b)=>new Date(b.uploaded_at||0).getTime()-new Date(a.uploaded_at||0).getTime()).map((doc:any)=>(
          <div key={doc.id} className="flex items-center justify-between p-2 rounded-xl group"
            style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={13} className="text-slate-500 shrink-0"/>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{color:'var(--text-primary)'}}>{doc.original_name||doc.file_name}</p>
                <p className="text-[10px]" style={{color:'var(--text-muted)'}}>{DOC_CAT_OPTIONS.find(c=>c.id===doc.category)?.label||'Sonstige'} · {doc.uploaded_at?new Date(doc.uploaded_at).toLocaleDateString('de-DE'):''}</p>
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={()=>(window.api as any).documents.open(doc.id)} className="btn-ghost p-1 text-xs" style={{color:'var(--accent)'}}>Öffnen</button>
              <button onClick={()=>del.mutate(doc.id)} className="btn-ghost p-1 text-red-400"><Trash2 size={11}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
const CAT_COLORS:Record<number,string> = {1:'#8b5cf6',2:'#06b6d4',3:'#10b981',4:'#f59e0b',5:'#ec4899',6:'#ef4444',7:'#3b82f6',8:'#a78bfa'}
export default function MaterialsPage() {
  const qc=useQueryClient(); const toast=useToast()
  const [search,setSearch]=useState(''); const [sortBy,setSortBy]=useState('name_asc')
  const [viewMode,setViewMode]=useState<'grid'|'list'>('list')
  const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Material|undefined>()
  const [deleting,setDeleting]=useState<Material|undefined>()
  const [expandedId,setExpandedId]=useState<number|null>(null)
  const [showLang,setShowLang]=useState<'de'|'en'>('de')
  const [showImport,setShowImport]=useState(false)
  const [importStatus,setImportStatus]=useState<{imported:number;errors:string[]}|null>(null)

  const {data:materials=[],isLoading}=useQuery<Material[]>({queryKey:['materials',search],queryFn:()=>window.api.materials.list({search:search||undefined}) as Promise<Material[]>})
  const hasDiponMaterials = materials.some((m:Material)=>m.code==='EPI-827')
  const {data:categories=[]}=useQuery<any[]>({queryKey:['categories'],queryFn:()=>window.api.categories.list() as Promise<any[]>})
  const {data:suppliers=[]}=useQuery<any[]>({queryKey:['suppliers'],queryFn:()=>window.api.suppliers.list() as Promise<any[]>})

  const sorted=useMemo(()=>{
    return [...materials].sort((a,b)=>{
      if(sortBy==='name_desc') return b.name.localeCompare(a.name)
      if(sortBy==='price_asc')  return (a.price_per_kg_calc??0)-(b.price_per_kg_calc??0)
      if(sortBy==='price_desc') return (b.price_per_kg_calc??0)-(a.price_per_kg_calc??0)
      if(sortBy==='type')       return (a.product_type??'').localeCompare(b.product_type??'')
      return a.name.localeCompare(b.name)
    })
  },[materials,sortBy])

  const inv=()=>qc.invalidateQueries({queryKey:['materials']})
  const createM=useMutation({mutationFn:(d:unknown)=>window.api.materials.create(d),onSuccess:()=>{inv();setOpen(false);toast.success('Rohstoff angelegt')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM=useMutation({mutationFn:({id,d}:{id:number;d:unknown})=>window.api.materials.update(id,d),onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM=useMutation({mutationFn:(id:number)=>window.api.materials.delete(id),onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')}})

  const submit=(d:unknown)=>editing?updateM.mutate({id:editing.id,d}):createM.mutate(d)

  // CSV Export
  const exportCSV=()=>{
    const headers=['Name','Code','Stoffname DE','Dichte','CAS','EG-Nr','Gebinde','Preis','Einheit','Menge','Energie-Zuschlag','ADR-Zuschlag','Preis/kg','Produktart','Lieferant','WGK','Gültig ab']
    const rows=sorted.map(m=>[
      m.name,m.code,m.substance_name_de||'',m.density||'',m.cas_number||'',m.eg_number||'',
      `${m.container_type||''} ${m.container_size||''}`.trim(),
      m.base_price||'',m.base_unit,m.base_quantity,m.surcharge_energy,m.surcharge_adr,
      m.price_per_kg_calc||'',m.product_type||'',m.supplier_name||'',m.wgk,m.valid_from||''
    ])
    const csv=[headers,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(';')).join('\n')
    const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a');a.href=url;a.download='rohstoffe.csv';a.click()
    toast.success('CSV exportiert')
  }

  // Gruppierung nach Produktart (MUSS vor isLoading return stehen!)
  const byType = useMemo(()=>{
    const map = new Map<string,Material[]>()
    for(const m of sorted){
      const key=(m as any).category_name||m.product_type||'Sonstige'
      map.set(key,[...(map.get(key)||[]),m])
    }
    return map
  },[sorted])


  // Gruppierung nach Name – mehrere Lieferanten zusammenfassen
  const groupedByName = useMemo(()=>{
    const map = new Map<string, Material[]>()
    for (const m of sorted) {
      const key = m.name
      map.set(key, [...(map.get(key) ?? []), m])
    }
    // Innerhalb jeder Gruppe: günstigsten Preis zuerst
    for (const [k, arr] of map) {
      map.set(k, arr.sort((a,b)=>(a.price_per_kg_calc??999)-(b.price_per_kg_calc??999)))
    }
    return map
  },[sorted])


  const downloadTemplate = () => {
    const headers = ['name','code','einheit','cas','dichte','lieferant','kategorie','produktart',
      'gebinde','gebinde_menge','preis','preis_menge','preis_einheit',
      'maut_zuschlag','maut_einheit','adr_zuschlag','adr_einheit',
      'wgk','gueltig_ab','pfand','pfand_hinweis','stoffbezeichnung_de'].join(';')
    const example = 'Benzylalkohol;BENZALC;kg;100-51-6;1,0450 g/ml;Brenntag;Rohstoffe;Lösungsmittel EP;IBC Container;1000 L;224,30;100;kg;8,95;100 kg;;;WGK2;2026-04-14;192,00;pro IBC;Phenylmethanol'
    const csv = headers + '\n' + example
    const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rohstoffe_vorlage.csv';a.click()
  }

  const handleCSVImport = async (file: File) => {
    const text = await file.text()
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean)
    const sep = lines[0].includes(';') ? ';' : ','
    const headers = lines[0].split(sep).map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'))
    const rows = lines.slice(1).map(line=>{
      const vals = line.split(sep)
      const obj: Record<string,string> = {}
      headers.forEach((h,i)=>{ obj[h]=(vals[i]||'').trim().replace(/^"|"$/g,'') })
      return obj
    }).filter(r=>r.name)
    const result = await window.api.materials.importCSV(rows) as {imported:number;errors:string[]}
    setImportStatus(result)
    qc.invalidateQueries({queryKey:['materials']})
    if(result.imported>0) toast.success(`${result.imported} Rohstoffe importiert`)
    if(result.errors.length) toast.error(`${result.errors.length} Fehler beim Import`)
  }

  if(isLoading) return (
    <div>
      <div className="page-header mb-4">
        <div><div className="h-7 w-48 bg-white/5 rounded-lg animate-pulse"/><div className="h-3 w-24 bg-white/4 rounded mt-1 animate-pulse"/></div>
      </div>
      <SkeletonTable rows={8} cols={5}/>
    </div>
  )

  return(
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Rohstoffe & Materialien</h2>
          <p className="page-subtitle">{materials.length} Einträge</p>
        </div>
        <div className="flex items-center gap-2">
          {!hasDiponMaterials && (
            <Button variant="secondary"
              onClick={async()=>{
                const r=await window.api.materials.runSeed() as any
                qc.invalidateQueries({queryKey:['materials']})
                toast.success(r.message)
              }}
              style={{background:'rgb(245 158 11/0.15)',borderColor:'rgb(245 158 11/0.3)',color:'#f59e0b'}}>
              ⚡ DIPON-Rohstoffe laden
            </Button>
          )}
          <button onClick={downloadTemplate}
            className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl"
            title="CSV-Vorlage herunterladen">
            <Download size={13}/> Vorlage
          </button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl">
            <Download size={13}/> Export
          </button>
          <label className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl cursor-pointer"
            title="CSV importieren">
            <Upload size={13}/> Import
            <input type="file" accept=".csv" className="hidden"
              onChange={e=>e.target.files?.[0]&&handleCSVImport(e.target.files[0])}/>
          </label>
          <button onClick={()=>setShowLang(l=>l==='de'?'en':'de')}
            className="text-xs px-3 py-1.5 rounded-xl border border-white/10 text-slate-400 hover:text-white transition-colors">
            🌐 {showLang.toUpperCase()}
          </button>
          <Button icon={<Plus size={14}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>Anlegen</Button>
        </div>
      </div>

      {importStatus&&(
        <div className={`p-3 rounded-xl mb-3 text-xs flex items-center justify-between ${importStatus.errors.length?'bg-amber-500/10 border border-amber-500/20':'bg-emerald-500/10 border border-emerald-500/20'}`}>
          <span className={importStatus.errors.length?'text-amber-400':'text-emerald-400'}>
            ✅ {importStatus.imported} importiert
            {importStatus.errors.length>0&&` · ⚠ ${importStatus.errors.length} Fehler`}
          </span>
          <button onClick={()=>setImportStatus(null)} className="text-slate-500 hover:text-slate-300">×</button>
        </div>
      )}
      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy}
        sortOptions={SORT_OPTIONS} search={search} onSearch={setSearch} searchPlaceholder="Name, CAS, Produktart…"/>

      {viewMode==='list'&&(
        <div className="space-y-4" style={{minHeight:440}}>
          {[...byType.entries()].map(([type,mats])=>(
            <div key={type}>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 px-1">{type} ({mats.length})</p>
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
                    <th className="table-th">Name / Bezeichnung</th>
                    <th className="table-th">CAS / Dichte</th>
                    <th className="table-th">Gebinde</th>
                    <th className="table-th text-right">Preis / kg</th>
                    <th className="table-th">WGK</th>
                    <th className="table-th">Lieferant</th>
                    <th className="table-th hidden md:table-cell">Gültig ab</th>
                    <th className="table-th text-right w-20"/>
                  </tr></thead>
                  <tbody>
                    {[...groupedByName.entries()]
                    .filter(([name]) => mats.some(m=>m.name===name))
                    .map(([name, group])=>{
                      const cheapest = group[0]
                      const ghs = JSON.parse(cheapest.ghs_symbols||'[]') as string[]
                      const isExp = expandedId===cheapest.id
                      const hasMultiple = group.length > 1
                      return(<>
                        {/* Hauptzeile – günstigster Preis */}
                        <tr key={name} className="table-row group cursor-pointer hover:bg-white/3"
                          onClick={()=>setExpandedId(isExp?null:cheapest.id)}>
                          <td className="table-td">
                            <div className="flex items-center gap-2">
                              <FlaskConical size={13} className="text-brand-400 shrink-0"/>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-200">{cheapest.name}</p>
                                  {hasMultiple&&(
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                      style={{background:'rgb(139 92 246/0.2)',color:'#a78bfa'}}>
                                      {group.length} Lieferanten
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="table-td">
                            <p className="text-xs font-mono text-slate-400">{cheapest.cas_number||'–'}</p>
                            {cheapest.density&&<p className="text-[10px] text-slate-600">{cheapest.density}</p>}
                          </td>
                          <td className="table-td text-slate-400 text-xs">
                            {cheapest.container_type&&<span>{cheapest.container_type}{cheapest.container_size&&<span className="text-slate-600"> {cheapest.container_size}</span>}</span>}
                            {!cheapest.container_type&&<span className="text-slate-700">–</span>}
                          </td>
                          <td className="table-td text-right">
                            {cheapest.price_per_kg_calc
                              ?<div>
                                <span className="font-mono font-bold text-emerald-400">{fmtEur(cheapest.price_per_kg_calc)}</span>
                                {hasMultiple&&<p className="text-[10px] text-slate-600">günstigster</p>}
                              </div>
                              :<span className="text-slate-600 text-xs">–</span>}
                          </td>
                          <td className="table-td"><WgkBadge wgk={cheapest.wgk||'-'}/></td>
                          <td className="table-td text-slate-400 text-xs">
                            {(cheapest as any).supplier_name||(cheapest as any).preferred_supplier||'–'}
                          </td>
                          <td className="table-td hidden md:table-cell text-slate-500 text-xs">{cheapest.valid_from||'–'}</td>
                          <td className="table-td text-right">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="btn-ghost p-1.5" onClick={e=>{e.stopPropagation();setEditing(cheapest);setOpen(true)}}><Pencil size={12}/></button>
                              <button className="btn-ghost p-1.5 text-red-400" onClick={e=>{e.stopPropagation();setDeleting(cheapest)}}><Trash2 size={12}/></button>
                            </div>
                          </td>
                        </tr>

                        {/* Aufgeklappt: Details + weitere Lieferanten */}
                        {isExp&&(
                          <tr key={`${cheapest.id}-exp`} style={{background:'rgb(139 92 246/0.04)'}}>
                            <td colSpan={8} className="px-6 pb-5 pt-3">
                              {/* Alle Lieferanten */}
                              {hasMultiple&&(
                                <div className="mb-4">
                                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">Alle Lieferanten & Preise</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    {group.map((v,i)=>(
                                      <div key={v.id} className="p-3 rounded-xl flex items-center justify-between"
                                        style={{background:i===0?'rgb(16 185 129/0.08)':'rgb(255 255 255/0.03)',border:i===0?'1px solid rgb(16 185 129/0.2)':'1px solid rgb(255 255 255/0.06)'}}>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-semibold text-slate-200">{v.supplier_name||'–'}</p>
                                            {i===0&&<span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{background:'rgb(16 185 129/0.2)',color:'#10b981'}}>günstigster</span>}
                                          </div>
                                          {v.base_price&&<p className="text-[10px] text-slate-500 mt-0.5">{v.base_price} € / {v.base_quantity} {v.base_unit}</p>}
                                          {v.surcharge_energy>0&&<p className="text-[10px] text-amber-500">+Maut {v.surcharge_energy} € / {v.surcharge_energy_unit}</p>}
                                          {v.surcharge_adr>0&&<p className="text-[10px] text-red-400">+ADR {v.surcharge_adr} € / {v.surcharge_adr_unit}</p>}
                                          {v.valid_from&&<p className="text-[10px] text-slate-600">Gültig ab {v.valid_from}</p>}
                                        </div>
                                        <div className="text-right">
                                          <p className={`text-base font-black font-mono ${i===0?'text-emerald-400':'text-slate-300'}`}>
                                            {v.price_per_kg_calc?fmtEur(v.price_per_kg_calc):'-'}
                                          </p>
                                          <p className="text-[10px] text-slate-600">/kg</p>
                                          <div className="flex gap-1 mt-1 justify-end">
                                            <button className="btn-ghost p-1" onClick={e=>{e.stopPropagation();setEditing(v);setOpen(true)}}><Pencil size={11}/></button>
                                            <button className="btn-ghost p-1 text-red-400" onClick={e=>{e.stopPropagation();setDeleting(v)}}><Trash2 size={11}/></button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Stamm- & Chemiedaten */}
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">Preisaufschlüsselung</p>
                                  <PriceBreakdown m={cheapest}/>
                                  {cheapest.deposit_amount>0&&<p className="text-xs text-slate-500 mt-2">Pfand: <strong className="text-slate-300">{fmtEur2(cheapest.deposit_amount)}</strong> {cheapest.deposit_note}</p>}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">Chemische Daten</p>
                                  {[['CAS',cheapest.cas_number],['EG-Nr.',cheapest.eg_number],['REACH',cheapest.reach_number],['UN-Nr.',cheapest.un_number],['Zolltarif',cheapest.customs_tariff]].map(([l,v])=>v?(
                                    <p key={l} className="text-xs text-slate-500">{l}: <span className="text-slate-300 font-mono">{v}</span></p>
                                  ):null)}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-2">GHS & Sicherheit</p>
                                  <GhsBadges symbols={ghs} size={36}/>
                                  {!ghs.length&&<p className="text-xs text-slate-600">Keine GHS-Symbole hinterlegt</p>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>)
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {!sorted.length&&(
            <div className="glass-card">
              <EmptyState icon={<FlaskConical size={40}/>} title="Keine Rohstoffe"
                description="DIPON-Rohstoffe können automatisch eingespielt werden"
                action={<div className="flex gap-2">
                  <Button variant="secondary" onClick={async()=>{const r=await window.api.materials.runSeed() as any;if(r.count>0){qc.invalidateQueries({queryKey:['materials']});toast.success(r.message)}else toast.info(r.message)}}>
                    ⚡ DIPON-Rohstoffe laden
                  </Button>
                  <Button icon={<Plus size={14}/>} onClick={()=>setOpen(true)}>Manuell anlegen</Button>
                </div>}/>
            </div>
          )}
        </div>
      )}

      {viewMode==='grid'&&(
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map(m=>{
            const ghs=JSON.parse(m.ghs_symbols||'[]') as string[]
            return(
              <GlowCard
                key={m.id}
                color={m.category_id?(CAT_COLORS[m.category_id]||'#8b5cf6'):'#8b5cf6'}
                icon={<FlaskConical size={20}/>}
                isActive={!!m.is_active}
                title={m.name}
                subtitle={m.code}
                onEdit={()=>{setEditing(m);setOpen(true)}}
                onDelete={()=>setDeleting(m)}
                badge={m.wgk&&m.wgk!=='-'?m.wgk:undefined}
                meta={[
                  ...(m.cas_number?[{label:'CAS',value:m.cas_number}]:[]),
                  ...(m.container_type?[{label:'Gebinde',value:`${m.container_type} ${m.container_size||''}`}]:[]),
                  ...(m.supplier_name?[{label:'Lieferant',value:m.supplier_name}]:[]),
                ]}
                highlight={m.price_per_kg_calc&&(
                  <p style={{fontSize:16,fontWeight:800,color:'#a78bfa',fontFamily:'monospace'}}>{fmtEur(m.price_per_kg_calc)}<span style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:400}}>/kg</span></p>
                )}
                footer={ghs.length>0?<GhsBadges symbols={ghs} size={24}/>:undefined}
              />
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={editing?'Rohstoff bearbeiten':'Neuer Rohstoff'} size="xl">
        <MaterialForm initial={editing} categories={categories} suppliers={suppliers}
          onSave={submit} onClose={()=>setOpen(false)} loading={createM.isPending||updateM.isPending}/>
      </Modal>
      <ConfirmDialog open={!!deleting} title="Löschen?" message={`"${deleting?.name}" löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)} onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
