import { useState, useMemo } from 'react'
import { useQuery }   from '@tanstack/react-query'
import {
  Calculator, TrendingUp, Package, ShoppingCart,
  Layers, Plus, Minus,
} from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Card, Spinner } from '@/components/ui/Badge'

const fmt = (v: number, cur='EUR') =>
  new Intl.NumberFormat('de-DE',{style:'currency',currency:cur,minimumFractionDigits:2}).format(v)
const fmtN = (v: number, dec=0) =>
  new Intl.NumberFormat('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v)

interface ProductVariant { id:number; name:string; code:string; fill_quantity:number; fill_unit:string; product_id:number }
interface VariantCost {
  total_cost:number; material_cost:number; packaging_cost:number;
  label_cost:number; carton_cost:number; price_per_kg:number
}

type ScenarioMode = 'target_price' | 'target_margin' | 'target_quantity'

export default function ScenarioCalculatorPage() {
  // Inputs
  const [mode, setMode]             = useState<ScenarioMode>('target_margin')
  const [variantId, setVariantId]   = useState<number|null>(null)
  const [manualCost, setManualCost] = useState(0)
  const [useVariant, setUseVariant] = useState(false)

  const [sellQty,     setSellQty]     = useState(100)     // Stück pro Monat
  const [sellingPrice,setSellingPrice]= useState(0)       // € Netto-VK
  const [targetMargin,setTargetMargin]= useState(35)      // %
  const [vatPct,      setVatPct]      = useState(19)      // %
  const [platformPct, setPlatformPct] = useState(0)       // %
  const [shippingPer, setShippingPer] = useState(0)       // € per Stück
  const [periodMonths,setPeriodMonths]= useState(1)       // Betrachtungszeitraum

  const {data:variants=[]} = useQuery<ProductVariant[]>({
    queryKey:['product-variants-all'],
    queryFn: ()=>window.api.products.list() as unknown as ProductVariant[],
  })
  const {data:variantCost} = useQuery<VariantCost>({
    queryKey:['variant-cost',variantId],
    queryFn: ()=>variantId ? window.api.products.calcVariantCost(variantId) as Promise<VariantCost> : null,
    enabled: !!variantId,
  })

  const ek = useVariant && variantCost ? variantCost.total_cost : manualCost

  // Berechnungen
  const calc = useMemo(() => {
    if (!ek || ek <= 0) return null

    let vk = sellingPrice
    let margin = targetMargin

    if (mode === 'target_margin') {
      // VK aus Marge berechnen
      vk = ek / (1 - targetMargin / 100)
    } else if (mode === 'target_price') {
      // Marge aus VK berechnen
      margin = vk > 0 ? ((vk - ek) / vk) * 100 : 0
    } else {
      // Menge ist fix, beide eingeben
      margin = vk > 0 ? ((vk - ek) / vk) * 100 : 0
    }

    const vkBrutto  = vk * (1 + vatPct / 100)
    const platformFee = vk * (platformPct / 100)
    const netRevenue  = vk - platformFee - shippingPer
    const profitPer   = netRevenue - ek
    const profitPct   = netRevenue > 0 ? (profitPer / netRevenue) * 100 : 0

    // Periode
    const totalQty      = sellQty * periodMonths
    const totalRevenue  = netRevenue  * totalQty
    const totalCost     = ek         * totalQty
    const totalProfit   = profitPer  * totalQty
    const totalVat      = (vkBrutto - vk) * totalQty
    const totalPlatform = platformFee * totalQty
    const totalShipping = shippingPer * totalQty
    const breakEven     = ek > 0 ? Math.ceil(ek / profitPer) : 0

    return {
      vk, vkBrutto, ek, margin, profitPer, profitPct,
      platformFee, netRevenue,
      totalQty, totalRevenue, totalCost, totalProfit,
      totalVat, totalPlatform, totalShipping,
      breakEven: profitPer > 0 ? breakEven : null,
    }
  }, [ek, mode, sellingPrice, targetMargin, vatPct, platformPct, shippingPer, sellQty, periodMonths])

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h2 className="page-title">Szenarienrechner</h2>
          <p className="page-subtitle">Gewinn, Kosten & Einkaufsmenge kalkulieren</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Eingaben ────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Modus */}
          <Card>
            <h3 className="text-sm font-bold text-slate-200 mb-3">Berechnungsmodus</h3>
            <div className="flex rounded-xl overflow-hidden" style={{border:'1px solid rgb(255 255 255/0.08)'}}>
              {([
                {value:'target_margin', label:'Ziel-Marge → VK', icon:<TrendingUp size={13}/>},
                {value:'target_price',  label:'Preis → Marge',   icon:<Calculator size={13}/>},
                {value:'target_quantity',label:'Menge × Preis',  icon:<ShoppingCart size={13}/>},
              ] as const).map(m=>(
                <button key={m.value} onClick={()=>setMode(m.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors ${mode===m.value?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Einkaufspreis */}
          <Card>
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Package size={14} className="text-cyan-400"/> Einkaufspreis (EK)
            </h3>
            <div className="flex gap-2 mb-3">
              <button onClick={()=>setUseVariant(false)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${!useVariant?'bg-brand-500/20 text-white border border-brand-500/30':'text-slate-500 hover:text-slate-300 border border-white/5'}`}>
                Manuell eingeben
              </button>
              <button onClick={()=>setUseVariant(true)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${useVariant?'bg-brand-500/20 text-white border border-brand-500/30':'text-slate-500 hover:text-slate-300 border border-white/5'}`}>
                Aus Produktvariante
              </button>
            </div>
            {!useVariant ? (
              <Input label="EK netto (€)" type="number" step="0.01" value={manualCost||''}
                onChange={e=>setManualCost(Number(e.target.value))}
                placeholder="z.B. 4.50"/>
            ) : (
              <div>
                <Select label="Produktvariante" value={variantId??''}
                  onChange={e=>setVariantId(Number(e.target.value)||null)}>
                  <option value="">– wählen –</option>
                  {variants.map((v:ProductVariant)=>(
                    <option key={v.id} value={v.id}>{v.name} ({v.fill_quantity} {v.fill_unit})</option>
                  ))}
                </Select>
                {variantCost && (
                  <div className="mt-2 p-2 rounded-lg text-xs space-y-1"
                    style={{background:'rgb(255 255 255/0.03)'}}>
                    <div className="flex justify-between"><span className="text-slate-500">Rohstoff</span><span className="text-slate-300">{fmt(variantCost.material_cost)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Verpackung</span><span className="text-slate-300">{fmt(variantCost.packaging_cost)}</span></div>
                    <div className="flex justify-between font-semibold pt-1 border-t border-white/5">
                      <span className="text-slate-300">Gesamt EK</span>
                      <span className="text-white">{fmt(variantCost.total_cost)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Verkaufsparameter */}
          <Card>
            <h3 className="text-sm font-bold text-slate-200 mb-3">Verkaufsparameter</h3>
            <div className="grid grid-cols-2 gap-3">
              {(mode==='target_price'||mode==='target_quantity') && (
                <Input label="Netto-VK (€)" type="number" step="0.01"
                  value={sellingPrice||''}
                  onChange={e=>setSellingPrice(Number(e.target.value))}/>
              )}
              {(mode==='target_margin') && (
                <Input label="Ziel-Marge (%)" type="number" step="0.5"
                  value={targetMargin}
                  onChange={e=>setTargetMargin(Number(e.target.value))}/>
              )}
              <Input label="MwSt. (%)" type="number" step="1"
                value={vatPct}
                onChange={e=>setVatPct(Number(e.target.value))}/>
              <Input label="Plattform-Gebühr (%)" type="number" step="0.1"
                value={platformPct}
                onChange={e=>setPlatformPct(Number(e.target.value))}
                placeholder="0"/>
              <Input label="Versand (€/Stück)" type="number" step="0.01"
                value={shippingPer||''}
                onChange={e=>setShippingPer(Number(e.target.value))}
                placeholder="0.00"/>
            </div>
          </Card>

          {/* Mengenschätzung */}
          <Card>
            <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Layers size={14} className="text-amber-400"/> Mengenschätzung
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Stück / Monat" type="number" step="1" min="1"
                value={sellQty}
                onChange={e=>setSellQty(Math.max(1,Number(e.target.value)))}/>
              <Select label="Zeitraum" value={periodMonths}
                onChange={e=>setPeriodMonths(Number(e.target.value))}>
                <option value={1}>1 Monat</option>
                <option value={3}>3 Monate</option>
                <option value={6}>6 Monate</option>
                <option value={12}>12 Monate</option>
              </Select>
            </div>
          </Card>
        </div>

        {/* ── Ergebnisse ──────────────────────────────────── */}
        <div className="space-y-4">
          {!calc || !ek ? (
            <Card>
              <div className="flex flex-col items-center py-12 text-center">
                <Calculator size={40} className="text-slate-700 mb-3"/>
                <p className="text-slate-500 text-sm">Einkaufspreis eingeben um Berechnungen zu starten</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Hauptkennzahlen */}
              <Card>
                <h3 className="text-sm font-bold text-slate-200 mb-4">Ergebnis pro Stück</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {label:'EK (netto)',     val:fmt(calc.ek),         color:'#ef4444'},
                    {label:'VK (netto)',     val:fmt(calc.vk),         color:'#8b5cf6'},
                    {label:'VK (brutto)',    val:fmt(calc.vkBrutto),   color:'#a78bfa'},
                    {label:'Gewinn/Stück',   val:fmt(calc.profitPer),  color: calc.profitPer>=0?'#10b981':'#ef4444'},
                  ].map(k=>(
                    <div key={k.label} className="p-3 rounded-xl"
                      style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
                      <p className="text-xs text-slate-500">{k.label}</p>
                      <p className="text-xl font-bold mt-1" style={{color:k.color}}>{k.val}</p>
                    </div>
                  ))}
                </div>
                {/* Marge-Anzeige */}
                <div className="mt-4 p-3 rounded-xl"
                  style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Marge</span>
                    <span className={`font-bold text-sm ${calc.margin>=30?'text-emerald-400':calc.margin>=15?'text-amber-400':'text-red-400'}`}>
                      {calc.margin.toFixed(1)} %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width:`${Math.min(Math.max(calc.margin,0),100)}%`,
                        background:calc.margin>=30?'#10b981':calc.margin>=15?'#f59e0b':'#ef4444',
                      }}/>
                  </div>
                </div>
                {calc.platformFee > 0 && (
                  <p className="text-xs text-slate-500 mt-2">
                    Plattform-Gebühr: {fmt(calc.platformFee)} · Nach Gebühren: {fmt(calc.netRevenue)}
                  </p>
                )}
              </Card>

              {/* Perioden-Ergebnis */}
              <Card>
                <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <ShoppingCart size={14} className="text-brand-400"/>
                  {fmtN(calc.totalQty)} Stück über {periodMonths} Monat{periodMonths>1?'e':''}
                </h3>
                <div className="space-y-2">
                  {[
                    {label:'Gesamtumsatz (netto)',    val:fmt(calc.totalRevenue), color:'#8b5cf6'},
                    {label:'Gesamtkosten (EK)',       val:fmt(calc.totalCost),    color:'#ef4444'},
                    {label:'MwSt. gesamt',            val:fmt(calc.totalVat),     color:'#64748b'},
                    ...(calc.totalPlatform>0?[{label:'Plattform-Gebühren',val:fmt(calc.totalPlatform),color:'#f59e0b'}]:[]),
                    ...(calc.totalShipping>0?[{label:'Versandkosten',      val:fmt(calc.totalShipping),color:'#06b6d4'}]:[]),
                    {label:'Gewinn gesamt',           val:fmt(calc.totalProfit),  color:calc.totalProfit>=0?'#10b981':'#ef4444'},
                  ].map(k=>(
                    <div key={k.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                      style={{background:'rgb(255 255 255/0.02)'}}>
                      <span className="text-xs text-slate-400">{k.label}</span>
                      <span className="text-sm font-mono font-semibold" style={{color:k.color}}>{k.val}</span>
                    </div>
                  ))}
                </div>

                {/* Einkaufsmenge */}
                <div className="mt-4 p-3 rounded-xl"
                  style={{background:'rgb(6 182 212/0.08)',border:'1px solid rgb(6 182 212/0.2)'}}>
                  <p className="text-xs font-semibold text-cyan-400 mb-1">Benötigte Einkaufsmenge</p>
                  <p className="text-xl font-bold text-white">{fmtN(calc.totalQty)} Einheiten</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {fmtN(sellQty)} / Monat × {periodMonths} Monate
                  </p>
                </div>

                {/* Break-Even */}
                {calc.breakEven != null && (
                  <div className="mt-3 p-3 rounded-xl"
                    style={{background:'rgb(139 92 246/0.08)',border:'1px solid rgb(139 92 246/0.2)'}}>
                    <p className="text-xs font-semibold text-brand-400 mb-0.5">Break-Even</p>
                    <p className="text-lg font-bold text-white">{fmtN(calc.breakEven)} Stück</p>
                    <p className="text-xs text-slate-500">
                      Ab diesem Stückpreis wird Gewinn erzielt
                    </p>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
