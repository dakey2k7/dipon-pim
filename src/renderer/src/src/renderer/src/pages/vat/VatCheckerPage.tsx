import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, RefreshCw, CheckCircle, XCircle, Clock,
  Building, ChevronRight, Layers, ArrowUpDown,
  CheckSquare, Square, RotateCcw, History, ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import { Button }     from '@/components/ui/Input'
import { Input }      from '@/components/ui/Input'
import { Spinner, Card } from '@/components/ui/Badge'
import { Modal }      from '@/components/ui/Modal'
import { FlagIcon }   from '@/components/ui/FlagImg'
import { useToast }   from '@/hooks/useToast'

interface VatEntry {
  id:number; vat_id:string; country_code:string; company_name:string|null
  address:string|null; is_valid:number; status_code:string|null
  message:string; checked_at:string; source:string; raw_response:string|null
}
interface KnownId { tax_id:string; name:string }

const fmtDT=(dt:string)=>{
  try{return new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(dt))}
  catch{return dt}
}

function ValidBadge({valid}:{valid:number}) {
  return valid
    ?<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{background:'rgb(16 185 129/0.15)',color:'#10b981',border:'1px solid rgb(16 185 129/0.25)'}}><CheckCircle size={11}/>Gültig</span>
    :<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{background:'rgb(239 68 68/0.15)',color:'#ef4444',border:'1px solid rgb(239 68 68/0.25)'}}><XCircle size={11}/>Ungültig</span>
}

function DetailModal({entry, onClose}:{entry:VatEntry; onClose:()=>void}) {
  return(
    <Modal open onClose={onClose} title="USt-ID Details" size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl"
          style={{background:entry.is_valid?'rgb(16 185 129/0.08)':'rgb(239 68 68/0.08)',border:`1px solid ${entry.is_valid?'rgb(16 185 129/0.3)':'rgb(239 68 68/0.3)'}`}}>
          <FlagIcon code={entry.country_code} size="lg"/>
          <div>
            <p className="text-2xl font-black text-white font-mono">{entry.vat_id}</p>
            <ValidBadge valid={entry.is_valid}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            {l:'Firmenname',  v:entry.company_name},
            {l:'Adresse',     v:entry.address},
            {l:'Nachricht',   v:entry.message},
            {l:'Statuscode',  v:entry.status_code},
            {l:'Quelle',      v:entry.source},
            {l:'Geprüft am',  v:fmtDT(entry.checked_at)},
          ].map(f=>(
            <div key={f.l} className="p-3 rounded-xl" style={{background:'rgb(255 255 255/0.03)',border:'1px solid rgb(255 255 255/0.06)'}}>
              <p className="text-xs text-slate-500 mb-0.5">{f.l}</p>
              <p className="text-slate-200 font-medium text-sm">{f.v||'–'}</p>
            </div>
          ))}
        </div>
        {entry.raw_response&&(
          <details className="text-xs">
            <summary className="text-slate-500 cursor-pointer hover:text-slate-300">Rohantwort</summary>
            <pre className="mt-2 p-3 rounded-xl overflow-auto text-[10px] text-slate-400" style={{background:'rgb(0 0 0/0.3)',maxHeight:160}}>
              {entry.raw_response}
            </pre>
          </details>
        )}
      </div>
    </Modal>
  )
}

const SORT_OPTIONS = [
  {v:'date_desc', l:'Datum (neueste zuerst)'},
  {v:'date_asc',  l:'Datum (älteste zuerst)'},
  {v:'country_az',l:'Land A–Z'},
  {v:'country_za',l:'Land Z–A'},
  {v:'id_az',     l:'USt-ID A–Z'},
  {v:'id_za',     l:'USt-ID Z–A'},
  {v:'valid',     l:'Gültige zuerst'},
  {v:'invalid',   l:'Ungültige zuerst'},
]

