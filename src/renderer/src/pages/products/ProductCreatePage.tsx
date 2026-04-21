/**
 * Produkt anlegen – Bento Grid Einstieg + Live Formulierungs-Panel
 */
import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical, Package, Plus, X, ChevronDown, ChevronUp,
  Check, AlertTriangle, ArrowLeft, GripVertical, Percent
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { Button, Input, Select } from '@/components/ui/Input'

// ── Typen ─────────────────────────────────────────────────────
interface RecipeRow {
  id: string
  material_id: number|null
  material_name: string
  material_code: string
  quantity: number
  unit: string
  price_per_kg: number|null
}

const f2  = (v:number) => v.toFixed(2).replace('.',',')
const f4  = (v:number) => v.toFixed(4).replace('.',',')
const fEur = (v:number) => `${f4(v)} €`

// ── Glassmorphism Bento Card ───────────────────────────────────
function BentoCard({children, active, onClick, color='#8b5cf6', className=''}:
  {children:React.ReactNode;active?:boolean;onClick?:()=>void;color?:string;className?:string}) {
  return (
    <div onClick={onClick}
      className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${onClick?'cursor-pointer':''}  ${className}`}
      style={{
        background: active
          ? `linear-gradient(145deg, ${color}18 0%, rgba(8,11,28,0.96) 100%)`
          : 'linear-gradient(145deg, rgba(15,20,45,0.92) 0%, rgba(8,11,28,0.96) 100%)',
        border: `1px solid ${active ? color+'45' : 'rgba(255,255,255,0.07)'}`,
        backdropFilter:'blur(24px)',
        boxShadow: active
          ? `0 4px 32px rgba(0,0,0,0.55), 0 0 32px ${color}20, inset 0 1px 0 rgba(255,255,255,0.08)`
          : '0 4px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
      {/* Shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{background:`linear-gradient(90deg,transparent,${color}50,transparent)`}}/>
      {children}
    </div>
  )
}

// ── Haupt-Seite ────────────────────────────────────────────────
export default function ProductCreatePage() {
  const navigate = useNavigate()
  const params = useParams<{id?:string}>()
  const editId = params.id
  const isEdit = !!editId && editId !== 'new'
  const qc = useQueryClient()
  const toast = useToast()

  // Step: start in 'formula' when editing so choose screen never shows
  const [step, setStep] = useState<'choose'|'formula'|'no-formula'>(isEdit ? 'formula' : 'choose')

  // Form state
  const [name, setName]           = useState('')
  const [code, setCode]           = useState('')
  const [groupId, setGroupId]     = useState('')
  const [batchSize, setBatchSize] = useState('1000')
  const [batchUnit, setBatchUnit] = useState('kg')
  const [notes, setNotes]         = useState('')
  const [ean, setEan]             = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [rows, setRows]           = useState<RecipeRow[]>([
    {id:'1',material_id:null,material_name:'',material_code:'',quantity:0,unit:'kg',price_per_kg:null}
  ])
  const [displayUnit, setDisplayUnit] = useState<'kg'|'g'|'100g'|'l'>('kg')

  // Load existing product for edit mode
  const {data:existingProduct} = useQuery<any>({
    queryKey:['product-detail', editId],
    queryFn: ()=>window.api.products.get(Number(editId)) as Promise<any>,
    enabled: !!editId,
  })

  // Populate form when editing
  React.useEffect(()=>{
    if (!existingProduct) return
    setName(existingProduct.name||'')
    setCode(existingProduct.code||'')
    setGroupId(String(existingProduct.product_group_id||''))
    setBatchSize(String(existingProduct.batch_size||1000))
    setBatchUnit(existingProduct.batch_unit||'kg')
    setNotes(existingProduct.notes||'')
    setEan(existingProduct.ean||'')
    setSupplierId(String(existingProduct.supplier_id||''))
    if (existingProduct.materials?.length > 0) {
      setStep('formula')
      setRows(existingProduct.materials.map((m:any, i:number)=>({
        id: String(i+1),
        material_id: m.material_id,
        material_name: m.material_name||'',
        material_code: m.material_code||'',
        quantity: m.quantity||0,
        unit: m.unit||'kg',
        price_per_kg: m.pref_price||null,
      })))
    } else {
      setStep('no-formula')
    }
  }, [existingProduct?.id])

  // Queries
  const {data:materials=[]} = useQuery<any[]>({
    queryKey:['materials'],
    queryFn:()=>window.api.materials.list() as Promise<any[]>,
    staleTime:30_000,
  })
  const {data:suppliers=[]} = useQuery<any[]>({
    queryKey:['suppliers'],
    queryFn:()=>window.api.suppliers.list() as Promise<any[]>,
    staleTime:30_000,
  })
  const {data:groups=[]} = useQuery<any[]>({
    queryKey:['product-groups'],
    queryFn:()=>window.api.productGroups.list() as Promise<any[]>,
  })

  // Mutations
  const createProduct = useMutation({
    mutationFn: async (d:unknown) => {
      if (isEdit && editId) {
        // UPDATE existing product
        const prod = await window.api.products.update(Number(editId), d) as any
        // Delete old materials and re-add
        const detail = await window.api.products.get(Number(editId)) as any
        for (const m of detail.materials||[]) {
          await window.api.products.deleteMaterial(Number(editId), m.id)
        }
        return prod
      }
      const prod = await window.api.products.create(d) as any
      return prod
    },
    onSuccess: async (prod) => {
      const prodId = isEdit ? Number(editId) : prod.id
      // Save recipe rows
      for (const r of rows.filter(r=>r.material_id&&r.quantity>0)) {
        await window.api.products.saveMaterial(prodId, {
          material_id: r.material_id,
          quantity: r.quantity,
          unit: r.unit,
          waste_factor: 0,
        })
      }
      qc.invalidateQueries({queryKey:['products']})
      qc.invalidateQueries({queryKey:['product-detail', editId]})
      toast.success(isEdit ? `${name} aktualisiert` : `${name} erfolgreich angelegt`)
      navigate('/recipes')
    },
    onError:(e:Error)=>toast.error('Fehler',e.message)
  })

  // ── Berechnungen ──────────────────────────────────────────────
  const totalQty = useMemo(()=>rows.reduce((s,r)=>s+(r.quantity||0),0),[rows])

  const enrichedRows = useMemo(()=>rows.map(r=>{
    const mat = (materials as any[]).find((m:any)=>m.id===r.material_id)
    const priceKg = r.price_per_kg ?? mat?.price_per_kg_calc ?? 0
    const pct = totalQty > 0 ? (r.quantity/totalQty)*100 : 0
    const costKg = priceKg * (r.quantity/totalQty) // weighted cost contribution
    return {...r, pct, priceKg, costKg, mat}
  }),[rows,materials,totalQty])

  // Price per kg of product
  const pricePerKgProduct = useMemo(()=>
    enrichedRows.reduce((s,r)=>s+r.costKg,0)
  ,[enrichedRows])

  // Display factor
  const displayFactor = displayUnit==='kg'?1 : displayUnit==='g'?0.001 : displayUnit==='100g'?0.1 : 1
  const displayLabel  = displayUnit==='kg'?'pro kg' : displayUnit==='g'?'pro g' : displayUnit==='100g'?'pro 100 g' : 'pro L'

  // ── Row helpers ───────────────────────────────────────────────
  const addRow = () => setRows(r=>[...r,{id:Date.now().toString(),material_id:null,material_name:'',material_code:'',quantity:0,unit:'kg',price_per_kg:null}])
  const removeRow = (id:string) => setRows(r=>r.filter(x=>x.id!==id))
  const updateRow = (id:string, k:keyof RecipeRow, v:unknown) =>
    setRows(r=>r.map(x=>x.id===id?{...x,[k]:v}:x))
  const selectMaterial = (rowId:string, matId:number) => {
    const mat = (materials as any[]).find((m:any)=>m.id===matId)
    setRows(r=>r.map(x=>x.id===rowId?{...x,
      material_id:matId,
      material_name:mat?.name||'',
      material_code:mat?.code||'',
      price_per_kg:mat?.price_per_kg_calc??null,
      unit:'kg'
    }:x))
  }

  const canSave = name.trim() && rows.some(r=>r.material_id&&r.quantity>0)
  const allPctOk = Math.abs(totalQty - parseFloat(batchSize||'0')) < 0.01 || parseFloat(batchSize||'0')===0

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Name erforderlich'); return }
    if (step==='formula' && !rows.some(r=>r.material_id&&r.quantity>0)) {
      toast.error('Mindestens 1 Rohstoff erforderlich'); return
    }
    createProduct.mutate({
      name: name.trim(),
      code: (code||name).trim().toUpperCase().replace(/\s+/g,'-'),
      product_group_id: groupId ? Number(groupId) : null,
      batch_size: parseFloat(batchSize)||1000,
      batch_unit: batchUnit,
      overhead_factor: 1.0,
      notes: notes||null,
      is_active: 1,
      has_formula: step==='formula' ? 1 : 0,
      ean: ean||null,
      supplier_id: supplierId?Number(supplierId):null,
    })
  }

  // ════════════════════════════════════════════════════════════
  // STEP: CHOOSE
  // ════════════════════════════════════════════════════════════
  if (!isEdit && step==='choose') return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={()=>navigate('/products')} className="btn-ghost p-2"><ArrowLeft size={16}/></button>
        <div>
          <h2 className="page-title">Neues Produkt anlegen</h2>
          <p className="page-subtitle">Wähle den Produkttyp</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <BentoCard color="#8b5cf6" onClick={()=>setStep('formula')} className="p-8 group">
          <div className="mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{background:'rgb(139 92 246/0.2)'}}>
              <FlaskConical size={26} style={{color:'#a78bfa'}}/>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Mit Formulierung</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Produkt aus Rohstoffen zusammenstellen. Preis/kg wird automatisch aus der Rezeptur berechnet.
            </p>
          </div>
          <div className="space-y-2">
            {['Rohstoff-Auswahl aus Materialdatenbank','Live Preis/kg Berechnung','Prozentuale Verteilung','Positionsnummern'].map(f=>(
              <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgb(139 92 246/0.2)',color:'#a78bfa'}}>
                  <Check size={10}/>
                </span>{f}
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{color:'#a78bfa'}}>
            Wählen <span>→</span>
          </div>
        </BentoCard>

        <BentoCard color="#10b981" onClick={()=>setStep('no-formula')} className="p-8 group">
          <div className="mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{background:'rgb(16 185 129/0.2)'}}>
              <Package size={26} style={{color:'#34d399'}}/>
            </div>
            <h3 className="text-xl font-black text-white mb-2">Ohne Formulierung</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Zugekauftes Produkt oder Komponente ohne eigene Rezeptur. Preis wird manuell hinterlegt.
            </p>
          </div>
          <div className="space-y-2">
            {['Manueller Preis','Kein Rohstoffverzeichnis nötig','Als Komponente nutzbar','Schnelle Anlage'].map(f=>(
              <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{background:'rgb(16 185 129/0.2)',color:'#34d399'}}>
                  <Check size={10}/>
                </span>{f}
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{color:'#34d399'}}>
            Wählen <span>→</span>
          </div>
        </BentoCard>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // STEP: NO FORMULA
  // ════════════════════════════════════════════════════════════
  if (step==='no-formula') return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={()=>setStep('choose')} className="btn-ghost p-2"><ArrowLeft size={16}/></button>
        <div>
          <h2 className="page-title">Produkt ohne Formulierung</h2>
          <p className="page-subtitle">Zugekauftes Produkt oder externe Komponente</p>
        </div>
      </div>
      <BentoCard color="#10b981" className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Produktname *" value={name} autoFocus onChange={e=>setName(e.target.value)} placeholder="z.B. Härter XY"/>
          </div>
          <Input label="Code (optional)" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Auto"/>
          <Select label="Produktgruppe" value={groupId} onChange={e=>setGroupId(e.target.value)}>
            <option value="">– keine –</option>
            {(groups as any[]).map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">EAN (optional)</label>
            <input value={ean} onChange={e=>setEan(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-brand-500"
              placeholder="z.B. 4260123456789"/>
          </div>
          <Select label="Lieferant" value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
            <option value="">– kein –</option>
            {(suppliers as any[]).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={()=>setStep('choose')}>Zurück</Button>
          <Button onClick={handleSubmit} loading={createProduct.isPending}
            style={{background:'rgb(16 185 129/0.3)',borderColor:'rgb(16 185 129/0.4)'}}>
            <Check size={14}/>Produkt anlegen
          </Button>
        </div>
      </BentoCard>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // STEP: FORMULA
  // ════════════════════════════════════════════════════════════
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={()=>isEdit?navigate('/recipes'):setStep('choose')} className="btn-ghost p-2"><ArrowLeft size={16}/></button>
        <div>
          <h2 className="page-title">{isEdit ? 'Rezeptur bearbeiten' : 'Produkt mit Formulierung'}</h2>
          <p className="page-subtitle">{isEdit ? existingProduct?.name : 'Rohstoffe auswählen · Live-Kalkulation'}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── Linke Spalte: Stammdaten + Rezeptur ── */}
        <div className="col-span-7 space-y-4">
          {/* Stammdaten */}
          <BentoCard color="#8b5cf6" className="p-5">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Stammdaten</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Produktname *" value={name} autoFocus
                  onChange={e=>setName(e.target.value)} placeholder="z.B. LuminaCast A"/>
              </div>
              <Input label="Code" value={code}
                onChange={e=>setCode(e.target.value.toUpperCase())}
                placeholder="z.B. LC-A"/>
              <Input label="EAN (optional)" value={ean}
                onChange={e=>setEan(e.target.value)}
                placeholder="4260..."/>
              <Select label="Produktgruppe" value={groupId} onChange={e=>setGroupId(e.target.value)}>
                <option value="">– keine –</option>
                {(groups as any[]).map((g:any)=><option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Chargengröße</label>
                <input type="number" value={batchSize} onChange={e=>setBatchSize(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-brand-500"/>
              </div>
              <Select label="Einheit" value={batchUnit} onChange={e=>setBatchUnit(e.target.value)}>
                {['kg','g','l','ml'].map(u=><option key={u}>{u}</option>)}
              </Select>
            </div>
          </BentoCard>

          {/* Rezeptur */}
          <BentoCard color="#8b5cf6" className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formulierung</p>
              <div className="flex items-center gap-2">
                {!allPctOk && totalQty > 0 && (
                  <span className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={11}/>Charge: {f2(totalQty)} {batchUnit}
                  </span>
                )}
                <span className="text-[10px] text-slate-600">Gesamt: <strong className="text-slate-300">{f2(totalQty)} {batchUnit}</strong></span>
              </div>
            </div>

            <div className="space-y-1">
              {/* Header */}
              <div className="grid text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 mb-1"
                style={{gridTemplateColumns:'28px 1fr 100px 80px 1fr 24px'}}>
                <span>Pos</span><span>Rohstoff</span><span>Menge</span>
                <span>Einheit</span><span>Preis/kg</span><span/>
              </div>

              {rows.map((row,i)=>{
                const er = enrichedRows.find(e=>e.id===row.id)
                return(
                  <div key={row.id} className="grid items-center gap-1 p-1.5 rounded-xl group hover:bg-white/3"
                    style={{gridTemplateColumns:'28px 1fr 100px 80px 1fr 24px',
                      background:row.material_id?'rgba(139,92,246,0.04)':'transparent',
                      border:'1px solid',
                      borderColor:row.material_id?'rgba(139,92,246,0.15)':'rgba(255,255,255,0.04)'}}>
                    {/* Pos */}
                    <span className="text-xs font-bold text-slate-600 text-center">{i+1}</span>
                    {/* Material */}
                    <select value={row.material_id||''} onChange={e=>selectMaterial(row.id,Number(e.target.value))}
                      className="w-full px-2 py-1 rounded-lg text-xs text-white bg-white/5 border border-white/8 outline-none focus:border-brand-500">
                      <option value="">– Rohstoff wählen –</option>
                      {Object.entries(
                        (materials as any[]).reduce((g:any,m:any)=>{
                          const k=m.category_name||m.product_type||'Sonstige'
                          if(!g[k])g[k]=[];g[k].push(m);return g
                        },{})
                      ).sort(([a],[b])=>a.localeCompare(b,'de')).map(([cat,mats])=>(
                        <optgroup key={cat} label={cat}>
                          {(mats as any[]).map((m:any)=>(
                            <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {/* Menge */}
                    <input type="number" step="0.001" value={row.quantity||''}
                      onChange={e=>updateRow(row.id,'quantity',parseFloat(e.target.value)||0)}
                      className="w-full px-2 py-1 rounded-lg text-xs text-white font-mono bg-white/5 border border-white/8 outline-none focus:border-brand-500"
                      placeholder="0"/>
                    {/* Einheit */}
                    <select value={row.unit} onChange={e=>updateRow(row.id,'unit',e.target.value)}
                      className="w-full px-2 py-1 rounded-lg text-xs text-white bg-white/5 border border-white/8 outline-none">
                      {['kg','g','l','ml'].map(u=><option key={u}>{u}</option>)}
                    </select>
                    {/* Preis override */}
                    <input type="number" step="0.0001"
                      value={row.price_per_kg!=null?row.price_per_kg:''}
                      onChange={e=>updateRow(row.id,'price_per_kg',e.target.value?parseFloat(e.target.value):null)}
                      className="w-full px-2 py-1 rounded-lg text-xs text-white font-mono bg-white/5 border border-white/8 outline-none focus:border-brand-500"
                      placeholder={er?.mat?.price_per_kg_calc?f4(er.mat.price_per_kg_calc):'–'}/>
                    {/* Delete */}
                    {rows.length>1&&(
                      <button onClick={()=>removeRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 btn-ghost p-0.5 text-red-400">
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <button onClick={addRow}
              className="w-full mt-2 py-1.5 rounded-xl text-xs text-slate-500 hover:text-white border border-dashed border-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-1.5">
              <Plus size={12}/>Zeile hinzufügen
            </button>
          </BentoCard>

          {/* Speichern */}
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={()=>isEdit?navigate('/recipes'):setStep('choose')}>Abbrechen</Button>
            <button onClick={handleSubmit} disabled={!canSave||createProduct.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
              style={{
                background:canSave?'linear-gradient(135deg,#16a34a,#15803d)':'rgb(255 255 255/0.05)',
                border:'1px solid',
                borderColor:canSave?'#22c55e50':'rgba(255,255,255,0.08)',
                boxShadow:canSave?'0 0 20px rgb(22 163 74/0.3)':'none',
              }}>
              <Check size={16}/>
              {createProduct.isPending?'Wird gespeichert…':isEdit?'Rezeptur speichern':'Formulierung abschließen & Produkt anlegen'}
            </button>
          </div>
        </div>

        {/* ── Rechte Spalte: Live-Kalkulation ── */}
        <div className="col-span-5">
          <div className="p-5 sticky top-4" style={{background:'linear-gradient(145deg,rgba(15,20,45,0.92),rgba(8,11,28,0.96))',border:'1px solid rgba(99,155,255,0.18)',borderRadius:18,backdropFilter:'blur(24px)',boxShadow:'0 4px 32px rgba(0,0,0,0.55),0 0 24px rgba(70,130,255,0.08)'}}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live-Kalkulation</p>
              <div className="flex gap-1 p-0.5 rounded-xl" style={{background:'rgba(0,0,0,0.3)',border:'1px solid rgba(255,255,255,0.06)'}}>
                {(['kg','100g','g','l'] as const).map(u=>(
                  <button key={u} onClick={()=>setDisplayUnit(u)}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                    style={displayUnit===u?{background:'rgb(6 182 212/0.3)',color:'#22d3ee'}:{color:'#64748b'}}>
                    /{u}
                  </button>
                ))}
              </div>
            </div>

            {!enrichedRows.some(r=>r.quantity>0) ? (
              <div className="text-center py-8">
                <FlaskConical size={28} className="text-slate-700 mx-auto mb-2"/>
                <p className="text-slate-600 text-xs">Rohstoffe + Mengen eingeben</p>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Rohstoff-Zeilen */}
                {enrichedRows.filter(r=>r.quantity>0).map((r,i)=>(
                  <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                    style={{background:'rgba(255,255,255,0.03)'}}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-slate-600 w-5 text-center">{i+1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">
                          {r.material_name||<span className="text-slate-600 italic">kein Rohstoff</span>}
                        </p>
                        <p className="text-[10px] text-slate-600">
                          {f2(r.quantity)} {r.unit} · {f2(r.pct)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-mono font-bold text-cyan-400">
                        {r.priceKg > 0 ? fEur(r.priceKg * displayFactor) : <span className="text-slate-600">–</span>}
                      </p>
                      <p className="text-[10px] text-slate-600">{fEur(r.costKg)} Anteil</p>
                    </div>
                  </div>
                ))}

                {/* Trenner */}
                <div className="border-t border-white/8 mt-2 pt-2">
                  {/* Prozentbalken */}
                  <div className="flex rounded-full overflow-hidden h-2 mb-3">
                    {enrichedRows.filter(r=>r.pct>0).map((r,i)=>{
                      const colors=['#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#ef4444','#a78bfa']
                      return <div key={r.id} style={{width:`${r.pct}%`,background:colors[i%colors.length]}} title={`${r.material_name}: ${f2(r.pct)}%`}/>
                    })}
                  </div>

                  {/* Gesamtgewicht */}
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Chargengewicht</span>
                    <span className="text-slate-300 font-mono">{f2(totalQty)} {batchUnit}</span>
                  </div>

                  {/* Preis/kg */}
                  <div className="flex justify-between items-center mt-3 p-3 rounded-xl"
                    style={{background:'rgb(6 182 212/0.08)',border:'1px solid rgb(6 182 212/0.2)'}}>
                    <div>
                      <p className="text-[10px] text-slate-500">Preis</p>
                      <p className="text-xs text-slate-400">{displayLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-white font-mono">
                        {fEur(pricePerKgProduct * displayFactor)}
                      </p>
                      {displayUnit!=='kg'&&<p className="text-[10px] text-slate-500">{fEur(pricePerKgProduct)} / kg</p>}
                    </div>
                  </div>

                  {/* Rohstoff mit fehlendem Preis */}
                  {enrichedRows.some(r=>r.quantity>0&&!r.priceKg)&&(
                    <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                      <AlertTriangle size={10}/>
                      Einige Rohstoffe haben keinen Preis — Kalkulation unvollständig
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
