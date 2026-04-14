import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, FlaskConical, Search, AlertTriangle, Star, FileText } from 'lucide-react'
import { api }          from '@/lib/api'
import { Button }       from '@/components/ui/Input'
import { Modal }        from '@/components/ui/Modal'
import { EmptyState, Spinner, ConfirmDialog, Badge } from '@/components/ui/Badge'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast }     from '@/hooks/useToast'
import { ViewControls } from '@/components/ui/ViewControls'
import { DocumentManager } from '@/components/ui/DocumentManager'
import { UNITS, CURRENCIES, generateCode, formatCurrency, formatWeight, formatDate } from '@/lib/formatters'
import type { Material, MaterialFormData, SupplierPrice, SupplierPriceFormData, Supplier, Category } from '@/types'

const EMPTY_MAT: MaterialFormData = {
  name:'',code:'',category_id:'',unit:'kg',density:'',description:'',
  cas_number:'',inci_name:'',min_stock:0,current_stock:0,safety_stock:0,
  storage_conditions:'',shelf_life_months:'',is_hazardous:0,is_active:1,
}

// Erweitertes Preisformular mit Datum
interface PriceFormExt extends SupplierPriceFormData {
  invoice_date:      string
  invoice_reference: string
  price_valid_from:  string  // Datum ab wann der Preis gilt
}

const EMPTY_PF: PriceFormExt = {
  supplier_id:'', price_per_unit:0, currency:'EUR', unit:'kg',
  min_order_qty:1, lead_time_days:'', is_preferred:0,
  valid_from: new Date().toISOString().slice(0,10),
  notes:'',
  invoice_date:      new Date().toISOString().slice(0,10),
  invoice_reference: '',
  price_valid_from:  new Date().toISOString().slice(0,10),
}