export default function VatCheckerPage() {
  const qc=useQueryClient(); const toast=useToast()

  // Prüf-Inputs
  const [vatInput,setVatInput]   = useState('')
  const [ownVatId,setOwnVatId]   = useState('')
  const [bulkInput,setBulkInput] = useState('')
  const [showBulk,setShowBulk]   = useState(false)

  // Log-Filter + Sort
  const [search,  setSearch]   = useState('')
  const [filter,  setFilter]   = useState<'all'|'valid'|'invalid'>('all')
  const [sortBy,  setSortBy]   = useState('date_desc')

  // Selektion für Neu-Prüfung
  const [selected,    setSelected]    = useState<Set<number>>(new Set())
  const [detailEntry, setDetailEntry] = useState<VatEntry|null>(null)
  const [checkResult, setCheckResult] = useState<Record<string,unknown>|null>(null)

  const {data:log=[],isLoading} = useQuery<VatEntry[]>({
    queryKey:['vat-log'],
    queryFn: ()=>window.api.vat.getLog(1000) as Promise<VatEntry[]>,
    staleTime:5_000,
  })
  const {data:knownIds=[]} = useQuery<KnownId[]>({
    queryKey:['vat-known'],
    queryFn: ()=>window.api.vat.getKnownIds() as Promise<KnownId[]>,
  })
  const invLog=()=>{ qc.invalidateQueries({queryKey:['vat-log']}); qc.invalidateQueries({queryKey:['audit-count']}) }

  const checkMut = useMutation({
    mutationFn:({id,own}:{id:string;own?:string})=>window.api.vat.check(id,own) as Promise<Record<string,unknown>>,
    onSuccess:(r)=>{setCheckResult(r);invLog();r.is_valid?toast.success('✅ Gültig',String(r.message)):toast.error('❌ Ungültig',String(r.message))},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })
  const recheckMut = useMutation({
    mutationFn:(ids:string[])=>window.api.vat.recheck(ids) as Promise<unknown[]>,
    onSuccess:(rs)=>{invLog();setSelected(new Set());const ok=(rs as Array<{is_valid:boolean}>).filter(r=>r.is_valid).length;toast.success(`Abgeschlossen: ${ok}/${rs.length} gültig`)},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })
  const bulkMut = useMutation({
    mutationFn:(ids:string[])=>window.api.vat.recheck(ids) as Promise<unknown[]>,
    onSuccess:(rs)=>{invLog();setShowBulk(false);setBulkInput('');const ok=(rs as Array<{is_valid:boolean}>).filter(r=>r.is_valid).length;toast.success(`${ok}/${rs.length} gültig`)},
    onError:(e:Error)=>toast.error('Fehler',e.message),
  })

  // Gefiltert + sortiert
  const displayLog = useMemo(()=>{
    let rows = log.filter(e=>{
      const matchFilter = filter==='valid'?e.is_valid===1:filter==='invalid'?e.is_valid===0:true
      const q = search.toLowerCase()
      const matchSearch = !q || e.vat_id.toLowerCase().includes(q) ||
        (e.company_name?.toLowerCase().includes(q)??false) ||
        e.country_code.toLowerCase().includes(q)
      return matchFilter && matchSearch
    })
    switch(sortBy){
      case 'date_asc':   rows=[...rows].sort((a,b)=>a.checked_at.localeCompare(b.checked_at)); break
      case 'date_desc':  rows=[...rows].sort((a,b)=>b.checked_at.localeCompare(a.checked_at)); break
      case 'country_az': rows=[...rows].sort((a,b)=>a.country_code.localeCompare(b.country_code)); break
      case 'country_za': rows=[...rows].sort((a,b)=>b.country_code.localeCompare(a.country_code)); break
      case 'id_az':      rows=[...rows].sort((a,b)=>a.vat_id.localeCompare(b.vat_id)); break
      case 'id_za':      rows=[...rows].sort((a,b)=>b.vat_id.localeCompare(a.vat_id)); break
      case 'valid':      rows=[...rows].sort((a,b)=>b.is_valid-a.is_valid); break
      case 'invalid':    rows=[...rows].sort((a,b)=>a.is_valid-b.is_valid); break
    }
    return rows
  },[log,filter,search,sortBy])

  const toggleSelect=(id:number)=>{
    setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  }
  const selectAll=()=>setSelected(new Set(displayLog.map(e=>e.id)))
  const selectNone=()=>setSelected(new Set())
  const selectInvalid=()=>setSelected(new Set(displayLog.filter(e=>e.is_valid===0).map(e=>e.id)))

  const recheckSelected=()=>{
    const ids=displayLog.filter(e=>selected.has(e.id)).map(e=>e.vat_id)
    if(!ids.length){toast.error('Keine Einträge ausgewählt');return}
    recheckMut.mutate(ids)
  }

  const bulkIds=bulkInput.split('\n').map(l=>l.trim().toUpperCase()).filter(l=>l.length>3)


  // Gruppierung nach USt-ID
  const groupedLog = useMemo(()=>{
    const map = new Map<string, VatEntry[]>()
    for (const e of displayLog) {
      const existing = map.get(e.vat_id) ?? []
      map.set(e.vat_id, [...existing, e])
    }
    // Sortiere innerhalb Gruppe: neueste zuerst
    for (const [k,v] of map) map.set(k, v.sort((a,b)=>b.checked_at.localeCompare(a.checked_at)))
    return map
  },[displayLog])

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpand = (vatId: string) => setExpandedIds(s => {
    const n = new Set(s); n.has(vatId) ? n.delete(vatId) : n.add(vatId); return n
  })

  return(
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">USt-ID Prüfung</h2>
          <p className="page-subtitle">BZSt EVATR · EU VIES · Permanenter Log</p>
        </div>
        <Button variant="secondary" icon={<Layers size={14}/>} onClick={()=>setShowBulk(true)}>
          Massen-Prüfung
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[{l:'Prüfungen gesamt',val:log.length,c:'#8b5cf6'},
          {l:'Gültige IDs',    val:log.filter(e=>e.is_valid===1).length,c:'#10b981'},
          {l:'Ungültig/Fehler',val:log.filter(e=>e.is_valid===0).length,c:'#ef4444'},
        ].map(k=>(
          <div key={k.l} className="glass-card p-4">
            <p className="text-xs text-slate-500 mb-1">{k.l}</p>
            <p className="text-3xl font-black" style={{color:k.c}}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Einzelprüfung */}
      <Card>
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Search size={14} className="text-brand-400"/>USt-ID prüfen
        </h3>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{flex:'1 1 200px'}}>
            <label className="form-label">USt-ID *</label>
            <input className="form-input w-full" placeholder="DE123456789 / FR12345678901"
              value={vatInput} onChange={e=>setVatInput(e.target.value.toUpperCase())}
              onKeyDown={e=>{if(e.key==='Enter'&&vatInput.length>=4)checkMut.mutate({id:vatInput,own:ownVatId||undefined})}}/>
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label className="form-label">Eigene USt-ID (BZSt DE, optional)</label>
            <input className="form-input w-full" placeholder="DE… (für DE-zu-DE Prüfung)"
              value={ownVatId} onChange={e=>setOwnVatId(e.target.value.toUpperCase())}/>
          </div>
          <Button className="shrink-0" icon={<Search size={14}/>}
            onClick={()=>checkMut.mutate({id:vatInput,own:ownVatId||undefined})}
            loading={checkMut.isPending} disabled={vatInput.length<4}>
            Prüfen
          </Button>
        </div>

        {/* Schnellzugriff */}
        {knownIds.length>0&&(
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-slate-600 self-center shrink-0">Lieferanten:</span>
            {knownIds.map(k=>(
              <button key={k.tax_id} onClick={()=>setVatInput(k.tax_id)}
                className="text-xs px-2 py-1 rounded-lg transition-all hover:border-brand-500/30"
                style={{background:'rgb(255 255 255/0.04)',border:'1px solid rgb(255 255 255/0.08)'}}>
                <span className="text-slate-500">{k.name}:</span>
                <span className="text-brand-400 ml-1 font-mono text-[11px]">{k.tax_id}</span>
              </button>
            ))}
          </div>
        )}

        {/* Aktuelles Ergebnis */}
        {checkResult&&(
          <div className="mt-4 p-4 rounded-xl"
            style={{background:checkResult.is_valid?'rgb(16 185 129/0.08)':'rgb(239 68 68/0.08)',border:`1px solid ${checkResult.is_valid?'rgb(16 185 129/0.25)':'rgb(239 68 68/0.25)'}`}}>
            <div className="flex items-start gap-3">
              {checkResult.is_valid?<CheckCircle size={20} className="text-emerald-400 shrink-0"/>:<XCircle size={20} className="text-red-400 shrink-0"/>}
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-white">{String(checkResult.vat_id)}</p>
                <p className={`text-sm mt-0.5 ${checkResult.is_valid?'text-emerald-400':'text-red-400'}`}>{String(checkResult.message)}</p>
                {checkResult.name&&(
                  <div className="mt-2 p-2 rounded-lg text-xs space-y-0.5" style={{background:'rgb(255 255 255/0.04)'}}>
                    <p className="flex items-center gap-1.5"><Building size={11} className="text-slate-500"/><span className="text-slate-200 font-semibold">{String(checkResult.name)}</span></p>
                    {checkResult.address&&<p className="text-slate-500 pl-5">{String(checkResult.address)}</p>}
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                  <Clock size={10}/>{fmtDT(String(checkResult.checked_at))} · {String(checkResult.source)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Log-Bereich */}
      <div>
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Suche */}
          <div className="relative flex-1 min-w-40">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input className="form-input pl-8 w-full text-sm" placeholder="USt-ID, Firma, Land …"
              value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>

          {/* Filter */}
          <div className="flex rounded-xl overflow-hidden shrink-0" style={{border:'1px solid rgb(255 255 255/0.08)'}}>
            {(['all','valid','invalid'] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter===f?'bg-brand-500/20 text-white':'text-slate-500 hover:text-slate-300'}`}>
                {f==='all'?'Alle':f==='valid'?'✅ Gültig':'❌ Ungültig'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select className="form-input text-xs shrink-0 w-44"
            value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            {SORT_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>

          {/* Anzeige-Count */}
          <span className="text-xs text-slate-500 shrink-0">
            {displayLog.length} von {log.length}
          </span>
        </div>

        {/* Auswahl-Toolbar */}
        {displayLog.length>0&&(
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-xs text-slate-500">Auswählen:</span>
            <button onClick={selectAll}   className="text-xs text-brand-400 hover:text-brand-300">Alle</button>
            <button onClick={selectNone}  className="text-xs text-slate-500 hover:text-slate-300">Keine</button>
            <button onClick={selectInvalid} className="text-xs text-red-400 hover:text-red-300">Ungültige</button>
            {selected.size>0&&(
              <>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-400">{selected.size} ausgewählt</span>
                <Button size="sm" icon={<RotateCcw size={11}/>}
                  loading={recheckMut.isPending}
                  onClick={recheckSelected}>
                  Ausgewählte prüfen
                </Button>
              </>
            )}
          </div>
        )}

        {/* Tabelle */}
        {isLoading?<Spinner size={24}/>:(
          <div className="glass-card overflow-hidden">
            {!displayLog.length
              ?<div className="p-8 text-center text-slate-600 text-sm">
                {search?`Keine Ergebnisse für „${search}"`:'Noch keine Prüfungen'}
              </div>
              :<table className="w-full">
                <thead style={{borderBottom:'1px solid rgb(255 255 255/0.05)'}}><tr>
                  <th className="table-th w-8"/>
                  <th className="table-th">USt-ID</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Firma</th>
                  <th className="table-th hidden lg:table-cell">Adresse</th>
                  <th className="table-th hidden md:table-cell">Quelle</th>
                  <th className="table-th">Datum</th>
                  <th className="table-th text-right w-8"/>
                </tr></thead>
                <tbody>
                  {[...groupedLog.entries()].map(([vatId, entries])=>{
                    const latest = entries[0]
                    const count  = entries.length
                    const isExpanded = expandedIds.has(vatId)
                    const isChecked  = selected.has(latest.id)
                    return(
                      <>
                        {/* Haupt-Zeile */}
                        <tr key={vatId} className={`table-row group cursor-pointer ${isChecked?'bg-brand-500/8':''}`}>
                          <td className="table-td" onClick={()=>toggleSelect(latest.id)}>
                            {isChecked?<CheckSquare size={15} className="text-brand-400"/>
                            :<Square size={15} className="text-slate-700 group-hover:text-slate-500"/>}
                          </td>
                          <td className="table-td" onClick={()=>setDetailEntry(latest)}>
                            <div className="flex items-center gap-2">
                              <FlagIcon code={latest.country_code} size="sm"/>
                              <span className="font-mono font-semibold text-slate-200 text-sm">{vatId}</span>
                              {count > 1 && (
                                <button onClick={e=>{e.stopPropagation();toggleExpand(vatId)}}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold transition-all hover:scale-105"
                                  style={{background:'rgb(139 92 246/0.2)',color:'#a78bfa',border:'1px solid rgb(139 92 246/0.3)'}}>
                                  <History size={9}/>
                                  {count}×
                                  <ChevronDownIcon size={9} className={`transition-transform ${isExpanded?'rotate-180':''}`}/>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="table-td" onClick={()=>setDetailEntry(latest)}><ValidBadge valid={latest.is_valid}/></td>
                          <td className="table-td" onClick={()=>setDetailEntry(latest)}>
                            <p className="text-xs font-semibold text-slate-300 max-w-32 truncate">{latest.company_name||'–'}</p>
                            <p className="text-[10px] text-slate-600 max-w-32 truncate">{latest.message}</p>
                          </td>
                          <td className="table-td hidden lg:table-cell text-slate-500 text-xs max-w-36 truncate" onClick={()=>setDetailEntry(latest)}>{latest.address||'–'}</td>
                          <td className="table-td hidden md:table-cell" onClick={()=>setDetailEntry(latest)}>
                            <span className="badge-slate text-xs">{latest.source}</span>
                          </td>
                          <td className="table-td text-slate-500 text-xs" onClick={()=>setDetailEntry(latest)}>{fmtDT(latest.checked_at)}</td>
                          <td className="table-td text-right">
                            <ChevronRight size={13} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                          </td>
                        </tr>
                        {/* History-Zeilen (aufgeklappt) */}
                        {isExpanded && count > 1 && entries.slice(1).map((e,hi)=>(
                          <tr key={e.id} className="cursor-pointer"
                            style={{background:'rgb(139 92 246/0.04)',borderBottom:'1px solid rgb(255 255 255/0.03)'}}
                            onClick={()=>setDetailEntry(e)}>
                            <td className="table-td pl-8">
                              <div className="w-px h-4 ml-2 bg-brand-500/30"/>
                            </td>
                            <td className="table-td pl-6">
                              <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                <div className="w-2.5 h-px bg-slate-700"/>
                                <span className="font-mono text-slate-600">#{hi+2}</span>
                              </div>
                            </td>
                            <td className="table-td"><ValidBadge valid={e.is_valid}/></td>
                            <td className="table-td">
                              <p className="text-xs text-slate-500 max-w-32 truncate">{e.message}</p>
                            </td>
                            <td className="table-td hidden lg:table-cell text-slate-600 text-xs">{e.address||'–'}</td>
                            <td className="table-td hidden md:table-cell">
                              <span className="badge-slate text-[10px]">{e.source}</span>
                            </td>
                            <td className="table-td text-slate-600 text-xs">{fmtDT(e.checked_at)}</td>
                            <td className="table-td text-right">
                              <ChevronRight size={11} className="text-slate-700"/>
                            </td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </tbody>
              </table>}
          </div>
        )}
      </div>

      {/* Detail-Modal */}
      {detailEntry&&<DetailModal entry={detailEntry} onClose={()=>setDetailEntry(null)}/>}

      {/* Massen-Prüfung Modal */}
      {showBulk&&(
        <Modal open onClose={()=>setShowBulk(false)} title="Massen-Prüfung" size="md">
          <div className="space-y-4">
            <div>
              <label className="form-label">USt-IDs – eine pro Zeile</label>
              <textarea className="form-input w-full font-mono text-sm" rows={10}
                placeholder={"DE123456789\nFR12345678901\nNL123456789B01\nAT U12345678\nGB 123456789"}
                value={bulkInput} onChange={e=>setBulkInput(e.target.value)}/>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span className="text-brand-400 font-semibold">{bulkIds.length}</span> IDs erkannt
                {bulkIds.length>10&&<span className="text-amber-400">· Große Mengen können länger dauern</span>}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={()=>{setShowBulk(false);setBulkInput('')}}>Abbrechen</Button>
              <Button loading={bulkMut.isPending} disabled={!bulkIds.length}
                icon={<Search size={14}/>}
                onClick={()=>bulkMut.mutate(bulkIds)}>
                {bulkIds.length} IDs prüfen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
