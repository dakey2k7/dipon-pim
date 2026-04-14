/**
 * DIPON Margenkalkulation
 * Schrittweise Kalkulation: Rohstoffe → Rezept → Verpackung → Verkauf → Ergebnis
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FlaskConical, Package, Tag, Box, Store, TrendingUp,
  ChevronRight, ChevronDown, AlertCircle, CheckCircle,
  Plus, Trash2, Calculator, Euro, Info,
} from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Card } from '@/components/ui/Badge'
import type {
  MaterialPriceInput, TwoKProduct
} from '@/lib/calc-engine'
import {
  calcMaterialPrice, calcTwoKProduct, calcProduct
} from '@/lib/calc-engine'

// ── Helpers ───────────────────────────────────────────────────
const f2 = (v: number) => v.toFixed(2)
const f4 = (v: number) => v.toFixed(4)
const fEur = (v: number) => new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR', minimumFractionDigits:2 }).format(v)
const fPct = (v: number) => `${v.toFixed(2)} %`

// ── Schritt-Anzeige ───────────────────────────────────────────
function Step({ n, title, icon, active, done, children, onClick }: {
  n:number; title:string; icon:React.ReactNode; active:boolean; done:boolean
  children?:React.ReactNode; onClick:()=>void
}) {
  return (
    <div className={`glass-card overflow-hidden transition-all ${active?'ring-1 ring-brand-500/40':''}`}>
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/3" onClick={onClick}>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${done?'bg-emerald-500/20 text-emerald-400':active?'bg-brand-500/20 text-brand-400':'bg-white/5 text-slate-600'}`}>
          {done ? <CheckCircle size={16}/> : n}
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className={active?'text-brand-400':'text-slate-400'}>{icon}</span>
          <span className={`text-sm font-bold ${active?'text-white':done?'text-slate-300':'text-slate-500'}`}>{title}</span>
        </div>
        {active ? <ChevronDown size={15} className="text-slate-500"/> : <ChevronRight size={15} className="text-slate-600"/>}
      </div>
      {active && children && <div className="px-4 pb-5 border-t border-white/5">{children}</div>}
    </div>
  )
}

// ── Ergebnis-Zeile ────────────────────────────────────────────
function ResultRow({ label, value, color='text-slate-300', bold=false, indent=0, note }:
  { label:string; value:string; color?:string; bold?:boolean; indent?:number; note?:string }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent>0?'pl-'+indent*4:''}`}>
      <span className={`text-xs text-slate-500 flex items-center gap-1.5 ${indent>0?'pl-3 border-l border-white/8':''}`}>
        {label}
        {note && <span className="text-slate-600" title={note}><Info size={10}/></span>}
      </span>
      <span className={`text-sm font-mono ${bold?'font-bold text-base':''} ${color}`}>{value}</span>
    </div>
  )
}

// ── Haupt-Kalkulation ─────────────────────────────────────────
export default function MarginsPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [showGross, setShowGross]   = useState(false)

  // Schritt 1: Rohstoff-Preis
  const [matPrice, setMatPrice] = useState<MaterialPriceInput>({
    base_price:1000, base_quantity:1000, base_unit:'kg',
    adr_enabled:false, adr_amount:0, adr_per_qty:100, adr_unit:'kg',
    env_enabled:false, env_amount:0, env_type:'per_unit',
    transport_enabled:false, transport_amount:0, transport_freight_kg:1000,
    custom_fees:[], vat_rate:19,
  })
  const [customFeeForm, setCustomFeeForm] = useState({name:'',amount:'',type:'per_unit' as const})
  const matResult = useMemo(() => calcMaterialPrice(matPrice), [matPrice])
  const mp = (k: keyof MaterialPriceInput, v: unknown) => setMatPrice(p => ({...p, [k]: v}))

  // Schritt 2: Rezept-Positionen
  const [recipePositions, setRecipePositions] = useState<Array<{
    id:number; name:string; quantity_kg:number; price_per_kg:number
  }>>([])
  const [recipeForm, setRecipeForm] = useState({name:'',quantity_kg:'',price_per_kg:''})
  const totalRecipeKg    = recipePositions.reduce((s,p) => s+p.quantity_kg, 0)
  const totalRecipeCost  = recipePositions.reduce((s,p) => s+p.quantity_kg*p.price_per_kg, 0)
  const costPerKgRecipe  = totalRecipeKg > 0 ? totalRecipeCost / totalRecipeKg : 0
  const recipePercentages = recipePositions.map(p => ({ ...p, pct: totalRecipeKg > 0 ? (p.quantity_kg/totalRecipeKg)*100 : 0 }))
  const pctSum = recipePercentages.reduce((s,p) => s+p.pct, 0)
  const pctOk  = Math.abs(pctSum - 100) < 0.01 || recipePositions.length === 0

  // Schritt 3: 2K Mischung
  const [use2k, setUse2k]   = useState(false)
  const [twoK, setTwoK]     = useState<TwoKProduct>({ comp_a_cost_per_kg:0, comp_b_cost_per_kg:0, ratio_a:100, ratio_b:50 })
  const twoKResult = useMemo(() => calcTwoKProduct(twoK), [twoK])

  // Schritt 4: Verpackung
  const [pack, setPack] = useState({ fill_kg:1.5, pkg_cost:0, lid_cost:0, label_cost:0, carton_cost:0, overhead_pct:5 })
  const pk = (k: keyof typeof pack, v: number) => setPack(p => ({...p, [k]: v}))

  // Schritt 5: Verkauf
  const [sell, setSell] = useState({ price_net:0, vat:19, platform_pct:0, platform_fix:0, payment_pct:0, payment_fix:0, discount_pct:0 })
  const sk = (k: keyof typeof sell, v: number) => setSell(s => ({...s, [k]: v}))

  // Material-Kosten für Kalkulation
  const materialCostForCalc = use2k ? twoKResult.cost_per_kg_set : costPerKgRecipe || matResult.total_net_per_unit

  // Gesamtkalkulation
  const result = useMemo(() => {
    if (!sell.price_net) return null
    return calcProduct({
      material_cost_per_kg:  materialCostForCalc,
      packaging_cost:        pack.pkg_cost,
      lid_cost:              pack.lid_cost,
      label_cost:            pack.label_cost,
      carton_cost:           pack.carton_cost,
      fill_weight_kg:        pack.fill_kg,
      overhead_pct:          pack.overhead_pct,
      labor_cost_per_unit:   0,
      selling_price_net:     sell.price_net,
      vat_rate:              sell.vat,
      platform_fee_pct:      sell.platform_pct,
      platform_fee_fixed:    sell.platform_fix,
      payment_fee_pct:       sell.payment_pct,
      payment_fee_fixed:     sell.payment_fix,
      discount_pct:          sell.discount_pct,
    })
  }, [materialCostForCalc, pack, sell])

  return (
    <div className="max-w-4xl">
      <div className="page-header">
        <div>
          <h2 className="page-title">Margenkalkulation</h2>
          <p className="page-subtitle">Schritt für Schritt von Rohstoffen bis zum Verkaufsergebnis</p>
        </div>
        <button onClick={() => setShowGross(v=>!v)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${showGross?'bg-emerald-500/20 border-emerald-500/30 text-emerald-400':'bg-white/5 border-white/10 text-slate-400'}`}>
          {showGross ? '✓ Brutto' : 'Brutto anzeigen'}
        </button>
      </div>

      <div className="space-y-3">
        {/* ── SCHRITT 1: Rohstoff-Preis ── */}
        <Step n={1} title="Rohstoff-Preis berechnen" icon={<FlaskConical size={14}/>}
          active={activeStep===0} done={matResult.total_net_per_unit>0 && activeStep>0}
          onClick={() => setActiveStep(activeStep===0?-1:0)}>
          <div className="mt-4 space-y-4">
            {/* Basis */}
            <div>
              <p className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Basiseinkaufspreis</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Preis (€ netto)" type="number" step="0.01"
                  value={matPrice.base_price||''} onChange={e=>mp('base_price',Number(e.target.value))}
                  hint="z.B. 2123.20"/>
                <Input label="Menge" type="number" step="1"
                  value={matPrice.base_quantity||''} onChange={e=>mp('base_quantity',Number(e.target.value))}
                  hint="z.B. 1000"/>
                <Select label="Einheit" value={matPrice.base_unit}
                  onChange={e=>mp('base_unit',e.target.value)}>
                  {['kg','l','g','ml','stk'].map(u=><option key={u} value={u}>{u}</option>)}
                </Select>
              </div>
              {matPrice.base_price>0 && matPrice.base_quantity>0 && (
                <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                  <CheckCircle size={11}/> = <strong>{f4(matResult.base_per_unit)} €</strong> pro 1 {matPrice.base_unit}
                </p>
              )}
            </div>

            {/* ADR */}
            <div className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.02)',border:'1px solid rgb(255 255 255/0.05)'}}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-300">ADR-Zuschlag <span className="text-slate-500 font-normal">(optional – Gefahrgut)</span></p>
                <button onClick={() => mp('adr_enabled', !matPrice.adr_enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${matPrice.adr_enabled?'bg-brand-500':'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${matPrice.adr_enabled?'translate-x-4':'translate-x-0.5'}`}/>
                </button>
              </div>
              {matPrice.adr_enabled && (
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Betrag (€)" type="number" step="0.01"
                    value={matPrice.adr_amount||''} onChange={e=>mp('adr_amount',Number(e.target.value))}
                    hint="z.B. 6.90"/>
                  <Input label={`Pro ___ ${matPrice.base_unit}`} type="number" step="1"
                    value={matPrice.adr_per_qty||''} onChange={e=>mp('adr_per_qty',Number(e.target.value))}
                    hint="z.B. 100"/>
                  <div className="flex items-end">
                    {matPrice.adr_amount>0 && matPrice.adr_per_qty>0 && (
                      <p className="text-xs text-cyan-400 pb-2">
                        = {f4(matResult.adr_per_unit)} € / {matPrice.base_unit}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Umweltabgabe */}
            <div className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.02)',border:'1px solid rgb(255 255 255/0.05)'}}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-300">Umweltabgabe <span className="text-slate-500 font-normal">(optional)</span></p>
                <button onClick={() => mp('env_enabled', !matPrice.env_enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${matPrice.env_enabled?'bg-brand-500':'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${matPrice.env_enabled?'translate-x-4':'translate-x-0.5'}`}/>
                </button>
              </div>
              {matPrice.env_enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Betrag" type="number" step="0.001"
                    value={matPrice.env_amount||''} onChange={e=>mp('env_amount',Number(e.target.value))}/>
                  <Select label="Typ" value={matPrice.env_type} onChange={e=>mp('env_type',e.target.value)}>
                    <option value="per_unit">Pro {matPrice.base_unit}</option>
                    <option value="percent">% auf EK</option>
                  </Select>
                </div>
              )}
            </div>

            {/* Transportkosten */}
            <div className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.02)',border:'1px solid rgb(255 255 255/0.05)'}}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-300">Transportkosten <span className="text-slate-500 font-normal">(optional – wird anteilig aufgeteilt)</span></p>
                <button onClick={() => mp('transport_enabled', !matPrice.transport_enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${matPrice.transport_enabled?'bg-brand-500':'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${matPrice.transport_enabled?'translate-x-4':'translate-x-0.5'}`}/>
                </button>
              </div>
              {matPrice.transport_enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Frachtkosten gesamt (€)" type="number" step="0.01"
                    value={matPrice.transport_amount||''} onChange={e=>mp('transport_amount',Number(e.target.value))}
                    hint="Gesamtkosten der Lieferung"/>
                  <Input label="Gesamtgewicht Fracht (kg)" type="number" step="1"
                    value={matPrice.transport_freight_kg||''} onChange={e=>mp('transport_freight_kg',Number(e.target.value))}
                    hint="z.B. 1000 kg"/>
                </div>
              )}
              {matPrice.transport_enabled && matPrice.transport_amount>0 && matPrice.transport_freight_kg>0 && (
                <p className="text-xs text-cyan-400 mt-1.5">= {f4(matResult.transport_per_unit)} € / {matPrice.base_unit}</p>
              )}
            </div>

            {/* Eigene Gebühren */}
            <div className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.02)',border:'1px solid rgb(255 255 255/0.05)'}}>
              <p className="text-xs font-semibold text-slate-300 mb-2">Weitere Gebühren <span className="text-slate-500 font-normal">(benutzerdefiniert)</span></p>
              {matPrice.custom_fees.map((f,i) => (
                <div key={f.id} className="flex items-center justify-between py-1 text-xs text-slate-400">
                  <span>{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{f.type==='percent'?`${f.amount}%`:`${f.amount} €`}</span>
                    <button onClick={() => mp('custom_fees', matPrice.custom_fees.filter((_,j)=>j!==i))}
                      className="text-red-400 hover:text-red-300"><Trash2 size={11}/></button>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Input label="Bezeichnung" value={customFeeForm.name} onChange={e=>setCustomFeeForm(f=>({...f,name:e.target.value}))} placeholder="z.B. Zoll"/>
                <Input label="Betrag" type="number" step="0.001" value={customFeeForm.amount} onChange={e=>setCustomFeeForm(f=>({...f,amount:e.target.value as unknown as number}))}/>
                <Select label="Typ" value={customFeeForm.type} onChange={e=>setCustomFeeForm(f=>({...f,type:e.target.value as 'per_unit'}))}>
                  <option value="per_unit">Pro {matPrice.base_unit}</option>
                  <option value="percent">%</option>
                  <option value="per_freight">Pro Fracht</option>
                </Select>
              </div>
              <button onClick={() => {
                if (!customFeeForm.name || !customFeeForm.amount) return
                mp('custom_fees', [...matPrice.custom_fees, { id:Date.now().toString(), name:customFeeForm.name, amount:Number(customFeeForm.amount), type:customFeeForm.type }])
                setCustomFeeForm({name:'',amount:'',type:'per_unit'})
              }} className="mt-2 text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <Plus size={11}/> Gebühr hinzufügen
              </button>
            </div>

            {/* Ergebnis */}
            <div className="p-4 rounded-xl" style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.25)'}}>
              <p className="text-xs font-bold text-brand-400 mb-3">Aufstellung pro 1 {matPrice.base_unit}</p>
              {matResult.breakdown.map((b,i) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-500">{b.label}</span>
                  <span className="text-slate-300 font-mono">{f4(b.per_unit)} €</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-white/10">
                <span className="text-slate-200">Gesamt netto / 1 {matPrice.base_unit}</span>
                <span className="text-white text-base">{fEur(matResult.total_net_per_unit)}</span>
              </div>
              {showGross && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-500">inkl. {matPrice.vat_rate}% MwSt.</span>
                  <span className="text-emerald-400 font-mono font-semibold">{fEur(matResult.total_gross_per_unit)}</span>
                </div>
              )}
            </div>

            <button onClick={() => setActiveStep(1)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-colors hover:bg-brand-500/30"
              style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
              Weiter zu Rezeptur →
            </button>
          </div>
        </Step>

        {/* ── SCHRITT 2: Rezeptur ── */}
        <Step n={2} title="Rezeptur / Zusammensetzung" icon={<FlaskConical size={14}/>}
          active={activeStep===1} done={recipePositions.length>0 && activeStep>1}
          onClick={() => setActiveStep(activeStep===1?-1:1)}>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={12} className={pctOk?'text-emerald-400':'text-amber-400'}/>
              <span className={`text-xs ${pctOk?'text-emerald-400':'text-amber-400'}`}>
                {recipePositions.length === 0
                  ? 'Füge Rohstoffe hinzu. Die Summe muss 100% ergeben.'
                  : pctOk
                    ? `✓ Summe: ${f2(pctSum)}% = 100% ✓`
                    : `Summe: ${f2(pctSum)}% – Abweichung von 100%!`}
              </span>
            </div>

            {/* Positionen */}
            {recipePositions.length > 0 && (
              <table className="w-full text-xs">
                <thead><tr style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}>
                  <th className="table-th text-left py-1.5">Rohstoff</th>
                  <th className="table-th text-right">Menge (kg)</th>
                  <th className="table-th text-right">Anteil %</th>
                  <th className="table-th text-right">Preis/kg</th>
                  <th className="table-th text-right">Kosten</th>
                  <th className="table-th w-6"/>
                </tr></thead>
                <tbody>
                  {recipePercentages.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid rgb(255 255 255/0.03)'}}>
                      <td className="py-2 text-slate-300">{p.name}</td>
                      <td className="text-right font-mono text-slate-300">{p.quantity_kg}</td>
                      <td className="text-right">
                        <span className={`font-mono ${Math.abs(p.pct - 100/recipePositions.length) < 5?'text-slate-400':'text-slate-400'}`}>
                          {f2(p.pct)}%
                        </span>
                      </td>
                      <td className="text-right font-mono text-slate-400">{fEur(p.price_per_kg)}</td>
                      <td className="text-right font-mono font-semibold text-slate-200">{fEur(p.quantity_kg * p.price_per_kg)}</td>
                      <td className="text-center">
                        <button onClick={() => setRecipePositions(ps => ps.filter(x=>x.id!==p.id))}
                          className="text-red-400 hover:text-red-300"><Trash2 size={11}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{borderTop:'1px solid rgb(255 255 255/0.08)'}}>
                  <td className="py-2 font-bold text-slate-200 text-xs">Gesamt</td>
                  <td className="text-right font-mono font-bold text-white">{f2(totalRecipeKg)} kg</td>
                  <td className="text-right font-mono font-bold text-white">{f2(pctSum)}%</td>
                  <td/>
                  <td className="text-right font-mono font-bold text-white">{fEur(totalRecipeCost)}</td>
                  <td/>
                </tr></tfoot>
              </table>
            )}

            {/* Neue Position */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl" style={{background:'rgb(139 92 246/0.05)',border:'1px solid rgb(139 92 246/0.15)'}}>
              <Input label="Rohstoff-Name" value={recipeForm.name}
                onChange={e => setRecipeForm(f=>({...f,name:e.target.value}))} placeholder="z.B. Benzylalkohol"/>
              <Input label="Menge (kg)" type="number" step="0.001"
                value={recipeForm.quantity_kg} onChange={e => setRecipeForm(f=>({...f,quantity_kg:e.target.value as unknown as number}))}
                hint={totalRecipeKg > 0 ? `= ${f2(Number(recipeForm.quantity_kg)/(totalRecipeKg+Number(recipeForm.quantity_kg||0))*100||0)}%` : ''}/>
              <Input label="Preis / kg (€)" type="number" step="0.0001"
                value={recipeForm.price_per_kg}
                onChange={e => setRecipeForm(f=>({...f,price_per_kg:e.target.value as unknown as number}))}
                hint={matResult.total_net_per_unit > 0 ? `Rohstoff-DB: ${fEur(matResult.total_net_per_unit)}` : ''}/>
            </div>
            <button onClick={() => {
              if (!recipeForm.name || !recipeForm.quantity_kg) return
              setRecipePositions(ps => [...ps, { id:Date.now(), name:recipeForm.name, quantity_kg:Number(recipeForm.quantity_kg), price_per_kg:Number(recipeForm.price_per_kg) }])
              setRecipeForm({name:'',quantity_kg:'',price_per_kg:''})
            }} className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300">
              <Plus size={12}/> Position hinzufügen
            </button>

            {totalRecipeKg > 0 && (
              <div className="p-3 rounded-xl flex justify-between items-center"
                style={{background:'rgb(16 185 129/0.08)',border:'1px solid rgb(16 185 129/0.2)'}}>
                <div>
                  <p className="text-xs text-slate-400">Rohstoffkosten pro kg</p>
                  <p className="text-xl font-black text-white">{fEur(costPerKgRecipe)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">{f2(totalRecipeKg)} kg Batch</p>
                  <p className="text-sm font-bold text-emerald-400">{fEur(totalRecipeCost)} gesamt</p>
                </div>
              </div>
            )}

            <button onClick={() => setActiveStep(2)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white"
              style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
              Weiter zu 2K-Mischung / Verpackung →
            </button>
          </div>
        </Step>

        {/* ── SCHRITT 3: 2K Mischung ── */}
        <Step n={3} title="2K-Produkt Mischungsverhältnis" icon={<Calculator size={14}/>}
          active={activeStep===2} done={activeStep>2}
          onClick={() => setActiveStep(activeStep===2?-1:2)}>
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{background:use2k?'rgb(139 92 246/0.08)':'rgb(255 255 255/0.02)',border:'1px solid rgb(255 255 255/0.06)'}}>
              <div>
                <p className="text-sm font-semibold text-slate-200">2K-Produkt (Zwei-Komponenten)</p>
                <p className="text-xs text-slate-500">z.B. EpoxyPlast 100P: Komponente (A) + Komponente (B)</p>
              </div>
              <button onClick={() => setUse2k(v=>!v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${use2k?'bg-brand-500':'bg-slate-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${use2k?'translate-x-5':'translate-x-0.5'}`}/>
              </button>
            </div>

            {use2k && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.2)'}}>
                    <p className="text-xs font-bold text-brand-400 mb-2">Komponente (A) – Epoxidharz</p>
                    <Input label="Preis / kg (€)" type="number" step="0.001"
                      value={twoK.comp_a_cost_per_kg||''}
                      onChange={e=>setTwoK(k=>({...k,comp_a_cost_per_kg:Number(e.target.value)}))}
                      hint={costPerKgRecipe>0?`Aus Rezept: ${fEur(costPerKgRecipe)}`:''}/>
                    {costPerKgRecipe > 0 && (
                      <button onClick={()=>setTwoK(k=>({...k,comp_a_cost_per_kg:costPerKgRecipe}))}
                        className="mt-1 text-xs text-brand-400 hover:text-brand-300">
                        ← Aus Rezept übernehmen
                      </button>
                    )}
                  </div>
                  <div className="p-3 rounded-xl" style={{background:'rgb(6 182 212/0.08)',border:'1px solid rgb(6 182 212/0.2)'}}>
                    <p className="text-xs font-bold text-cyan-400 mb-2">Komponente (B) – Härter</p>
                    <Input label="Preis / kg (€)" type="number" step="0.001"
                      value={twoK.comp_b_cost_per_kg||''}
                      onChange={e=>setTwoK(k=>({...k,comp_b_cost_per_kg:Number(e.target.value)}))}/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Anteil A" type="number" step="1"
                    value={twoK.ratio_a} onChange={e=>setTwoK(k=>({...k,ratio_a:Number(e.target.value)}))}
                    hint="z.B. 100"/>
                  <Input label="Anteil B" type="number" step="1"
                    value={twoK.ratio_b} onChange={e=>setTwoK(k=>({...k,ratio_b:Number(e.target.value)}))}
                    hint="z.B. 50"/>
                </div>
                {twoK.comp_a_cost_per_kg > 0 && (
                  <div className="p-3 rounded-xl" style={{background:'rgb(16 185 129/0.08)',border:'1px solid rgb(16 185 129/0.2)'}}>
                    <p className="text-xs text-slate-400 mb-1">Mischungsverhältnis: <strong className="text-white">{twoKResult.ratio_label}</strong></p>
                    <div className="flex gap-6 text-xs">
                      <span className="text-slate-500">A-Anteil: <strong className="text-brand-400">{fPct(twoKResult.share_a*100)}</strong></span>
                      <span className="text-slate-500">B-Anteil: <strong className="text-cyan-400">{fPct(twoKResult.share_b*100)}</strong></span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-sm text-slate-400">Preis / kg Set</span>
                      <span className="text-lg font-black text-white">{fEur(twoKResult.cost_per_kg_set)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setActiveStep(3)}
              className="w-full py-2 rounded-xl text-xs font-semibold text-white"
              style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
              Weiter zu Verpackung →
            </button>
          </div>
        </Step>

        {/* ── SCHRITT 4: Verpackung ── */}
        <Step n={4} title="Verpackung, Etiketten & Kartonagen" icon={<Package size={14}/>}
          active={activeStep===3} done={activeStep>3}
          onClick={() => setActiveStep(activeStep===3?-1:3)}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Input label="Füllmenge (kg)" type="number" step="0.001"
              value={pack.fill_kg} onChange={e=>pk('fill_kg',Number(e.target.value))} hint="z.B. 1.5 kg"/>
            <Input label="Overhead %" type="number" step="0.1"
              value={pack.overhead_pct} onChange={e=>pk('overhead_pct',Number(e.target.value))} hint="Gemeinkosten"/>
            <Input label="Behältnis (€)" type="number" step="0.0001"
              value={pack.pkg_cost||''} onChange={e=>pk('pkg_cost',Number(e.target.value))} hint="Flasche / Kanister"/>
            <Input label="Deckel (€)" type="number" step="0.0001"
              value={pack.lid_cost||''} onChange={e=>pk('lid_cost',Number(e.target.value))}/>
            <Input label="Etikett (€/Stk)" type="number" step="0.0001"
              value={pack.label_cost||''} onChange={e=>pk('label_cost',Number(e.target.value))} hint="Preis/1000 ÷ 1000"/>
            <Input label="Karton-Anteil (€)" type="number" step="0.0001"
              value={pack.carton_cost||''} onChange={e=>pk('carton_cost',Number(e.target.value))} hint="Kartonpreis ÷ Stk/Karton"/>
            <div className="col-span-2 flex justify-between text-xs p-2 rounded-lg"
              style={{background:'rgb(255 255 255/0.03)'}}>
              <span className="text-slate-500">Verpackungskosten gesamt</span>
              <span className="text-white font-mono font-semibold">{fEur(pack.pkg_cost+pack.lid_cost+pack.label_cost+pack.carton_cost)}</span>
            </div>
          </div>
          <button onClick={() => setActiveStep(4)}
            className="w-full mt-3 py-2 rounded-xl text-xs font-semibold text-white"
            style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
            Weiter zu Verkauf →
          </button>
        </Step>

        {/* ── SCHRITT 5: Verkauf ── */}
        <Step n={5} title="Verkaufspreis & Gebühren" icon={<Store size={14}/>}
          active={activeStep===4} done={!!result}
          onClick={() => setActiveStep(activeStep===4?-1:4)}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Input label="VK netto (€) *" type="number" step="0.01"
              value={sell.price_net||''} onChange={e=>sk('price_net',Number(e.target.value))}/>
            <Select label="MwSt." value={sell.vat} onChange={e=>sk('vat',Number(e.target.value))}>
              {[0,7,19].map(r=><option key={r} value={r}>{r}%</option>)}
            </Select>
            <Input label="Plattform-Gebühr %" type="number" step="0.01"
              value={sell.platform_pct||''} onChange={e=>sk('platform_pct',Number(e.target.value))} hint="z.B. Amazon 8.0%"/>
            <Input label="Plattform fix (€)" type="number" step="0.01"
              value={sell.platform_fix||''} onChange={e=>sk('platform_fix',Number(e.target.value))}/>
            <Input label="Zahlung % (z.B. PayPal)" type="number" step="0.01"
              value={sell.payment_pct||''} onChange={e=>sk('payment_pct',Number(e.target.value))} hint="z.B. 1.49%"/>
            <Input label="Zahlung fix (€)" type="number" step="0.01"
              value={sell.payment_fix||''} onChange={e=>sk('payment_fix',Number(e.target.value))} hint="z.B. PayPal 0.35€"/>
            <Input label="Rabatt %" type="number" step="0.1"
              value={sell.discount_pct||''} onChange={e=>sk('discount_pct',Number(e.target.value))}/>
          </div>
        </Step>

        {/* ── ERGEBNIS ── */}
        {result && (
          <div className="glass-card p-5" style={{border:`1px solid ${result.is_profitable?'rgb(16 185 129/0.3)':'rgb(239 68 68/0.3)'}`,boxShadow:`0 0 20px ${result.is_profitable?'rgb(16 185 129/0.1)':'rgb(239 68 68/0.1)'}`}}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className={result.is_profitable?'text-emerald-400':'text-red-400'}/>
              <h3 className="text-sm font-bold text-white">Kalkulationsergebnis</h3>
              {!result.is_profitable && <span className="badge-red text-xs flex items-center gap-1"><AlertCircle size={10}/>Negative Marge!</span>}
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Kosten</p>
                <ResultRow label="Rohstoffkosten" value={fEur(result.material_cost)} indent={1}/>
                <ResultRow label="Verpackung" value={fEur(result.packaging_total)} indent={1}/>
                <ResultRow label="Gemeinkosten" value={fEur(result.overhead_cost)} indent={1}/>
                <ResultRow label="Selbstkosten (COGS)" value={fEur(result.cogs)} bold color="text-red-400"/>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Erlös</p>
                <ResultRow label="VK netto" value={fEur(result.selling_net)}/>
                {showGross && <ResultRow label="VK brutto" value={fEur(result.selling_gross)} color="text-emerald-400"/>}
                {result.discount_amount > 0 && <ResultRow label="Rabatt" value={`-${fEur(result.discount_amount)}`} color="text-amber-400" indent={1}/>}
                {result.platform_fee > 0 && <ResultRow label="Plattformgebühr" value={`-${fEur(result.platform_fee)}`} indent={1}/>}
                {result.payment_fee > 0 && <ResultRow label="Zahlungsgebühr" value={`-${fEur(result.payment_fee)}`} indent={1}/>}
                <ResultRow label="Netto-Erlös" value={fEur(result.net_after_fees)} bold/>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-xl" style={{background:'rgb(255 255 255/0.04)'}}>
                <p className="text-xs text-slate-500 mb-1">Gewinn / Stück</p>
                <p className={`text-xl font-black ${result.is_profitable?'text-emerald-400':'text-red-400'}`}>{fEur(result.gross_margin)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{background:'rgb(255 255 255/0.04)'}}>
                <p className="text-xs text-slate-500 mb-1">Marge</p>
                <p className={`text-xl font-black ${result.gross_margin_pct>=30?'text-emerald-400':result.gross_margin_pct>=10?'text-amber-400':'text-red-400'}`}>{fPct(result.gross_margin_pct)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{background:'rgb(255 255 255/0.04)'}}>
                <p className="text-xs text-slate-500 mb-1">Deckungsbeitrag</p>
                <p className="text-xl font-black text-brand-400">{fEur(result.contribution)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