function MaterialForm({ initial, onSubmit, onSavePrice, onDeletePrice, onCancel, loading }:
  { initial?:Material&{prices?:SupplierPrice[]}; onSubmit:(d:MaterialFormData)=>Promise<void>;
    onSavePrice:(id:number,d:PriceFormExt)=>Promise<void>;
    onDeletePrice?:(matId:number,priceId:number)=>Promise<void>;
    onCancel:()=>void; loading?:boolean }) {

  const [form, setForm]     = useState<MaterialFormData>(EMPTY_MAT)
  const [tab, setTab]       = useState<'base'|'prices'|'docs'>('base')
  const [pf, setPf]         = useState<PriceFormExt>(EMPTY_PF)
  const [savingP, setSavingP] = useState(false)

  const {data:sups}  = useQuery<Supplier[]>({queryKey:['suppliers'],queryFn:()=>api.suppliers.list()})
  const {data:cats}  = useQuery<Category[]>({queryKey:['categories'],queryFn:()=>api.categories.list()})

  useEffect(()=>{
    setForm(initial ? {
      name:initial.name, code:initial.code,
      category_id:initial.category_id?.toString()??'', unit:initial.unit,
      density:initial.density?.toString()??'',description:initial.description??'',
      cas_number:initial.cas_number??'',inci_name:initial.inci_name??'',
      min_stock:initial.min_stock,current_stock:initial.current_stock,safety_stock:initial.safety_stock,
      storage_conditions:initial.storage_conditions??'',
      shelf_life_months:initial.shelf_life_months?.toString()??'',
      is_hazardous:initial.is_hazardous,is_active:initial.is_active,
    } : EMPTY_MAT)
    setPf({...EMPTY_PF, unit: initial?.unit ?? 'kg'})
    setTab('base')
  },[initial])

  const set = (k:keyof MaterialFormData,v:string|number) => setForm(f=>({...f,[k]:v}))

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault()
    if(!form.name.trim()||!form.code.trim()) return
    await onSubmit(form)
  }

  const handleSavePrice = async () => {
    if(!initial?.id||!pf.supplier_id||!pf.price_per_unit) return
    setSavingP(true)
    try {
      await onSavePrice(initial.id, pf)
      setPf({...EMPTY_PF, unit:form.unit})
    } finally { setSavingP(false) }
  }

  const prices = initial?.prices ?? []
  const TABS = [
    { id:'base',   label:'Stammdaten' },
    { id:'prices', label:`Preise (${prices.length})` },
    ...(initial ? [{ id:'docs', label:'Dokumente' }] : []),
  ] as const

  return (
    <div>
      {/* Tab Bar */}
      {initial && (
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-slate-800/50 w-fit">
          {TABS.map(t=>(
            <button key={t.id} type="button" onClick={()=>setTab(t.id as typeof tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${tab===t.id?'bg-brand-500 text-white':'text-slate-400 hover:text-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Stammdaten ──────────────────────────────────── */}
      {tab==='base' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Name *" value={form.name} autoFocus
                onChange={e=>{set('name',e.target.value);if(!initial)set('code',generateCode(e.target.value,'MAT'))}}/>
            </div>
            <Input label="Code *" value={form.code} onChange={e=>set('code',e.target.value.toUpperCase())}/>
            <Select label="Einheit *" value={form.unit} onChange={e=>set('unit',e.target.value)}>
              {UNITS.map(u=><option key={u}>{u}</option>)}
            </Select>
            <Select label="Kategorie" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
              <option value="">– Keine –</option>
              {(cats??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Input label="Dichte (g/ml)" type="number" step="0.001" value={form.density}
              onChange={e=>set('density',e.target.value)} placeholder="0.960"/>
            <Input label="CAS-Nummer" value={form.cas_number} onChange={e=>set('cas_number',e.target.value)}/>
            <Input label="INCI-Name" value={form.inci_name} onChange={e=>set('inci_name',e.target.value)}/>
            <div className="col-span-2">
              <Textarea label="Beschreibung" value={form.description} rows={2}
                onChange={e=>set('description',e.target.value)}/>
            </div>
            <Input label="Aktuell (Bestand)" type="number" step="0.001" value={form.current_stock}
              onChange={e=>set('current_stock',Number(e.target.value))}/>
            <Input label="Mindestbestand" type="number" step="0.001" value={form.min_stock}
              onChange={e=>set('min_stock',Number(e.target.value))}/>
            <Select label="Status" value={form.is_active} onChange={e=>set('is_active',Number(e.target.value))}>
              <option value={1}>Aktiv</option><option value={0}>Inaktiv</option>
            </Select>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.is_hazardous===1}
                onChange={e=>set('is_hazardous',e.target.checked?1:0)}
                className="rounded border-white/20 bg-slate-800 text-brand-500"/>
              <span className="text-sm text-slate-300">Gefahrstoff (ADR/GHS)</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Abbrechen</Button>
            <Button type="submit" loading={loading}>{initial?'Speichern':'Anlegen'}</Button>
          </div>
        </form>
      )}

      {/* ── Preise ──────────────────────────────────────── */}
      {tab==='prices' && initial && (
        <div className="space-y-4">
          {/* Bestehende Preise */}
          {prices.map(p=>(
            <div key={p.id}
              className="flex items-center justify-between p-3 rounded-xl group"
              style={{ background:'rgb(255 255 255 / 0.03)', border:'1px solid rgb(255 255 255 / 0.06)' }}>
              <div className="flex items-center gap-3">
                {p.is_preferred ? <Star size={14} className="text-amber-400"/> : <div className="w-3.5"/>}
                <div>
                  <p className="text-sm font-medium text-slate-200">{p.supplier_name}</p>
                  <p className="text-xs text-slate-500">
                    Min. {p.min_order_qty} {p.unit}
                    {p.lead_time_days != null && ` · LZ ${p.lead_time_days} Tage`}
                    {p.valid_from && <span className="ml-2 text-emerald-600">ab {formatDate(p.valid_from)}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-100">
                    {formatCurrency(p.price_per_unit, p.currency)} / {p.unit}
                  </p>
                </div>
                {onDeletePrice && (
                  <button className="btn-ghost p-1 text-red-400 opacity-0 group-hover:opacity-100"
                    onClick={()=>onDeletePrice(initial.id, p.id)}>
                    <Trash2 size={13}/>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Neuer Preis */}
          <div className="p-4 rounded-xl space-y-4"
            style={{ background:'rgb(139 92 246 / 0.05)', border:'1px solid rgb(139 92 246 / 0.15)' }}>
            <p className="text-xs font-bold text-brand-400 uppercase tracking-wider">
              Neuen Preis hinzufügen
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Select label="Lieferant *" value={pf.supplier_id}
                onChange={e=>setPf(f=>({...f,supplier_id:e.target.value}))}>
                <option value="">– Wählen –</option>
                {(sups??[]).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Preis *" type="number" step="0.0001" min="0"
                value={pf.price_per_unit||''}
                onChange={e=>setPf(f=>({...f,price_per_unit:Number(e.target.value)}))}/>
              <Select label="Einheit" value={pf.unit}
                onChange={e=>setPf(f=>({...f,unit:e.target.value}))}>
                {UNITS.map(u=><option key={u}>{u}</option>)}
              </Select>
              <Select label="Währung" value={pf.currency}
                onChange={e=>setPf(f=>({...f,currency:e.target.value}))}>
                {CURRENCIES.map(c=><option key={c}>{c}</option>)}
              </Select>
              <Input label="Mindestmenge" type="number" min="0" value={pf.min_order_qty}
                onChange={e=>setPf(f=>({...f,min_order_qty:Number(e.target.value)}))}/>
              <Input label="Lieferzeit (Tage)" type="number" min="0" value={pf.lead_time_days}
                onChange={e=>setPf(f=>({...f,lead_time_days:e.target.value}))}/>
            </div>

            {/* Datum-Felder */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <Input
                label="Preis gültig ab *"
                type="date"
                value={pf.price_valid_from}
                onChange={e=>setPf(f=>({...f,price_valid_from:e.target.value,valid_from:e.target.value}))}
                hint="Wann tritt dieser Preis in Kraft?"
              />
              <Input
                label="Rechnungsdatum"
                type="date"
                value={pf.invoice_date}
                onChange={e=>setPf(f=>({...f,invoice_date:e.target.value}))}
              />
              <Input
                label="Rechnungs-Nr."
                value={pf.invoice_reference}
                onChange={e=>setPf(f=>({...f,invoice_reference:e.target.value}))}
                placeholder="RE-2025-001"
                className="col-span-2"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 col-span-2">
                <input type="checkbox" checked={pf.is_preferred===1}
                  onChange={e=>setPf(f=>({...f,is_preferred:e.target.checked?1:0}))}
                  className="rounded border-white/20 bg-slate-800 text-brand-500"/>
                <Star size={13} className="text-amber-400"/> Bevorzugter Lieferant
              </label>
            </div>

            <Button icon={<Plus size={14}/>} onClick={handleSavePrice} loading={savingP}
              disabled={!pf.supplier_id||!pf.price_per_unit}>
              Preis speichern
            </Button>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onCancel}>Schließen</Button>
          </div>
        </div>
      )}

      {/* ── Dokumente ─────────────────────────────────── */}
      {tab==='docs' && initial && (
        <div className="space-y-4">
          <DocumentManager entityType="material" entityId={initial.id} compact/>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onCancel}>Schließen</Button>
          </div>
        </div>
      )}
    </div>
  )
}

const MAT_SORT = [
  {value:'name_asc',label:'Name A–Z'},{value:'name_desc',label:'Name Z–A'},
  {value:'code_asc',label:'Code A–Z'},{value:'price_asc',label:'Preis ↑'},
  {value:'price_desc',label:'Preis ↓'},{value:'stock_asc',label:'Bestand ↑'},
]
// ─── Hauptseite ───────────────────────────────────────────────
export default function MaterialsPage() {
  const qc    = useQueryClient()
  const toast = useToast()
  const [search, setSearch]       = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [lowStock, setLowStock]   = useState(false)
  const [viewMode, setViewMode]   = useState<'grid'|'list'>('list')
  const [sortBy, setSortBy]       = useState('name_asc')
  const [open, setOpen]           = useState(false)
  const [editing, setEditing]     = useState<(Material&{prices?:SupplierPrice[]})|undefined>()
  const [deleting, setDeleting]   = useState<Material|undefined>()

  const {data,isLoading} = useQuery<Material[]>({
    queryKey:['materials',{search,filterCat,lowStock}],
    queryFn:()=>api.materials.list({
      search:search||undefined,
      category_id:filterCat?Number(filterCat):undefined,
      low_stock:lowStock||undefined,
    }),
  })
  const {data:cats} = useQuery<Category[]>({queryKey:['categories'],queryFn:()=>api.categories.list()})
  const mats = (data??[]).sort((a,b)=>{
    if(sortBy==='name_asc')   return a.name.localeCompare(b.name)
    if(sortBy==='name_desc')  return b.name.localeCompare(a.name)
    if(sortBy==='code_asc')   return a.code.localeCompare(b.code)
    if(sortBy==='price_asc')  return (a.preferred_price??Infinity)-(b.preferred_price??Infinity)
    if(sortBy==='price_desc') return (b.preferred_price??0)-(a.preferred_price??0)
    if(sortBy==='stock_asc')  return a.current_stock-b.current_stock
    return 0
  })
  const inv  = ()=>qc.invalidateQueries({queryKey:['materials']})

  const createM = useMutation({mutationFn:(d:MaterialFormData)=>api.materials.create(d),
    onSuccess:()=>{inv();setOpen(false);toast.success('Material angelegt')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})
  const updateM = useMutation({mutationFn:({id,d}:{id:number;d:MaterialFormData})=>api.materials.update(id,d),
    onSuccess:()=>{inv();setOpen(false);toast.success('Gespeichert')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})
  const deleteM = useMutation({mutationFn:(id:number)=>api.materials.delete(id),
    onSuccess:()=>{inv();setDeleting(undefined);toast.success('Gelöscht')},
    onError:(e:Error)=>toast.error('Fehler',e.message)})

  const openEdit = async (m:Material) => {
    const d = await api.materials.get(m.id)
    setEditing(d)
    setOpen(true)
  }
  const submit = async (form:MaterialFormData) => {
    if(editing) await updateM.mutateAsync({id:editing.id,d:form})
    else        await createM.mutateAsync(form)
  }
  const savePrice = async (id:number, d:PriceFormExt) => {
    await api.materials.savePrice(id, d)
    const fresh = await api.materials.get(id)
    setEditing(fresh)
    inv()
    toast.success('Preis gespeichert')
  }
  const deletePrice = async (matId:number, priceId:number) => {
    await api.materials.deletePrice(matId, priceId)
    const fresh = await api.materials.get(matId)
    setEditing(fresh)
    inv()
    toast.success('Preis entfernt')
  }

  if(isLoading) return <Spinner/>
  const lowCount = mats.filter(m=>m.current_stock<=m.min_stock).length

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Rohstoffe & Materialien</h2>
          <p className="page-subtitle">
            {mats.length} Materialien
            {lowCount>0 && <span className="ml-2 text-amber-400">· {lowCount} unter Mindestbestand</span>}
          </p>
        </div>
        <Button icon={<Plus size={16}/>} onClick={()=>{setEditing(undefined);setOpen(true)}}>
          Material anlegen
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="form-input pl-9 w-56" placeholder="Name, Code, INCI …"
            value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="form-input w-44 text-sm" value={filterCat}
          onChange={e=>setFilterCat(e.target.value)}>
          <option value="">Alle Kategorien</option>
          {(cats??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={()=>setLowStock(v=>!v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors
            ${lowStock?'bg-amber-500/15 border-amber-500/30 text-amber-400':'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'}`}>
          <AlertTriangle size={13}/> Niedriger Bestand
        </button>
      </div>

      <ViewControls viewMode={viewMode} onViewMode={setViewMode} sortBy={sortBy} onSortBy={setSortBy}
        sortOptions={MAT_SORT}/>
      {/* Tabelle */}
      <div className="glass-card overflow-hidden">
        {!mats.length ? (
          <EmptyState icon={<FlaskConical size={40}/>} title="Keine Materialien"
            action={<Button icon={<Plus size={16}/>} onClick={()=>setOpen(true)}>Erstes anlegen</Button>}/>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/5"><tr>
                <th className="table-th">Name</th>
                <th className="table-th">Code</th>
                <th className="table-th">Kategorie</th>
                <th className="table-th text-right">Bestand</th>
                <th className="table-th text-right">Preis (bevorzugt)</th>
                <th className="table-th text-center">Lief.</th>
                <th className="table-th text-center">Dok.</th>
                <th className="table-th text-center">Status</th>
                <th className="table-th text-right">Aktionen</th>
              </tr></thead>
              <tbody>
                {mats.map(m=>{
                  const isLow = m.current_stock<=m.min_stock
                  return (
                    <tr key={m.id} className="table-row group">
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          {m.is_hazardous===1 && <AlertTriangle size={12} className="text-amber-400 shrink-0"/>}
                          <span className="font-medium text-slate-200">{m.name}</span>
                          {m.inci_name && <span className="text-xs text-slate-600 hidden lg:block">({m.inci_name})</span>}
                        </div>
                      </td>
                      <td className="table-td">
                        <span className="badge-blue font-mono text-xs">{m.code}</span>
                      </td>
                      <td className="table-td">
                        {m.category_name ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0"
                              style={{backgroundColor:m.category_color??'#8b5cf6'}}/>
                            <span className="text-slate-400 text-xs">{m.category_name}</span>
                          </span>
                        ) : <span className="text-slate-600">–</span>}
                      </td>
                      <td className="table-td text-right">
                        <span className={isLow?'text-amber-400 font-semibold':'text-slate-300'}>
                          {formatWeight(m.current_stock,m.unit)}
                          {isLow && <AlertTriangle size={11} className="inline ml-1 text-amber-400"/>}
                        </span>
                      </td>
                      <td className="table-td text-right font-mono text-xs">
                        {m.preferred_price
                          ? <>{formatCurrency(m.preferred_price,m.preferred_currency??'EUR')} / {m.preferred_unit}</>
                          : <span className="text-slate-600">kein Preis</span>}
                      </td>
                      <td className="table-td text-center text-slate-400 text-xs">
                        {m.supplier_count??0}
                      </td>
                      <td className="table-td text-center">
                        <button
                          onClick={()=>openEdit(m).then(()=>{})}
                          className="btn-ghost p-1 text-xs"
                          title="Dokumente anzeigen"
                        >
                          <FileText size={13} className="text-slate-500 hover:text-brand-400 transition-colors"/>
                        </button>
                      </td>
                      <td className="table-td text-center">
                        <Badge variant={m.is_active?'green':'slate'}>
                          {m.is_active?'Aktiv':'Inaktiv'}
                        </Badge>
                      </td>
                      <td className="table-td text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="btn-ghost p-1.5" onClick={()=>openEdit(m)}>
                            <Pencil size={13}/>
                          </button>
                          <button className="btn-ghost p-1.5 text-red-400" onClick={()=>setDeleting(m)}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={()=>setOpen(false)}
        title={editing?'Material bearbeiten':'Neues Material'}
        subtitle={editing?.name} size="xl">
        <MaterialForm
          initial={editing}
          onSubmit={submit}
          onSavePrice={savePrice}
          onDeletePrice={deletePrice}
          onCancel={()=>setOpen(false)}
          loading={createM.isPending||updateM.isPending}
        />
      </Modal>

      <ConfirmDialog open={!!deleting} title="Material löschen?"
        message={`"${deleting?.name}" wirklich löschen?`}
        onConfirm={()=>deleting&&deleteM.mutate(deleting.id)}
        onCancel={()=>setDeleting(undefined)} loading={deleteM.isPending}/>
    </div>
  )
}
