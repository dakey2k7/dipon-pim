/**
 * DIPON Margenkalkulation – vollständiger Entwurf v2
 * Ablauf: Produkt (2K) → Variante → Gebinde → Versand → Plattform → Ergebnis
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calculator, Package, Truck, Euro, ChevronDown, ChevronUp,
  FlaskConical, AlertTriangle, CheckCircle, ArrowRight,
  TrendingUp, ShoppingCart, Globe, Layers,
} from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { COUNTRIES_SORTED as COUNTRIES } from '@/lib/countries'

// ── Formatierung ───────────────────────────────────────────────
const f2 = (v: number) => v.toFixed(2).replace('.', ',')
const f4 = (v: number) => v.toFixed(4).replace('.', ',')
const fEur = (v: number) => `${f2(v)} €`
const fPct = (v: number) => `${f2(v)} %`

// ── Schritt-Komponente ─────────────────────────────────────────
function Step({n,title,icon,done,active,children,onClick}: {
  n:number; title:string; icon:React.ReactNode
  done:boolean; active:boolean
  children:React.ReactNode; onClick:()=>void
}) {
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{border: active ? '1px solid rgb(139 92 246/0.4)' : done ? '1px solid rgb(16 185 129/0.3)' : '1px solid rgba(255,255,255,0.06)',
        background: active ? 'rgb(139 92 246/0.05)' : 'rgba(255,255,255,0.02)'}}>
      <button className="w-full flex items-center gap-3 px-5 py-4 text-left" onClick={onClick}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
          style={{background: active?'rgb(139 92 246/0.3)':done?'rgb(16 185 129/0.2)':'rgba(255,255,255,0.05)',
            color: active?'#a78bfa':done?'#10b981':'#64748b'}}>
          {done ? <CheckCircle size={14}/> : n}
        </div>
        <span style={{color:active?'#a78bfa':done?'#10b981':'#64748b'}}>{icon}</span>
        <span className={`text-sm font-semibold ${active?'text-white':done?'text-slate-300':'text-slate-500'}`}>{title}</span>
        <div className="ml-auto">{active ? <ChevronUp size={14} className="text-slate-500"/> : <ChevronDown size={14} className="text-slate-600"/>}</div>
      </button>
      {active && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

// ── Kosten-Zeile ───────────────────────────────────────────────
function CostRow({label, value, sub, color, bold}: {label:string;value:number;sub?:string;color?:string;bold?:boolean}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${bold?'border-t border-white/10 mt-1 pt-2':''}`}>
      <div>
        <span className={`text-xs ${bold?'text-slate-200 font-bold':'text-slate-400'}`}>{label}</span>
        {sub && <span className="text-[10px] text-slate-600 ml-2">{sub}</span>}
      </div>
      <span className={`text-sm font-mono ${bold?'font-black text-white':'font-semibold'}`}
        style={{color: color || (bold?'white':'#94a3b8')}}>
        {fEur(value)}
      </span>
    </div>
  )
}

// ── Hauptseite ────────────────────────────────────────────────
export default function MarginsPage() {
  const [step, setStep] = useState(0)

  // Schritt 1: Produkt
  const [productId,  setProductId]  = useState<number|null>(null)
  const [variantId,  setVariantId]  = useState<number|null>(null)

  // Schritt 2: Rezeptur-Preise
  const [compAPriceKg, setCompAPriceKg] = useState<number>(0)
  const [compBPriceKg, setCompBPriceKg] = useState<number>(0)

  // Schritt 3: Gebinde
  const [packAId,  setPackAId]  = useState<number|null>(null)
  const [packBId,  setPackBId]  = useState<number|null>(null)
  const [lidAId,   setLidAId]   = useState<number|null>(null)
  const [lidBId,   setLidBId]   = useState<number|null>(null)
  const [labelAId, setLabelAId] = useState<number|null>(null)
  const [cartonId, setCartonId] = useState<number|null>(null)
  const [unitsPerCarton, setUnitsPerCarton] = useState(1)

  // Schritt 4: Versand
  const [country,      setCountry]      = useState('DE')
  const [weightKg,     setWeightKg]     = useState<number>(0)
  const [shippingCost, setShippingCost] = useState<number>(0)

  // Schritt 5: Plattform & Marge
  const [platformFeeP, setPlatformFeeP] = useState<number>(0)
  const [platformFeeF, setPlatformFeeF] = useState<number>(0)
  const [paymentFeeP,  setPaymentFeeP]  = useState<number>(0)
  const [vatRate,      setVatRate]      = useState<number>(19)
  const [targetMargin, setTargetMargin] = useState<number>(30)
  const [customPrice,  setCustomPrice]  = useState<number>(0)
  const [useCustomPrice, setUseCustomPrice] = useState(false)

  // ── Queries ────────────────────────────────────────────────
  const {data: products2k=[]} = useQuery<any[]>({
    queryKey:['products2k'],
    queryFn: async () => { try { return await window.api.products.list() ?? [] } catch { return [] } },
    staleTime: 30_000,
  })
  const {data: products=[]} = useQuery<any[]>({
    queryKey:['products'],
    queryFn: () => window.api.products.list(),
    staleTime: 30_000,
  })
  const {data: packaging=[]} = useQuery<any[]>({
    queryKey:['packaging'],
    queryFn: () => window.api.packaging.list(),
    staleTime: 30_000,
  })
  const {data: lids=[]} = useQuery<any[]>({
    queryKey:['lids'],
    queryFn: async () => {
      try { return await window.api.lids?.list?.() ?? [] } catch { return [] }
    },
    staleTime: 30_000,
  })
  const {data: labels=[]} = useQuery<any[]>({
    queryKey:['labels'],
    queryFn: async () => { try { return await window.api.labels.list() ?? [] } catch { return [] } },
    staleTime: 30_000,
  })
  const {data: cartons=[]} = useQuery<any[]>({
    queryKey:['cartons'],
    queryFn: async () => { try { return await window.api.cartons.list() ?? [] } catch { return [] } },
    staleTime: 30_000,
  })
  const {data: platforms=[]} = useQuery<any[]>({
    queryKey:['platforms'],
    queryFn: async () => { return [] },
    staleTime: 30_000,
  })

  // ── Ausgewähltes Produkt ───────────────────────────────────
  const selectedProduct = useMemo(()=>
    (products2k as any[]).find((p:any)=>p.id===productId) ??
    (products as any[]).find((p:any)=>p.id===productId) ?? null
  ,[products2k, products, productId])

  const selectedVariant = useMemo(()=>
    selectedProduct?.variants?.find((v:any)=>v.id===variantId) ?? null
  ,[selectedProduct, variantId])

  // ── Mischungsverhältnis ────────────────────────────────────
  const mixA = selectedProduct?.mix_ratio_a ?? 100
  const mixB = selectedProduct?.mix_ratio_b ?? 50
  const mixTotal = mixA + mixB
  const ratioA = mixA / mixTotal  // z.B. 0.667 bei 2:1
  const ratioB = mixB / mixTotal  // z.B. 0.333 bei 2:1

  const totalKg     = selectedVariant?.total_fill_kg ?? selectedVariant?.fill_quantity ?? 0
  const kgA         = totalKg * ratioA
  const kgB         = totalKg * ratioB

  // ── Kosten berechnen ──────────────────────────────────────
  const costA       = kgA * compAPriceKg
  const costB       = kgB * compBPriceKg
  const costFilling = costA + costB

  const packA  = (packaging as any[]).find((p:any)=>p.id===packAId)
  const packB  = (packaging as any[]).find((p:any)=>p.id===packBId)
  const lidA   = (lids     as any[]).find((l:any)=>l.id===lidAId)
  const lidB   = (lids     as any[]).find((l:any)=>l.id===lidBId)
  const labelA = (labels   as any[]).find((l:any)=>l.id===labelAId)
  const carton = (cartons  as any[]).find((c:any)=>c.id===cartonId)

  const costPackA   = (packA?.price_per_unit ?? 0)
  const costPackB   = (packB?.price_per_unit ?? 0)
  const costLidA    = (lidA?.price_per_unit ?? 0)
  const costLidB    = (lidB?.price_per_unit ?? 0)
  const costLabel   = (labelA?.price_per_unit ?? labelA?.price_per_1000 ? (labelA.price_per_1000/1000) : 0)
  const costCarton  = cartonId && unitsPerCarton > 0 ? (carton?.price_per_unit ?? 0) / unitsPerCarton : 0

  const costPackaging = costPackA + costPackB + costLidA + costLidB + costLabel + costCarton
  const costSelf      = costFilling + costPackaging

  // ── Bruttogewicht für Versand ──────────────────────────────
  const taraA = (packA?.tare_weight_g ?? packA?.weight_g ?? 0) / 1000
  const taraB = (packB?.tare_weight_g ?? packB?.weight_g ?? 0) / 1000
  const lidAW = (lidA?.weight_g ?? 0) / 1000
  const lidBW = (lidB?.weight_g ?? 0) / 1000
  const cartonW = cartonId ? (carton?.weight_g ?? 0) / 1000 / Math.max(unitsPerCarton,1) : 0
  const bruttoKg = totalKg + taraA + taraB + lidAW + lidBW + cartonW

  // ── Verkaufspreisberechnung ────────────────────────────────
  const baseCost = costSelf + shippingCost

  const calcNetPrice = (margin: number) => {
    const mf = margin / 100
    if (mf >= 1) return baseCost * 2
    return baseCost / (1 - mf)
  }

  const netSuggested  = calcNetPrice(targetMargin)
  const netPrice      = useCustomPrice ? customPrice : netSuggested
  const platformFee   = netPrice * (platformFeeP/100) + platformFeeF
  const paymentFee    = netPrice * (paymentFeeP/100)
  const grossPrice    = netPrice * (1 + vatRate/100)
  const netAfterFees  = netPrice - platformFee - paymentFee
  const marginAbs     = netAfterFees - baseCost
  const marginPct     = netAfterFees > 0 ? (marginAbs / netAfterFees) * 100 : 0
  const db            = netAfterFees - costSelf // Deckungsbeitrag

  const hasData = costSelf > 0

  return (
    <div>
      <div className="page-header mb-6">
        <div>
          <h2 className="page-title">Margenkalkulation</h2>
          <p className="page-subtitle">Selbstkosten · Preisfindung · Deckungsbeitrag</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── Linke Spalte: Schritte ── */}
        <div className="col-span-7 space-y-3">

          {/* Schritt 1: Produkt */}
          <Step n={1} title="Produkt & Variante" icon={<Package size={14}/>}
            done={!!productId && !!variantId} active={step===0} onClick={()=>setStep(step===0?-1:0)}>
            <div className="space-y-3 mt-3">
              <Select label="Produkt auswählen *"
                value={productId||''} onChange={e=>{setProductId(Number(e.target.value)||null);setVariantId(null)}}>
                <option value="">– Produkt wählen –</option>
                {(products2k as any[]).length > 0
                  ? (products2k as any[]).map((p:any)=><option key={p.id} value={p.id}>{p.name} (2K)</option>)
                  : (products as any[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)
                }
              </Select>

              {selectedProduct && (
                <>
                  {/* Mischungsverhältnis anzeigen */}
                  <div className="p-3 rounded-xl flex items-center gap-4"
                    style={{background:'rgb(139 92 246/0.06)',border:'1px solid rgb(139 92 246/0.15)'}}>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase">Mischung</p>
                      <p className="text-lg font-black text-white">
                        {mixA}:{mixB}
                      </p>
                      <p className="text-[10px] text-brand-400">{(mixA/mixB).toFixed(2).replace(/\.?0+$/,'')}:1</p>
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg" style={{background:'rgb(139 92 246/0.1)'}}>
                        <p className="text-[10px] text-slate-500">Komponente A</p>
                        <p className="text-sm font-bold text-brand-400">{selectedProduct.component_a_name||'–'}</p>
                        <p className="text-[10px] text-slate-500">{(ratioA*100).toFixed(1)}% des Gemisches</p>
                      </div>
                      <div className="p-2 rounded-lg" style={{background:'rgb(6 182 212/0.1)'}}>
                        <p className="text-[10px] text-slate-500">Komponente B</p>
                        <p className="text-sm font-bold text-cyan-400">{selectedProduct.component_b_name||'–'}</p>
                        <p className="text-[10px] text-slate-500">{(ratioB*100).toFixed(1)}% des Gemisches</p>
                      </div>
                    </div>
                  </div>

                  {/* Variante */}
                  <Select label="Variante (Füllmenge) *"
                    value={variantId||''} onChange={e=>setVariantId(Number(e.target.value)||null)}>
                    <option value="">– Variante wählen –</option>
                    {(selectedProduct.variants||[]).map((v:any)=>(
                      <option key={v.id} value={v.id}>
                        {v.name} – {v.total_fill_kg || v.fill_quantity} kg
                        (A: {((v.total_fill_kg||v.fill_quantity||0)*ratioA).toFixed(3)} kg |
                         B: {((v.total_fill_kg||v.fill_quantity||0)*ratioB).toFixed(3)} kg)
                      </option>
                    ))}
                    {/* Fallback wenn keine Varianten */}
                    {(!selectedProduct.variants?.length) && (
                      <option value={selectedProduct.id}>
                        Standard – {selectedProduct.batch_size}g
                      </option>
                    )}
                  </Select>

                  {variantId && totalKg > 0 && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        {l:'Gesamtmenge',v:`${totalKg} kg`,c:'text-white'},
                        {l:'Komponente A',v:`${kgA.toFixed(3)} kg`,c:'text-brand-400'},
                        {l:'Komponente B',v:`${kgB.toFixed(3)} kg`,c:'text-cyan-400'},
                      ].map(r=>(
                        <div key={r.l} className="p-2 rounded-xl text-center"
                          style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                          <p className="text-slate-500 text-[10px]">{r.l}</p>
                          <p className={`font-black text-base ${r.c}`}>{r.v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {variantId && <button onClick={()=>setStep(1)} className="w-full py-2 rounded-xl text-xs font-semibold text-white mt-2"
                style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                Weiter: Rohstoffpreise <ArrowRight size={12} className="inline ml-1"/>
              </button>}
            </div>
          </Step>

          {/* Schritt 2: Rohstoffpreise */}
          <Step n={2} title="Rohstoffpreise (Komponenten)" icon={<FlaskConical size={14}/>}
            done={compAPriceKg > 0} active={step===1} onClick={()=>setStep(step===1?-1:1)}>
            <div className="space-y-3 mt-3">
              <p className="text-xs text-slate-500">
                Preis/kg für jede Komponente eingeben oder aus Rezeptur übernehmen.
              </p>

              {/* Komponente A */}
              <div className="p-3 rounded-xl space-y-2"
                style={{background:'rgb(139 92 246/0.06)',border:'1px solid rgb(139 92 246/0.2)'}}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-400">
                    Komponente A — {selectedProduct?.component_a_name||'unbekannt'}
                  </p>
                  <span className="text-[10px] text-slate-500">{kgA.toFixed(3)} kg benötigt</span>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Preis / kg (€ netto)</label>
                    <input type="number" step="0.001" value={compAPriceKg||''}
                      onChange={e=>setCompAPriceKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none"
                      placeholder="0,0000"/>
                  </div>
                  <div className="text-right pb-2">
                    <p className="text-[10px] text-slate-500">Kosten Komp. A</p>
                    <p className="text-sm font-bold text-brand-400">{fEur(costA)}</p>
                  </div>
                </div>
              </div>

              {/* Komponente B */}
              <div className="p-3 rounded-xl space-y-2"
                style={{background:'rgb(6 182 212/0.06)',border:'1px solid rgb(6 182 212/0.2)'}}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-cyan-400">
                    Komponente B — {selectedProduct?.component_b_name||'unbekannt'}
                  </p>
                  <span className="text-[10px] text-slate-500">{kgB.toFixed(3)} kg benötigt</span>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Preis / kg (€ netto)</label>
                    <input type="number" step="0.001" value={compBPriceKg||''}
                      onChange={e=>setCompBPriceKg(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 focus:border-brand-500/50 outline-none"
                      placeholder="0,0000"/>
                  </div>
                  <div className="text-right pb-2">
                    <p className="text-[10px] text-slate-500">Kosten Komp. B</p>
                    <p className="text-sm font-bold text-cyan-400">{fEur(costB)}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-2 rounded-xl"
                style={{background:'rgba(255,255,255,0.03)'}}>
                <span className="text-xs text-slate-400">Füllkosten gesamt</span>
                <span className="text-sm font-bold text-white font-mono">{fEur(costFilling)}</span>
              </div>

              <button onClick={()=>setStep(2)} className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                Weiter: Gebinde & Verpackung <ArrowRight size={12} className="inline ml-1"/>
              </button>
            </div>
          </Step>

          {/* Schritt 3: Gebinde */}
          <Step n={3} title="Gebinde · Deckel · Etikett · Karton" icon={<Layers size={14}/>}
            done={!!packAId} active={step===2} onClick={()=>setStep(step===2?-1:2)}>
            <div className="space-y-4 mt-3">

              {/* Flasche A */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1.5">Gebinde Komp. A</p>
                  <select value={packAId||''} onChange={e=>setPackAId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(packaging as any[]).map((p:any)=>(
                      <option key={p.id} value={p.id}>{p.name} – {fEur(p.price_per_unit||0)}</option>
                    ))}
                  </select>
                  {packA && <p className="text-[10px] text-slate-500 mt-1">Tara: {packA.tare_weight_g||packA.weight_g||0} g · Art.-Nr.: {packA.article_number||'–'}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-400 uppercase tracking-wider mb-1.5">Deckel Komp. A</p>
                  <select value={lidAId||''} onChange={e=>setLidAId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(lids as any[]).map((l:any)=>(
                      <option key={l.id} value={l.id}>{l.name} – {fEur(l.price_per_unit||0)}</option>
                    ))}
                  </select>
                  {lidA && <p className="text-[10px] text-slate-500 mt-1">Gewicht: {lidA.weight_g||0} g · Art.-Nr.: {lidA.article_number||'–'}</p>}
                </div>
              </div>

              {/* Flasche B */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">Gebinde Komp. B</p>
                  <select value={packBId||''} onChange={e=>setPackBId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(packaging as any[]).map((p:any)=>(
                      <option key={p.id} value={p.id}>{p.name} – {fEur(p.price_per_unit||0)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1.5">Deckel Komp. B</p>
                  <select value={lidBId||''} onChange={e=>setLidBId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(lids as any[]).map((l:any)=>(
                      <option key={l.id} value={l.id}>{l.name} – {fEur(l.price_per_unit||0)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Etikett + Karton */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Etikett</p>
                  <select value={labelAId||''} onChange={e=>setLabelAId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(labels as any[]).map((l:any)=>(
                      <option key={l.id} value={l.id}>{l.name} – {fEur(l.price_per_unit||l.price_per_1000/1000||0)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Karton</p>
                  <select value={cartonId||''} onChange={e=>setCartonId(Number(e.target.value)||null)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value="">– kein –</option>
                    {(cartons as any[]).map((c:any)=>(
                      <option key={c.id} value={c.id}>{c.name} – {fEur(c.price_per_unit||0)}</option>
                    ))}
                  </select>
                  {cartonId && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-slate-500">Sets/Karton:</span>
                      <input type="number" min="1" value={unitsPerCarton}
                        onChange={e=>setUnitsPerCarton(Math.max(1,Number(e.target.value)))}
                        className="w-16 px-2 py-1 rounded-lg text-xs text-white bg-white/5 border border-white/10 outline-none"/>
                      <span className="text-[10px] text-slate-500">= {fEur(costCarton)}/Set</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verpackungskosten Zusammenfassung */}
              <div className="p-3 rounded-xl space-y-1"
                style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)'}}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Verpackungskosten</p>
                {costPackA>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Flasche A</span><span className="text-slate-300 font-mono">{fEur(costPackA)}</span></div>}
                {costLidA>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Deckel A</span><span className="text-slate-300 font-mono">{fEur(costLidA)}</span></div>}
                {costPackB>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Flasche B</span><span className="text-slate-300 font-mono">{fEur(costPackB)}</span></div>}
                {costLidB>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Deckel B</span><span className="text-slate-300 font-mono">{fEur(costLidB)}</span></div>}
                {costLabel>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Etikett</span><span className="text-slate-300 font-mono">{fEur(costLabel)}</span></div>}
                {costCarton>0&&<div className="flex justify-between text-xs"><span className="text-slate-500">Karton (anteilig)</span><span className="text-slate-300 font-mono">{fEur(costCarton)}</span></div>}
                <div className="flex justify-between text-xs font-bold border-t border-white/8 pt-1 mt-1">
                  <span className="text-slate-300">Gesamt Verpackung</span>
                  <span className="text-white font-mono">{fEur(costPackaging)}</span>
                </div>
              </div>

              <div className="p-2 rounded-xl flex items-center justify-between"
                style={{background:'rgba(255,255,255,0.02)'}}>
                <span className="text-xs text-slate-400">Bruttogewicht (geschätzt)</span>
                <span className="text-sm font-bold text-slate-200 font-mono">{bruttoKg.toFixed(3)} kg</span>
              </div>

              <button onClick={()=>setStep(3)} className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                Weiter: Versandkosten <ArrowRight size={12} className="inline ml-1"/>
              </button>
            </div>
          </Step>

          {/* Schritt 4: Versand */}
          <Step n={4} title="Versandkosten" icon={<Truck size={14}/>}
            done={shippingCost > 0} active={step===3} onClick={()=>setStep(step===3?-1:3)}>
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Zielland</label>
                  <select value={country} onChange={e=>setCountry(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Versandgewicht (kg)</label>
                  <input type="number" step="0.01" value={weightKg||bruttoKg.toFixed(3)}
                    onChange={e=>setWeightKg(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white font-mono bg-white/5 border border-white/10 outline-none"/>
                  <p className="text-[10px] text-slate-600 mt-0.5">Brutto: ~{bruttoKg.toFixed(3)} kg</p>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Versandkosten (€)</label>
                <input type="number" step="0.01" value={shippingCost||''}
                  onChange={e=>setShippingCost(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none"
                  placeholder="0,00"/>
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Versandprofile mit Staffeln werden in Phase 2 vollständig implementiert
                </p>
              </div>
              <button onClick={()=>setStep(4)} className="w-full py-2 rounded-xl text-xs font-semibold text-white"
                style={{background:'rgb(139 92 246/0.2)',border:'1px solid rgb(139 92 246/0.3)'}}>
                Weiter: Plattform & Marge <ArrowRight size={12} className="inline ml-1"/>
              </button>
            </div>
          </Step>

          {/* Schritt 5: Plattform & Marge */}
          <Step n={5} title="Plattform · Zahlung · Zielmarge" icon={<TrendingUp size={14}/>}
            done={false} active={step===4} onClick={()=>setStep(step===4?-1:4)}>
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Plattformgebühr %</label>
                  <input type="number" step="0.1" value={platformFeeP||''} onChange={e=>setPlatformFeeP(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none" placeholder="0"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Plattformgebühr fix (€)</label>
                  <input type="number" step="0.01" value={platformFeeF||''} onChange={e=>setPlatformFeeF(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none" placeholder="0,00"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Zahlungsgebühr %</label>
                  <input type="number" step="0.1" value={paymentFeeP||''} onChange={e=>setPaymentFeeP(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none" placeholder="0"/>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">MwSt. %</label>
                  <select value={vatRate} onChange={e=>setVatRate(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none">
                    <option value={19}>19% (DE Standard)</option>
                    <option value={7}>7% (DE ermäßigt)</option>
                    <option value={0}>0% (Export/B2B)</option>
                    <option value={20}>20% (AT)</option>
                    <option value={23}>23% (PL)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl" style={{background:'rgb(139 92 246/0.06)',border:'1px solid rgb(139 92 246/0.2)'}}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-brand-400">Zielmarge</p>
                  <span className="text-lg font-black text-white">{targetMargin}%</span>
                </div>
                <input type="range" min={0} max={80} step={1} value={targetMargin}
                  onChange={e=>setTargetMargin(Number(e.target.value))}
                  className="w-full accent-purple-500"/>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span>
                </div>
                {hasData && <p className="text-xs text-brand-400 mt-2 text-center">
                  Vorgeschlagener Netto-VK: <strong className="text-white">{fEur(netSuggested)}</strong>
                </p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-500">Eigener VK-Preis (netto)</label>
                  <button onClick={()=>setUseCustomPrice(v=>!v)}
                    className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${useCustomPrice?'bg-brand-500/20 text-brand-400':'bg-white/5 text-slate-500'}`}>
                    {useCustomPrice?'✓ Manuell':'Automatisch'}
                  </button>
                </div>
                <input type="number" step="0.01" value={customPrice||''} onChange={e=>setCustomPrice(Number(e.target.value))}
                  disabled={!useCustomPrice}
                  className="w-full px-3 py-2 rounded-xl text-sm text-white font-mono bg-white/5 border border-white/10 outline-none disabled:opacity-40"
                  placeholder={fEur(netSuggested)}/>
              </div>
            </div>
          </Step>
        </div>

        {/* ── Rechte Spalte: Ergebnis ── */}
        <div className="col-span-5 space-y-4">
          <div className="glass-card p-5 sticky top-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Kalkulationsergebnis
            </p>

            {!hasData ? (
              <div className="text-center py-8">
                <Calculator size={32} className="text-slate-700 mx-auto mb-3"/>
                <p className="text-slate-500 text-sm">Fülle die Schritte aus</p>
                <p className="text-slate-600 text-xs mt-1">Produkt → Preise → Gebinde → Versand</p>
              </div>
            ) : (
              <div className="space-y-1">
                <CostRow label="Komponente A" value={costA} sub={`${kgA.toFixed(3)} kg × ${f4(compAPriceKg)} €`} color="#a78bfa"/>
                <CostRow label="Komponente B" value={costB} sub={`${kgB.toFixed(3)} kg × ${f4(compBPriceKg)} €`} color="#22d3ee"/>
                <CostRow label="Füllkosten" value={costFilling} bold/>

                {costPackaging > 0 && <>
                  <div className="pt-2"/>
                  {costPackA>0&&<CostRow label="Flasche A"      value={costPackA}/>}
                  {costLidA>0&&<CostRow  label="Deckel A"       value={costLidA}/>}
                  {costPackB>0&&<CostRow label="Flasche B"      value={costPackB}/>}
                  {costLidB>0&&<CostRow  label="Deckel B"       value={costLidB}/>}
                  {costLabel>0&&<CostRow label="Etikett"        value={costLabel}/>}
                  {costCarton>0&&<CostRow label="Karton (ant.)" value={costCarton}/>}
                  <CostRow label="Verpackung gesamt" value={costPackaging} bold/>
                </>}

                <div className="my-2 border-t border-white/8"/>
                <CostRow label="🏭 Selbstkosten" value={costSelf} bold color="#f59e0b"/>

                {shippingCost > 0 && <CostRow label="📦 Versand" value={shippingCost} color="#10b981"/>}
                <CostRow label="Basis (SK + Versand)" value={baseCost} bold/>

                <div className="my-2 border-t border-white/8"/>
                <CostRow label="Netto VK" value={netPrice} bold color="#8b5cf6"/>
                <CostRow label={`MwSt. ${vatRate}%`} value={grossPrice - netPrice}/>
                <CostRow label="Brutto VK" value={grossPrice} bold color="#a78bfa"/>

                {(platformFee > 0 || paymentFee > 0) && <>
                  <div className="my-2 border-t border-white/8"/>
                  {platformFee>0&&<CostRow label="Plattformgebühr" value={-platformFee} color="#ef4444"/>}
                  {paymentFee>0&&<CostRow  label="Zahlungsgebühr"  value={-paymentFee}  color="#ef4444"/>}
                  <CostRow label="Netto nach Gebühren" value={netAfterFees} bold/>
                </>}

                <div className="mt-4 p-3 rounded-xl" style={{
                  background: marginPct >= 20 ? 'rgb(16 185 129/0.1)' : marginPct >= 10 ? 'rgb(245 158 11/0.1)' : 'rgb(239 68 68/0.1)',
                  border: `1px solid ${marginPct >= 20 ? 'rgb(16 185 129/0.3)' : marginPct >= 10 ? 'rgb(245 158 11/0.3)' : 'rgb(239 68 68/0.3)'}`,
                }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Marge</p>
                      <p className="text-3xl font-black" style={{color: marginPct>=20?'#10b981':marginPct>=10?'#f59e0b':'#ef4444'}}>
                        {fPct(marginPct)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Marge absolut</p>
                      <p className="text-lg font-bold text-white">{fEur(marginAbs)}</p>
                      <p className="text-[10px] text-slate-500">DB: {fEur(db)}</p>
                    </div>
                  </div>
                  {marginPct < 10 && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                      <AlertTriangle size={11}/>Marge zu niedrig — Preis prüfen
                    </div>
                  )}
                </div>

                {/* Bruttogewicht */}
                <div className="mt-2 p-2 rounded-xl flex items-center justify-between text-xs"
                  style={{background:'rgba(255,255,255,0.02)'}}>
                  <span className="text-slate-500">Bruttogewicht</span>
                  <span className="text-slate-300 font-mono">{bruttoKg.toFixed(3)} kg</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
